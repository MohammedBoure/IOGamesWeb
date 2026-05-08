import { findGame, games } from "../games/catalog.js";
import {
  getStoredMatchId,
  getStoredPlayerName,
  saveMatchId,
  savePlayerName,
  sanitizeMatchId,
  sanitizePlayerName
} from "../shared/playerProfile.js";

const DEFAULT_PLAYER_NAME = import.meta.env.VITE_DEFAULT_PLAYER_NAME || "Player";
const DEFAULT_SERVER_URL = import.meta.env.VITE_WS_URL || "ws://127.0.0.1:8000/ws";
const BACKEND_ACCESS_TOKEN = import.meta.env.VITE_BACKEND_ACCESS_TOKEN || "";
const BACKEND_WAKE_WAIT_SECONDS = 60;
const BACKEND_HEALTH_TIMEOUT_MS = 9000;
const BACKEND_HEALTH_RETRY_MS = 5000;

const GAME_VIEW_HTML = `
  <div id="game"></div>

  <div class="hud" aria-hidden="false">
    <div id="scoreboard" class="scoreboard">
      <div class="score-heading">
        <span>SCORE</span>
        <strong>HP | K/D</strong>
      </div>
      <div id="scoreRows" class="score-rows">
        <div class="score-empty">Deathmatch</div>
      </div>
    </div>

    <div class="crosshair">
      <i></i>
      <i></i>
      <i></i>
      <i></i>
      <b></b>
    </div>

    <div id="pulseMarker" class="pulse-marker">
      <i></i>
      <i></i>
      <i></i>
      <i></i>
    </div>

    <div id="combatFeed" class="combat-feed" aria-live="polite"></div>

    <div id="matchPanel" class="match-panel">
      <span id="matchStateValue">Warmup</span>
      <strong id="matchTimerValue">03:00</strong>
      <small id="matchGoalValue">First to 8</small>
    </div>

    <div id="healthPanel" class="health-panel">
      <span>HP</span>
      <div class="health-track"><i id="healthBar"></i></div>
      <strong id="healthValue">5/5</strong>
    </div>

    <div id="weaponPanel" class="weapon-panel">
      <div class="weapon-panel-head">
        <span id="weaponSlotLabel">1</span>
        <strong id="weaponNameValue">Rifle</strong>
      </div>
      <div class="weapon-panel-body">
        <strong id="weaponAmmoValue">--</strong>
        <span id="weaponStateValue">READY</span>
      </div>
      <div class="reload-track"><i id="weaponReloadBar"></i></div>
    </div>

    <div class="hud-bottom">
      <div class="motion-panel">
        <div class="meter">
          <span>Energy</span>
          <div class="meter-track"><i id="boostBar"></i></div>
          <strong id="boostValue">100</strong>
        </div>
        <div class="meter pulse">
          <span>BHOP</span>
          <div class="meter-track"><i id="pulseBar"></i></div>
          <strong id="pulseValue">0x</strong>
        </div>
      </div>

      <div class="race-panel">
        <div class="race-stat">
          <span>Lap</span>
          <strong id="raceLapValue">1/3</strong>
        </div>
        <div class="race-stat">
          <span>Checkpoint</span>
          <strong id="raceCheckpointValue">1/4</strong>
        </div>
      </div>

      <div class="speed-box">
        <span>Speed</span>
        <strong id="speedValue">0</strong>
      </div>
    </div>

    <div id="statusToast" class="status-toast"></div>
    <div id="pickupNotice" class="pickup-notice"></div>
    <div id="damageVignette" class="damage-vignette"></div>
    <div id="respawnOverlay" class="respawn-overlay">
      <strong id="respawnTitle">Respawning</strong>
      <span id="respawnTimer">1.0</span>
    </div>
  </div>

  <section id="startScreen" class="overlay active">
    <div class="modal">
      <p class="eyebrow">NEON AIM ARENA</p>
      <h1>Aim Arena</h1>
      <p class="brief">Precision hops, power slides, fast movement, and clean aiming.</p>
      <div class="mode-selector" aria-label="Game mode">
        <button id="shooterModeButton" class="mode-button active" type="button">Shooter</button>
        <button id="racingModeButton" class="mode-button" type="button">Car Racing</button>
      </div>
      <div class="network-panel">
        <label>
          <span>Name</span>
          <input id="playerNameInput" type="text" maxlength="32" value="Player" autocomplete="off" />
        </label>
        <label>
          <span>Match ID</span>
          <input id="matchIdInput" type="text" maxlength="6" inputmode="numeric" pattern="[0-9]*" placeholder="Leave empty when creating a match" autocomplete="off" dir="ltr" />
        </label>
        <div class="network-actions">
          <button id="connectButton" class="ghost-button compact" type="button">Connect</button>
          <button id="createMatchButton" class="ghost-button compact" type="button">Create Match</button>
          <button id="joinMatchButton" class="ghost-button compact" type="button">Join</button>
        </div>
        <p id="networkStatus" class="network-status">Disconnected</p>
      </div>
      <button id="startButton" class="primary-button" type="button">Enter Arena</button>
    </div>
  </section>

  <section id="pauseScreen" class="overlay">
    <div class="modal settings-modal">
      <p class="eyebrow">PAUSED</p>
      <h2>Settings</h2>
      <div class="menu-actions">
        <button id="resumeButton" class="primary-button" type="button">Resume</button>
        <button id="restartButton" class="ghost-button" type="button">Reset Position</button>
      </div>
      <div class="network-panel settings-panel">
        <label>
          <span>Session ID</span>
          <input id="sessionIdValue" type="text" value="No session" readonly dir="ltr" />
        </label>
        <label>
          <span>Name</span>
          <input id="settingsPlayerNameInput" type="text" maxlength="32" value="Player" autocomplete="off" />
        </label>
        <label>
          <span>Match ID</span>
          <input id="settingsMatchIdInput" type="text" maxlength="6" inputmode="numeric" pattern="[0-9]*" placeholder="123456" autocomplete="off" dir="ltr" />
        </label>
        <div class="network-actions">
          <button id="settingsConnectButton" class="ghost-button compact" type="button">Connect</button>
          <button id="settingsCreateMatchButton" class="ghost-button compact" type="button">Create</button>
          <button id="settingsJoinMatchButton" class="ghost-button compact" type="button">Join</button>
          <button id="settingsDisconnectButton" class="ghost-button compact danger" type="button">Disconnect</button>
        </div>
        <p id="settingsNetworkStatus" class="network-status">Disconnected</p>
      </div>
      <label class="slider-row">
        <span>Sensitivity</span>
        <input id="sensitivitySlider" type="range" min="0.5" max="2.2" step="0.05" value="1" />
      </label>
    </div>
  </section>

  <section id="matchEndScreen" class="overlay match-end-screen">
    <div class="modal small">
      <p class="eyebrow">ROUND COMPLETE</p>
      <h2 id="matchEndTitle">Round Complete</h2>
      <p id="matchEndBrief" class="brief">Nice run.</p>
      <div class="menu-actions">
        <button id="rematchButton" class="primary-button" type="button">Rematch</button>
        <button id="leaveMatchButton" class="ghost-button" type="button">Back to Games</button>
      </div>
    </div>
  </section>
`;

