from __future__ import annotations

import asyncio
import logging
import random
import re
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from starlette.websockets import WebSocket, WebSocketState

JsonDict = dict[str, Any]
logger = logging.getLogger("neon_aim.match_manager")

WEAPON_RULES: dict[str, JsonDict] = {
    "pistol": {"damage": 3, "interval": 0.15, "range": 64, "magazine": 8, "reload": 0.9},
    "long-pistol": {"damage": 2, "interval": 0.3, "range": 82, "magazine": 5, "reload": 1.15},
    "long-pistol-small": {"damage": 3, "interval": 0.72, "range": 26, "magazine": 3, "reload": 1.35},
    "rifle": {"damage": 1, "interval": 0.14, "range": 82, "magazine": 28, "reload": 1.35},
    "sniper-rifle": {"damage": 5, "interval": 0.58, "range": 132, "magazine": 1, "reload": 1.55},
    "ray-gun": {"damage": 1, "interval": 0.145, "range": 72, "magazine": 24, "reload": 1.1},
    "lightning-gun": {"damage": 1, "interval": 0.17, "range": 44, "magazine": 14, "reload": 1.25},
}
DEFAULT_WEAPON_RULE: JsonDict = {"damage": 1, "interval": 0.12, "range": 95, "magazine": 18, "reload": 1.2}
DEFAULT_MATCH_DURATION_SECONDS = 180
DEFAULT_MATCH_SCORE_LIMIT = 8
RESPAWN_DELAY_SECONDS = 1


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
    last_action_at: dict[str, float] = field(default_factory=dict)
    last_hit_at: dict[str, float] = field(default_factory=dict)
    weapon_ammo: dict[str, int] = field(default_factory=dict)
    weapon_reload_until: dict[str, float] = field(default_factory=dict)
    connected_at: str = field(default_factory=lambda: utc_now())
    last_seen: str = field(default_factory=lambda: utc_now())


@dataclass
class Match:
    id: str
    host_id: str
    mode: str = "deathmatch"
    map_name: str = "aim_arena"
    max_players: int = 12
    duration_seconds: int = DEFAULT_MATCH_DURATION_SECONDS
    score_limit: int = DEFAULT_MATCH_SCORE_LIMIT
    status: str = "lobby"
    players: set[str] = field(default_factory=set)
    created_at: str = field(default_factory=lambda: utc_now())
    started_at: str | None = None
    finished_at: str | None = None
    winner_id: str | None = None
    finish_reason: str | None = None
    started_at_monotonic: float | None = None
    ends_at_monotonic: float | None = None
    game_state: JsonDict = field(default_factory=dict)


