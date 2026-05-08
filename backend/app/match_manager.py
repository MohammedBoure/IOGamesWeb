from __future__ import annotations

import asyncio
import logging
import random
import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from starlette.websockets import WebSocket, WebSocketState

JsonDict = dict[str, Any]
logger = logging.getLogger("neon_aim.match_manager")


class ClientMessageError(Exception):
    def __init__(self, code: str, message: str) -> None:
        self.code = code
        self.message = message
        super().__init__(message)


@dataclass
class Player:
    id: str
    name: str
    websocket: WebSocket
    match_id: str | None = None
    ready: bool = False
    kills: int = 0
    deaths: int = 0
    alive: bool = True
    health: int = 5
    max_health: int = 5
    last_spawn_index: int | None = None
    state: JsonDict = field(default_factory=dict)
    connected_at: str = field(default_factory=lambda: utc_now())
    last_seen: str = field(default_factory=lambda: utc_now())


@dataclass
class Match:
    id: str
    host_id: str
    mode: str = "deathmatch"
    map_name: str = "aim_arena"
    max_players: int = 12
    status: str = "lobby"
    players: set[str] = field(default_factory=set)
    created_at: str = field(default_factory=lambda: utc_now())


class MatchManager:
    def __init__(self) -> None:
        self._players: dict[str, Player] = {}
        self._matches: dict[str, Match] = {}
        self._respawn_tasks: dict[str, asyncio.Task] = {}
        self._lock = asyncio.Lock()

    @property
    def player_count(self) -> int:
        return len(self._players)

    @property
    def match_count(self) -> int:
        return len(self._matches)

    async def connect(self, websocket: WebSocket, player_name: str, player_id: str | None) -> Player:
        await websocket.accept()
        clean_name = sanitize_name(player_name)

        async with self._lock:
            clean_id = sanitize_id(player_id) if player_id else short_id("player")
            if clean_id in self._players:
                clean_id = short_id("player")

            player = Player(id=clean_id, name=clean_name, websocket=websocket)
            self._players[player.id] = player
            lobby = self._public_matches_locked()
            player_count = len(self._players)
            match_count = len(self._matches)

        await self._safe_send(
            player.id,
            {
                "type": "connected",
                "player": self._public_player(player),
                "matches": lobby,
                "server_time": utc_now(),
            },
        )
        await self._broadcast_lobby()
        logger.info(
            "player connected id=%s name=%s players=%s matches=%s",
            player.id,
            player.name,
            player_count,
            match_count,
        )
        return player

    async def disconnect(self, player_id: str) -> None:
        async with self._lock:
            player = self._players.get(player_id)
            player_name = player.name if player else "unknown"
            old_match_id = player.match_id if player else None
            self._cancel_respawn_locked(player_id)
            events = self._leave_match_locked(player_id, reason="disconnect")
            self._players.pop(player_id, None)
            events.append((set(self._players), {"type": "lobby_matches", "matches": self._public_matches_locked()}))
            player_count = len(self._players)
            match_count = len(self._matches)

        await self._flush(events)
        logger.info(
            "player disconnected id=%s name=%s match=%s players=%s matches=%s",
            player_id,
            player_name,
            old_match_id or "-",
            player_count,
            match_count,
        )

    async def handle_message(self, player_id: str, payload: JsonDict) -> None:
        if not isinstance(payload, dict):
            raise ClientMessageError("invalid_payload", "WebSocket messages must be JSON objects.")

        message_type = payload.get("type")
        if message_type == "ping":
            await self._safe_send(player_id, {"type": "pong", "server_time": utc_now()})
        elif message_type == "list_matches":
            await self._safe_send(player_id, {"type": "lobby_matches", "matches": self.public_matches()})
        elif message_type == "create_match":
            await self.create_match(player_id, payload)
        elif message_type == "join_match":
            await self.join_match(player_id, require_string(payload, "match_id"))
        elif message_type == "leave_match":
            await self.leave_match(player_id)
        elif message_type == "set_ready":
            await self.set_ready(player_id, bool(payload.get("ready", False)))
        elif message_type == "start_match":
            await self.start_match(player_id)
        elif message_type == "player_update":
            await self.player_update(player_id, payload)
        elif message_type == "player_hit":
            await self.player_hit(player_id, payload)
        elif message_type in {"shoot", "player_action"}:
            await self.player_action(player_id, payload)
        else:
            raise ClientMessageError("unknown_message", f"Unknown message type: {message_type!r}.")

    async def create_match(self, player_id: str, payload: JsonDict) -> None:
        settings = payload.get("settings") if isinstance(payload.get("settings"), dict) else {}
        match_mode = sanitize_mode(settings.get("mode", "deathmatch"))
        map_name = sanitize_mode(settings.get("map", "aim_arena"))
        max_players = clamp_int(settings.get("max_players", 12), 2, 24)

        async with self._lock:
            player = self._require_player_locked(player_id)
            match = Match(
                id=match_code(self._matches),
                host_id=player_id,
                mode=match_mode,
                map_name=map_name,
                max_players=max_players,
            )
            events = self._leave_match_locked(player_id, reason="switch_match")
            match.players.add(player_id)
            player.match_id = match.id
            player.ready = False
            reset_combat_player(player)
            self._matches[match.id] = match
            match_state = self._public_match_state_locked(match.id)
            events.append(({player_id}, {"type": "match_created", "match": match_state}))
            events.append((set(match.players), {"type": "match_state", "match": match_state}))
            events.append((set(self._players), {"type": "lobby_matches", "matches": self._public_matches_locked()}))
            player_name = player.name

        await self._flush(events)
        logger.info(
            "match created id=%s host=%s host_name=%s mode=%s map=%s max_players=%s",
            match.id,
            player_id,
            player_name,
            match.mode,
            match.map_name,
            match.max_players,
        )

    async def join_match(self, player_id: str, match_id: str) -> None:
        match_id = match_id.strip()
        if not re.fullmatch(r"\d{6}", match_id):
            raise ClientMessageError("invalid_match_id", "Match ID must be 6 digits.")
        async with self._lock:
            player = self._require_player_locked(player_id)
            match = self._matches.get(match_id)
            if match is None:
                raise ClientMessageError("match_not_found", "Match does not exist.")
            already_in_match = player.match_id == match_id
            if len(match.players) >= match.max_players and not already_in_match:
                raise ClientMessageError("match_full", "Match is full.")

            if already_in_match:
                events = []
            else:
                events = self._leave_match_locked(player_id, reason="switch_match")
                match.players.add(player_id)
                if match.host_id not in match.players:
                    match.host_id = player_id
                player.match_id = match.id
                player.ready = False
                reset_combat_player(player)

            match_state = self._public_match_state_locked(match.id)
            others = set(match.players) - {player_id}
            events.append(({player_id}, {"type": "joined_match", "match": match_state}))
            events.append((others, {"type": "player_joined", "player": self._public_player(player)}))
            events.append((set(match.players), {"type": "match_state", "match": match_state}))
            events.append((set(self._players), {"type": "lobby_matches", "matches": self._public_matches_locked()}))
            player_name = player.name
            player_total = len(match.players)

        await self._flush(events)
        logger.info(
            "match joined id=%s player=%s player_name=%s players=%s/%s",
            match_id,
            player_id,
            player_name,
            player_total,
            match.max_players,
        )

    async def leave_match(self, player_id: str) -> None:
        async with self._lock:
            player = self._players.get(player_id)
            old_match_id = player.match_id if player else None
            events = self._leave_match_locked(player_id, reason="leave")
            events.append(({player_id}, {"type": "left_match"}))
            events.append((set(self._players), {"type": "lobby_matches", "matches": self._public_matches_locked()}))
            match_count = len(self._matches)

        await self._flush(events)
        logger.info("match left id=%s player=%s matches=%s", old_match_id or "-", player_id, match_count)

    async def set_ready(self, player_id: str, ready: bool) -> None:
        async with self._lock:
            player = self._require_player_locked(player_id)
            player.ready = ready
            events = self._match_state_events_locked(player.match_id)

        await self._flush(events)

    async def start_match(self, player_id: str) -> None:
        async with self._lock:
            player = self._require_player_locked(player_id)
            if not player.match_id:
                raise ClientMessageError("not_in_match", "Player is not in a match.")
            if not player.alive:
                raise ClientMessageError("player_dead", "Dead players cannot send actions.")
            match = self._matches[player.match_id]
            if match.host_id != player_id:
                raise ClientMessageError("not_host", "Only the host can start the match.")
            match.status = "playing"
            events = self._match_state_events_locked(match.id)
            match_id = match.id

        await self._flush(events)
        logger.info("match started id=%s host=%s", match_id, player_id)

    async def player_update(self, player_id: str, payload: JsonDict) -> None:
        update = payload.get("state")
        if not isinstance(update, dict):
            raise ClientMessageError("invalid_state", "player_update requires a state object.")

        async with self._lock:
            player = self._require_player_locked(player_id)
            if not player.match_id:
                raise ClientMessageError("not_in_match", "Player is not in a match.")
            clean_state = clean_player_state(update)
            clean_state["alive"] = player.alive
            player.state.update(clean_state)
            player.last_seen = utc_now()
            match = self._matches[player.match_id]
            recipients = set(match.players) - {player_id}
            message = {
                "type": "player_update",
                "player_id": player_id,
                "state": player.state,
                "server_time": player.last_seen,
            }

        await self._send_many(recipients, message)

    async def player_hit(self, player_id: str, payload: JsonDict) -> None:
        target_id = require_string(payload, "target_id")
        if target_id == player_id:
            raise ClientMessageError("invalid_hit", "Players cannot hit themselves.")

        async with self._lock:
            attacker = self._require_player_locked(player_id)
            victim = self._players.get(target_id)
            if not victim:
                raise ClientMessageError("target_not_found", "Target player is not connected.")
            if not attacker.match_id or attacker.match_id != victim.match_id:
                raise ClientMessageError("invalid_hit", "Target is not in the same match.")
            if not attacker.alive:
                raise ClientMessageError("attacker_dead", "Dead players cannot hit.")
            if not victim.alive:
                raise ClientMessageError("target_dead", "Target is already dead.")

            match = self._matches[attacker.match_id]
            victim.health = max(0, victim.health - 1)
            victim.last_seen = utc_now()
            match_state = self._public_match_state_locked(match.id)
            recipients = set(match.players)
            should_respawn = False

            if victim.health > 0:
                events = [
                    (
                        recipients,
                        {
                            "type": "player_damaged",
                            "attacker_id": attacker.id,
                            "attacker_name": attacker.name,
                            "victim_id": victim.id,
                            "victim_name": victim.name,
                            "health": victim.health,
                            "max_health": victim.max_health,
                            "match": match_state,
                            "server_time": utc_now(),
                        },
                    ),
                    (recipients, {"type": "match_state", "match": match_state}),
                ]
            else:
                attacker.kills += 1
                victim.deaths += 1
                victim.alive = False
                victim.ready = False
                victim.state["alive"] = False
                victim.state["velocity"] = [0, 0, 0]
                self._cancel_respawn_locked(victim.id)
                match_state = self._public_match_state_locked(match.id)
                events = [
                    (
                        recipients,
                        {
                            "type": "player_killed",
                            "killer_id": attacker.id,
                            "killer_name": attacker.name,
                            "victim_id": victim.id,
                            "victim_name": victim.name,
                            "match": match_state,
                            "server_time": utc_now(),
                        },
                    ),
                    (recipients, {"type": "match_state", "match": match_state}),
                ]
                should_respawn = True

        await self._flush(events)
        if should_respawn:
            logger.info(
                "player killed match=%s killer=%s victim=%s score=%s-%s",
                match.id,
                attacker.id,
                victim.id,
                attacker.kills,
                attacker.deaths,
            )
            self._respawn_tasks[victim.id] = asyncio.create_task(self._respawn_player_after(victim.id, match.id))
        else:
            logger.info(
                "player damaged match=%s attacker=%s victim=%s health=%s/%s",
                match.id,
                attacker.id,
                victim.id,
                victim.health,
                victim.max_health,
            )

    async def player_action(self, player_id: str, payload: JsonDict) -> None:
        async with self._lock:
            player = self._require_player_locked(player_id)
            if not player.match_id:
                raise ClientMessageError("not_in_match", "Player is not in a match.")
            if not player.alive:
                raise ClientMessageError("player_dead", "Dead players cannot send actions.")
            match = self._matches[player.match_id]
            recipients = set(match.players) - {player_id}
            action_type = str(payload.get("action", payload.get("type", "player_action")))[:32]
            message = {
                "type": "player_action",
                "player_id": player_id,
                "action": action_type,
                "payload": clean_action_payload(payload.get("payload", payload)),
                "server_time": utc_now(),
            }

        await self._send_many(recipients, message)

    async def _respawn_player_after(self, player_id: str, match_id: str) -> None:
        await asyncio.sleep(1)
        async with self._lock:
            player = self._players.get(player_id)
            match = self._matches.get(match_id)
            if not player or not match or player.match_id != match_id:
                self._respawn_tasks.pop(player_id, None)
                return

            player.alive = True
            player.health = player.max_health
            player.state.update(spawn_state(player))
            player.last_seen = utc_now()
            match_state = self._public_match_state_locked(match_id)
            recipients = set(match.players)
            events = [
                (
                    recipients,
                    {
                        "type": "player_respawned",
                        "player_id": player_id,
                        "state": player.state,
                        "match": match_state,
                        "server_time": player.last_seen,
                    },
                ),
                (recipients, {"type": "match_state", "match": match_state}),
            ]
            self._respawn_tasks.pop(player_id, None)

        await self._flush(events)
        logger.info("player respawned match=%s player=%s", match_id, player_id)

    def public_matches(self) -> list[JsonDict]:
        return self._public_matches_locked()

    async def send_error(self, player_id: str, code: str, message: str) -> None:
        logger.warning("client error player=%s code=%s message=%s", player_id, code, message)
        await self._safe_send(player_id, {"type": "error", "code": code, "message": message})

    def _leave_match_locked(self, player_id: str, reason: str) -> list[tuple[set[str], JsonDict]]:
        events: list[tuple[set[str], JsonDict]] = []
        player = self._players.get(player_id)
        if not player or not player.match_id:
            return events

        self._cancel_respawn_locked(player_id)
        match = self._matches.get(player.match_id)
        old_match_id = player.match_id
        player.match_id = None
        player.ready = False
        player.alive = True
        player.health = player.max_health

        if not match:
            return events

        match.players.discard(player_id)
        if not match.players:
            match.status = "lobby"
            return events

        if match.host_id == player_id:
            match.host_id = sorted(match.players)[0]

        match_state = self._public_match_state_locked(match.id)
        recipients = set(match.players)
        events.append((recipients, {"type": "player_left", "player_id": player_id, "reason": reason}))
        events.append((recipients, {"type": "match_state", "match": match_state}))
        return events

    def _match_state_events_locked(self, match_id: str | None) -> list[tuple[set[str], JsonDict]]:
        if not match_id or match_id not in self._matches:
            return []
        match = self._matches[match_id]
        return [(set(match.players), {"type": "match_state", "match": self._public_match_state_locked(match_id)})]

    def _cancel_respawn_locked(self, player_id: str) -> None:
        task = self._respawn_tasks.pop(player_id, None)
        if task and not task.done():
            task.cancel()

    def _require_player_locked(self, player_id: str) -> Player:
        player = self._players.get(player_id)
        if not player:
            raise ClientMessageError("player_not_found", "Player is not connected.")
        return player

    def _public_matches_locked(self) -> list[JsonDict]:
        return [
            {
                "id": match.id,
                "host_id": match.host_id,
                "mode": match.mode,
                "map": match.map_name,
                "status": match.status,
                "players": len(match.players),
                "max_players": match.max_players,
                "created_at": match.created_at,
            }
            for match in self._matches.values()
        ]

    def _public_match_state_locked(self, match_id: str) -> JsonDict:
        match = self._matches[match_id]
        return {
            "id": match.id,
            "host_id": match.host_id,
            "mode": match.mode,
            "map": match.map_name,
            "status": match.status,
            "max_players": match.max_players,
            "created_at": match.created_at,
            "players": [
                self._public_player(self._players[player_id])
                for player_id in sorted(match.players)
                if player_id in self._players
            ],
        }

    def _public_player(self, player: Player) -> JsonDict:
        return {
            "id": player.id,
            "name": player.name,
            "match_id": player.match_id,
            "ready": player.ready,
            "kills": player.kills,
            "deaths": player.deaths,
            "alive": player.alive,
            "health": player.health,
            "max_health": player.max_health,
            "state": player.state,
            "connected_at": player.connected_at,
            "last_seen": player.last_seen,
        }

    async def _broadcast_lobby(self) -> None:
        async with self._lock:
            recipients = set(self._players)
            matches = self._public_matches_locked()
        await self._send_many(recipients, {"type": "lobby_matches", "matches": matches})

    async def _flush(self, events: list[tuple[set[str], JsonDict]]) -> None:
        for recipients, message in events:
            await self._send_many(recipients, message)

    async def _send_many(self, recipients: set[str], message: JsonDict) -> None:
        if not recipients:
            return
        await asyncio.gather(
            *(self._safe_send(player_id, message) for player_id in recipients),
            return_exceptions=True,
        )

    async def _safe_send(self, player_id: str, message: JsonDict) -> None:
        player = self._players.get(player_id)
        if not player:
            return
        if player.websocket.client_state != WebSocketState.CONNECTED:
            return
        try:
            await player.websocket.send_json(message)
        except Exception as exc:
            logger.info(
                "send skipped player=%s message_type=%s error=%s",
                player_id,
                message.get("type"),
                exc.__class__.__name__,
            )


