import { Chess } from "chess.js";

export const chessArena = {
  id: "chess-arena",
  title: "Chess Arena",
  mode: "chess",
  roomMode: "chess",
  map: "classic_board",
  summary: "A focused two-player chess board with legal moves, room play, roles, move history, and clean turn feedback.",
  controls: "Click a piece, choose a highlighted square, promote to queen automatically."
};

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const RANKS = [8, 7, 6, 5, 4, 3, 2, 1];
const PIECES = {
  wp: "♙",
  wn: "♘",
  wb: "♗",
  wr: "♖",
  wq: "♕",
  wk: "♔",
  bp: "♟",
  bn: "♞",
  bb: "♝",
  br: "♜",
  bq: "♛",
  bk: "♚"
};

export function mountGame(options = {}) {
  return createChessArenaRuntime(options);
}

function createChessArenaRuntime(options = {}) {
  const root = options.root ?? document.querySelector("#game");
  if (!root) {
    throw new Error("Game root element not found.");
  }

  const chess = new Chess();
  const network = {
    socket: null,
    connected: false,
    connecting: false,
    clientId: null,
    matchId: null,
    hostId: null
  };
  const state = {
    selected: null,
    legalTargets: new Set(),
    orientation: "w",
    role: null,
    roles: {},
    players: [],
    serverMoves: [],
    gameStatus: "playing",
    result: "",
    statusText: "Local board ready",
    lastMove: null
  };
  const eventCleanups = [];
  let disposed = false;

  root.innerHTML = `
    <section class="chess-shell" aria-label="Chess Arena">
      <div class="chess-board-wrap">
        <div class="chess-board-top">
          <div>
            <p class="eyebrow">CHESS ARENA</p>
            <h1>Chess Arena</h1>
          </div>
          <div class="chess-status">
            <span id="chessRoleValue">Local</span>
            <strong id="chessTurnValue">White to move</strong>
          </div>
        </div>
        <div class="chess-board-frame">
          <div id="chessBoard" class="chess-board" aria-label="Chess board"></div>
        </div>
      </div>
      <aside class="chess-panel">
        <div class="chess-panel-section chess-match-section">
          <span class="panel-label">Match</span>
          <strong id="chessMatchValue">Local</strong>
          <small id="chessStatusValue">Local board ready</small>
        </div>
        <div class="chess-panel-section chess-players-section">
          <span class="panel-label">Players</span>
          <div id="chessPlayers" class="chess-players"></div>
        </div>
        <div class="chess-panel-section chess-moves-section">
          <span class="panel-label">Moves</span>
          <ol id="chessMoves" class="chess-moves"></ol>
        </div>
        <div class="chess-actions">
          <button id="flipBoardButton" class="ghost-button compact" type="button">Flip</button>
          <button id="newChessButton" class="ghost-button compact" type="button">New Game</button>
          <button id="resignChessButton" class="ghost-button compact danger" type="button">Resign</button>
        </div>
      </aside>
    </section>
  `;

  const ui = {
    board: root.querySelector("#chessBoard"),
    role: root.querySelector("#chessRoleValue"),
    turn: root.querySelector("#chessTurnValue"),
    match: root.querySelector("#chessMatchValue"),
    status: root.querySelector("#chessStatusValue"),
    players: root.querySelector("#chessPlayers"),
    moves: root.querySelector("#chessMoves"),
    flip: root.querySelector("#flipBoardButton"),
    reset: root.querySelector("#newChessButton"),
    resign: root.querySelector("#resignChessButton")
  };

  addEvent(ui.flip, "click", () => {
    state.orientation = state.orientation === "w" ? "b" : "w";
    render();
  });
  addEvent(ui.reset, "click", () => {
    if (network.matchId && isHost()) {
      sendNetwork({ type: "chess_reset" });
      return;
    }
    resetLocalGame();
  });
  addEvent(ui.resign, "click", () => {
    if (network.matchId) {
      sendNetwork({ type: "chess_resign" });
      return;
    }
    state.gameStatus = "resigned";
    state.result = chess.turn() === "w" ? "0-1" : "1-0";
    state.statusText = "Local resignation";
    render();
  });

  render();
  if (options.roomAction === "join" && options.matchId) {
    joinNetworkMatch(options.matchId);
  }

  return {
    destroy,
    connect: connectNetwork,
    joinMatch: joinNetworkMatch,
    disconnect: disconnectNetwork
  };

  function addEvent(target, type, handler, eventOptions) {
    if (!target) {
      return;
    }
    target.addEventListener(type, handler, eventOptions);
    eventCleanups.push(() => target.removeEventListener(type, handler, eventOptions));
  }

  function resetLocalGame() {
    chess.reset();
    state.selected = null;
    state.legalTargets.clear();
    state.serverMoves = [];
    state.gameStatus = "playing";
    state.result = "";
    state.lastMove = null;
    state.statusText = network.matchId ? "Waiting for server" : "Local board ready";
    render();
  }

  function render() {
    renderBoard();
    renderHud();
    renderPlayers();
    renderMoves();
  }

  function renderBoard() {
    ui.board.replaceChildren();
    const files = state.orientation === "w" ? FILES : [...FILES].reverse();
    const ranks = state.orientation === "w" ? RANKS : [...RANKS].reverse();

    for (const rank of ranks) {
      for (const file of files) {
        const square = `${file}${rank}`;
        const piece = chess.get(square);
        const button = document.createElement("button");
        button.type = "button";
        button.className = `chess-square ${(FILES.indexOf(file) + rank) % 2 === 0 ? "dark" : "light"}`;
        button.dataset.square = square;
        button.setAttribute("aria-label", square);
        button.classList.toggle("selected", state.selected === square);
        button.classList.toggle("target", state.legalTargets.has(square));
        button.classList.toggle("last", isLastMoveSquare(square));

        const coordinate = document.createElement("span");
        coordinate.className = "chess-coordinate";
        coordinate.textContent = square;
        button.append(coordinate);

        if (piece) {
          const pieceNode = document.createElement("strong");
          pieceNode.className = `chess-piece ${piece.color === "w" ? "white" : "black"}`;
          pieceNode.textContent = PIECES[`${piece.color}${piece.type}`] ?? "";
          button.append(pieceNode);
        }

        button.addEventListener("click", () => handleSquareClick(square));
        ui.board.append(button);
      }
    }
  }

  function renderHud() {
    const turnName = chess.turn() === "w" ? "White" : "Black";
    const roleText = network.matchId
      ? state.role === "w" ? "White"
        : state.role === "b" ? "Black" : "Observer"
      : "Local";
    ui.role.textContent = roleText;
    ui.turn.textContent = getStatusHeadline(turnName);
    ui.match.textContent = network.matchId ? `Match ${network.matchId}` : "Local Game";
    ui.status.textContent = state.statusText;
    ui.reset.disabled = Boolean(network.matchId && !isHost());
    ui.resign.disabled = Boolean(network.matchId && state.role !== "w" && state.role !== "b");
  }

  function renderPlayers() {
    ui.players.replaceChildren();
    for (const role of ["w", "b"]) {
      const player = network.matchId ? state.players.find((item) => state.roles[item.id] === role) : { name: "Local player" };
      const row = document.createElement("div");
      row.className = "chess-player-row";
      row.innerHTML = `
        <span>${role === "w" ? "White" : "Black"}</span>
        <strong>${escapeHtml(player?.name ?? "Waiting...")}</strong>
      `;
      ui.players.append(row);
    }
  }

  function renderMoves() {
    ui.moves.replaceChildren();
    const moves = state.serverMoves.length
      ? state.serverMoves
      : chess.history({ verbose: true }).map((move) => ({ san: move.san, from: move.from, to: move.to }));
    for (let index = 0; index < moves.length; index += 2) {
      const row = document.createElement("li");
      const white = moves[index]?.san || `${moves[index]?.from ?? ""}${moves[index]?.to ?? ""}`;
      const black = moves[index + 1]?.san || (moves[index + 1] ? `${moves[index + 1].from}${moves[index + 1].to}` : "");
      row.innerHTML = `<span>${Math.floor(index / 2) + 1}.</span><strong>${escapeHtml(white)}</strong><em>${escapeHtml(black)}</em>`;
      ui.moves.append(row);
    }
  }

  function handleSquareClick(square) {
    if (!canInteractWithBoard()) {
      return;
    }

    const piece = chess.get(square);
    if (state.selected && state.legalTargets.has(square)) {
      makeMove(state.selected, square);
      return;
    }

    if (piece && piece.color === chess.turn() && canMoveTurn(piece.color)) {
      state.selected = square;
      state.legalTargets = new Set(chess.moves({ square, verbose: true }).map((move) => move.to));
    } else {
      state.selected = null;
      state.legalTargets.clear();
    }
    render();
  }

  function makeMove(from, to) {
    const move = chess.move({ from, to, promotion: "q" });
    if (!move) {
      state.statusText = "Illegal move";
      render();
      return;
    }

    state.selected = null;
    state.legalTargets.clear();
    state.lastMove = { from: move.from, to: move.to };
    const status = getChessStatus();
    state.gameStatus = status;
    state.result = getResultForStatus(status, move.color);
    state.statusText = getMoveStatus(move, status);

    if (network.matchId) {
      sendNetwork({
        type: "chess_move",
        from: move.from,
        to: move.to,
        promotion: move.promotion || "",
        san: move.san,
        lan: move.lan || `${move.from}${move.to}`,
        fen: chess.fen(),
        pgn: chess.pgn(),
        status,
        result: state.result
      });
    }
    render();
  }

  function canInteractWithBoard() {
    if (state.gameStatus !== "playing" || chess.isGameOver()) {
      return false;
    }
    if (!network.matchId) {
      return true;
    }
    return state.role === chess.turn();
  }

  function canMoveTurn(color) {
    return !network.matchId || state.role === color;
  }

  function connectNetwork(afterConnect = null) {
    if (network.connected) {
      afterConnect?.();
      return;
    }
    if (network.connecting) {
      return;
    }

    let url = appendQuery(normalizeWebSocketUrl(options.serverUrl || import.meta.env.VITE_WS_URL || "ws://127.0.0.1:8000/ws"), "player_name", options.playerName || "Player");
    url = appendAccessToken(url, options.accessToken || import.meta.env.VITE_BACKEND_ACCESS_TOKEN || "");
    network.connecting = true;
    state.statusText = "Connecting...";
    render();

    try {
      const socket = new WebSocket(url);
      network.socket = socket;
      socket.addEventListener("open", () => {
        network.connected = true;
        network.connecting = false;
        state.statusText = "Connected";
        afterConnect?.();
        render();
      });
      socket.addEventListener("message", (event) => {
        try {
          handleNetworkMessage(JSON.parse(event.data));
        } catch {
          state.statusText = "Invalid server message";
          render();
        }
      });
      socket.addEventListener("close", () => {
        network.connected = false;
        network.connecting = false;
        network.socket = null;
        network.clientId = null;
        network.matchId = null;
        network.hostId = null;
        state.role = null;
        state.players = [];
        state.roles = {};
        state.statusText = "Disconnected";
        render();
      });
      socket.addEventListener("error", () => {
        state.statusText = "WebSocket connection error";
        render();
      });
    } catch {
      network.connecting = false;
      state.statusText = "Could not open WebSocket";
      render();
    }
  }

  function joinNetworkMatch(matchId) {
    const cleanMatchId = String(matchId || "").replace(/\D/g, "").slice(0, 6);
    if (!cleanMatchId) {
      state.statusText = "Missing match ID";
      render();
      return;
    }
    connectNetwork(() => {
      sendNetwork({ type: "join_match", match_id: cleanMatchId });
    });
  }

  function handleNetworkMessage(message) {
    if (message.type === "connected") {
      network.clientId = message.player?.id ?? null;
      state.statusText = "Connected";
      render();
      return;
    }
    if (message.type === "joined_match" || message.type === "match_state" || message.type === "match_created") {
      syncMatchState(message.match);
      return;
    }
    if (message.type === "chess_state") {
      syncMatchState(message.match);
      return;
    }
    if (message.type === "error") {
      state.statusText = `${message.code}: ${message.message}`;
      render();
    }
  }

  function syncMatchState(match) {
    if (!match?.id) {
      return;
    }
    network.matchId = match.id;
    network.hostId = match.host_id ?? null;
    state.players = Array.isArray(match.players) ? match.players : [];
    const gameState = match.game_state || {};
    const roles = gameState.roles && typeof gameState.roles === "object" ? gameState.roles : {};
    state.roles = roles;
    state.role = roles[network.clientId] ?? null;
    if (state.role) {
      state.orientation = state.role;
    }
    loadServerGameState(gameState, match.status);
    window.dispatchEvent(new CustomEvent("arcade:room-ready", {
      detail: {
        matchId: match.id,
        mode: "chess",
        players: state.players.length,
        maxPlayers: match.max_players ?? 2
      }
    }));
    render();
  }

  function loadServerGameState(gameState, matchStatus) {
    const fen = gameState.fen || "start";
    try {
      if (fen === "start") {
        chess.reset();
      } else if (fen !== chess.fen()) {
        chess.load(fen);
      }
    } catch {
      state.statusText = "Server sent an invalid board";
      return;
    }
    state.serverMoves = Array.isArray(gameState.moves) ? gameState.moves : [];
    state.lastMove = gameState.last_move || state.serverMoves.at(-1) || null;
    state.gameStatus = gameState.status || (matchStatus === "finished" ? "finished" : "playing");
    state.result = gameState.result || "";
    if (state.gameStatus === "waiting" || matchStatus === "lobby") {
      state.statusText = "Waiting for second player";
    } else if (matchStatus === "finished" || state.gameStatus !== "playing") {
      state.statusText = `Game finished ${state.result || ""}`.trim();
    } else if (state.role === chess.turn()) {
      state.statusText = "Your move";
    } else if (state.role) {
      state.statusText = "Opponent's move";
    } else {
      state.statusText = "Observing";
    }
  }

  function sendNetwork(message) {
    if (!network.socket || network.socket.readyState !== WebSocket.OPEN) {
      state.statusText = "Not connected";
      render();
      return false;
    }
    network.socket.send(JSON.stringify(message));
    return true;
  }

  function disconnectNetwork() {
    network.socket?.close();
    network.socket = null;
  }

  function destroy() {
    disposed = true;
    while (eventCleanups.length) {
      eventCleanups.pop()();
    }
    disconnectNetwork();
    root.replaceChildren();
  }

  function isHost() {
    return network.clientId && network.hostId && network.clientId === network.hostId;
  }

  function isLastMoveSquare(square) {
    return state.lastMove && (state.lastMove.from === square || state.lastMove.to === square);
  }

  function getChessStatus() {
    if (chess.isCheckmate()) return "checkmate";
    if (chess.isStalemate()) return "stalemate";
    if (chess.isInsufficientMaterial()) return "insufficient";
    if (chess.isThreefoldRepetition()) return "threefold";
    if (chess.isDraw()) return "draw";
    return "playing";
  }

  function getResultForStatus(status, movingColor) {
    if (status === "checkmate") {
      return movingColor === "w" ? "1-0" : "0-1";
    }
    if (status !== "playing") {
      return "1/2-1/2";
    }
    return "";
  }

  function getStatusHeadline(turnName) {
    if (state.gameStatus === "checkmate") {
      return `Checkmate ${state.result}`;
    }
    if (state.gameStatus !== "playing" && state.gameStatus !== "waiting") {
      return `Finished ${state.result}`;
    }
    if (chess.inCheck()) {
      return `${turnName} in check`;
    }
    return `${turnName} to move`;
  }

  function getMoveStatus(move, status) {
    if (status === "checkmate") return `Checkmate by ${move.san}`;
    if (status !== "playing") return `Game drawn: ${status}`;
    return `${move.color === "w" ? "White" : "Black"} played ${move.san}`;
  }
}

function normalizeWebSocketUrl(value) {
  const cleanValue = String(value || "").trim();
  if (cleanValue.startsWith("https://")) {
    return `wss://${cleanValue.slice("https://".length)}`;
  }
  if (cleanValue.startsWith("http://")) {
    return `ws://${cleanValue.slice("http://".length)}`;
  }
  if (cleanValue.startsWith("ws://") && shouldUseSecureWebSocket(cleanValue)) {
    return `wss://${cleanValue.slice("ws://".length)}`;
  }
  return cleanValue;
}

function shouldUseSecureWebSocket(value) {
  if (window.location.protocol === "https:") {
    return true;
  }
  try {
    const url = new URL(value);
    return url.hostname.endsWith(".onrender.com");
  } catch {
    return false;
  }
}

function appendQuery(url, key, value) {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
}

function appendAccessToken(url, accessToken) {
  const cleanToken = String(accessToken || "").trim();
  if (!cleanToken) {
    return url;
  }
  return appendQuery(url, "access_token", cleanToken);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