const SIMPLE_GAME_VIEW_HTML = `<div id="game"></div>`;

export function createArcadeApp(root) {
  if (!root) {
    throw new Error("App root element not found.");
  }

  let selectedGameId = games[0]?.id;
  let activeRuntime = null;
  let launchToken = 0;
  let exitHandler = null;
  let createdRoomLease = null;
  let pendingRoomReadyReleaseHandler = null;
  let backendCheckToken = 0;
  let backendRetryTimer = null;
  let backendCountdownTimer = null;
  let backendWakeStartedAt = 0;
  const backendGate = {
    status: "checking",
    title: "Checking backend",
    detail: "Contacting the game server...",
    ready: false,
    secondsRemaining: null
  };

  function renderLibrary(statusText = "") {
    destroyActiveGame();
    document.body.dataset.screen = "library";

    const selectedGame = findGame(selectedGameId);
    const playerName = getStoredPlayerName(DEFAULT_PLAYER_NAME);
    const lastMatchId = getStoredMatchId();

    root.innerHTML = `
      <section class="library-view" aria-label="IOGamesWeb">
        <header class="library-topbar">
          <div class="brand-lockup">
            <span class="brand-mark" aria-hidden="true"></span>
            <div>
              <p class="eyebrow">IOGamesWeb</p>
              <h1>Games</h1>
            </div>
          </div>
          <div class="library-top-actions">
            <div class="library-stat" aria-label="Available games">
              <span>Games</span>
              <strong>${games.length}</strong>
            </div>
            <label class="profile-control">
              <span>Player</span>
              <input id="libraryPlayerName" type="text" maxlength="32" value="${escapeHtml(playerName)}" autocomplete="off" />
            </label>
          </div>
        </header>

        <div class="library-layout">
          <section class="games-list" aria-label="Games list">
            ${games.map((game) => renderGameButton(game, selectedGame.id)).join("")}
          </section>

          <section class="room-panel library-room" aria-label="Room">
            <p class="eyebrow">ROOM</p>
            <h2>${escapeHtml(selectedGame.title)}</h2>
            <p class="brief">${escapeHtml(selectedGame.summary)}</p>
            <div class="selected-game-preview">
              <img src="${escapeHtml(selectedGame.image)}" alt="" />
              <div class="selected-game-metrics">
                <span>${escapeHtml(selectedGame.label)}</span>
                <span>${escapeHtml(selectedGame.pace)}</span>
                <span>${escapeHtml(selectedGame.capacity)}</span>
              </div>
            </div>
            <div id="backendGate" class="backend-gate" data-status="${escapeHtml(backendGate.status)}" role="status" aria-live="polite">
              <span class="backend-gate-dot"></span>
              <span class="backend-gate-copy">
                <strong id="backendGateTitle">${escapeHtml(backendGate.title)}</strong>
                <small id="backendGateDetail">${escapeHtml(backendGate.detail)}</small>
              </span>
              <button id="retryBackendButton" class="ghost-button compact" type="button">Retry</button>
            </div>
            <label>
              <span>Match ID</span>
              <input id="libraryMatchId" type="text" maxlength="6" inputmode="numeric" pattern="[0-9]*" placeholder="123456" autocomplete="off" dir="ltr" />
            </label>
            <div class="match-tools">
              <button id="lastMatchButton" class="ghost-button compact" type="button" ${lastMatchId ? "" : "hidden"}>Last ${escapeHtml(lastMatchId)}</button>
              <button id="clearMatchButton" class="ghost-button compact" type="button">Clear</button>
            </div>
            <div class="room-actions">
              <button id="createRoomButton" class="primary-button" type="button">Create Room</button>
              <button id="joinRoomButton" class="ghost-button" type="button">Join Room</button>
            </div>
            <p id="libraryStatus" class="network-status">${escapeHtml(statusText)}</p>
          </section>
        </div>
      </section>
    `;

    bindLibraryEvents();
    updateBackendGateView();
  }

  function renderGameButton(game, selectedId) {
    const selected = game.id === selectedId ? " selected" : "";
    return `
      <button class="game-card${selected}" type="button" data-game-id="${escapeHtml(game.id)}">
        <span class="game-accent ${escapeHtml(game.accent)}"></span>
        <span class="game-thumb">
          <img src="${escapeHtml(game.image)}" alt="" loading="lazy" />
        </span>
        <span class="game-meta">
          <span class="game-card-head">
            <strong>${escapeHtml(game.title)}</strong>
            <em>${selected ? "Selected" : escapeHtml(game.label)}</em>
          </span>
          <small>${escapeHtml(game.summary)}</small>
          <span class="game-tags">
            <span>${escapeHtml(game.pace)}</span>
            <span>${escapeHtml(game.capacity)}</span>
          </span>
        </span>
      </button>
    `;
  }

  function bindLibraryEvents() {
    const playerNameInput = root.querySelector("#libraryPlayerName");
    const matchIdInput = root.querySelector("#libraryMatchId");
    const status = root.querySelector("#libraryStatus");

    playerNameInput?.addEventListener("input", () => {
      savePlayerName(playerNameInput.value, DEFAULT_PLAYER_NAME);
    });
    matchIdInput?.addEventListener("input", () => {
      const cleanMatchId = sanitizeMatchId(matchIdInput.value);
      if (matchIdInput.value !== cleanMatchId) {
        matchIdInput.value = cleanMatchId;
      }
      if (cleanMatchId.length === 6) {
        saveMatchId(cleanMatchId);
        status.textContent = "";
      }
    });
    matchIdInput?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        root.querySelector("#joinRoomButton")?.click();
      }
    });

    root.querySelectorAll("[data-game-id]").forEach((button) => {
      button.addEventListener("click", () => {
        selectedGameId = button.dataset.gameId;
        renderLibrary();
      });
    });

    root.querySelector("#createRoomButton")?.addEventListener("click", () => {
      if (!backendGate.ready) {
        status.textContent = "Backend is still starting. Please wait.";
        startBackendCheck(true);
        return;
      }
      createRoomDialog();
    });
    root.querySelector("#joinRoomButton")?.addEventListener("click", () => {
      if (!backendGate.ready) {
        status.textContent = "Backend is still starting. Please wait.";
        startBackendCheck(true);
        return;
      }
      const cleanMatchId = sanitizeMatchId(matchIdInput?.value);
      if (matchIdInput && matchIdInput.value !== cleanMatchId) {
        matchIdInput.value = cleanMatchId;
      }
      if (cleanMatchId.length !== 6) {
        status.textContent = "Enter a 6-digit Match ID.";
        matchIdInput?.focus();
        return;
      }
      saveMatchId(cleanMatchId);
      launchGame("join", cleanMatchId);
    });
    root.querySelector("#retryBackendButton")?.addEventListener("click", () => {
      status.textContent = "";
      startBackendCheck(true);
    });
    root.querySelector("#lastMatchButton")?.addEventListener("click", () => {
      const lastMatchId = getStoredMatchId();
      if (matchIdInput && lastMatchId) {
        matchIdInput.value = lastMatchId;
        status.textContent = "";
        matchIdInput.focus();
      }
    });
    root.querySelector("#clearMatchButton")?.addEventListener("click", () => {
      if (matchIdInput) {
        matchIdInput.value = "";
        matchIdInput.focus();
      }
      status.textContent = "";
    });
  }

  async function createRoomDialog() {
    const selectedGame = findGame(selectedGameId);
    const playerNameInput = root.querySelector("#libraryPlayerName");
    const createButton = root.querySelector("#createRoomButton");
    const status = root.querySelector("#libraryStatus");
    const playerName = savePlayerName(playerNameInput?.value, DEFAULT_PLAYER_NAME);
    const serverUrl = DEFAULT_SERVER_URL;

    if (createButton) {
      createButton.disabled = true;
    }
    status.textContent = "Creating room...";

    try {
      releaseCreatedRoomLease();
      createdRoomLease = await createBackendRoom({
        serverUrl,
        playerName,
        accessToken: BACKEND_ACCESS_TOKEN,
        game: selectedGame
      });
      showCreatedRoomDialog(createdRoomLease.match.id);
      status.textContent = "";
    } catch (error) {
      status.textContent = error.message || "Could not create the room.";
    } finally {
      updateBackendGateView();
    }
  }

  async function launchGame(roomAction, matchIdOverride = "", options = {}) {
    const selectedGame = findGame(selectedGameId);
    const playerNameInput = root.querySelector("#libraryPlayerName");
    const matchIdInput = root.querySelector("#libraryMatchId");
    const playerName = savePlayerName(playerNameInput?.value, DEFAULT_PLAYER_NAME);
    const serverUrl = DEFAULT_SERVER_URL;
    const matchId = roomAction === "join" ? sanitizeMatchId(matchIdOverride || matchIdInput?.value) : "";
    const token = ++launchToken;

    if (roomAction === "join" && matchId) {
      saveMatchId(matchId);
    }

    document.body.dataset.screen = "game";
    const gameViewHtml = selectedGame.usesArcadeHud === false ? SIMPLE_GAME_VIEW_HTML : GAME_VIEW_HTML;
    root.innerHTML = `
      <section class="game-shell" aria-label="${escapeHtml(selectedGame.title)}">
        <button id="backToGamesButton" class="back-to-games" type="button">Back to Games</button>
        <div id="gameLoadStatus" class="game-load-status">Loading ${escapeHtml(selectedGame.title)}...</div>
        ${gameViewHtml}
      </section>
    `;

    const backButton = root.querySelector("#backToGamesButton");
    const loadStatus = root.querySelector("#gameLoadStatus");
    exitHandler = () => renderLibrary();
    window.addEventListener("arcade:game-exit", exitHandler);
    if (options.releaseRoomWhenJoined) {
      if (pendingRoomReadyReleaseHandler) {
        window.removeEventListener("arcade:room-ready", pendingRoomReadyReleaseHandler);
      }
      const releaseWhenJoined = (event) => {
        if (!matchId || event.detail?.matchId === matchId) {
          window.removeEventListener("arcade:room-ready", releaseWhenJoined);
          pendingRoomReadyReleaseHandler = null;
          options.releaseRoomWhenJoined();
        }
      };
      pendingRoomReadyReleaseHandler = releaseWhenJoined;
      window.addEventListener("arcade:room-ready", releaseWhenJoined);
    }
    backButton?.addEventListener("click", () => renderLibrary());

    try {
      const module = await selectedGame.load();
      if (token !== launchToken) {
        return;
      }
      activeRuntime = module.mountGame({
        root: root.querySelector("#game"),
        playerName: sanitizePlayerName(playerName, DEFAULT_PLAYER_NAME),
        serverUrl,
        accessToken: BACKEND_ACCESS_TOKEN,
        matchId,
        roomAction,
        autoStart: roomAction === "join"
      });
      loadStatus?.remove();
    } catch (error) {
      if (loadStatus) {
        loadStatus.textContent = "Could not load the game.";
      }
    }
  }

  function destroyActiveGame() {
    launchToken += 1;
    activeRuntime?.destroy?.();
    activeRuntime = null;
    releaseCreatedRoomLease();
    if (exitHandler) {
      window.removeEventListener("arcade:game-exit", exitHandler);
      exitHandler = null;
    }
    if (pendingRoomReadyReleaseHandler) {
      window.removeEventListener("arcade:room-ready", pendingRoomReadyReleaseHandler);
      pendingRoomReadyReleaseHandler = null;
    }
  }

  function showCreatedRoomDialog(matchId) {
    matchId = String(matchId || "").trim();
    if (!matchId) {
      return;
    }

    root.querySelector("#roomDialogBackdrop")?.remove();
    saveMatchId(matchId);
    const dialog = document.createElement("section");
    dialog.id = "roomDialogBackdrop";
    dialog.className = "room-dialog-backdrop";
    dialog.innerHTML = `
      <div class="room-dialog" role="dialog" aria-modal="true" aria-labelledby="roomDialogTitle">
        <p class="eyebrow">ROOM CREATED</p>
        <h2 id="roomDialogTitle">Room Ready</h2>
        <label>
          <span>Match ID</span>
          <div class="copy-field">
            <input id="createdMatchId" type="text" value="${escapeHtml(matchId)}" readonly dir="ltr" maxlength="6" inputmode="numeric" />
            <button id="copyCreatedMatchButton" type="button">Copy</button>
          </div>
        </label>
        <div class="dialog-actions">
          <button id="enterCreatedRoomButton" class="primary-button" type="button">Enter</button>
          <button id="closeRoomDialogButton" class="ghost-button" type="button">Close</button>
        </div>
      </div>
    `;
    root.append(dialog);
    const libraryMatchId = root.querySelector("#libraryMatchId");
    if (libraryMatchId) {
      libraryMatchId.value = matchId;
    }
    dialog.querySelector("#createdMatchId")?.select();
    dialog.querySelector("#closeRoomDialogButton")?.addEventListener("click", () => {
      releaseCreatedRoomLease();
      dialog.remove();
    });
    dialog.querySelector("#enterCreatedRoomButton")?.addEventListener("click", () => {
      dialog.remove();
      const lease = createdRoomLease;
      launchGame("join", matchId, {
        releaseRoomWhenJoined() {
          if (createdRoomLease === lease) {
            releaseCreatedRoomLease();
          } else {
            lease?.release();
          }
        }
      });
    });
    dialog.querySelector("#copyCreatedMatchButton")?.addEventListener("click", async (event) => {
      const copied = await copyText(matchId);
      event.currentTarget.textContent = copied ? "Copied" : "Select text";
      setTimeout(() => {
        event.currentTarget.textContent = "Copy";
      }, 1200);
    });
  }

  function releaseCreatedRoomLease() {
    createdRoomLease?.release();
    createdRoomLease = null;
  }

  renderLibrary();
  if (new URLSearchParams(window.location.search).has("capture")) {
    launchGame(null);
  } else {
    startBackendCheck();
  }

  return {
    destroy() {
      destroyActiveGame();
      stopBackendCheck();
    }
  };

  function startBackendCheck(force = false) {
    if (backendGate.ready && !force) {
      updateBackendGateView();
      return;
    }
    window.clearTimeout(backendRetryTimer);
    checkBackendHealth(force);
  }

  async function checkBackendHealth(force = false) {
    const checkToken = ++backendCheckToken;
    if (force) {
      backendWakeStartedAt = 0;
    }
    if (backendGate.status !== "waking") {
      setBackendGate({
        status: "checking",
        title: "Checking backend",
        detail: "Contacting the game server...",
        ready: false,
        secondsRemaining: null
      });
    }

    try {
      const health = await fetchBackendHealth(DEFAULT_SERVER_URL);
      if (checkToken !== backendCheckToken) {
        return;
      }
      stopBackendCountdown();
      backendWakeStartedAt = 0;
      setBackendGate({
        status: "ready",
        title: "Backend connected",
        detail: `Ready for multiplayer. Players online: ${health.players ?? 0}`,
        ready: true,
        secondsRemaining: null
      });
    } catch {
      if (checkToken !== backendCheckToken) {
        return;
      }
      if (!backendWakeStartedAt) {
        backendWakeStartedAt = Date.now();
      }
      setBackendWakingState();
      startBackendCountdown();
      backendRetryTimer = window.setTimeout(() => checkBackendHealth(), BACKEND_HEALTH_RETRY_MS);
    }
  }

  function setBackendWakingState() {
    const elapsedSeconds = Math.floor((Date.now() - backendWakeStartedAt) / 1000);
    const secondsRemaining = Math.max(0, BACKEND_WAKE_WAIT_SECONDS - elapsedSeconds);
    const detail = secondsRemaining > 0
      ? `Render may be waking the free instance. Wait ${secondsRemaining} sec.`
      : "Still waking the backend. Retrying now...";
    setBackendGate({
      status: "waking",
      title: "Backend is starting",
      detail,
      ready: false,
      secondsRemaining
    });
  }

  function setBackendGate(nextState) {
    Object.assign(backendGate, nextState);
    updateBackendGateView();
  }

  function updateBackendGateView() {
    const gate = root.querySelector("#backendGate");
    const title = root.querySelector("#backendGateTitle");
    const detail = root.querySelector("#backendGateDetail");
    const retryButton = root.querySelector("#retryBackendButton");
    const createButton = root.querySelector("#createRoomButton");
    const joinButton = root.querySelector("#joinRoomButton");

    if (gate) {
      gate.dataset.status = backendGate.status;
    }
    if (title) {
      title.textContent = backendGate.title;
    }
    if (detail) {
      detail.textContent = backendGate.detail;
    }
    if (retryButton) {
      retryButton.hidden = backendGate.status === "ready" || backendGate.status === "checking";
      retryButton.disabled = backendGate.status === "checking";
    }
    if (createButton) {
      createButton.disabled = !backendGate.ready;
    }
    if (joinButton) {
      joinButton.disabled = !backendGate.ready;
    }
  }

  function startBackendCountdown() {
    if (backendCountdownTimer) {
      return;
    }
    backendCountdownTimer = window.setInterval(() => {
      if (backendGate.status !== "waking") {
        stopBackendCountdown();
        return;
      }
      setBackendWakingState();
    }, 1000);
  }

  function stopBackendCountdown() {
    window.clearInterval(backendCountdownTimer);
    backendCountdownTimer = null;
  }

  function stopBackendCheck() {
    backendCheckToken += 1;
    window.clearTimeout(backendRetryTimer);
    backendRetryTimer = null;
    stopBackendCountdown();
  }
}