class MatchManager:
    def __init__(self) -> None:
        self._players: dict[str, Player] = {}
        self._matches: dict[str, Match] = {}
        self._respawn_tasks: dict[str, asyncio.Task] = {}
        self._match_finish_tasks: dict[str, asyncio.Task] = {}
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
        elif message_type == "chess_move":
            await self.chess_move(player_id, payload)
        elif message_type == "chess_resign":
            await self.chess_resign(player_id)
        elif message_type == "chess_reset":
            await self.chess_reset(player_id)
        elif message_type in {"shoot", "player_action"}:
            await self.player_action(player_id, payload)
        else:
            raise ClientMessageError("unknown_message", f"Unknown message type: {message_type!r}.")

    async def create_match(self, player_id: str, payload: JsonDict) -> None:
        settings = payload.get("settings") if isinstance(payload.get("settings"), dict) else {}
        match_mode = sanitize_mode(settings.get("mode", "deathmatch"))
        map_name = sanitize_mode(settings.get("map", "aim_arena"))
        max_players_limit = 2 if match_mode == "chess" else 24
        max_players = clamp_int(settings.get("max_players", 12), 2, max_players_limit)
        duration_seconds = clamp_int(
            settings.get("duration_seconds", settings.get("duration", DEFAULT_MATCH_DURATION_SECONDS)),
            60,
            900,
        )
        score_limit = clamp_int(
            settings.get("score_limit", settings.get("scoreLimit", DEFAULT_MATCH_SCORE_LIMIT)),
            1,
            50,
        )

        async with self._lock:
            player = self._require_player_locked(player_id)
            match = Match(
                id=match_code(self._matches),
                host_id=player_id,
                mode=match_mode,
                map_name=map_name,
                max_players=max_players,
                duration_seconds=duration_seconds,
                score_limit=score_limit,
            )
            events = self._leave_match_locked(player_id, reason="switch_match")
            match.players.add(player_id)
            player.match_id = match.id
            player.ready = False
            reset_combat_player(player)
            if match.mode == "chess":
                initialize_chess_state(match)
                sync_chess_roles(match, self._players)
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

            if match.mode == "chess":
                sync_chess_roles(match, self._players)

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
            match = self._matches[player.match_id]
            if match.host_id != player_id:
                raise ClientMessageError("not_host", "Only the host can start the match.")
            if match.mode == "chess":
                initialize_chess_state(match)
                sync_chess_roles(match, self._players)
                match.status = "playing" if len(match.players) >= 2 else "lobby"
            else:
                self._start_match_round_locked(match)
            events = self._match_state_events_locked(match.id)
            events.append((set(self._players), {"type": "lobby_matches", "matches": self._public_matches_locked()}))
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
            if match.status != "playing":
                raise ClientMessageError("match_not_playing", "Match is not currently playing.")
            weapon = sanitize_weapon_id(payload.get("weapon"))
            rule = resolve_weapon_rule(weapon)
            validate_recent_shot(attacker, weapon, rule)
            enforce_hit_cooldown(attacker, target_id, weapon, rule)
            validate_hit_range(attacker, victim, payload, rule)
            damage = resolve_weapon_damage(rule)
            victim.health = max(0, victim.health - damage)
            victim.last_seen = utc_now()
            match_state = self._public_match_state_locked(match.id)
            recipients = set(match.players)
            should_respawn = False
            was_kill = False

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
                            "weapon": weapon,
                            "damage": damage,
                            "health": victim.health,
                            "max_health": victim.max_health,
                            "match": match_state,
                            "server_time": utc_now(),
                        },
                    ),
                    (recipients, {"type": "match_state", "match": match_state}),
                ]
            else:
                was_kill = True
                attacker.kills += 1
                victim.deaths += 1
                victim.alive = False
                victim.ready = False
                victim.state["alive"] = False
                victim.state["velocity"] = [0, 0, 0]
                self._cancel_respawn_locked(victim.id)
                round_finished = attacker.kills >= match.score_limit
                finish_events = self._finish_match_locked(match, "score", attacker.id) if round_finished else []
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
                            "weapon": weapon,
                            "damage": damage,
                            "match": match_state,
                            "server_time": utc_now(),
                        },
                    ),
                ]
                if finish_events:
                    events.extend(finish_events)
                else:
                    events.append((recipients, {"type": "match_state", "match": match_state}))
                should_respawn = not round_finished

        await self._flush(events)
        if was_kill:
            logger.info(
                "player killed match=%s killer=%s victim=%s weapon=%s damage=%s score=%s-%s",
                match.id,
                attacker.id,
                victim.id,
                weapon or "-",
                damage,
                attacker.kills,
                attacker.deaths,
            )
            if should_respawn:
                self._respawn_tasks[victim.id] = asyncio.create_task(self._respawn_player_after(victim.id, match.id))
        else:
            logger.info(
                "player damaged match=%s attacker=%s victim=%s weapon=%s damage=%s health=%s/%s",
                match.id,
                attacker.id,
                victim.id,
                weapon or "-",
                damage,
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
            clean_payload = clean_action_payload(payload.get("payload", payload))
            if action_type == "shoot":
                if match.status != "playing":
                    raise ClientMessageError("match_not_playing", "Match is not currently playing.")
                weapon = sanitize_weapon_id(clean_payload.get("weapon"))
                consume_weapon_shot(player, weapon, resolve_weapon_rule(weapon))
            message = {
                "type": "player_action",
                "player_id": player_id,
                "action": action_type,
                "payload": clean_payload,
                "server_time": utc_now(),
            }

        await self._send_many(recipients, message)

    async def chess_move(self, player_id: str, payload: JsonDict) -> None:
        async with self._lock:
            player = self._require_player_locked(player_id)
            if not player.match_id:
                raise ClientMessageError("not_in_match", "Player is not in a match.")
            match = self._matches[player.match_id]
            if match.mode != "chess":
                raise ClientMessageError("invalid_mode", "This match is not a chess game.")
            sync_chess_roles(match, self._players)
            state = match.game_state
            role = state.get("roles", {}).get(player_id)
            if role not in {"w", "b"}:
                raise ClientMessageError("chess_observer", "Only seated chess players can move.")
            if match.status != "playing":
                raise ClientMessageError("match_not_playing", "Chess game is not currently playing.")
            if state.get("turn") != role:
                raise ClientMessageError("not_your_turn", "It is not your turn.")

            move = clean_chess_move(payload)
            state["fen"] = move["fen"]
            state["pgn"] = sanitize_chess_text(payload.get("pgn"), 4000)
            state["turn"] = "b" if role == "w" else "w"
            state["last_move"] = move
            state["ply"] = clamp_int(state.get("ply", 0), 0, 10000) + 1
            moves = state.get("moves") if isinstance(state.get("moves"), list) else []
            moves.append(move)
            state["moves"] = moves[-160:]

            status = sanitize_chess_status(payload.get("status"))
            result = sanitize_chess_text(payload.get("result"), 32)
            if status != "playing":
                state["status"] = status
                state["result"] = result or chess_result_for_status(status, role)
                match.status = "finished"
                match.finished_at = utc_now()
                match.winner_id = player_id if status == "checkmate" else None
                match.finish_reason = status
            else:
                state["status"] = "playing"
                state["result"] = ""

            match_state = self._public_match_state_locked(match.id)
            recipients = set(match.players)
            events = [
                (
                    recipients,
                    {
                        "type": "chess_state",
                        "player_id": player_id,
                        "move": move,
                        "state": state,
                        "match": match_state,
                        "server_time": utc_now(),
                    },
                ),
                (recipients, {"type": "match_state", "match": match_state}),
            ]
            if match.status == "finished":
                events.append((set(self._players), {"type": "lobby_matches", "matches": self._public_matches_locked()}))

        await self._flush(events)

    async def chess_resign(self, player_id: str) -> None:
        async with self._lock:
            player = self._require_player_locked(player_id)
            if not player.match_id:
                raise ClientMessageError("not_in_match", "Player is not in a match.")
            match = self._matches[player.match_id]
            if match.mode != "chess":
                raise ClientMessageError("invalid_mode", "This match is not a chess game.")
            sync_chess_roles(match, self._players)
            state = match.game_state
            role = state.get("roles", {}).get(player_id)
            if role not in {"w", "b"}:
                raise ClientMessageError("chess_observer", "Only seated chess players can resign.")
            winner_role = "b" if role == "w" else "w"
            winner_id = next((pid for pid, seat in state.get("roles", {}).items() if seat == winner_role), None)
            state["status"] = "resigned"
            state["result"] = "0-1" if winner_role == "b" else "1-0"
            match.status = "finished"
            match.finished_at = utc_now()
            match.winner_id = winner_id
            match.finish_reason = "resign"
            match_state = self._public_match_state_locked(match.id)
            recipients = set(match.players)
            events = [
                (
                    recipients,
                    {
                        "type": "chess_state",
                        "player_id": player_id,
                        "state": state,
                        "match": match_state,
                        "server_time": utc_now(),
                    },
                ),
                (recipients, {"type": "match_state", "match": match_state}),
                (set(self._players), {"type": "lobby_matches", "matches": self._public_matches_locked()}),
            ]

        await self._flush(events)

    async def chess_reset(self, player_id: str) -> None:
        async with self._lock:
            player = self._require_player_locked(player_id)
            if not player.match_id:
                raise ClientMessageError("not_in_match", "Player is not in a match.")
            match = self._matches[player.match_id]
            if match.mode != "chess":
                raise ClientMessageError("invalid_mode", "This match is not a chess game.")
            if match.host_id != player_id:
                raise ClientMessageError("not_host", "Only the host can reset the chess game.")
            initialize_chess_state(match)
            sync_chess_roles(match, self._players)
            match.status = "playing" if len(match.players) >= 2 else "lobby"
            match.finished_at = None
            match.winner_id = None
            match.finish_reason = None
            match_state = self._public_match_state_locked(match.id)
            recipients = set(match.players)
            events = [
                (
                    recipients,
                    {
                        "type": "chess_state",
                        "player_id": player_id,
                        "state": match.game_state,
                        "match": match_state,
                        "server_time": utc_now(),
                    },
                ),
                (recipients, {"type": "match_state", "match": match_state}),
            ]

        await self._flush(events)

    async def _respawn_player_after(self, player_id: str, match_id: str) -> None:
        await asyncio.sleep(RESPAWN_DELAY_SECONDS)
        async with self._lock:
            player = self._players.get(player_id)
            match = self._matches.get(match_id)
            if not player or not match or player.match_id != match_id or match.status != "playing":
                self._respawn_tasks.pop(player_id, None)
                return

            player.alive = True
            player.health = player.max_health
            player.state.update(spawn_state(player))
            reset_weapon_state(player)
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
        reset_weapon_state(player)

        if not match:
            return events

        match.players.discard(player_id)
        if match.mode == "chess":
            roles = match.game_state.get("roles") if isinstance(match.game_state.get("roles"), dict) else {}
            roles.pop(player_id, None)
            match.game_state["roles"] = roles
        if not match.players:
            self._cancel_match_finish_locked(match.id)
            match.status = "lobby"
            return events

        if match.host_id == player_id:
            match.host_id = sorted(match.players)[0]
        if match.mode == "chess":
            sync_chess_roles(match, self._players)

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

    def _start_match_round_locked(self, match: Match) -> None:
        self._cancel_match_finish_locked(match.id)
        now = time.monotonic()
        match.status = "playing"
        match.started_at = utc_now()
        match.finished_at = None
        match.winner_id = None
        match.finish_reason = None
        match.started_at_monotonic = now
        match.ends_at_monotonic = now + match.duration_seconds
        for player_id in list(match.players):
            player = self._players.get(player_id)
            if player:
                reset_combat_player(player)
        self._match_finish_tasks[match.id] = asyncio.create_task(self._finish_match_after(match.id))

    async def _finish_match_after(self, match_id: str) -> None:
        async with self._lock:
            match = self._matches.get(match_id)
            sleep_seconds = match.duration_seconds if match else 0

        await asyncio.sleep(max(0.1, sleep_seconds))

        async with self._lock:
            match = self._matches.get(match_id)
            if not match or match.status != "playing":
                self._match_finish_tasks.pop(match_id, None)
                return
            events = self._finish_match_locked(match, "time", self._match_leader_id_locked(match))
            self._match_finish_tasks.pop(match_id, None)

        await self._flush(events)
        logger.info("match finished id=%s reason=time winner=%s", match_id, match.winner_id or "-")

    def _finish_match_locked(self, match: Match, reason: str, winner_id: str | None) -> list[tuple[set[str], JsonDict]]:
        match.status = "finished"
        match.finished_at = utc_now()
        match.winner_id = winner_id
        match.finish_reason = reason
        match.ends_at_monotonic = time.monotonic()
        self._cancel_match_finish_locked(match.id)
        for player_id in list(match.players):
            self._cancel_respawn_locked(player_id)

        recipients = set(match.players)
        match_state = self._public_match_state_locked(match.id)
        return [
            (
                recipients,
                {
                    "type": "match_finished",
                    "reason": reason,
                    "winner_id": winner_id,
                    "match": match_state,
                    "server_time": utc_now(),
                },
            ),
            (recipients, {"type": "match_state", "match": match_state}),
            (set(self._players), {"type": "lobby_matches", "matches": self._public_matches_locked()}),
        ]

    def _match_leader_id_locked(self, match: Match) -> str | None:
        players = [self._players[player_id] for player_id in match.players if player_id in self._players]
        if not players:
            return None
        players.sort(key=lambda player: (-player.kills, player.deaths, player.name.lower(), player.id))
        return players[0].id

    def _cancel_respawn_locked(self, player_id: str) -> None:
        task = self._respawn_tasks.pop(player_id, None)
        if task and not task.done():
            task.cancel()

    def _cancel_match_finish_locked(self, match_id: str) -> None:
        task = self._match_finish_tasks.pop(match_id, None)
        if task and not task.done() and task is not asyncio.current_task():
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
                "duration_seconds": match.duration_seconds,
                "score_limit": match.score_limit,
                "remaining_seconds": self._match_remaining_seconds(match),
                "winner_id": match.winner_id,
                "finish_reason": match.finish_reason,
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
            "duration_seconds": match.duration_seconds,
            "score_limit": match.score_limit,
            "remaining_seconds": self._match_remaining_seconds(match),
            "started_at": match.started_at,
            "finished_at": match.finished_at,
            "winner_id": match.winner_id,
            "finish_reason": match.finish_reason,
            "game_state": match.game_state,
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

    def _match_remaining_seconds(self, match: Match) -> int | None:
        if match.status != "playing" or match.ends_at_monotonic is None:
            return None
        return max(0, int(round(match.ends_at_monotonic - time.monotonic())))

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
    reset_weapon_state(player)


def initialize_chess_state(match: Match) -> None:
    existing_roles = match.game_state.get("roles") if isinstance(match.game_state.get("roles"), dict) else {}
    match.game_state = {
        "fen": "start",
        "pgn": "",
        "turn": "w",
        "status": "waiting",
        "result": "",
        "ply": 0,
        "moves": [],
        "last_move": None,
        "roles": {player_id: role for player_id, role in existing_roles.items() if player_id in match.players},
    }


def sync_chess_roles(match: Match, players: dict[str, Player]) -> None:
    if not match.game_state:
        initialize_chess_state(match)

    roles = match.game_state.get("roles") if isinstance(match.game_state.get("roles"), dict) else {}
    roles = {
        player_id: role
        for player_id, role in roles.items()
        if player_id in match.players and role in {"w", "b"}
    }
    seated_roles = set(roles.values())
    for player_id in sorted(match.players):
        if player_id not in players or player_id in roles:
            continue
        if "w" not in seated_roles:
            roles[player_id] = "w"
            seated_roles.add("w")
        elif "b" not in seated_roles:
            roles[player_id] = "b"
            seated_roles.add("b")

    match.game_state["roles"] = roles
    if len(roles) >= 2 and match.game_state.get("status") == "waiting":
        match.game_state["status"] = "playing"
        match.status = "playing"
        match.started_at = match.started_at or utc_now()
    elif len(roles) < 2 and match.status != "finished":
        match.game_state["status"] = "waiting"
        match.status = "lobby"


def clean_chess_move(payload: JsonDict) -> JsonDict:
    from_square = sanitize_square(require_string(payload, "from"))
    to_square = sanitize_square(require_string(payload, "to"))
    fen = sanitize_chess_text(require_string(payload, "fen"), 160)
    if fen == "start":
        raise ClientMessageError("invalid_fen", "FEN must describe the board after the move.")
    promotion = str(payload.get("promotion", "")).lower()
    if promotion not in {"", "q", "r", "b", "n"}:
        raise ClientMessageError("invalid_promotion", "Invalid chess promotion piece.")
    return {
        "from": from_square,
        "to": to_square,
        "promotion": promotion,
        "san": sanitize_chess_text(payload.get("san"), 32),
        "lan": sanitize_chess_text(payload.get("lan"), 16),
        "fen": fen,
    }


def sanitize_square(value: str) -> str:
    value = str(value or "").strip().lower()
    if not re.fullmatch(r"[a-h][1-8]", value):
        raise ClientMessageError("invalid_square", "Chess squares must use algebraic coordinates.")
    return value


def sanitize_chess_status(value: Any) -> str:
    value = str(value or "playing").strip().lower()
    if value in {"playing", "checkmate", "draw", "stalemate", "insufficient", "threefold", "resigned"}:
        return value
    return "playing"


def sanitize_chess_text(value: Any, max_length: int) -> str:
    return str(value or "").replace("\x00", "").strip()[:max_length]


def chess_result_for_status(status: str, moving_role: str) -> str:
    if status == "checkmate":
        return "1-0" if moving_role == "w" else "0-1"
    if status in {"draw", "stalemate", "insufficient", "threefold"}:
        return "1/2-1/2"
    return ""


def reset_weapon_state(player: Player) -> None:
    player.last_action_at.clear()
    player.last_hit_at.clear()
    player.weapon_ammo.clear()
    player.weapon_reload_until.clear()


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
    if is_number(payload.get("weaponSlot")):
        clean["weaponSlot"] = clamp_int(payload.get("weaponSlot"), 0, 8)
    if isinstance(payload.get("weapon"), str):
        clean["weapon"] = payload["weapon"][:32]
    if isinstance(payload.get("style"), str):
        clean["style"] = payload["style"][:32]
    return clean


def require_string(payload: JsonDict, key: str) -> str:
    value = payload.get(key)
    if not isinstance(value, str) or not value:
        raise ClientMessageError("missing_field", f"Missing required string field: {key}.")
    return value


def sanitize_weapon_id(value: Any) -> str:
    if not isinstance(value, str):
        return ""
    return re.sub(r"[^a-zA-Z0-9_-]", "", value)[:32]


def resolve_weapon_rule(weapon: str) -> JsonDict:
    return WEAPON_RULES.get(weapon, DEFAULT_WEAPON_RULE)


def resolve_weapon_damage(rule: JsonDict) -> int:
    return clamp_int(rule.get("damage", 1), 1, 5)


def enforce_hit_cooldown(attacker: Player, target_id: str, weapon: str, rule: JsonDict) -> None:
    cooldown_key = f"{weapon or 'unknown'}:{target_id}"
    minimum_interval = max(0.045, float(rule.get("interval", 0.12)) * 0.72)
    now = time.monotonic()
    last_hit_at = attacker.last_hit_at.get(cooldown_key, 0)
    if now - last_hit_at < minimum_interval:
        raise ClientMessageError("hit_rate_limited", "Weapon is cooling down.")
    attacker.last_hit_at[cooldown_key] = now


def consume_weapon_shot(player: Player, weapon: str, rule: JsonDict) -> None:
    cooldown_key = weapon or "unknown"
    minimum_interval = max(0.045, float(rule.get("interval", 0.12)) * 0.72)
    now = time.monotonic()
    last_action_at = player.last_action_at.get(cooldown_key, 0)
    if now - last_action_at < minimum_interval:
        raise ClientMessageError("action_rate_limited", "Weapon action is cooling down.")

    magazine = clamp_int(rule.get("magazine", 18), 1, 60)
    reload_duration = max(0.35, float(rule.get("reload", 1.2)))
    reload_until = player.weapon_reload_until.get(cooldown_key, 0)
    if reload_until > now:
        raise ClientMessageError("weapon_reloading", "Weapon is reloading.")

    ammo = player.weapon_ammo.get(cooldown_key, magazine)
    if reload_until and reload_until <= now and ammo <= 0:
        ammo = magazine
        player.weapon_reload_until.pop(cooldown_key, None)

    if ammo <= 0:
        player.weapon_ammo[cooldown_key] = 0
        player.weapon_reload_until[cooldown_key] = now + reload_duration
        raise ClientMessageError("weapon_reloading", "Weapon is reloading.")

    ammo -= 1
    player.weapon_ammo[cooldown_key] = ammo
    if ammo <= 0:
        player.weapon_reload_until[cooldown_key] = now + reload_duration
    player.last_action_at[cooldown_key] = now


def validate_recent_shot(player: Player, weapon: str, rule: JsonDict) -> None:
    cooldown_key = weapon or "unknown"
    last_action_at = player.last_action_at.get(cooldown_key, 0)
    allowed_delay = max(1.2, float(rule.get("interval", 0.12)) + 0.85)
    if not last_action_at or time.monotonic() - last_action_at > allowed_delay:
        raise ClientMessageError("missing_shot_action", "Hit must follow a recent shot.")


def validate_hit_range(attacker: Player, victim: Player, payload: JsonDict, rule: JsonDict) -> None:
    hit = payload.get("hit") if isinstance(payload.get("hit"), dict) else {}
    origin = vector3_from(hit.get("origin")) or vector3_from(attacker.state.get("position"))
    victim_position = vector3_from(victim.state.get("position"))
    hit_point = vector3_from(hit.get("point"))
    if not origin:
        return

    max_range = float(rule.get("range", 95))
    allowed_range = max_range + max(7.5, max_range * 0.12)
    if hit_point and distance3(origin, hit_point) > allowed_range:
        raise ClientMessageError("hit_out_of_range", "Hit point is outside weapon range.")
    if victim_position and distance3(origin, victim_position) > allowed_range:
        raise ClientMessageError("target_out_of_range", "Target is outside weapon range.")


def vector3_from(value: Any) -> tuple[float, float, float] | None:
    if not isinstance(value, list) or len(value) != 3 or not all(is_number(item) for item in value):
        return None
    return (float(value[0]), float(value[1]), float(value[2]))


def distance3(a: tuple[float, float, float], b: tuple[float, float, float]) -> float:
    return ((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2) ** 0.5


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