def clean_player_state(update: JsonDict) -> JsonDict:
    clean: JsonDict = {}
    for key in ("position", "rotation", "velocity"):
        value = update.get(key)
        if isinstance(value, list) and 1 <= len(value) <= 4 and all(is_number(item) for item in value):
            clean[key] = [round(float(item), 4) for item in value]

    for key in ("grounded", "moving"):
        if isinstance(update.get(key), bool):
            clean[key] = update[key]

    for key in ("bhopChain", "weaponSlot"):
        if is_number(update.get(key)):
            clean[key] = int(update[key])

    if isinstance(update.get("animation"), str):
        clean["animation"] = update["animation"][:32]

    return clean


def reset_combat_player(player: Player) -> None:
    player.kills = 0
    player.deaths = 0
    player.alive = True
    player.health = player.max_health
    player.ready = False
    player.state.update(spawn_state(player))


def spawn_state(player: Player) -> JsonDict:
    spawn_points = [
        [0, 0, 27],
        [0, 0, -27],
        [27, 0, 0],
        [-27, 0, 0],
        [20, 0, 20],
        [-20, 0, -20],
        [20, 0, -20],
        [-20, 0, 20],
    ]
    choices = [index for index in range(len(spawn_points)) if index != player.last_spawn_index]
    index = random.choice(choices or list(range(len(spawn_points))))
    player.last_spawn_index = index
    return {
        "position": spawn_points[index],
        "velocity": [0, 0, 0],
        "alive": True,
        "health": player.max_health,
    }