async function fetchBackendHealth(serverUrl) {
  const healthUrl = appendQuery(toBackendHealthUrl(serverUrl), "wake", Date.now());
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), BACKEND_HEALTH_TIMEOUT_MS);

  try {
    const response = await fetch(healthUrl, {
      cache: "no-store",
      signal: controller.signal
    });
    if (!response.ok) {
      throw new Error(`Health check failed: ${response.status}`);
    }
    const payload = await response.json();
    if (!payload?.ok) {
      throw new Error("Backend health check did not return ok.");
    }
    return payload;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function createBackendRoom({ serverUrl, playerName, accessToken, game }) {
  return new Promise((resolve, reject) => {
    let url = appendQuery(normalizeWebSocketUrl(serverUrl), "player_name", playerName);
    url = appendAccessToken(url, accessToken);
    let settled = false;
    let socket = null;
    const timeoutId = window.setTimeout(() => {
      finish(null, new Error("Room creation timed out."));
    }, 9000);

    function finish(match, error) {
      if (settled) {
        return;
      }
      settled = true;
      window.clearTimeout(timeoutId);
      if (error) {
        if (socket && socket.readyState === WebSocket.OPEN) {
          socket.close();
        }
        reject(error);
      } else {
        resolve({
          match,
          release() {
            if (socket && socket.readyState === WebSocket.OPEN) {
              socket.close();
            }
            socket = null;
          }
        });
      }
    }

    try {
      socket = new WebSocket(url);
    } catch {
      finish(null, new Error("Could not open the room connection."));
      return;
    }

    socket.addEventListener("message", (event) => {
      let message = null;
      try {
        message = JSON.parse(event.data);
      } catch {
        finish(null, new Error("Invalid server message."));
        return;
      }

      if (message.type === "connected") {
        socket.send(JSON.stringify({
          type: "create_match",
          settings: {
            mode: game.roomMode || (game.mode === "racing" ? "racing" : "deathmatch"),
            map: game.map || (game.mode === "racing" ? "neon_circuit" : "aim_arena"),
            max_players: game.maxPlayers || 12,
            duration_seconds: 180,
            score_limit: 8
          }
        }));
        return;
      }

      if (message.type === "match_created") {
        finish(message.match);
        return;
      }

      if (message.type === "error") {
        finish(null, new Error(`${message.code}: ${message.message}`));
      }
    });

    socket.addEventListener("error", () => {
      finish(null, new Error("WebSocket connection error."));
    });
    socket.addEventListener("close", () => {
      if (!settled) {
        finish(null, new Error("The connection closed before the room was created."));
      }
    });
  });
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

function toBackendHealthUrl(serverUrl) {
  const normalizedUrl = normalizeWebSocketUrl(serverUrl)
    .replace(/^wss:\/\//, "https://")
    .replace(/^ws:\/\//, "http://");
  const url = new URL(normalizedUrl);
  url.pathname = url.pathname.replace(/\/ws\/?$/, "/health");
  if (!url.pathname.endsWith("/health")) {
    url.pathname = `${url.pathname.replace(/\/$/, "")}/health`;
  }
  url.search = "";
  url.hash = "";
  return url.toString();
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

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function copyText(value) {
  if (!value) {
    return false;
  }
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.append(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();
    return copied;
  }
}