def clean_action_payload(payload: Any) -> JsonDict:
    if not isinstance(payload, dict):
        return {}
    clean: JsonDict = {}
    for key in ("origin", "direction"):
        value = payload.get(key)
        if isinstance(value, list) and len(value) == 3 and all(is_number(item) for item in value):
            clean[key] = [round(float(item), 4) for item in value]
    if is_number(payload.get("client_time")):
        clean["client_time"] = float(payload["client_time"])
    if isinstance(payload.get("weapon"), str):
        clean["weapon"] = payload["weapon"][:32]
    return clean


def require_string(payload: JsonDict, key: str) -> str:
    value = payload.get(key)
    if not isinstance(value, str) or not value:
        raise ClientMessageError("missing_field", f"Missing required string field: {key}.")
    return value


def sanitize_name(value: str) -> str:
    value = re.sub(r"\s+", " ", value.strip())
    return value[:32] or "Player"


def sanitize_id(value: str | None) -> str:
    if not value:
        return short_id("player")
    value = re.sub(r"[^a-zA-Z0-9_-]", "", value)
    return value[:64] or short_id("player")


def sanitize_mode(value: Any) -> str:
    if not isinstance(value, str):
        return "deathmatch"
    value = re.sub(r"[^a-zA-Z0-9_-]", "", value)
    return value[:32] or "deathmatch"


def short_id(prefix: str) -> str:
    return f"{prefix}_{uuid4().hex[:10]}"


def match_code(matches: dict[str, Match]) -> str:
    for _ in range(100):
        code = str(random.randint(100000, 999999))
        if code not in matches:
            return code

    for code_number in range(100000, 1000000):
        code = str(code_number)
        if code not in matches:
            return code

    raise ClientMessageError("match_capacity", "No match codes are available.")


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def is_number(value: Any) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def clamp_int(value: Any, minimum: int, maximum: int) -> int:
    if not is_number(value):
        return minimum
    return max(minimum, min(maximum, int(value)))
