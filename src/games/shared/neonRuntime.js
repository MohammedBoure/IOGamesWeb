import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MTLLoader } from "three/examples/jsm/loaders/MTLLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { clone as cloneSkinnedModel } from "three/examples/jsm/utils/SkeletonUtils.js";
import { worldAssets } from "../../shared/worldAssets.js";

export function createNeonArenaRuntime(options = {}) {
const runtimeOptions = {
  mode: "shooter",
  playerName: import.meta.env.VITE_DEFAULT_PLAYER_NAME || "Player",
  serverUrl: import.meta.env.VITE_WS_URL || "ws://127.0.0.1:8000/ws",
  accessToken: import.meta.env.VITE_BACKEND_ACCESS_TOKEN || "",
  matchId: "",
  roomAction: null,
  lockMode: true,
  autoStart: false,
  root: null,
  ...options
};
const root = runtimeOptions.root ?? document.querySelector("#game");
if (!root) {
  throw new Error("Game root element not found.");
}
let disposed = false;
let animationFrameId = 0;
const eventCleanups = [];

function addEvent(target, type, handler, options) {
  if (!target) {
    return;
  }
  target.addEventListener(type, handler, options);
  eventCleanups.push(() => target.removeEventListener(type, handler, options));
}

const hud = {
  start: document.querySelector("#startScreen"),
  pause: document.querySelector("#pauseScreen"),
  startButton: document.querySelector("#startButton"),
  startTitle: document.querySelector("#startScreen h1"),
  startBrief: document.querySelector("#startScreen .brief"),
  modeSelector: document.querySelector("#startScreen .mode-selector"),
  shooterModeButton: document.querySelector("#shooterModeButton"),
  racingModeButton: document.querySelector("#racingModeButton"),
  resumeButton: document.querySelector("#resumeButton"),
  restartButton: document.querySelector("#restartButton"),
  sensitivity: document.querySelector("#sensitivitySlider"),
  boostBar: document.querySelector("#boostBar"),
  boostValue: document.querySelector("#boostValue"),
  pulseBar: document.querySelector("#pulseBar"),
  pulseValue: document.querySelector("#pulseValue"),
  speedValue: document.querySelector("#speedValue"),
  scoreboard: document.querySelector("#scoreboard"),
  scoreRows: document.querySelector("#scoreRows"),
  crosshair: document.querySelector(".crosshair"),
  combatFeed: document.querySelector("#combatFeed"),
  weaponPanel: document.querySelector("#weaponPanel"),
  weaponSlotLabel: document.querySelector("#weaponSlotLabel"),
  weaponNameValue: document.querySelector("#weaponNameValue"),
  weaponAmmoValue: document.querySelector("#weaponAmmoValue"),
  weaponStateValue: document.querySelector("#weaponStateValue"),
  weaponReloadBar: document.querySelector("#weaponReloadBar"),
  raceLapValue: document.querySelector("#raceLapValue"),
  raceCheckpointValue: document.querySelector("#raceCheckpointValue"),
  pulseMarker: document.querySelector("#pulseMarker"),
  statusToast: document.querySelector("#statusToast"),
  playerNameInput: document.querySelector("#playerNameInput"),
  serverUrlInput: document.querySelector("#serverUrlInput"),
  matchIdInput: document.querySelector("#matchIdInput"),
  connectButton: document.querySelector("#connectButton"),
  createMatchButton: document.querySelector("#createMatchButton"),
  joinMatchButton: document.querySelector("#joinMatchButton"),
  networkStatus: document.querySelector("#networkStatus"),
  sessionIdValue: document.querySelector("#sessionIdValue"),
  settingsPlayerNameInput: document.querySelector("#settingsPlayerNameInput"),
  settingsServerUrlInput: document.querySelector("#settingsServerUrlInput"),
  settingsMatchIdInput: document.querySelector("#settingsMatchIdInput"),
  settingsConnectButton: document.querySelector("#settingsConnectButton"),
  settingsCreateMatchButton: document.querySelector("#settingsCreateMatchButton"),
  settingsJoinMatchButton: document.querySelector("#settingsJoinMatchButton"),
  settingsDisconnectButton: document.querySelector("#settingsDisconnectButton"),
  settingsNetworkStatus: document.querySelector("#settingsNetworkStatus")
};

const captureMode = new URLSearchParams(window.location.search).has("capture");
const clock = new THREE.Clock();
const WORLD_UP = new THREE.Vector3(0, 1, 0);
const ARENA = 150;
const HALF_ARENA = ARENA / 2;
const PLAYER_RADIUS = 0.42;
const PLAYER_HEIGHT = 1.72;
const GRAVITY = -27;
const JUMP_FORCE = 8.85;
const COYOTE_TIME = 0.09;
const BHOP_BUFFER = 0.22;
const FAST_SLIDE_BUFFER = 0.18;
const PERFECT_HOP_WINDOW = 0.11;
const HOP_CHAIN_TIMEOUT = 0.74;
const HOP_ASSIST_TIME = 0.34;
const BHOP_CHAIN_MAX = 12;
const SLIDE_DURATION = 0.62;
const SLIDE_COOLDOWN = 0.16;
const CROUCH_HEIGHT = 1.18;
const SLIDE_HEIGHT = 0.98;
const TARGET_COUNT = 9;
const FIRE_INTERVAL = 0.105;
const GAME_MODES = {
  SHOOTER: "shooter",
  RACING: "racing"
};
const INITIAL_GAME_MODE = runtimeOptions.mode === GAME_MODES.RACING ? GAME_MODES.RACING : GAME_MODES.SHOOTER;
const RACE_TRACK = {
  centerX: 56,
  centerZ: 46,
  roadWidth: 14,
  horizontalLength: 124,
  verticalLength: 104,
  outerX: 66,
  outerZ: 56,
  innerX: 46,
  innerZ: 36,
  checkpointRadius: 7.2
};
const COLLISION_SKIN = 0.08;
const MOVE_STEP = 0.26;
const WEAPON_CLIP_DISTANCE = 1.22;
const WEAPON_SWITCH_TIME = 0.18;
const LOCAL_WEAPON_MODEL_LENGTH = 1.46;
const REMOTE_WEAPON_MODEL_LENGTH = 0.98;
const REMOTE_HAND_WEAPON_LENGTH = 1.08;
const REMOTE_CHARACTER_HEIGHT = 1.74;
const REMOTE_CHARACTER_YAW_OFFSET = Math.PI;
const REMOTE_WEAPON_HAND_NAMES = ["WristR", "Wrist.R", "HandR", "RightHand"];
const tempVec3 = new THREE.Vector3();
const tempVec2 = new THREE.Vector2();
const raycaster = new THREE.Raycaster();

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: "high-performance",
  preserveDrawingBuffer: captureMode
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.55));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.18;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
root.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = createSkyTexture();
scene.fog = new THREE.Fog(0xdcefff, 72, 190);

const camera = new THREE.PerspectiveCamera(74, window.innerWidth / window.innerHeight, 0.06, 240);
camera.rotation.order = "YXZ";

const player = new THREE.Object3D();
const pitch = new THREE.Object3D();
pitch.position.y = PLAYER_HEIGHT;
pitch.add(camera);
player.add(pitch);
scene.add(player);

const materials = createMaterials();
const shooterWorld = new THREE.Group();
const colliders = [];
const targets = [];
const effects = [];
const raceCheckpoints = [];
const remotePlayers = new Map();
const scorePlayers = new Map();
const worldModelCache = new Map();
const keys = new Set();
const MOVEMENT_KEYS = new Set(["z", "s", "q", "d"]);
const WEAPON_KEYS = new Set(["1", "2", "3", "4", "5", "6", "7", "8", "9"]);
const GAMEPLAY_KEYS = new Set(["z", "s", "q", "d", " ", "control", "ctrl", "r", "x", ...WEAPON_KEYS]);
const DEFAULT_SERVER_URL = runtimeOptions.serverUrl || import.meta.env.VITE_WS_URL || "ws://127.0.0.1:8000/ws";
const DEFAULT_PLAYER_NAME = runtimeOptions.playerName || import.meta.env.VITE_DEFAULT_PLAYER_NAME || "Player";
const BACKEND_ACCESS_TOKEN = runtimeOptions.accessToken || import.meta.env.VITE_BACKEND_ACCESS_TOKEN || "";
const EMPTY_SESSION_LABEL = "No session";
const runtimeModels = createRuntimeAssetState(runtimeOptions.assets);
const startCopy = {
  title: hud.startTitle?.textContent ?? "",
  brief: hud.startBrief?.textContent ?? "",
  button: hud.startButton?.textContent ?? ""
};

const state = {
  mode: INITIAL_GAME_MODE,
  running: false,
  paused: false,
  sensitivity: 1,
  bhopChain: 0,
  bhopBuffer: 0,
  fastSlideBuffer: 0,
  slideTimer: 0,
  slideCooldown: 0,
  hopAssistTimer: 0,
  chainTimer: 0,
  groundTime: 0,
  airTime: 0,
  landingWindow: 0,
  motionTimer: 0,
  motionKick: 0,
  motionRoll: 0,
  motionStyle: "idle",
  stamina: 100,
  fireTimer: 0,
  jumpQueued: false,
  grounded: false,
  wasGrounded: false,
  coyote: 0,
  verticalVelocity: 0,
  bob: 0,
  swayX: 0,
  swayY: 0,
  recoil: 0,
  firing: false,
  toastTimer: 0,
  settingsRequested: false,
  alive: true,
  weaponSlot: 0,
  weaponSwitchTimer: 0
};

const weaponStates = new Map();

const velocity = new THREE.Vector3();
const wishDir = new THREE.Vector3();
const weapon = createWeapon();
loadRuntimeModels();
const audio = createAudioSystem();
const race = {
  world: new THREE.Group(),
  car: null,
  speed: 0,
  velocity: new THREE.Vector2(),
  steer: 0,
  heading: 0,
  drift: 0,
  lap: 1,
  laps: 3,
  nextCheckpoint: 0,
  finished: false,
  boostTimer: 0,
  driftTrailTimer: 0,
  cameraLook: new THREE.Vector3(),
  cameraPosition: new THREE.Vector3()
};
const localSnapshot = {
  id: "local",
  position: [0, 0, 0],
  rotation: [0, 0],
  velocity: [0, 0, 0],
  grounded: false,
  bhopChain: 0,
  weaponSlot: 0,
  animation: "idle",
  alive: true
};
const network = {
  socket: null,
  connected: false,
  connecting: false,
  clientId: null,
  matchId: null,
  afterConnect: null,
  sendTimer: 0
};

hydrateNetworkForm();
setupWorld();
setupRacingWorld();
setupEvents();
applyGameMode();
if (state.mode === GAME_MODES.RACING) {
  resetRace();
} else {
  resetRound(false);
}
if (runtimeOptions.matchId) {
  setMatchIdInput(runtimeOptions.matchId);
}
updateHud();
animate();

window.NeonAimNet = {
  getLocalSnapshot,
  connect: connectNetwork,
  createMatch: createNetworkMatch,
  joinMatch: joinNetworkMatch,
  disconnect: disconnectNetwork
};
window.NeonYardNet = window.NeonAimNet;

if (runtimeOptions.roomAction === "create") {
  createNetworkMatch();
} else if (runtimeOptions.roomAction === "join") {
  joinNetworkMatch(runtimeOptions.matchId);
}
if (runtimeOptions.autoStart && runtimeOptions.roomAction !== "join") {
  startGame();
}

return {
  destroy,
  getLocalSnapshot,
  connect: connectNetwork,
  createMatch: createNetworkMatch,
  joinMatch: joinNetworkMatch,
  disconnect: disconnectNetwork
};

function setupWorld() {
  scene.add(shooterWorld);

  const hemi = new THREE.HemisphereLight(0xffffff, 0xcad7cf, 1.55);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xfff2d6, 2.25);
  sun.position.set(-28, 42, 26);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -88;
  sun.shadow.camera.right = 88;
  sun.shadow.camera.top = 88;
  sun.shadow.camera.bottom = -88;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 150;
  scene.add(sun);

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(ARENA + 18, ARENA + 18), materials.floor);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  shooterWorld.add(floor);

  addShooterGroundLayout();
  addArenaShell();
  addMovementGeometry();
  addTargetLanes();
  addAmbientMarkers();
  addShooterWorldProps();
}

function setupRacingWorld() {
  race.world.visible = false;
  scene.add(race.world);
  addRacingTerrain();

  const trackPieces = [
    [0, RACE_TRACK.centerZ, RACE_TRACK.horizontalLength, RACE_TRACK.roadWidth],
    [0, -RACE_TRACK.centerZ, RACE_TRACK.horizontalLength, RACE_TRACK.roadWidth],
    [RACE_TRACK.centerX, 0, RACE_TRACK.roadWidth, RACE_TRACK.verticalLength],
    [-RACE_TRACK.centerX, 0, RACE_TRACK.roadWidth, RACE_TRACK.verticalLength]
  ];

  for (const [x, z, w, d] of trackPieces) {
    const road = new THREE.Mesh(new THREE.BoxGeometry(w, 0.06, d), materials.raceTrack);
    road.position.set(x, 0.035, z);
    road.receiveShadow = true;
    race.world.add(road);
  }

  const curbPieces = [
    [0, 53.2, 122, 0.28],
    [0, 38.8, 104, 0.28],
    [0, -53.2, 122, 0.28],
    [0, -38.8, 104, 0.28],
    [63.2, 0, 0.28, 102],
    [48.8, 0, 0.28, 74],
    [-63.2, 0, 0.28, 102],
    [-48.8, 0, 0.28, 74]
  ];

  for (const [x, z, w, d] of curbPieces) {
    const curb = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, d), materials.raceCurb);
    curb.position.set(x, 0.08, z);
    race.world.add(curb);
  }

  const banks = [
    [0, 57.2, 128, 4.6, "x", -0.22],
    [0, 34.8, 108, 3.8, "x", 0.19],
    [0, -57.2, 128, 4.6, "x", 0.22],
    [0, -34.8, 108, 3.8, "x", -0.19],
    [67.2, 0, 4.6, 108, "z", 0.22],
    [44.8, 0, 3.8, 76, "z", -0.19],
    [-67.2, 0, 4.6, 108, "z", -0.22],
    [-44.8, 0, 3.8, 76, "z", 0.19]
  ];

  for (const [x, z, w, d, axis, tilt] of banks) {
    addRaceBank(x, z, w, d, axis, tilt);
  }

  addRaceCornerBank(56, 46, 0.24, 1);
  addRaceCornerBank(56, -46, -0.24, 1);
  addRaceCornerBank(-56, -46, 0.24, -1);
  addRaceCornerBank(-56, 46, -0.24, -1);

  const checkpoints = [
    { position: new THREE.Vector3(0, 0.18, 46), label: "START" },
    { position: new THREE.Vector3(56, 0.18, 46), label: "2" },
    { position: new THREE.Vector3(56, 0.18, 0), label: "3" },
    { position: new THREE.Vector3(56, 0.18, -46), label: "4" },
    { position: new THREE.Vector3(0, 0.18, -46), label: "5" },
    { position: new THREE.Vector3(-56, 0.18, -46), label: "6" },
    { position: new THREE.Vector3(-56, 0.18, 0), label: "7" },
    { position: new THREE.Vector3(-56, 0.18, 46), label: "8" }
  ];

  for (const checkpoint of checkpoints) {
    raceCheckpoints.push(checkpoint);
    const marker = new THREE.Mesh(new THREE.TorusGeometry(3.4, 0.06, 8, 56), materials.accentAmber);
    marker.position.copy(checkpoint.position);
    marker.rotation.x = Math.PI / 2;
    race.world.add(marker);
  }

  race.car = createRaceCar();
  race.world.add(race.car);
  addRacingWorldProps();
}

function addRacingTerrain() {
  const ground = new THREE.Mesh(new THREE.BoxGeometry(168, 0.08, 146), materials.field);
  ground.position.y = -0.04;
  ground.receiveShadow = true;
  race.world.add(ground);

  addGroundPatch(race.world, 0, RACE_TRACK.centerZ, 132, 20, 0, materials.raceShoulder, 0.012);
  addGroundPatch(race.world, 0, -RACE_TRACK.centerZ, 132, 20, 0, materials.raceShoulder, 0.012);
  addGroundPatch(race.world, RACE_TRACK.centerX, 0, 20, 112, 0, materials.raceShoulder, 0.012);
  addGroundPatch(race.world, -RACE_TRACK.centerX, 0, 20, 112, 0, materials.raceShoulder, 0.012);
  addGroundPatch(race.world, 0, 0, 78, 58, 0, materials.meadowDark, 0.018);
  addGroundPatch(race.world, -58, 58, 30, 18, 0.22, materials.dirt, 0.018);
  addGroundPatch(race.world, 58, -58, 30, 18, -0.22, materials.dirt, 0.018);
}

function addRaceBank(x, z, width, depth, axis, tilt) {
  const bank = new THREE.Mesh(new THREE.BoxGeometry(width, 0.2, depth), materials.raceBank);
  bank.position.set(x, 0.16, z);
  if (axis === "x") {
    bank.rotation.x = tilt;
  } else {
    bank.rotation.z = tilt;
  }
  bank.receiveShadow = true;
  race.world.add(bank);
}

function addRaceCornerBank(x, z, tilt, side) {
  const group = new THREE.Group();
  group.position.set(x, 0.15, z);
  group.rotation.y = side * Math.PI * 0.25;
  race.world.add(group);

  const outer = new THREE.Mesh(new THREE.BoxGeometry(24, 0.22, 4.6), materials.raceBank);
  outer.rotation.x = tilt;
  outer.receiveShadow = true;
  group.add(outer);

  const inner = new THREE.Mesh(new THREE.BoxGeometry(16, 0.18, 3.6), materials.raceCurb);
  inner.position.z = -side * 8.6;
  inner.rotation.x = -tilt * 0.7;
  inner.receiveShadow = true;
  group.add(inner);
}

function createRaceCar(bodyMaterial = materials.raceCarBody, accentMaterial = materials.accentGreen) {
  const group = new THREE.Group();

  const body = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.36, 2.35), bodyMaterial);
  body.position.y = 0.42;
  body.castShadow = true;
  group.add(body);

  const cabin = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.34, 0.88), materials.raceGlass);
  cabin.position.set(0, 0.78, -0.18);
  cabin.castShadow = true;
  group.add(cabin);

  const nose = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.16, 0.54), accentMaterial);
  nose.position.set(0, 0.54, -1.22);
  group.add(nose);

  const spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.54, 0.08, 0.28), materials.platformDark);
  spoiler.position.set(0, 0.82, 1.24);
  group.add(spoiler);

  for (const sideX of [-0.72, 0.72]) {
    for (const sideZ of [-0.78, 0.78]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.22, 18), materials.platformDark);
      wheel.position.set(sideX, 0.28, sideZ);
      wheel.rotation.z = Math.PI / 2;
      wheel.castShadow = true;
      group.add(wheel);
    }
  }

  const headLightMaterial = materials.targetCore.clone();
  for (const side of [-1, 1]) {
    const light = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.07, 0.04), headLightMaterial);
    light.position.set(side * 0.36, 0.54, -1.2);
    group.add(light);
  }

  return group;
}

function createMaterials() {
  const floorTexture = createFloorTexture();
  floorTexture.wrapS = THREE.RepeatWrapping;
  floorTexture.wrapT = THREE.RepeatWrapping;
  floorTexture.repeat.set(4, 4);
  floorTexture.colorSpace = THREE.SRGBColorSpace;

  return {
    floor: new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.86,
      metalness: 0.02,
      map: floorTexture
    }),
    wall: new THREE.MeshStandardMaterial({
      color: 0x87987c,
      roughness: 0.82,
      metalness: 0.04
    }),
    platform: new THREE.MeshStandardMaterial({
      color: 0xb98a58,
      roughness: 0.7,
      metalness: 0.03
    }),
    platformDark: new THREE.MeshStandardMaterial({
      color: 0x6f5842,
      roughness: 0.76,
      metalness: 0.05
    }),
    dirt: new THREE.MeshStandardMaterial({
      color: 0x8c6b47,
      roughness: 0.92,
      metalness: 0.01
    }),
    packedDirt: new THREE.MeshStandardMaterial({
      color: 0xa8845c,
      roughness: 0.88,
      metalness: 0.01
    }),
    field: new THREE.MeshStandardMaterial({
      color: 0x9fb981,
      roughness: 0.9,
      metalness: 0.01
    }),
    meadowDark: new THREE.MeshStandardMaterial({
      color: 0x789a62,
      roughness: 0.92,
      metalness: 0.01
    }),
    raceShoulder: new THREE.MeshStandardMaterial({
      color: 0x69715f,
      roughness: 0.88,
      metalness: 0.02
    }),
    raceTrack: new THREE.MeshStandardMaterial({
      color: 0x303a3b,
      roughness: 0.7,
      metalness: 0.03
    }),
    raceCurb: new THREE.MeshStandardMaterial({
      color: 0xf8fbff,
      roughness: 0.5,
      metalness: 0.04
    }),
    raceBank: new THREE.MeshStandardMaterial({
      color: 0xbfd3cd,
      roughness: 0.66,
      metalness: 0.03
    }),
    raceCarBody: new THREE.MeshStandardMaterial({
      color: 0x1b8dff,
      emissive: 0x0b4f93,
      emissiveIntensity: 0.2,
      roughness: 0.36,
      metalness: 0.16
    }),
    raceGlass: new THREE.MeshStandardMaterial({
      color: 0x102028,
      emissive: 0x2aa8ff,
      emissiveIntensity: 0.22,
      roughness: 0.18,
      metalness: 0.08
    }),
    weapon: new THREE.MeshStandardMaterial({
      color: 0x39484d,
      emissive: 0x0f1618,
      emissiveIntensity: 0.22,
      roughness: 0.34,
      metalness: 0.55
    }),
    accentBlue: new THREE.MeshStandardMaterial({
      color: 0x1b8dff,
      emissive: 0x0f6bd4,
      emissiveIntensity: 0.62,
      roughness: 0.24,
      metalness: 0.08
    }),
    accentGreen: new THREE.MeshStandardMaterial({
      color: 0x20d488,
      emissive: 0x11a369,
      emissiveIntensity: 0.58,
      roughness: 0.24,
      metalness: 0.08
    }),
    accentAmber: new THREE.MeshStandardMaterial({
      color: 0xffb238,
      emissive: 0xda7c0c,
      emissiveIntensity: 0.72,
      roughness: 0.24,
      metalness: 0.08
    }),
    targetBody: new THREE.MeshStandardMaterial({
      color: 0xff4d6d,
      emissive: 0xc51d3d,
      emissiveIntensity: 0.45,
      roughness: 0.28,
      metalness: 0.04
    }),
    targetCore: new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xfff3c4,
      emissiveIntensity: 0.26,
      roughness: 0.22,
      metalness: 0.02
    })
  };
}

function addArenaShell() {
  const height = 1.35;
  const depth = 1.25;
  addBox(0, height / 2, -HALF_ARENA, ARENA + depth, height, depth, materials.wall, true);
  addBox(0, height / 2, HALF_ARENA, ARENA + depth, height, depth, materials.wall, true);
  addBox(HALF_ARENA, height / 2, 0, depth, height, ARENA + depth, materials.wall, true);
  addBox(-HALF_ARENA, height / 2, 0, depth, height, ARENA + depth, materials.wall, true);
}

function addShooterGroundLayout() {
  addGroundPatch(shooterWorld, 0, 0, 46, 34, 0, materials.packedDirt, 0.012);
  addGroundPatch(shooterWorld, -38, -44, 30, 22, 0.45, materials.dirt, 0.014);
  addGroundPatch(shooterWorld, -38, 43, 30, 21, -0.35, materials.dirt, 0.014);
  addGroundPatch(shooterWorld, 45, -43, 26, 21, -0.18, materials.dirt, 0.014);
  addGroundPatch(shooterWorld, 45, 43, 26, 21, 0.22, materials.dirt, 0.014);
  addGroundPatch(shooterWorld, 0, -36, 15, 70, 0, materials.dirt, 0.016);
  addGroundPatch(shooterWorld, -34, 0, 58, 11, -0.08, materials.dirt, 0.016);
  addGroundPatch(shooterWorld, 34, 0, 58, 11, 0.08, materials.dirt, 0.016);
  addGroundPatch(shooterWorld, -55, 0, 20, 96, 0, materials.field, 0.006);
  addGroundPatch(shooterWorld, 55, 0, 20, 96, 0, materials.field, 0.006);
}

function addMovementGeometry() {
  const blocks = [
    [-18, -10, 7.2, 2.6, 1.35, 0.08],
    [18, -10, 7.2, 2.6, 1.35, -0.08],
    [-18, 10, 7.2, 2.6, 1.35, -0.08],
    [18, 10, 7.2, 2.6, 1.35, 0.08],
    [0, -15, 5.4, 3.1, 1.55, 0],
    [0, 15, 5.4, 3.1, 1.55, 0],
    [-7, 0, 3.2, 5.4, 1.15, 0.2],
    [7, 0, 3.2, 5.4, 1.15, -0.2]
  ];

  for (const [x, z, w, d, h, r] of blocks) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.rotation.y = r;
    shooterWorld.add(group);

    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), materials.platform);
    body.position.y = h / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    const cap = new THREE.Mesh(new THREE.BoxGeometry(w + 0.18, 0.08, d + 0.18), materials.platformDark);
    cap.position.y = h + 0.04;
    cap.castShadow = true;
    group.add(cap);

    for (const side of [-1, 1]) {
      const frontRail = new THREE.Mesh(new THREE.BoxGeometry(w * 0.86, 0.055, 0.08), materials.platformDark);
      frontRail.position.set(0, h * 0.45, side * (d / 2 + 0.045));
      group.add(frontRail);

      const lowerRail = new THREE.Mesh(new THREE.BoxGeometry(w * 0.72, 0.045, 0.07), materials.platformDark);
      lowerRail.position.set(0, h * 0.18, side * (d / 2 + 0.047));
      group.add(lowerRail);
    }

    for (const side of [-1, 1]) {
      const sideRail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.052, d * 0.8), materials.platformDark);
      sideRail.position.set(side * (w / 2 + 0.045), h * 0.52, 0);
      group.add(sideRail);
    }

    colliders.push(makeRotatedCollider(group.position, w, d, r));
  }

  addRamp(-8, -22, 9, 4, 0.45, 0.25);
  addRamp(12, 20, 9, 4, -0.35, 0.25);
  addSpeedPad(-22, -21, new THREE.Vector3(1, 0, 0.2).normalize());
  addSpeedPad(22, -20, new THREE.Vector3(-1, 0, 0.25).normalize());
  addSpeedPad(0, 14, new THREE.Vector3(0, 0, -1).normalize());
}

function addTargetLanes() {
  const anchors = [
    [-18, 1.4, -25],
    [-8, 2.2, -27],
    [5, 1.65, -26],
    [18, 2.35, -24],
    [-24, 1.8, -8],
    [24, 1.7, -6],
    [-20, 2.2, 12],
    [0, 1.75, 6],
    [20, 2.35, 10]
  ];

  for (let i = 0; i < TARGET_COUNT; i++) {
    const [x, y, z] = anchors[i];
    targets.push(createTarget(i, new THREE.Vector3(x, y, z)));
  }
}

function createTarget(index, anchor) {
  const group = new THREE.Group();
  group.position.copy(anchor);
  shooterWorld.add(group);

  const radius = index % 3 === 0 ? 0.36 : index % 3 === 1 ? 0.44 : 0.52;
  const bodyMaterial = materials.targetBody.clone();
  bodyMaterial.color.setHSL(0.96 - index * 0.035, 0.9, 0.56);
  bodyMaterial.emissive.set(bodyMaterial.color).multiplyScalar(0.65);

  const body = new THREE.Mesh(new THREE.SphereGeometry(radius, 28, 18), bodyMaterial);
  body.castShadow = true;
  body.userData.targetIndex = index;
  group.add(body);

  const core = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.34, 18, 12), materials.targetCore);
  core.position.z = -radius * 0.92;
  core.userData.targetIndex = index;
  group.add(core);

  const ring = new THREE.Mesh(new THREE.TorusGeometry(radius * 1.22, 0.025, 8, 48), materials.accentBlue.clone());
  ring.rotation.x = Math.PI / 2;
  group.add(ring);

  const light = new THREE.PointLight(bodyMaterial.color.getHex(), 0.9, 6, 2);
  group.add(light);

  return {
    group,
    body,
    core,
    ring,
    light,
    anchor,
    baseAnchor: anchor.clone(),
    radius,
    phase: Math.random() * Math.PI * 2,
    speed: randomRange(0.65, 1.25),
    lane: index % 2 === 0 ? "horizontal" : "vertical",
    alive: true,
    respawn: 0
  };
}

function addAmbientMarkers() {
  for (const [x, z, material] of [
    [-27, 24, materials.accentAmber],
    [27, 24, materials.accentBlue],
    [-27, -24, materials.accentGreen],
    [27, -24, materials.accentAmber]
  ]) {
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, 3.4, 10), materials.platformDark);
    tower.position.set(x, 1.7, z);
    tower.castShadow = true;
    shooterWorld.add(tower);

    const marker = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 0.08), material);
    marker.position.set(x, 3.45, z);
    shooterWorld.add(marker);
  }
}

function addShooterWorldProps() {
  const placements = [
    { id: "barn", x: -46, z: -44, rotation: 0.42, scale: 1.22, collider: [9.4, 10] },
    { id: "open-barn", x: -47, z: 42, rotation: -0.36, scale: 1.12, collider: [7.4, 7.8] },
    { id: "silo", x: 48, z: -43, rotation: -0.18, scale: 1.08, collider: [4.4, 4.4] },
    { id: "water-tower", x: 49, z: 42, rotation: 0.22, scale: 1.06, collider: [3.4, 3.4] },
    { id: "well", x: 28, z: 16, rotation: 0.72, scale: 1.45, collider: [2.3, 2.3] },
    { id: "fence", x: -33, z: -57, rotation: 0.08, scale: 1.4 },
    { id: "fence", x: -22, z: -56, rotation: 0.08, scale: 1.4 },
    { id: "fence-2", x: -35, z: 56, rotation: -0.1, scale: 1.4 },
    { id: "fence-2", x: -24, z: 55, rotation: -0.1, scale: 1.4 },
    { id: "fence", x: 37, z: -56, rotation: -0.1, scale: 1.4 },
    { id: "fence-2", x: 38, z: 55, rotation: 0.1, scale: 1.4 },
    { id: "common-tree-1", x: -66, z: -24, rotation: 0.2, scale: 2.7, collider: [2.4, 2.4] },
    { id: "common-tree-1", x: -64, z: 22, rotation: -0.18, scale: 2.35, collider: [2.1, 2.1] },
    { id: "pine-tree-1", x: 64, z: -22, rotation: -0.4, scale: 2.6, collider: [2.1, 2.1] },
    { id: "pine-tree-1", x: 65, z: 22, rotation: 0.36, scale: 2.25, collider: [2, 2] },
    { id: "cactus-1", x: 41, z: -25, rotation: 0.9, scale: 2.15, collider: [1.3, 1.3] },
    { id: "bush-1", x: -31, z: 28, rotation: -0.35, scale: 1.65 },
    { id: "bush-1", x: 31, z: 29, rotation: 0.38, scale: 1.55 },
    { id: "rock-1", x: -30, z: -6, rotation: 0.55, scale: 3.0, collider: [1.6, 1.5] },
    { id: "rock-moss-1", x: 30, z: -25, rotation: -0.2, scale: 2.9, collider: [1.6, 1.5] },
    { id: "wood-log", x: -33, z: 4, rotation: 1.08, scale: 1.9, collider: [1.3, 4.7] },
    { id: "tree-stump", x: 31, z: -2, rotation: -0.65, scale: 2.05, collider: [2.4, 1.9] },
    { id: "grass", x: -12, z: 30, rotation: 0.1, scale: 1.35 },
    { id: "grass", x: 8, z: -30, rotation: -0.18, scale: 1.2 },
    { id: "plant-1", x: 12, z: 30, rotation: -0.1, scale: 1.45 },
    { id: "plant-1", x: -8, z: -31, rotation: 0.25, scale: 1.25 }
  ];

  for (const placement of placements) {
    addWorldProp(shooterWorld, placement);
    if (placement.collider) {
      colliders.push(makeRotatedCollider(
        new THREE.Vector3(placement.x, 0, placement.z),
        placement.collider[0],
        placement.collider[1],
        placement.rotation || 0
      ));
    }
  }
}

function addRacingWorldProps() {
  const placements = [
    { id: "windmill", x: -73, z: 58, rotation: 0.34, scale: 1.35 },
    { id: "barn", x: 73, z: 58, rotation: -0.55, scale: 1.2 },
    { id: "open-barn", x: -74, z: -58, rotation: 0.62, scale: 1.12 },
    { id: "silo", x: 74, z: -58, rotation: -0.2, scale: 1.08 },
    { id: "water-tower", x: 31, z: -68, rotation: 0.3, scale: 1.05 },
    { id: "well", x: -22, z: 4, rotation: -0.5, scale: 1.2 },
    { id: "fence", x: -36, z: 64, rotation: 0, scale: 1.5 },
    { id: "fence", x: -25, z: 64, rotation: 0, scale: 1.5 },
    { id: "fence", x: -14, z: 64, rotation: 0, scale: 1.5 },
    { id: "fence-2", x: 14, z: -64, rotation: Math.PI, scale: 1.5 },
    { id: "fence-2", x: 25, z: -64, rotation: Math.PI, scale: 1.5 },
    { id: "fence-2", x: 36, z: -64, rotation: Math.PI, scale: 1.5 },
    { id: "common-tree-1", x: -72, z: 22, rotation: 0.1, scale: 2.7 },
    { id: "common-tree-1", x: -72, z: 34, rotation: -0.18, scale: 2.4 },
    { id: "pine-tree-1", x: 72, z: 18, rotation: -0.25, scale: 2.55 },
    { id: "pine-tree-1", x: 73, z: 31, rotation: 0.18, scale: 2.35 },
    { id: "palm-tree-1", x: 72, z: -19, rotation: 0.45, scale: 1.8 },
    { id: "palm-tree-1", x: 72, z: -31, rotation: -0.2, scale: 1.65 },
    { id: "cactus-1", x: -73, z: -20, rotation: -0.6, scale: 2.45 },
    { id: "cactus-1", x: -73, z: -32, rotation: 0.15, scale: 2.1 },
    { id: "rock-moss-1", x: 0, z: 0, rotation: 0.4, scale: 4.5 },
    { id: "rock-1", x: 11, z: 8, rotation: -0.2, scale: 3.7 },
    { id: "bush-1", x: -12, z: -8, rotation: 0.2, scale: 2.2 },
    { id: "grass", x: 0, z: 12, rotation: 0.1, scale: 1.8 },
    { id: "plant-1", x: -10, z: 10, rotation: -0.4, scale: 1.75 }
  ];

  for (const placement of placements) {
    addWorldProp(race.world, placement);
  }
}

function addWorldProp(parent, placement) {
  const asset = findWorldAsset(placement.id);
  if (!asset) {
    return;
  }

  loadWorldModel(asset).then((source) => {
    if (disposed || !source) {
      return;
    }
    const model = source.clone(true);
    const group = new THREE.Group();
    group.position.set(placement.x, placement.y ?? 0, placement.z);
    group.rotation.y = placement.rotation || 0;
    parent.add(group);
    prepareWorldModel(model, placement.scale ?? 1);
    group.add(model);
  });
}

function findWorldAsset(id) {
  return worldAssets.find((asset) => asset.id === id || asset.file === id || asset.name === id) || null;
}

function loadWorldModel(asset) {
  if (worldModelCache.has(asset.id)) {
    return worldModelCache.get(asset.id);
  }

  const promise = new MTLLoader()
    .loadAsync(asset.mtl)
    .then((materials) => {
      materials.preload();
      const loader = new OBJLoader();
      loader.setMaterials(materials);
      return loader.loadAsync(asset.obj);
    })
    .then((object) => {
      object.name = asset.id;
      return object;
    })
    .catch((error) => {
      console.warn(`Could not load world model: ${asset.id}`, error);
      return null;
    });

  worldModelCache.set(asset.id, promise);
  return promise;
}

function prepareWorldModel(model, scale) {
  model.scale.setScalar(scale);
  model.traverse((child) => {
    if (!child.isMesh) {
      return;
    }
    child.castShadow = true;
    child.receiveShadow = true;
  });
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  model.position.x -= center.x;
  model.position.z -= center.z;
  model.position.y -= box.min.y;
}

function addGroundPatch(parent, x, z, width, depth, rotation, material, y = 0.01) {
  const patch = new THREE.Mesh(new THREE.BoxGeometry(width, 0.025, depth), material);
  patch.position.set(x, y, z);
  patch.rotation.y = rotation || 0;
  patch.receiveShadow = true;
  parent.add(patch);
  return patch;
}

function addRamp(x, z, width, depth, rotation, height) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.rotation.y = rotation;
  shooterWorld.add(group);

  const ramp = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), materials.platform);
  ramp.position.y = height / 2;
  ramp.rotation.x = -0.12;
  ramp.castShadow = true;
  ramp.receiveShadow = true;
  group.add(ramp);

  colliders.push(makeRotatedCollider(group.position, width, depth, rotation));
}

function addSpeedPad(x, z, direction) {
  const group = new THREE.Group();
  group.position.set(x, 0.06, z);
  shooterWorld.add(group);

  const pad = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.25, 0.1, 32), materials.accentGreen);
  pad.castShadow = true;
  pad.receiveShadow = true;
  group.add(pad);

  const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.88, 3), materials.accentBlue);
  arrow.position.y = 0.15;
  arrow.rotation.x = Math.PI / 2;
  arrow.rotation.z = -Math.atan2(direction.z, direction.x) + Math.PI / 2;
  group.add(arrow);

  group.userData.direction = direction;
  group.userData.cooldown = 0;
  effects.push({
    update(dt) {
      group.userData.cooldown = Math.max(0, group.userData.cooldown - dt);
      group.rotation.y += dt * 0.4;
      if (horizontalDistance(player.position, group.position) < 1.3 && group.userData.cooldown <= 0) {
        velocity.x += direction.x * 5.2;
        velocity.z += direction.z * 5.2;
        state.stamina = Math.min(100, state.stamina + 16);
        group.userData.cooldown = 0.9;
        audio.boost();
        spawnRingBurst(group.position, materials.accentGreen);
      }
    }
  });
}

function addBox(x, y, z, width, height, depth, material, solid = false) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  shooterWorld.add(mesh);
  if (solid) {
    colliders.push(makeRotatedCollider(new THREE.Vector3(x, 0, z), width, depth, 0));
  }
  return mesh;
}

function chooseAccent(x, z) {
  return [materials.accentBlue, materials.accentGreen, materials.accentAmber][Math.abs(Math.round(x + z)) % 3];
}

function createRuntimeAssetState(assetConfig = {}) {
  const weapons = Array.isArray(assetConfig?.weapons) ? assetConfig.weapons : [];
  const preferredWeaponId = assetConfig?.loadout?.primaryWeaponId || assetConfig?.primaryWeaponId || "rifle";
  const weaponAssets = weapons.filter((asset) => asset?.path || asset?.obj);
  const preferredWeaponIndex = Math.max(0, weaponAssets.findIndex((asset) => asset.id === preferredWeaponId));

  return {
    gltfLoader: new GLTFLoader(),
    character: createModelEntry(assetConfig?.character, "character"),
    weaponSlot: preferredWeaponIndex,
    weapons: weaponAssets.map((asset) => createModelEntry(asset, "weapon"))
  };
}

function createModelEntry(asset, kind) {
  return {
    kind,
    asset: asset?.path || asset?.obj ? asset : null,
    gltf: null,
    promise: null,
    failed: false
  };
}

function loadRuntimeModels() {
  state.weaponSlot = THREE.MathUtils.clamp(runtimeModels.weaponSlot, 0, Math.max(0, runtimeModels.weapons.length - 1));
  applyWeaponViewPose(getSelectedWeaponAsset() ?? {}, true);
  positionWeaponMuzzle(getSelectedWeaponAsset() ?? {});

  loadModelEntry(getSelectedWeaponEntry()).then((modelSource) => {
    if (disposed || !modelSource) {
      return;
    }
    mountWeaponModel();
    for (const remote of remotePlayers.values()) {
      mountRemoteWeaponModel(remote);
    }
  });
  preloadWeaponModels();

  loadModelEntry(runtimeModels.character).then((gltf) => {
    if (disposed || !gltf) {
      return;
    }
    for (const remote of remotePlayers.values()) {
      mountRemoteCharacterModel(remote);
    }
  });
}

function loadModelEntry(entry) {
  if (!entry?.asset?.path && !entry?.asset?.obj) {
    return Promise.resolve(null);
  }
  if (entry.gltf) {
    return Promise.resolve(entry.gltf);
  }
  if (!entry.promise) {
    entry.promise = loadAssetModel(entry.asset)
      .then((modelSource) => {
        entry.gltf = modelSource;
        return modelSource;
      })
      .catch((error) => {
        entry.failed = true;
        console.warn(`Could not load ${entry.kind} model: ${entry.asset.path || entry.asset.obj}`, error);
        return null;
      });
  }
  return entry.promise;
}

function loadAssetModel(asset) {
  const format = String(asset?.format || "").toLowerCase();
  if (format === "obj" || asset?.obj) {
    return loadObjAsset(asset);
  }
  return runtimeModels.gltfLoader.loadAsync(asset.path);
}

function loadObjAsset(asset) {
  const objPath = asset.obj || asset.path;
  if (!asset.mtl) {
    return new OBJLoader().loadAsync(objPath).then((object) => ({ scene: object, animations: [] }));
  }
  return new MTLLoader()
    .loadAsync(asset.mtl)
    .then((loadedMaterials) => {
      loadedMaterials.preload();
      const loader = new OBJLoader();
      loader.setMaterials(loadedMaterials);
      return loader.loadAsync(objPath);
    })
    .then((object) => ({ scene: object, animations: [] }));
}

function preloadWeaponModels() {
  for (const entry of runtimeModels.weapons) {
    loadModelEntry(entry);
  }
}

function getSelectedWeaponEntry() {
  return getWeaponEntryForSlot(state.weaponSlot);
}

function getWeaponEntryForSlot(slot) {
  if (!runtimeModels.weapons.length) {
    return null;
  }
  const index = THREE.MathUtils.clamp(Number(slot) || 0, 0, runtimeModels.weapons.length - 1);
  return runtimeModels.weapons[index] ?? runtimeModels.weapons[0] ?? null;
}

function getSelectedWeaponAsset() {
  return getSelectedWeaponEntry()?.asset ?? null;
}

function getWeaponSlotById(weaponId) {
  return runtimeModels.weapons.findIndex((entry) => entry.asset?.id === weaponId);
}

function getWeaponEntryById(weaponId) {
  return runtimeModels.weapons.find((entry) => entry.asset?.id === weaponId) ?? getSelectedWeaponEntry();
}

function getSelectedWeaponProfile() {
  return getWeaponProfile(getSelectedWeaponAsset());
}

function getWeaponProfileById(weaponId) {
  return getWeaponProfile(getWeaponEntryById(weaponId)?.asset);
}

function getWeaponProfile(asset = {}) {
  const fire = asset?.fire ?? {};
  const style = fire.style ?? "rifle";
  const styleAim = {
    sidearm: [0.021, 0.17],
    "hand-cannon": [0.017, 0.14],
    "quick-burst": [0.023, 0.18],
    shotgun: [0.008, 0.08],
    rifle: [0.019, 0.15],
    sniper: [0.01, 0.09],
    ray: [0.027, 0.2],
    lightning: [0.034, 0.24]
  }[style] ?? [0.018, 0.14];
  const rawTracerSpeed = Number(fire.tracerSpeed);
  const defaultTracerSpeed = ["sniper", "ray", "lightning"].includes(style) ? 0 : 180;
  return {
    id: asset?.id ?? "weapon",
    name: asset?.name ?? "Weapon",
    style,
    auto: fire.auto !== false,
    interval: Number(fire.interval) || FIRE_INTERVAL,
    range: Number(fire.range) || 95,
    damage: THREE.MathUtils.clamp(Number(fire.damage) || 1, 1, 5),
    spread: Number(fire.spread) || 0.001,
    projectiles: THREE.MathUtils.clamp(Math.trunc(Number(fire.projectiles) || 1), 1, 12),
    magazine: THREE.MathUtils.clamp(Math.trunc(Number(fire.magazine) || getDefaultMagazine(style)), 1, 60),
    reloadTime: THREE.MathUtils.clamp(Number(fire.reloadTime) || getDefaultReloadTime(style), 0.35, 3),
    recoil: Number(fire.recoil) || 0.12,
    pitchKick: Number(fire.pitchKick) || 0.004,
    yawKick: Number(fire.yawKick) || 0.002,
    aimAssist: Number(fire.aimAssist) || styleAim[0],
    hitRadius: Number(fire.hitRadius) || styleAim[1],
    mobility: THREE.MathUtils.clamp(Number(fire.mobility) || 1, 0.85, 1.12),
    tracerColor: Number(fire.tracerColor) || 0x2aa8ff,
    hitColor: Number(fire.hitColor) || 0xffdf8a,
    tracerRadius: Number(fire.tracerRadius) || 0.01,
    tracerSpeed: Math.max(0, Number.isFinite(rawTracerSpeed) ? rawTracerSpeed : defaultTracerSpeed),
    tracerLength: Math.max(0.08, Number(fire.tracerLength) || 3),
    tracerLifetime: Math.max(0.04, Number(fire.tracerLifetime) || 1),
    flashScale: Math.max(0.4, Number(fire.flashScale) || 1),
    muzzleIntensity: Math.max(2, Number(fire.muzzleIntensity) || 12),
    missDistance: Number(fire.missDistance) || 48,
    pelletMinRange: Math.max(0.5, Number(fire.pelletMinRange) || 0),
    pelletRadiusVariance: THREE.MathUtils.clamp(Number(fire.pelletRadiusVariance) || 0, 0, 0.8)
  };
}

function getDefaultMagazine(style) {
  return {
    sidearm: 8,
    "hand-cannon": 5,
    shotgun: 3,
    rifle: 28,
    sniper: 1,
    ray: 24,
    lightning: 14
  }[style] ?? 18;
}

function getDefaultReloadTime(style) {
  return {
    sidearm: 0.9,
    "hand-cannon": 1.15,
    shotgun: 1.35,
    rifle: 1.35,
    sniper: 1.55,
    ray: 1.1,
    lightning: 1.25
  }[style] ?? 1.2;
}

function mountWeaponModel() {
  const entry = getSelectedWeaponEntry();
  if (!entry?.gltf || !weapon.modelMount) {
    return;
  }
  const model = cloneRuntimeModel(entry.gltf);
  prepareViewWeaponModel(model);
  const asset = entry.asset ?? {};
  applyWeaponViewPose(asset);
  fitWeaponModel(
    model,
    asset.modelLength ?? LOCAL_WEAPON_MODEL_LENGTH,
    vectorFromArray(asset.localOffset, 0.02, -0.03, -0.09),
    asset.localRotation
  );
  positionWeaponMuzzle(asset);
  weapon.modelMount.clear();
  weapon.modelMount.add(model);
  weapon.fallbackGroup.visible = false;
  weapon.model = model;
  weapon.modelEntry = entry;
}

function mountRemoteCharacterModel(remote) {
  if (remote.kind !== "shooter" || remote.characterModel || !runtimeModels.character.gltf || !remote.characterMount) {
    return;
  }
  const model = cloneRuntimeModel(runtimeModels.character.gltf);
  prepareRuntimeModel(model);
  hideEmbeddedCharacterProps(model);
  fitCharacterModel(model, REMOTE_CHARACTER_HEIGHT);
  remote.characterMount.clear();
  remote.characterMount.add(model);
  remote.characterModel = model;
  remote.weaponHand = findRuntimeModelNode(model, REMOTE_WEAPON_HAND_NAMES);
  remote.fallbackBodyGroup.visible = false;
  setupRemoteCharacterAnimation(remote, model, runtimeModels.character.gltf.animations);
  mountRemoteWeaponModel(remote);
}

function mountRemoteWeaponModel(remote) {
  const entry = getWeaponEntryForSlot(remote.weaponSlot);
  if (remote.kind !== "shooter" || !entry || !remote.weaponMount) {
    return;
  }
  if (!entry.gltf) {
    loadModelEntry(entry).then((modelSource) => {
      if (!disposed && modelSource) {
        mountRemoteWeaponModel(remote);
      }
    });
    return;
  }
  const parent = remote.weaponHand || remote.weaponMount;
  const shouldAttachToHand = parent === remote.weaponHand;
  if (remote.weaponModel && remote.weaponModel.parent === parent && remote.weaponModelEntry === entry) {
    return;
  }

  remote.weaponModel?.parent?.remove(remote.weaponModel);
  const model = cloneRuntimeModel(entry.gltf);
  prepareRuntimeModel(model);
  remote.weaponModel = model;
  remote.weaponModelEntry = entry;

  if (shouldAttachToHand) {
    fitHandWeaponModel(model, entry.asset);
  } else {
    fitWeaponModel(
      model,
      entry.asset?.remoteLength ?? REMOTE_WEAPON_MODEL_LENGTH,
      new THREE.Vector3(0, 0, 0),
      entry.asset?.remoteRotation
    );
  }

  if (!shouldAttachToHand) {
    remote.weaponMount.clear();
  }
  parent.add(model);
  remote.weaponAttachedToHand = shouldAttachToHand;
  remote.weaponBasePosition.copy(model.position);
  remote.weaponBaseRotation.copy(model.rotation);
  remote.fallbackWeaponGroup.visible = false;
}

function cloneRuntimeModel(gltf) {
  return cloneSkinnedModel(gltf.scene);
}

function prepareRuntimeModel(model) {
  model.traverse((child) => {
    if (!child.isMesh) {
      return;
    }
    child.castShadow = true;
    child.receiveShadow = false;
    child.frustumCulled = false;
  });
}

function prepareViewWeaponModel(model) {
  const liftColor = new THREE.Color(0xf7fbff);
  prepareRuntimeModel(model);
  model.traverse((child) => {
    if (!child.isMesh || !child.material) {
      return;
    }

    child.castShadow = false;
    child.receiveShadow = false;
    child.renderOrder = 4;

    const sourceMaterials = Array.isArray(child.material) ? child.material : [child.material];
    const displayMaterials = sourceMaterials.map((material) => {
      const next = material.clone();
      if (next.color?.isColor) {
        next.color.offsetHSL(0, -0.02, 0.08);
        next.color.lerp(liftColor, 0.035);
      }
      if (next.emissive?.isColor && next.color?.isColor) {
        next.emissive.copy(next.color).multiplyScalar(0.08);
        next.emissiveIntensity = Math.max(next.emissiveIntensity || 0, 0.08);
      }
      if ("shininess" in next) {
        next.shininess = Math.max(next.shininess ?? 0, 42);
      }
      if ("roughness" in next) {
        next.roughness = Math.min(next.roughness ?? 0.85, 0.72);
      }
      if ("metalness" in next) {
        next.metalness = Math.min(next.metalness ?? 0.4, 0.26);
      }
      next.needsUpdate = true;
      return next;
    });

    child.material = Array.isArray(child.material) ? displayMaterials : displayMaterials[0];
  });
}

function hideEmbeddedCharacterProps(model) {
  model.traverse((child) => {
    if (/pistol/i.test(child.name ?? "")) {
      child.visible = false;
    }
  });
}

function findRuntimeModelNode(model, names) {
  for (const name of names) {
    const node = model.getObjectByName(name);
    if (node) {
      return node;
    }
  }
  return null;
}

function fitWeaponModel(model, targetLength, offset, rotation = null) {
  model.position.set(0, 0, 0);
  setEulerFromArray(model.rotation, rotation, 0, 0, 0);
  model.scale.setScalar(1);
  scaleObjectToLongestAxis(model, targetLength);
  centerObject(model, true);
  model.position.add(offset);
}

function fitHandWeaponModel(model, asset = {}) {
  model.position.set(0, 0, 0);
  setEulerFromArray(model.rotation, asset.handRotation, 0, 0, Math.PI / 2);
  model.scale.setScalar(1);
  scaleObjectToLongestAxis(model, asset.handLength ?? REMOTE_HAND_WEAPON_LENGTH);
  centerObject(model, true);
  model.position.set(0.02, 0.22, -0.025);
}

function positionWeaponMuzzle(asset = {}) {
  const muzzle = vectorFromArray(asset.muzzleOffset, 0, 0.04, -0.92);
  weapon.muzzle.position.copy(muzzle);
  weapon.flash.position.copy(muzzle);
  weapon.flash.position.z += 0.06;
}

function applyWeaponViewPose(asset = {}, immediate = false) {
  weapon.basePosition.copy(vectorFromArray(asset.viewPosition, 0.28, -0.47, -0.84));
  setEulerFromArray(weapon.baseRotation, asset.viewRotation, -0.08, -0.34, 0.038);
  weapon.viewMount.position.copy(vectorFromArray(asset.viewOffset, 0, 0, 0));
  setEulerFromArray(weapon.viewMount.rotation, asset.viewMountRotation, 0, 0, 0);
  const scale = Number(asset.viewScale) || 1;
  weapon.viewMount.scale.setScalar(scale);

  if (immediate) {
    weapon.group.position.copy(weapon.basePosition);
    weapon.group.rotation.copy(weapon.baseRotation);
  }
}

function fitCharacterModel(model, targetHeight) {
  model.position.set(0, 0, 0);
  model.rotation.set(0, REMOTE_CHARACTER_YAW_OFFSET, 0);
  model.scale.setScalar(1);
  scaleObjectToAxis(model, "y", targetHeight);
  centerObject(model, false);
}

function scaleObjectToAxis(object, axis, targetSize) {
  object.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const currentSize = Math.max(size[axis], 0.001);
  object.scale.multiplyScalar(targetSize / currentSize);
  object.updateMatrixWorld(true);
}

function scaleObjectToLongestAxis(object, targetSize) {
  object.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const currentSize = Math.max(size.x, size.y, size.z, 0.001);
  object.scale.multiplyScalar(targetSize / currentSize);
  object.updateMatrixWorld(true);
}

function vectorFromArray(value, fallbackX = 0, fallbackY = 0, fallbackZ = 0) {
  if (!Array.isArray(value) || value.length < 3) {
    return new THREE.Vector3(fallbackX, fallbackY, fallbackZ);
  }
  return new THREE.Vector3(Number(value[0]) || 0, Number(value[1]) || 0, Number(value[2]) || 0);
}

function setEulerFromArray(euler, value, fallbackX = 0, fallbackY = 0, fallbackZ = 0) {
  if (!Array.isArray(value) || value.length < 3) {
    euler.set(fallbackX, fallbackY, fallbackZ);
    return;
  }
  euler.set(Number(value[0]) || 0, Number(value[1]) || 0, Number(value[2]) || 0);
}

function centerObject(object, centerY) {
  object.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(object);
  const center = box.getCenter(new THREE.Vector3());
  object.position.x -= center.x;
  object.position.z -= center.z;
  object.position.y -= centerY ? center.y : box.min.y;
}

function setupRemoteCharacterAnimation(remote, model, animations = []) {
  const idleClip = findAnimationClip(animations, ["Idle_Gun_Pointing", "Idle_Gun", "Idle", "Idle_Neutral"]);
  const walkClip = findAnimationClip(animations, ["Walk", "Run", "Run_Shoot"]);
  const runClip = findAnimationClip(animations, ["Run_Shoot", "Run", "Walk"]);
  const shootClip = findAnimationClip(animations, ["Idle_Gun_Shoot", "Gun_Shoot", "Run_Shoot"]);
  if (!idleClip && !walkClip && !runClip && !shootClip) {
    return;
  }
  remote.mixer = new THREE.AnimationMixer(model);
  remote.animation = {
    current: null,
    actions: {
      idle: idleClip ? remote.mixer.clipAction(idleClip) : null,
      walk: walkClip ? remote.mixer.clipAction(walkClip) : null,
      run: runClip ? remote.mixer.clipAction(runClip) : null,
      shoot: shootClip ? remote.mixer.clipAction(shootClip) : null
    }
  };

  for (const action of Object.values(remote.animation.actions)) {
    if (action) {
      action.enabled = true;
      action.setEffectiveWeight(0);
      action.play();
    }
  }
  setRemoteAnimation(remote, "idle", 0);
}

function findAnimationClip(animations, names) {
  for (const name of names) {
    const clip = THREE.AnimationClip.findByName(animations, name);
    if (clip) {
      return clip;
    }
  }
  return null;
}

function setRemoteAnimation(remote, animationName, fade = 0.16) {
  const animation = remote.animation;
  const nextAction = animation?.actions?.[animationName];
  if (!animation || !nextAction || animation.current === animationName) {
    return;
  }

  const previousAction = animation.actions[animation.current];
  nextAction.enabled = true;
  nextAction.setEffectiveWeight(1);
  if (fade > 0 && previousAction) {
    previousAction.fadeOut(fade);
    nextAction.reset().fadeIn(fade).play();
  } else {
    if (previousAction) {
      previousAction.setEffectiveWeight(0);
    }
    nextAction.reset().setEffectiveWeight(1).play();
  }
  animation.current = animationName;
}

function createWeapon() {
  const group = new THREE.Group();
  group.position.set(0.28, -0.47, -0.84);
  group.rotation.set(-0.08, -0.34, 0.038);
  camera.add(group);

  const viewMount = new THREE.Group();
  const modelMount = new THREE.Group();
  const fallbackGroup = new THREE.Group();
  group.add(viewMount);
  viewMount.add(modelMount);
  viewMount.add(fallbackGroup);

  const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.18, 0.68), materials.weapon);
  receiver.castShadow = true;
  fallbackGroup.add(receiver);

  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.38), materials.platformDark);
  stock.position.set(0.02, -0.01, 0.46);
  stock.rotation.x = -0.08;
  fallbackGroup.add(stock);

  const rail = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.07, 0.9), materials.platformDark);
  rail.position.y = 0.14;
  fallbackGroup.add(rail);

  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.045, 0.72, 14), materials.weapon);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.04, -0.66);
  fallbackGroup.add(barrel);

  const muzzleBrake = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.08, 0.12), materials.platformDark);
  muzzleBrake.position.set(0, 0.04, -1.04);
  fallbackGroup.add(muzzleBrake);

  const magazine = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.42, 0.18), materials.platformDark);
  magazine.position.set(0.03, -0.28, -0.04);
  magazine.rotation.x = 0.18;
  fallbackGroup.add(magazine);

  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.35, 0.17), materials.platformDark);
  grip.position.set(0, -0.24, 0.16);
  grip.rotation.x = -0.24;
  fallbackGroup.add(grip);

  const sideStrip = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.035, 0.48), materials.accentGreen);
  sideStrip.position.set(-0.27, 0.04, -0.14);
  fallbackGroup.add(sideStrip);

  const sight = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.04, 0.15), materials.accentBlue);
  sight.position.set(0, 0.23, -0.22);
  fallbackGroup.add(sight);

  const muzzle = new THREE.PointLight(0xffe4a6, 0, 3.2, 1.8);
  muzzle.position.set(0, 0.04, -0.95);
  viewMount.add(muzzle);

  const flash = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.34, 12), materials.accentAmber);
  flash.position.set(0, 0.04, -0.9);
  flash.rotation.x = -Math.PI / 2;
  flash.visible = false;
  viewMount.add(flash);

  const viewKeyLight = new THREE.PointLight(0xffffff, 2.05, 3.6, 1.35);
  viewKeyLight.position.set(-0.48, 0.42, 0.5);
  viewMount.add(viewKeyLight);

  const viewFillLight = new THREE.PointLight(0x9fe8ff, 0.9, 3, 1.45);
  viewFillLight.position.set(0.34, -0.08, -0.3);
  viewMount.add(viewFillLight);

  return {
    group,
    viewMount,
    modelMount,
    fallbackGroup,
    muzzle,
    flash,
    flashTimer: 0,
    flashBaseScale: 1,
    clipPull: 0,
    basePosition: group.position.clone(),
    baseRotation: group.rotation.clone()
  };
}

function selectWeaponSlot(slot, announce = true) {
  if (state.mode !== GAME_MODES.SHOOTER || !runtimeModels.weapons.length) {
    return false;
  }
  if (slot < 0 || slot >= runtimeModels.weapons.length) {
    return false;
  }
  const nextSlot = slot;
  const entry = getWeaponEntryForSlot(nextSlot);
  if (!entry) {
    return false;
  }

  state.weaponSlot = nextSlot;
  localSnapshot.weaponSlot = nextSlot;
  weapon.model = null;
  weapon.modelEntry = null;
  weapon.modelMount.clear();
  weapon.fallbackGroup.visible = true;
  weapon.clipPull = 0;
  state.recoil = 0;
  state.weaponSwitchTimer = WEAPON_SWITCH_TIME;
  applyWeaponViewPose(entry.asset);
  positionWeaponMuzzle(entry.asset);
  getWeaponRuntimeState(getWeaponProfile(entry.asset));

  loadModelEntry(entry).then((modelSource) => {
    if (disposed || state.weaponSlot !== nextSlot || !modelSource) {
      return;
    }
    mountWeaponModel();
  });

  if (announce) {
    showToast(`${nextSlot + 1} - ${entry.asset?.name ?? "Weapon"}`);
    audio.boost();
  }
  updateLocalSnapshot();
  sendNetworkUpdate(1);
  updateHud();
  return true;
}

function setupEvents() {
  addEvent(hud.startButton, "click", startGame);
  if (!runtimeOptions.lockMode) {
    addEvent(hud.shooterModeButton, "click", () => setGameMode(GAME_MODES.SHOOTER));
    addEvent(hud.racingModeButton, "click", () => setGameMode(GAME_MODES.RACING));
  }
  addEvent(hud.resumeButton, "click", resumeGame);
  addEvent(hud.restartButton, "click", () => restartGame(true));
  addEvent(hud.connectButton, "click", () => connectNetwork());
  addEvent(hud.createMatchButton, "click", () => createNetworkMatch());
  addEvent(hud.joinMatchButton, "click", () => joinNetworkMatch(getMatchIdInput()));
  addEvent(hud.settingsConnectButton, "click", () => connectNetwork());
  addEvent(hud.settingsCreateMatchButton, "click", () => createNetworkMatch());
  addEvent(hud.settingsJoinMatchButton, "click", () => joinNetworkMatch(getMatchIdInput()));
  addEvent(hud.settingsDisconnectButton, "click", () => disconnectNetwork());
  bindSyncedInputs(hud.playerNameInput, hud.settingsPlayerNameInput);
  bindSyncedInputs(hud.serverUrlInput, hud.settingsServerUrlInput);
  bindSyncedInputs(hud.matchIdInput, hud.settingsMatchIdInput);
  addEvent(hud.sensitivity, "input", () => {
    state.sensitivity = Number(hud.sensitivity.value);
  });

  addEvent(renderer.domElement, "click", () => {
    if (state.running && document.pointerLockElement !== renderer.domElement) {
      renderer.domElement.requestPointerLock();
    }
  });

  addEvent(document, "pointerlockchange", () => {
    if (!state.running) {
      return;
    }
    const locked = document.pointerLockElement === renderer.domElement;
    if (locked) {
      state.paused = false;
      state.settingsRequested = false;
      hud.pause.classList.remove("active");
      return;
    }

    clearGameplayInput();
    if (state.settingsRequested) {
      state.settingsRequested = false;
      openPauseSettings();
      return;
    }

    if (!hud.pause.classList.contains("active")) {
      state.paused = false;
    }
  });

  addEvent(document, "mousemove", (event) => {
    if (state.mode !== GAME_MODES.SHOOTER || document.pointerLockElement !== renderer.domElement || state.paused) {
      return;
    }
    const scale = 0.00225 * state.sensitivity;
    state.swayX = event.movementX;
    state.swayY = event.movementY;
    player.rotation.y -= event.movementX * scale;
    pitch.rotation.x -= event.movementY * scale;
    pitch.rotation.x = THREE.MathUtils.clamp(pitch.rotation.x, -1.34, 1.2);
  });

  addEvent(window, "keydown", (event) => {
    const key = normalizeInputKey(event);
    const weaponSlot = state.running && state.mode === GAME_MODES.SHOOTER && !state.paused ? getTopNumberSlot(event) : null;
    if (event.ctrlKey) {
      keys.add("control");
    }
    if (shouldCaptureKey(event, key) || weaponSlot !== null) {
      event.preventDefault();
      event.stopPropagation();
    }
    keys.add(key);
    if (weaponSlot !== null && state.running && !event.repeat) {
      selectWeaponSlot(weaponSlot);
    }
    if (state.mode === GAME_MODES.SHOOTER && key === " ") {
      state.jumpQueued = true;
    }
    if (key === "r") {
      if (state.mode === GAME_MODES.SHOOTER && state.running && !state.paused) {
        beginReload(getSelectedWeaponProfile(), true);
      } else {
        restartGame(true);
      }
    }
    if (key === "x") {
      exitToMenu();
    }
    if (key === "escape" && state.running) {
      state.settingsRequested = true;
      updateSettingsPanel();
      if (document.pointerLockElement === renderer.domElement) {
        document.exitPointerLock();
      } else {
        state.settingsRequested = false;
        openPauseSettings();
      }
    }
  }, { capture: true });

  addEvent(window, "keyup", (event) => {
    const key = normalizeInputKey(event);
    keys.delete(key);
    if (key === "control") {
      keys.delete("ctrl");
    }
  }, { capture: true });

  addEvent(window, "wheel", (event) => {
    if (state.mode !== GAME_MODES.SHOOTER || !state.running || state.paused) {
      return;
    }
    if (isCtrlHeld() || event.ctrlKey) {
      if (event.deltaY > 0) {
        state.fastSlideBuffer = FAST_SLIDE_BUFFER;
      } else {
        state.bhopBuffer = BHOP_BUFFER;
      }
      event.preventDefault();
      event.stopPropagation();
    }
  }, { passive: false, capture: true });

  addEvent(window, "mousedown", (event) => {
    if (state.mode === GAME_MODES.SHOOTER && event.button === 0) {
      audio.resume();
      state.firing = true;
      shoot();
    }
  });
  addEvent(window, "mouseup", (event) => {
    if (event.button === 0) {
      state.firing = false;
    }
  });
  addEvent(window, "contextmenu", (event) => event.preventDefault());

  addEvent(window, "resize", onResize);
  addEvent(window, "blur", () => {
    clearGameplayInput();
  });
}

function startGame() {
  audio.resume();
  state.running = true;
  state.paused = false;
  applyGameMode();
  if (state.mode === GAME_MODES.RACING) {
    resetRace();
  }
  hud.start.classList.remove("active");
  hud.pause.classList.remove("active");
  renderer.domElement.requestPointerLock();
}

function resumeGame() {
  renderer.domElement.requestPointerLock();
}

function openPauseSettings() {
  state.paused = true;
  hud.pause.classList.add("active");
  updateSettingsPanel();
  clearGameplayInput();
}

function setGameMode(mode) {
  state.mode = mode;
  applyGameMode();
  if (!state.running) {
    if (mode === GAME_MODES.RACING) {
      resetRace();
    } else {
      resetRound(false);
    }
  }
}

function applyGameMode() {
  document.body.dataset.mode = state.mode;
  if (hud.modeSelector) {
    hud.modeSelector.hidden = runtimeOptions.lockMode;
  }
  hud.shooterModeButton?.classList.toggle("active", state.mode === GAME_MODES.SHOOTER);
  hud.racingModeButton?.classList.toggle("active", state.mode === GAME_MODES.RACING);
  if (state.mode === GAME_MODES.RACING) {
    hud.startTitle.textContent = "Neon Race Circuit";
    hud.startBrief.textContent = "Z accelerate, S brake, Q/D steer, Space drift handbrake.";
    hud.startButton.textContent = "Start Race";
  } else {
    hud.startTitle.textContent = startCopy.title;
    hud.startBrief.textContent = startCopy.brief;
    hud.startButton.textContent = startCopy.button;
  }
  weapon.group.visible = state.mode === GAME_MODES.SHOOTER;
  shooterWorld.visible = state.mode === GAME_MODES.SHOOTER;
  race.world.visible = state.mode === GAME_MODES.RACING;
  for (const target of targets) {
    target.group.visible = state.mode === GAME_MODES.SHOOTER && target.alive;
  }
  updateHud();
}

function restartGame(lockPointer) {
  if (state.mode === GAME_MODES.RACING) {
    resetRace();
    showToast("Race reset");
    if (lockPointer) {
      audio.resume();
      state.running = true;
      hud.start.classList.remove("active");
      hud.pause.classList.remove("active");
      renderer.domElement.requestPointerLock();
    }
    return;
  }
  resetRound(lockPointer);
}

function clearGameplayInput() {
  keys.clear();
  state.firing = false;
  state.jumpQueued = false;
  state.bhopBuffer = 0;
  state.fastSlideBuffer = 0;
}

function resetMotionTech() {
  state.bhopChain = 0;
  state.bhopBuffer = 0;
  state.fastSlideBuffer = 0;
  state.slideTimer = 0;
  state.slideCooldown = 0;
  state.hopAssistTimer = 0;
  state.chainTimer = 0;
  state.groundTime = 0;
  state.airTime = 0;
  state.landingWindow = 0;
  state.motionTimer = 0;
  state.motionKick = 0;
  state.motionRoll = 0;
  state.motionStyle = "idle";
}

function resetRound(lockPointer) {
  state.mode = GAME_MODES.SHOOTER;
  applyGameMode();
  player.position.set(0, 0, 27);
  player.rotation.set(0, 0, 0);
  pitch.position.y = PLAYER_HEIGHT;
  pitch.rotation.set(0, 0, 0);
  velocity.set(0, 0, 0);
  resetMotionTech();
  state.stamina = 100;
  state.fireTimer = 0;
  state.weaponSwitchTimer = 0;
  resetWeaponInventory();
  state.verticalVelocity = 0;
  state.coyote = 0;
  state.grounded = false;
  state.paused = false;
  state.alive = true;

  targets.forEach((target, index) => {
    target.alive = true;
    target.respawn = 0;
    target.group.visible = true;
    placeTarget(target, index);
  });

  hud.pause.classList.remove("active");
  showToast("Deathmatch base");
  updateHud();

  if (lockPointer) {
    audio.resume();
    state.running = true;
    hud.start.classList.remove("active");
    renderer.domElement.requestPointerLock();
  }
}

function resetRace() {
  state.mode = GAME_MODES.RACING;
  applyGameMode();
  clearGameplayInput();
  race.speed = 0;
  race.velocity.set(0, 0);
  race.steer = 0;
  race.drift = 0;
  race.heading = -Math.PI / 2;
  race.lap = 1;
  race.nextCheckpoint = 1;
  race.finished = false;
  race.boostTimer = 0;
  race.driftTrailTimer = 0;
  race.car.position.set(0, 0.18, RACE_TRACK.centerZ);
  race.car.rotation.set(0, race.heading, 0);
  player.rotation.set(0, 0, 0);
  pitch.rotation.set(0, 0, 0);
  pitch.position.set(0, 0, 0);
  updateRaceCamera(0.016);
  updateHud();
}

function updateRace(dt, time) {
  const accelerateInput = Number(keys.has("z")) - Number(keys.has("s"));
  const steerInput = Number(keys.has("d")) - Number(keys.has("q"));
  const handbrake = keys.has(" ");
  const onTrack = isRaceOnTrack(race.car.position);

  let forwardX = -Math.sin(race.heading);
  let forwardZ = -Math.cos(race.heading);
  let rightX = Math.cos(race.heading);
  let rightZ = -Math.sin(race.heading);
  let forwardSpeed = race.velocity.x * forwardX + race.velocity.y * forwardZ;
  let sideSpeed = race.velocity.x * rightX + race.velocity.y * rightZ;
  const driftIntent = handbrake && onTrack && Math.abs(forwardSpeed) > 7.5 && Math.abs(steerInput) > 0.12;

  const speedFactor = THREE.MathUtils.clamp(Math.abs(forwardSpeed) / 16, 0.12, 1.75);
  const steerResponse = driftIntent ? 5.4 : onTrack ? 7.6 : 4.2;
  race.steer = THREE.MathUtils.damp(race.steer, steerInput, steerResponse, dt);
  race.heading -= race.steer * speedFactor * dt * (forwardSpeed >= 0 ? 1 : -1) * (driftIntent ? 2.35 : 1.55);

  forwardX = -Math.sin(race.heading);
  forwardZ = -Math.cos(race.heading);
  rightX = Math.cos(race.heading);
  rightZ = -Math.sin(race.heading);

  if (accelerateInput > 0) {
    race.velocity.x += forwardX * 24 * dt;
    race.velocity.y += forwardZ * 24 * dt;
  } else if (accelerateInput < 0) {
    const brakingForce = forwardSpeed > 1.5 ? 34 : 12;
    race.velocity.x -= forwardX * brakingForce * dt;
    race.velocity.y -= forwardZ * brakingForce * dt;
  }

  forwardSpeed = race.velocity.x * forwardX + race.velocity.y * forwardZ;
  sideSpeed = race.velocity.x * rightX + race.velocity.y * rightZ;

  if (driftIntent) {
    sideSpeed += race.steer * Math.abs(forwardSpeed) * 5.8 * dt;
    if (accelerateInput > 0) {
      race.boostTimer = Math.max(race.boostTimer, 0.14);
    }
  }

  const lateralGrip = driftIntent ? 0.78 : handbrake ? 1.35 : onTrack ? 6.2 : 2.2;
  sideSpeed *= Math.exp(-lateralGrip * dt);
  forwardSpeed *= Math.exp(-(onTrack ? 0.72 : 1.35) * dt);

  if (accelerateInput === 0) {
    forwardSpeed -= Math.sign(forwardSpeed) * Math.min(Math.abs(forwardSpeed), (onTrack ? 2.8 : 5.5) * dt);
  }

  race.velocity.x = forwardX * forwardSpeed + rightX * sideSpeed;
  race.velocity.y = forwardZ * forwardSpeed + rightZ * sideSpeed;

  race.boostTimer = Math.max(0, race.boostTimer - dt);
  const maxSpeed = (onTrack ? 31 : 15.5) + (race.boostTimer > 0 ? 3.2 : 0);
  const velocityLength = race.velocity.length();
  if (velocityLength > maxSpeed) {
    race.velocity.multiplyScalar(maxSpeed / velocityLength);
  }

  race.speed = race.velocity.length();
  race.car.position.x += race.velocity.x * dt;
  race.car.position.z += race.velocity.y * dt;

  const beforeClampX = race.car.position.x;
  const beforeClampZ = race.car.position.z;
  race.car.position.x = THREE.MathUtils.clamp(race.car.position.x, -RACE_TRACK.outerX - 4, RACE_TRACK.outerX + 4);
  race.car.position.z = THREE.MathUtils.clamp(race.car.position.z, -RACE_TRACK.outerZ - 4, RACE_TRACK.outerZ + 4);
  if (beforeClampX !== race.car.position.x) {
    race.velocity.x *= -0.25;
  }
  if (beforeClampZ !== race.car.position.z) {
    race.velocity.y *= -0.25;
  }

  const slipRatio = THREE.MathUtils.clamp(sideSpeed / Math.max(Math.abs(forwardSpeed), 4), -1, 1);
  race.drift = THREE.MathUtils.damp(race.drift, driftIntent ? Math.abs(slipRatio) : 0, 7, dt);
  const visualSlip = THREE.MathUtils.clamp(slipRatio * 0.28, -0.35, 0.35);
  race.car.rotation.y = race.heading + visualSlip;
  race.car.rotation.z = THREE.MathUtils.damp(race.car.rotation.z, -race.steer * 0.1 + visualSlip * 0.45, 6, dt);
  race.car.rotation.x = THREE.MathUtils.damp(race.car.rotation.x, Math.sin(time * 8) * Math.min(race.speed * 0.0015, 0.04), 8, dt);

  updateDriftTrail(dt);

  updateRaceCheckpoint();
  updateRaceCamera(dt);
}

function updateRaceCamera(dt) {
  const forward = tempVec3.set(-Math.sin(race.heading), 0, -Math.cos(race.heading));
  const desired = race.cameraPosition
    .copy(race.car.position)
    .addScaledVector(forward, -8.4 - Math.min(race.speed * 0.06, 2.4))
    .add(new THREE.Vector3(0, 4.2, 0));
  player.position.lerp(desired, 1 - Math.exp(-8 * dt));
  player.rotation.set(0, 0, 0);
  pitch.position.set(0, 0, 0);
  pitch.rotation.set(0, 0, 0);
  race.cameraLook.copy(race.car.position).add(new THREE.Vector3(0, 1.0, 0)).addScaledVector(forward, 2.1);
  camera.lookAt(race.cameraLook);
  camera.fov = THREE.MathUtils.damp(camera.fov, 66 + Math.min(race.speed * 0.52, 16), 4.5, dt);
  camera.updateProjectionMatrix();
}

function updateDriftTrail(dt) {
  race.driftTrailTimer = Math.max(0, race.driftTrailTimer - dt);
  if (race.drift < 0.18 || race.speed < 9 || race.driftTrailTimer > 0) {
    return;
  }
  race.driftTrailTimer = 0.055;
  spawnDriftTrail();
}

function spawnDriftTrail() {
  const forward = new THREE.Vector3(-Math.sin(race.heading), 0, -Math.cos(race.heading));
  const right = new THREE.Vector3(Math.cos(race.heading), 0, -Math.sin(race.heading));

  for (const side of [-1, 1]) {
    const material = new THREE.MeshBasicMaterial({
      color: 0x152024,
      transparent: true,
      opacity: 0.32,
      depthWrite: false
    });
    const mark = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.012, 1.28), material);
    mark.position
      .copy(race.car.position)
      .addScaledVector(forward, -1.08)
      .addScaledVector(right, side * 0.53);
    mark.position.y = 0.085;
    mark.rotation.y = race.heading;
    race.world.add(mark);

    effects.push({
      object: mark,
      age: 0,
      update(markDt) {
        this.age += markDt;
        material.opacity = Math.max(0, 0.32 * (1 - this.age / 1.65));
        if (this.age >= 1.65) {
          mark.geometry.dispose();
          material.dispose();
          this.done = true;
        }
      }
    });
  }
}

function updateRaceCheckpoint() {
  if (race.finished) {
    return;
  }

  const checkpoint = raceCheckpoints[race.nextCheckpoint];
  if (!checkpoint || horizontalDistance(race.car.position, checkpoint.position) > RACE_TRACK.checkpointRadius) {
    return;
  }

  race.nextCheckpoint += 1;
  if (race.nextCheckpoint >= raceCheckpoints.length) {
    race.nextCheckpoint = 0;
  }

  if (race.nextCheckpoint === 1) {
    if (race.lap >= race.laps) {
      race.finished = true;
      showToast("Race complete");
    } else {
      race.lap += 1;
      showToast(`Lap ${race.lap}/${race.laps}`);
    }
  } else {
    showToast(`Checkpoint ${race.nextCheckpoint + 1}/${raceCheckpoints.length}`);
  }
}

function updateRaceMarkers(time) {
  for (let i = 0; i < race.world.children.length; i++) {
    const child = race.world.children[i];
    if (child.geometry?.type === "TorusGeometry") {
      child.scale.setScalar(1 + Math.sin(time * 3 + i) * 0.04);
    }
  }
}

function isRaceOnTrack(position) {
  const x = Math.abs(position.x);
  const z = Math.abs(position.z);
  return x <= RACE_TRACK.outerX && z <= RACE_TRACK.outerZ && (x >= RACE_TRACK.innerX || z >= RACE_TRACK.innerZ);
}

function exitToMenu() {
  state.running = false;
  state.paused = false;
  state.settingsRequested = false;
  state.alive = true;
  keys.clear();
  velocity.set(0, 0, 0);
  state.verticalVelocity = 0;
  state.firing = false;
  resetMotionTech();
  hud.pause.classList.remove("active");
  hud.start.classList.add("active");
  showToast("Exit");
  if (document.pointerLockElement) {
    document.exitPointerLock();
  }
  window.dispatchEvent(new CustomEvent("arcade:game-exit"));
}

function animate() {
  if (disposed) {
    return;
  }
  animationFrameId = requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.033);
  const time = clock.elapsedTime;

  updateEffects(dt, time);
  if (state.mode === GAME_MODES.SHOOTER) {
    updateTargets(dt, time);
  } else {
    updateRaceMarkers(time);
  }
  updateRemotePlayers(dt);

  if (state.running && !state.paused) {
    updateGame(dt, time);
  }

  updateWeapon(dt, time);
  renderer.render(scene, camera);
}

function updateGame(dt, time) {
  if (state.mode === GAME_MODES.RACING) {
    updateRace(dt, time);
    updateLocalSnapshot();
    sendNetworkUpdate(dt);
    updateHud();
    return;
  }

  state.fireTimer = Math.max(0, state.fireTimer - dt);
  updateWeaponInventory(dt);
  state.bhopBuffer = Math.max(0, state.bhopBuffer - dt);
  state.fastSlideBuffer = Math.max(0, state.fastSlideBuffer - dt);
  state.slideTimer = Math.max(0, state.slideTimer - dt);
  state.slideCooldown = Math.max(0, state.slideCooldown - dt);
  state.hopAssistTimer = Math.max(0, state.hopAssistTimer - dt);
  state.chainTimer = Math.max(0, state.chainTimer - dt);
  state.landingWindow = Math.max(0, state.landingWindow - dt);
  state.motionTimer = Math.max(0, state.motionTimer - dt);
  state.weaponSwitchTimer = Math.max(0, state.weaponSwitchTimer - dt);
  state.motionKick = THREE.MathUtils.damp(state.motionKick, 0, 9, dt);
  state.motionRoll = THREE.MathUtils.damp(state.motionRoll, 0, 8, dt);
  state.stamina = Math.min(100, state.stamina + dt * (state.grounded ? 9 : 5));

  if (!state.alive) {
    velocity.set(0, 0, 0);
    state.verticalVelocity = 0;
    state.firing = false;
    updateLocalSnapshot();
    sendNetworkUpdate(dt);
    updateHud();
    return;
  }

  updateMovement(dt, time);
  if (state.firing && getSelectedWeaponProfile().auto && state.fireTimer <= 0) {
    shoot();
  }
  updateLocalSnapshot();
  sendNetworkUpdate(dt);
  updateHud();
}

function updateMovement(dt, time) {
  const forwardInput = Number(keys.has("z")) - Number(keys.has("s"));
  const strafeInput = Number(keys.has("d")) - Number(keys.has("q"));
  const hasInput = forwardInput !== 0 || strafeInput !== 0;
  const weaponMobility = getSelectedWeaponProfile().mobility;
  const ctrlHeld = isCtrlHeld();
  let slideActive = state.slideTimer > 0;
  let crouchActive = ctrlHeld && !slideActive;

  wishDir.set(strafeInput, 0, -forwardInput);
  if (hasInput) {
    wishDir.normalize().applyAxisAngle(WORLD_UP, player.rotation.y);
  }

  let horizontalSpeed = getHorizontalSpeed();
  const moveIntent = hasInput ? wishDir : cameraForwardFlat();
  const bhopRequested = ctrlHeld && state.bhopBuffer > 0;
  const fastSlideRequested = ctrlHeld && state.fastSlideBuffer > 0;
  const canJump = state.grounded || state.coyote > 0;
  let wheelActionConsumed = false;

  if (fastSlideRequested && state.slideCooldown <= 0) {
    if (state.grounded) {
      startPowerSlide(moveIntent);
      slideActive = true;
      crouchActive = false;
      wheelActionConsumed = true;
    } else {
      applyAirTuck(moveIntent);
      wheelActionConsumed = true;
    }
    state.fastSlideBuffer = 0;
  }

  if (!wheelActionConsumed && (state.jumpQueued || bhopRequested) && canJump) {
    jump(bhopRequested ? "precision" : "normal", moveIntent);
  }
  state.jumpQueued = false;
  horizontalSpeed = getHorizontalSpeed();

  if (state.grounded) {
    state.coyote = COYOTE_TIME;
    const landingMomentum = state.landingWindow > 0 && state.bhopChain > 0;
    const keepSlideSpeed = slideActive && horizontalSpeed > 4.2;
    if (keepSlideSpeed) {
      applyFriction(dt, 0.55);
    } else if (landingMomentum) {
      applyFriction(dt, hasInput ? 2.2 : 3.6);
    } else if (crouchActive) {
      applyFriction(dt, hasInput ? 9.5 : 15.5);
    } else {
      applyFriction(dt, hasInput ? 7.8 : 12.5);
    }
    if (hasInput) {
      if (slideActive) {
        accelerate(wishDir, 6.9 * weaponMobility, 24, dt);
      } else if (crouchActive) {
        accelerate(wishDir, 3.4 * weaponMobility, 22, dt);
      } else {
        accelerate(wishDir, 5.9 * weaponMobility, 62, dt);
      }
    }
  } else {
    state.coyote = Math.max(0, state.coyote - dt);
    if (hasInput) {
      applyAirControl(wishDir, dt, slideActive, weaponMobility);
    }
  }

  capHorizontalSpeed(getMovementSpeedCap(slideActive, crouchActive, weaponMobility));
  movePlayer(velocity.x * dt, velocity.z * dt);

  state.verticalVelocity += GRAVITY * dt;
  player.position.y += state.verticalVelocity * dt;
  state.wasGrounded = state.grounded;
  if (player.position.y <= 0) {
    const justLanded = !state.wasGrounded;
    player.position.y = 0;
    state.verticalVelocity = 0;
    state.grounded = true;
    state.airTime = 0;
    if (justLanded) {
      state.groundTime = 0;
      state.landingWindow = PERFECT_HOP_WINDOW;
      state.motionKick = Math.max(state.motionKick, Math.min(0.16, 0.035 + getHorizontalSpeed() * 0.006));
    } else {
      state.groundTime += dt;
    }
    if (state.chainTimer <= 0 && state.groundTime > 0.18 && !slideActive && state.bhopBuffer <= 0) {
      state.bhopChain = 0;
      state.hopAssistTimer = 0;
    }
  } else {
    state.grounded = false;
    state.airTime += dt;
    state.groundTime = 0;
  }

  player.position.x = THREE.MathUtils.clamp(player.position.x, -HALF_ARENA + 1.2, HALF_ARENA - 1.2);
  player.position.z = THREE.MathUtils.clamp(player.position.z, -HALF_ARENA + 1.2, HALF_ARENA - 1.2);

  const speed = getHorizontalSpeed();
  state.bob += dt * (state.grounded ? Math.min(16, speed * 1.75) : 6);
  const crouchHeight = slideActive ? SLIDE_HEIGHT : crouchActive ? CROUCH_HEIGHT : PLAYER_HEIGHT;
  const slideBlend = slideActive ? THREE.MathUtils.clamp(state.slideTimer / SLIDE_DURATION, 0, 1) : 0;
  pitch.position.y = THREE.MathUtils.damp(
    pitch.position.y,
    crouchHeight + Math.sin(state.bob) * (speed > 0.4 ? 0.038 : 0.008),
    13,
    dt
  );
  pitch.rotation.z = THREE.MathUtils.damp(pitch.rotation.z, -strafeInput * 0.032 + state.motionRoll * (0.45 + slideBlend), 9, dt);
  camera.fov = THREE.MathUtils.damp(
    camera.fov,
    78 + Math.min(speed * 0.58, 8) + (slideActive ? 3.8 : state.hopAssistTimer > 0 ? 1.8 : 0) + state.motionKick * 8,
    5.6,
    dt
  );
  camera.updateProjectionMatrix();
}

function jump(mode = "normal", preferredDirection = null) {
  const horizontalSpeed = getHorizontalSpeed();
  const isPrecisionHop = mode === "precision";
  const hopQuality = isPrecisionHop ? getHopQuality(horizontalSpeed) : 0;
  state.verticalVelocity = JUMP_FORCE + Math.min(horizontalSpeed, 13) * 0.028 + hopQuality * 0.22;
  state.grounded = false;
  state.coyote = 0;
  state.groundTime = 0;
  state.airTime = 0;
  state.landingWindow = 0;

  if (isPrecisionHop) {
    state.bhopBuffer = 0;
    state.bhopChain = Math.min(state.bhopChain + 1, BHOP_CHAIN_MAX);
    state.chainTimer = HOP_CHAIN_TIMEOUT;
    state.hopAssistTimer = HOP_ASSIST_TIME + hopQuality * 0.16;
    state.motionStyle = hopQuality > 0.72 ? "perfect-hop" : "precision-hop";
    state.motionTimer = 0.36;
    state.motionKick = Math.max(state.motionKick, 0.055 + hopQuality * 0.045);
    state.stamina = Math.max(0, state.stamina - (hopQuality > 0.72 ? 2 : 4));
    applyPrecisionHop(normalizeFlatDirection(preferredDirection), hopQuality);
    spawnRingBurst(player.position, materials.accentGreen);
    if (state.bhopChain === 1 || state.bhopChain % 4 === 0) {
      showToast(hopQuality > 0.72 ? `Perfect hop ${state.bhopChain}x` : `Precision hop ${state.bhopChain}x`);
    }
    audio.bhop();
  } else {
    state.bhopChain = 0;
    state.chainTimer = 0;
    state.hopAssistTimer = 0;
    state.motionStyle = "jump";
    state.motionTimer = 0.24;
    state.motionKick = Math.max(state.motionKick, 0.04);
    audio.jump();
  }
}

function startPowerSlide(direction) {
  const slideDir = normalizeFlatDirection(direction);
  const speed = getHorizontalSpeed();
  if (speed > 1.2) {
    steerHorizontalVelocity(slideDir, 0.18);
  }
  const impulse = THREE.MathUtils.clamp(1.2 + speed * 0.09 + state.bhopChain * 0.06, 1.45, 3.25);
  velocity.x += slideDir.x * impulse;
  velocity.z += slideDir.z * impulse;
  state.slideTimer = SLIDE_DURATION + Math.min(speed * 0.014, 0.18);
  state.slideCooldown = SLIDE_COOLDOWN;
  state.motionStyle = "power-slide";
  state.motionTimer = state.slideTimer;
  state.motionKick = Math.max(state.motionKick, 0.08);
  state.motionRoll = getLocalRightVector().dot(slideDir) * -0.12;
  state.stamina = Math.max(0, state.stamina - 6);
  spawnRingBurst(player.position, materials.accentGreen);
  showToast("Power slide");
  audio.boost();
}

function applyAirTuck(direction) {
  const tuckDir = normalizeFlatDirection(direction);
  const impulse = THREE.MathUtils.clamp(0.7 + getHorizontalSpeed() * 0.035 + state.bhopChain * 0.04, 0.8, 1.75);
  velocity.x += tuckDir.x * impulse;
  velocity.z += tuckDir.z * impulse;
  state.verticalVelocity = Math.min(state.verticalVelocity, -7.1);
  state.motionStyle = "air-tuck";
  state.motionTimer = 0.32;
  state.motionKick = Math.max(state.motionKick, 0.065);
  state.motionRoll = getLocalRightVector().dot(tuckDir) * -0.08;
  state.stamina = Math.max(0, state.stamina - 4);
  spawnRingBurst(player.position, materials.accentGreen);
  showToast("Air tuck");
  audio.boost();
}

function applyPrecisionHop(direction, quality) {
  const speed = getHorizontalSpeed();
  const chain = Math.min(state.bhopChain, BHOP_CHAIN_MAX);
  if (speed < 0.2) {
    const starter = 2.2 + quality * 1.1;
    velocity.x += direction.x * starter;
    velocity.z += direction.z * starter;
    return;
  }

  const velocityDir = new THREE.Vector3(velocity.x, 0, velocity.z).normalize();
  const alignment = THREE.MathUtils.clamp(velocityDir.dot(direction), -1, 1);
  const strafeValue = 1 - Math.abs(alignment);
  const redirect = THREE.MathUtils.clamp(0.08 + quality * 0.1 + strafeValue * 0.16, 0.06, 0.28);
  velocityDir.lerp(direction, redirect).normalize();
  velocity.x = velocityDir.x * speed;
  velocity.z = velocityDir.z * speed;

  const targetForwardSpeed = 6 + chain * 0.24 + strafeValue * 1.15;
  const forwardSpeed = velocity.x * direction.x + velocity.z * direction.z;
  const missingSpeed = Math.max(0, targetForwardSpeed - forwardSpeed);
  const impulse = Math.min(0.18 + quality * 0.48 + strafeValue * 0.28, missingSpeed * 0.22);
  velocity.x += direction.x * impulse;
  velocity.z += direction.z * impulse;
}

function applyAirControl(direction, dt, slideActive, weaponMobility = 1) {
  const speed = getHorizontalSpeed();
  let strafeValue = 0;
  if (speed > 0.2) {
    const velocityDir = new THREE.Vector3(velocity.x, 0, velocity.z).normalize();
    strafeValue = 1 - Math.abs(THREE.MathUtils.clamp(velocityDir.dot(direction), -1, 1));
  }
  const chainFactor = THREE.MathUtils.clamp(state.bhopChain / BHOP_CHAIN_MAX, 0, 1);
  const assist = state.hopAssistTimer > 0 ? 1 : 0;
  const slidePenalty = slideActive ? 0.84 : 1;
  const wishSpeed = (6.5 + chainFactor * 3.8 + strafeValue * 1.5 + assist * 0.9) * slidePenalty * weaponMobility;
  const accel = 10 + strafeValue * 17 + chainFactor * 5 + assist * 5;
  accelerate(direction, wishSpeed, accel, dt);
  if (speed > 3 && (assist || state.bhopChain > 0) && strafeValue > 0.18) {
    steerHorizontalVelocity(direction, Math.min(0.16, dt * (0.8 + strafeValue * 2.2 + chainFactor * 1.3)));
  }
}

function getHopQuality(horizontalSpeed) {
  const landingTiming = state.landingWindow > 0
    ? THREE.MathUtils.clamp(state.landingWindow / PERFECT_HOP_WINDOW, 0, 1)
    : THREE.MathUtils.clamp(1 - state.groundTime / 0.22, 0, 1) * 0.52;
  const pace = THREE.MathUtils.clamp(horizontalSpeed / 10, 0, 1);
  const staminaFactor = THREE.MathUtils.clamp(state.stamina / 28, 0.45, 1);
  return THREE.MathUtils.clamp((0.28 + landingTiming * 0.5 + pace * 0.22) * staminaFactor, 0.2, 1);
}

function getMovementSpeedCap(slideActive, crouchActive, weaponMobility = 1) {
  const chain = Math.min(state.bhopChain, BHOP_CHAIN_MAX);
  let cap = state.grounded ? 7.8 : 9.3 + chain * 0.48;
  if (state.hopAssistTimer > 0 || chain > 0) {
    cap = Math.max(cap, Math.min(10.1 + chain * 0.52, 15.6));
  }
  if (slideActive) {
    cap = Math.max(cap, Math.min(11.1 + chain * 0.34, 15));
  }
  cap *= weaponMobility;
  if (crouchActive && state.grounded && !slideActive) {
    cap = Math.min(cap, 3.8);
  }
  return cap;
}

function normalizeFlatDirection(direction) {
  const flat = direction?.clone?.() ?? cameraForwardFlat();
  flat.y = 0;
  if (flat.lengthSq() < 0.001) {
    return cameraForwardFlat();
  }
  return flat.normalize();
}

function steerHorizontalVelocity(direction, amount) {
  const speed = getHorizontalSpeed();
  if (speed < 0.2) {
    return;
  }
  const current = new THREE.Vector3(velocity.x, 0, velocity.z).normalize();
  current.lerp(direction, THREE.MathUtils.clamp(amount, 0, 1)).normalize();
  velocity.x = current.x * speed;
  velocity.z = current.z * speed;
}

function getLocalRightVector() {
  return new THREE.Vector3(1, 0, 0).applyAxisAngle(WORLD_UP, player.rotation.y);
}

function accelerate(direction, wishSpeed, accel, dt) {
  const currentSpeed = velocity.x * direction.x + velocity.z * direction.z;
  const addSpeed = wishSpeed - currentSpeed;
  if (addSpeed <= 0) {
    return;
  }
  const accelSpeed = Math.min(accel * wishSpeed * dt, addSpeed);
  velocity.x += direction.x * accelSpeed;
  velocity.z += direction.z * accelSpeed;
}

function applyFriction(dt, friction) {
  const speed = getHorizontalSpeed();
  if (speed < 0.001) {
    velocity.x = 0;
    velocity.z = 0;
    return;
  }
  const drop = speed * friction * dt;
  const newSpeed = Math.max(0, speed - drop) / speed;
  velocity.x *= newSpeed;
  velocity.z *= newSpeed;
}

function capHorizontalSpeed(maxSpeed) {
  const speed = getHorizontalSpeed();
  if (speed > maxSpeed) {
    const scale = maxSpeed / speed;
    velocity.x *= scale;
    velocity.z *= scale;
  }
}

function movePlayer(dx, dz) {
  const distance = Math.hypot(dx, dz);
  const steps = Math.max(1, Math.ceil(distance / MOVE_STEP));
  const stepX = dx / steps;
  const stepZ = dz / steps;

  for (let i = 0; i < steps; i++) {
    if (stepX !== 0) {
      player.position.x += stepX;
      resolvePlayerCollisions();
    }
    if (stepZ !== 0) {
      player.position.z += stepZ;
      resolvePlayerCollisions();
    }
  }
}

function resolvePlayerCollisions() {
  for (let pass = 0; pass < 3; pass++) {
    for (const collider of colliders) {
      resolveRotatedCollider(collider, player.position, PLAYER_RADIUS + COLLISION_SKIN);
    }
  }
}

function shoot() {
  if (!state.running || state.paused || !state.alive || state.fireTimer > 0) {
    return;
  }

  const profile = getSelectedWeaponProfile();
  const ammoState = getWeaponRuntimeState(profile);
  if (ammoState.reloadTimer > 0) {
    return;
  }
  if (ammoState.ammo <= 0) {
    beginReload(profile);
    return;
  }

  ammoState.ammo -= 1;
  state.fireTimer = profile.interval;
  applyWeaponRecoil(profile);
  weapon.flash.visible = true;
  weapon.flashTimer = profile.style === "ray" ? 0.07 : profile.style === "sniper" ? 0.085 : 0.045;
  weapon.flashBaseScale = profile.flashScale * (profile.projectiles > 1 ? 1.08 : 1);
  weapon.flash.scale.setScalar(weapon.flashBaseScale);
  weapon.muzzle.intensity = profile.muzzleIntensity + profile.projectiles * 0.8;
  audio.shoot(profile);

  const origin = camera.getWorldPosition(new THREE.Vector3());
  const baseDirection = camera.getWorldDirection(new THREE.Vector3()).normalize();
  sendNetworkAction("shoot", {
    origin: [round4(origin.x), round4(origin.y), round4(origin.z)],
    direction: [round4(baseDirection.x), round4(baseDirection.y), round4(baseDirection.z)],
    weapon: profile.id,
    weaponSlot: state.weaponSlot,
    style: profile.style,
    client_time: round4(clock.elapsedTime)
  });

  let hits = 0;
  const shotContext = {
    remoteIds: new Set(),
    targetIndexes: new Set()
  };
  for (let index = 0; index < profile.projectiles; index++) {
    const projectileProfile = getProjectileProfile(profile);
    const shotDirection = applyAimAssist(origin, createShotDirection(baseDirection, projectileProfile, index), projectileProfile, index);
    const result = resolveWeaponShot(origin, shotDirection, projectileProfile, shotContext);
    if (result.hit) {
      hits += 1;
    }
  }

  if (hits > 0) {
    showPulseMarker();
  } else {
    audio.miss();
  }

  if (ammoState.ammo <= 0) {
    beginReload(profile);
  }
  updateHud();
}

function applyWeaponRecoil(profile) {
  const speedPressure = THREE.MathUtils.clamp(getHorizontalSpeed() / 18, 0, 1);
  const airPressure = state.grounded ? 0 : 1;
  const styleScale = {
    sidearm: [0.78, 0.85],
    "hand-cannon": [1.18, 1.12],
    shotgun: [1.28, 1.35],
    rifle: [0.82, 0.94],
    sniper: [1.6, 1.18],
    ray: [0.28, 0.36],
    lightning: [0.95, 1.28]
  }[profile.style] ?? [1, 1];
  const recoilLift = profile.recoil * styleScale[0] * (0.78 + speedPressure * 0.12 + airPressure * 0.12);
  const yawScale = profile.yawKick * styleScale[1] * (0.12 + state.recoil * 0.18 + speedPressure * 0.08);
  state.recoil = Math.min(state.recoil + recoilLift, 1.15);
  pitch.rotation.x = THREE.MathUtils.clamp(
    pitch.rotation.x - profile.pitchKick * styleScale[0] * 0.6 - state.recoil * 0.00065,
    -1.34,
    1.2
  );
  const recoilBias = profile.style === "rifle" ? Math.sin(clock.elapsedTime * 23) * 0.35 : 0;
  player.rotation.y += randomRange(-yawScale, yawScale) + recoilBias * yawScale;
}

function getWeaponRuntimeState(profile = getSelectedWeaponProfile()) {
  const key = profile.id;
  const magazine = profile.magazine;
  let weaponState = weaponStates.get(key);
  if (!weaponState || weaponState.magazine !== magazine) {
    weaponState = {
      ammo: magazine,
      magazine,
      reloadTimer: 0,
      reloadDuration: profile.reloadTime
    };
    weaponStates.set(key, weaponState);
  }
  return weaponState;
}

function updateWeaponInventory(dt) {
  for (const [weaponId, weaponState] of weaponStates) {
    if (weaponState.reloadTimer <= 0) {
      continue;
    }
    weaponState.reloadTimer = Math.max(0, weaponState.reloadTimer - dt);
    if (weaponState.reloadTimer <= 0) {
      weaponState.ammo = weaponState.magazine;
      weaponState.reloadDuration = 0;
      if (weaponId === getSelectedWeaponProfile().id) {
        audio.reloadReady();
      }
    }
  }
}

function beginReload(profile = getSelectedWeaponProfile(), manual = false) {
  const weaponState = getWeaponRuntimeState(profile);
  if (weaponState.reloadTimer > 0 || weaponState.ammo >= profile.magazine) {
    return false;
  }
  weaponState.reloadDuration = profile.reloadTime;
  weaponState.reloadTimer = profile.reloadTime;
  state.fireTimer = Math.max(state.fireTimer, Math.min(0.18, profile.interval));
  if (manual) {
    state.firing = false;
  }
  audio.reload(profile);
  updateHud();
  return true;
}

function resetWeaponInventory() {
  weaponStates.clear();
  for (const entry of runtimeModels.weapons) {
    const profile = getWeaponProfile(entry.asset);
    getWeaponRuntimeState(profile);
  }
}

function getProjectileProfile(profile) {
  if (profile.style !== "shotgun") {
    return profile;
  }
  const minRange = THREE.MathUtils.clamp(profile.pelletMinRange || profile.range * 0.35, 0.5, profile.range);
  const range = randomRange(minRange, profile.range);
  const radiusVariance = profile.pelletRadiusVariance;
  const radiusScale = randomRange(1 - radiusVariance, 1 + radiusVariance);
  return {
    ...profile,
    range,
    missDistance: Math.min(profile.missDistance, range),
    tracerRadius: Math.max(0.003, profile.tracerRadius * radiusScale)
  };
}

function createShotDirection(baseDirection, profile, projectileIndex = 0) {
  const speedPressure = THREE.MathUtils.clamp(getHorizontalSpeed() / 18, 0, 1);
  const airPressure = state.grounded ? 0 : 1;
  const movementSpread = 1 + speedPressure * 0.34 + airPressure * (profile.style === "sniper" ? 1.15 : 0.44) + state.recoil * 0.28;
  if (profile.style === "shotgun") {
    const direction = baseDirection.clone().normalize();
    const right = new THREE.Vector3().crossVectors(direction, WORLD_UP);
    if (right.lengthSq() < 0.001) {
      right.set(1, 0, 0);
    } else {
      right.normalize();
    }
    const up = new THREE.Vector3().crossVectors(right, direction).normalize();
    const spread = profile.spread * randomRange(0.3, 1.15) * movementSpread;
    const angle = randomRange(0, Math.PI * 2);
    const horizontal = Math.cos(angle) * spread + randomRange(-profile.spread * 0.18, profile.spread * 0.18);
    const vertical = Math.sin(angle) * spread * 0.72 + randomRange(-profile.spread * 0.16, profile.spread * 0.16);
    direction.addScaledVector(right, horizontal);
    direction.addScaledVector(up, vertical);
    return direction.normalize();
  }
  const spread = profile.spread * (projectileIndex === 0 ? 0.34 : 0.82) * movementSpread;
  const direction = baseDirection.clone();
  direction.x += randomRange(-spread, spread);
  direction.y += randomRange(-spread * 0.55, spread * 0.55);
  direction.z += randomRange(-spread, spread);
  return direction.normalize();
}

function applyAimAssist(origin, direction, profile, projectileIndex = 0) {
  const candidate = findAimCandidate(origin, direction, profile, projectileIndex);
  if (!candidate) {
    return direction;
  }
  const speedPressure = THREE.MathUtils.clamp(getHorizontalSpeed() / 18, 0, 1);
  const projectileScale = projectileIndex === 0 ? 1 : 0.42;
  const edgeFalloff = 1 - THREE.MathUtils.clamp(candidate.missRatio, 0, 1);
  const strength = THREE.MathUtils.clamp((0.14 + speedPressure * 0.1) * edgeFalloff * projectileScale, 0, 0.28);
  return direction.clone().lerp(candidate.direction, strength).normalize();
}

function resolveWeaponShot(origin, direction, profile, shotContext = null) {
  raycaster.set(origin, direction);
  raycaster.far = profile.range;
  const visualOrigin = getLocalTracerOrigin(origin);

  const worldHitDistance = intersectWorldColliders(origin, direction, raycaster.far);
  const remoteHit = intersectRemotePlayers();
  const hitObjects = targets.filter((target) => target.alive).flatMap((target) => [target.body, target.core]);
  const targetHits = raycaster.intersectObjects(hitObjects, false);
  const forgivingHit = findForgivingAimHit(origin, direction, profile);
  const nearestTargetDistance = targetHits[0]?.distance ?? Infinity;
  const nearestRemoteDistance = remoteHit?.hit.distance ?? Infinity;
  const nearestForgivingDistance = forgivingHit?.hit.distance ?? Infinity;
  const nearestDamageDistance = Math.min(nearestTargetDistance, nearestRemoteDistance, nearestForgivingDistance);

  if (worldHitDistance !== null && worldHitDistance <= nearestDamageDistance) {
    spawnShotTracer(visualOrigin, origin, direction, worldHitDistance, true, profile);
    spawnRingBurst(origin.clone().addScaledVector(direction, worldHitDistance), materials.platformDark);
    return { blocked: true, hit: false };
  }

  if (remoteHit && (targetHits.length === 0 || remoteHit.hit.distance <= targetHits[0].distance)) {
    if (shotContext?.remoteIds?.has(remoteHit.remote.id)) {
      spawnShotTracer(visualOrigin, origin, direction, remoteHit.hit.distance, true, profile);
      return { blocked: false, hit: false, duplicate: true };
    }
    shotContext?.remoteIds?.add(remoteHit.remote.id);
    reportPlayerHit(remoteHit.remote, remoteHit.hit, origin, direction, profile);
    spawnShotTracer(visualOrigin, origin, direction, remoteHit.hit.distance, true, profile);
    return { blocked: false, hit: true };
  }

  if (targetHits.length > 0) {
    const targetIndex = targetHits[0].object.userData.targetIndex;
    if (shotContext?.targetIndexes?.has(targetIndex)) {
      spawnShotTracer(visualOrigin, origin, direction, targetHits[0].distance, true, profile);
      return { blocked: false, hit: false, duplicate: true };
    }
    shotContext?.targetIndexes?.add(targetIndex);
    const target = targets[targetIndex];
    hitTarget(target, targetHits[0], profile);
    spawnShotTracer(visualOrigin, origin, direction, targetHits[0].distance, true, profile);
    return { blocked: false, hit: true };
  }

  if (forgivingHit?.remote) {
    if (shotContext?.remoteIds?.has(forgivingHit.remote.id)) {
      spawnShotTracer(visualOrigin, origin, direction, forgivingHit.hit.distance, true, profile);
      return { blocked: false, hit: false, duplicate: true };
    }
    shotContext?.remoteIds?.add(forgivingHit.remote.id);
    reportPlayerHit(forgivingHit.remote, forgivingHit.hit, origin, direction, profile);
    spawnShotTracer(visualOrigin, origin, direction, forgivingHit.hit.distance, true, profile);
    return { blocked: false, hit: true };
  }

  if (forgivingHit?.target) {
    const targetIndex = getTargetIndex(forgivingHit.target);
    if (shotContext?.targetIndexes?.has(targetIndex)) {
      spawnShotTracer(visualOrigin, origin, direction, forgivingHit.hit.distance, true, profile);
      return { blocked: false, hit: false, duplicate: true };
    }
    shotContext?.targetIndexes?.add(targetIndex);
    hitTarget(forgivingHit.target, forgivingHit.hit, profile);
    spawnShotTracer(visualOrigin, origin, direction, forgivingHit.hit.distance, true, profile);
    return { blocked: false, hit: true };
  }

  spawnShotTracer(visualOrigin, origin, direction, profile.missDistance, false, profile);
  return { blocked: false, hit: false };
}

function spawnShotTracer(visualOrigin, shotOrigin, shotDirection, shotDistance, hit, profile = null) {
  const impactPoint = shotOrigin.clone().addScaledVector(shotDirection, Math.max(shotDistance, 0.08));
  const visualDirection = impactPoint.sub(visualOrigin);
  const visualLength = visualDirection.length();
  if (visualLength < 0.08) {
    spawnTracer(visualOrigin, shotDirection, 0.08, hit, profile);
    return;
  }
  spawnTracer(visualOrigin, visualDirection.normalize(), visualLength, hit, profile);
}

function getLocalTracerOrigin(fallback) {
  if (!weapon?.muzzle) {
    return fallback;
  }
  return weapon.muzzle.getWorldPosition(new THREE.Vector3());
}

function findForgivingAimHit(origin, direction, profile) {
  const candidate = findAimCandidate(origin, direction, profile, 0);
  if (!candidate || candidate.missRatio > 1) {
    return null;
  }
  return candidate;
}

function findAimCandidate(origin, direction, profile, projectileIndex = 0) {
  const speedPressure = THREE.MathUtils.clamp(getHorizontalSpeed() / 18, 0, 1);
  const airPressure = state.grounded ? 0 : 1;
  const chainPressure = THREE.MathUtils.clamp(state.bhopChain / BHOP_CHAIN_MAX, 0, 1);
  const projectileScale = projectileIndex === 0 ? 1 : 0.55;
  const movementPenalty = THREE.MathUtils.clamp(1 - airPressure * 0.22 - state.recoil * 0.08, 0.62, 1);
  const cone = (profile.aimAssist + speedPressure * 0.004 + chainPressure * 0.002) * projectileScale * movementPenalty;
  const extraRadius = (profile.hitRadius + speedPressure * 0.035 + chainPressure * 0.022) * projectileScale * movementPenalty;
  let best = null;

  for (const target of targets) {
    if (!target.alive || !target.group.visible) {
      continue;
    }
    const center = target.group.getWorldPosition(new THREE.Vector3());
    best = chooseAimCandidate(best, {
      type: "target",
      target,
      center,
      radius: target.radius + extraRadius
    }, origin, direction, profile.range, cone);
  }

  for (const remote of remotePlayers.values()) {
    if (!remote.alive || !remote.group.visible) {
      continue;
    }
    for (const hitbox of remote.hitboxes) {
      const center = hitbox.getWorldPosition(new THREE.Vector3());
      best = chooseAimCandidate(best, {
        type: "remote",
        remote,
        center,
        radius: 0.34 + extraRadius
      }, origin, direction, profile.range, cone);
    }
  }

  return best;
}

function chooseAimCandidate(best, candidate, origin, direction, range, cone) {
  const toCenter = candidate.center.clone().sub(origin);
  const distance = toCenter.dot(direction);
  if (distance < 1.2 || distance > range) {
    return best;
  }
  const perpendicularSq = Math.max(0, toCenter.lengthSq() - distance * distance);
  const perpendicular = Math.sqrt(perpendicularSq);
  const allowed = candidate.radius + cone * distance;
  if (perpendicular > allowed) {
    return best;
  }

  const direct = toCenter.normalize();
  const missRatio = perpendicular / Math.max(allowed, 0.001);
  const score = missRatio + distance * 0.0008;
  if (best && best.score <= score) {
    return best;
  }

  return {
    target: candidate.type === "target" ? candidate.target : null,
    remote: candidate.type === "remote" ? candidate.remote : null,
    hit: {
      distance,
      point: candidate.center.clone()
    },
    direction: direct,
    missRatio,
    score
  };
}

function hitTarget(target, hit, profile = null) {
  target.alive = false;
  target.group.visible = false;
  target.respawn = randomRange(0.28, 0.58);
  state.stamina = Math.min(100, state.stamina + 6 + (profile?.damage ?? 1) * 2);

  spawnRingBurst(hit.point, materials.targetBody);
  showToast(profile ? `${profile.name} hit` : "Hit");
  audio.hit();
}

function getTargetIndex(target) {
  return target?.body?.userData?.targetIndex ?? target?.core?.userData?.targetIndex ?? targets.indexOf(target);
}

function intersectRemotePlayers() {
  const hitboxes = [];
  for (const remote of remotePlayers.values()) {
    if (remote.alive && remote.group.visible) {
      hitboxes.push(...remote.hitboxes);
    }
  }
  if (hitboxes.length === 0) {
    return null;
  }

  const hits = raycaster.intersectObjects(hitboxes, false);
  if (hits.length === 0) {
    return null;
  }

  const remote = remotePlayers.get(hits[0].object.userData.remotePlayerId);
  if (!remote || !remote.alive) {
    return null;
  }
  return { remote, hit: hits[0] };
}

function intersectWorldColliders(origin, direction, maxDistance) {
  const horizontalLength = Math.hypot(direction.x, direction.z);
  if (horizontalLength < 0.0001) {
    return null;
  }

  let nearest = maxDistance;
  const dirX = direction.x / horizontalLength;
  const dirZ = direction.z / horizontalLength;
  const horizontalMax = maxDistance * horizontalLength;

  for (const collider of colliders) {
    const hit = raycastCollider2D(collider, origin.x, origin.z, dirX, dirZ, horizontalMax, 0.02);
    if (hit !== null && hit > 0.08) {
      nearest = Math.min(nearest, hit / horizontalLength);
    }
  }

  return nearest < maxDistance ? nearest : null;
}

function reportPlayerHit(remote, hit, origin, direction, profile = null) {
  remote.pendingHit = performance.now();
  state.stamina = Math.min(100, state.stamina + 8 + (profile?.damage ?? 1) * 3);
  spawnRingBurst(hit.point, materials.targetBody);
  showPulseMarker("hit");
  audio.hit();
  sendNetwork({
    type: "player_hit",
    target_id: remote.id,
    damage: profile?.damage ?? 1,
    weapon: profile?.id ?? "weapon",
    hit: {
      point: [round4(hit.point.x), round4(hit.point.y), round4(hit.point.z)],
      origin: [round4(origin.x), round4(origin.y), round4(origin.z)],
      direction: [round4(direction.x), round4(direction.y), round4(direction.z)],
      client_time: round4(clock.elapsedTime)
    }
  });
}

function updateTargets(dt, time) {
  targets.forEach((target, index) => {
    if (!target.alive) {
      target.respawn -= dt;
      if (target.respawn <= 0) {
        target.alive = true;
        target.group.visible = true;
        placeTarget(target, index);
      }
      return;
    }

    const phase = time * target.speed + target.phase;
    const horizontal = Math.sin(phase) * (target.lane === "horizontal" ? 2.9 : 1.1);
    const vertical = Math.cos(phase * 1.3) * (target.lane === "vertical" ? 0.85 : 0.35);
    target.group.position.set(target.anchor.x + horizontal, target.anchor.y + vertical, target.anchor.z);
    target.group.lookAt(camera.getWorldPosition(new THREE.Vector3()));
    target.body.rotation.y += dt * 1.6;
    target.ring.rotation.z += dt * 1.2;
    target.light.intensity = 0.75 + Math.sin(time * 5 + target.phase) * 0.2;
  });

  if (state.toastTimer > 0) {
    state.toastTimer -= dt;
    if (state.toastTimer <= 0) {
      hud.statusToast.classList.remove("active");
    }
  }
}

function placeTarget(target, index) {
  const xJitter = randomRange(-2.2, 2.2);
  const yJitter = randomRange(-0.45, 0.65);
  const zJitter = randomRange(-1.4, 1.4);
  const side = index % 3;
  target.anchor.copy(target.baseAnchor);
  target.anchor.x += xJitter;
  target.anchor.y = THREE.MathUtils.clamp(target.anchor.y + yJitter, 1.2, 2.7);
  target.anchor.z += zJitter;
  target.group.position.set(target.anchor.x, target.anchor.y, target.anchor.z);
  target.phase = randomRange(0, Math.PI * 2);
  target.speed = randomRange(0.75 + side * 0.18, 1.38 + side * 0.14);
}

function updateWeapon(dt, time) {
  state.swayX = THREE.MathUtils.damp(state.swayX, 0, 12, dt);
  state.swayY = THREE.MathUtils.damp(state.swayY, 0, 12, dt);
  state.recoil = THREE.MathUtils.damp(state.recoil, state.firing ? 0.22 : 0, state.firing ? 3.2 : 7.5, dt);
  weapon.clipPull = THREE.MathUtils.damp(weapon.clipPull, getWeaponCollisionPull(), 22, dt);

  const speed = getHorizontalSpeed();
  const bob = Math.sin(state.bob * 1.25) * Math.min(speed * 0.002, 0.02);
  const switchDrop = state.weaponSwitchTimer > 0 ? (state.weaponSwitchTimer / WEAPON_SWITCH_TIME) ** 2 : 0;
  weapon.group.position.x = THREE.MathUtils.damp(
    weapon.group.position.x,
    weapon.basePosition.x - weapon.clipPull * 0.18 + state.swayX * 0.0008 - switchDrop * 0.035,
    12,
    dt
  );
  weapon.group.position.y = THREE.MathUtils.damp(
    weapon.group.position.y,
    weapon.basePosition.y + bob - weapon.clipPull * 0.08 - state.swayY * 0.0005 - switchDrop * 0.16,
    12,
    dt
  );
  weapon.group.position.z = THREE.MathUtils.damp(
    weapon.group.position.z,
    weapon.basePosition.z + weapon.clipPull * 0.54 + state.recoil * 0.12 + switchDrop * 0.18,
    16,
    dt
  );
  weapon.group.rotation.x = THREE.MathUtils.damp(weapon.group.rotation.x, weapon.baseRotation.x - state.recoil * 0.24 - weapon.clipPull * 0.12 + switchDrop * 0.12, 18, dt);
  weapon.group.rotation.y = THREE.MathUtils.damp(weapon.group.rotation.y, weapon.baseRotation.y + Math.sin(time * 0.9) * 0.004 + weapon.clipPull * 0.1 + switchDrop * 0.035, 8, dt);
  weapon.group.rotation.z = THREE.MathUtils.damp(weapon.group.rotation.z, weapon.baseRotation.z + state.swayX * 0.00012 - switchDrop * 0.035, 10, dt);

  if (weapon.flashTimer > 0) {
    weapon.flashTimer -= dt;
    weapon.flash.scale.setScalar(weapon.flashBaseScale * randomRange(0.82, 1.16));
    if (weapon.flashTimer <= 0) {
      weapon.flash.visible = false;
    }
  }
  weapon.muzzle.intensity = THREE.MathUtils.damp(weapon.muzzle.intensity, 0, 18, dt);
}

function updateEffects(dt, time) {
  for (let i = effects.length - 1; i >= 0; i--) {
    const effect = effects[i];
    effect.update(dt, time);
    if (effect.done) {
      if (effect.object) {
        effect.object.parent?.remove(effect.object);
      }
      effects.splice(i, 1);
    }
  }
}

function spawnTracer(origin, direction, length, hit, profile = null) {
  const shotLength = Math.max(length, 0.08);
  if (profile?.style === "lightning") {
    spawnLightningTracer(origin, direction, shotLength, hit, profile);
    return;
  }

  const radius = (profile?.tracerRadius ?? (hit ? 0.012 : 0.008)) * 1.65;
  const fadeTime = profile?.tracerLifetime ?? 0.08;
  const color = hit ? (profile?.hitColor ?? 0xffdf8a) : (profile?.tracerColor ?? 0x2aa8ff);
  const group = new THREE.Group();
  const coreGeometry = new THREE.CylinderGeometry(radius * 0.78, radius * 0.62, shotLength, 8);
  const glowGeometry = new THREE.CylinderGeometry(radius * 3.2, radius * 2.2, shotLength, 10);
  const coreMaterial = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: hit ? 0.96 : 0.78,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const glowMaterial = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: hit ? 0.24 : 0.18,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const core = new THREE.Mesh(coreGeometry, coreMaterial);
  const glow = new THREE.Mesh(glowGeometry, glowMaterial);
  for (const mesh of [core, glow]) {
    mesh.quaternion.setFromUnitVectors(WORLD_UP, direction);
    mesh.position.copy(origin).addScaledVector(direction, shotLength / 2);
    group.add(mesh);
  }
  scene.add(group);

  const duration = fadeTime;
  const coreOpacity = coreMaterial.opacity;
  const glowOpacity = glowMaterial.opacity;
  const holdTime = Math.min(0.72, duration * 0.72);

  effects.push({
    object: group,
    age: 0,
    update(dt) {
      this.age += dt;
      const fade = this.age <= holdTime ? 1 : 1 - (this.age - holdTime) / Math.max(0.001, duration - holdTime);
      coreMaterial.opacity = Math.max(0, coreOpacity * fade);
      glowMaterial.opacity = Math.max(0, glowOpacity * fade);
      if (this.age >= duration) {
        coreGeometry.dispose();
        glowGeometry.dispose();
        coreMaterial.dispose();
        glowMaterial.dispose();
        this.done = true;
      }
    }
  });
}

function spawnLightningTracer(origin, direction, length, hit, profile = null) {
  const radius = (profile?.tracerRadius ?? 0.012) * 1.65;
  const material = new THREE.MeshBasicMaterial({
    color: hit ? (profile?.hitColor ?? 0xf1d6ff) : (profile?.tracerColor ?? 0xb465ff),
    transparent: true,
    opacity: hit ? 0.78 : 0.5,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const group = new THREE.Group();
  const right = new THREE.Vector3().crossVectors(direction, WORLD_UP);
  if (right.lengthSq() < 0.001) {
    right.set(1, 0, 0);
  }
  right.normalize();
  const up = new THREE.Vector3().crossVectors(right, direction).normalize();
  const points = [origin.clone()];
  const segments = 6;
  const jitter = hit ? 0.2 : 0.34;

  for (let index = 1; index <= segments; index++) {
    const point = origin.clone().addScaledVector(direction, (length * index) / segments);
    if (index < segments) {
      point.addScaledVector(right, randomRange(-jitter, jitter));
      point.addScaledVector(up, randomRange(-jitter * 0.7, jitter * 0.7));
    }
    points.push(point);
  }

  for (let index = 0; index < points.length - 1; index++) {
    const mesh = createTracerSegment(points[index], points[index + 1], radius * randomRange(0.8, 1.35), material);
    group.add(mesh);
  }

  scene.add(group);
  const lifetime = profile?.tracerLifetime ?? 1;
  const baseOpacity = material.opacity;
  const holdTime = Math.min(0.72, lifetime * 0.72);
  effects.push({
    object: group,
    age: 0,
    update(dt) {
      this.age += dt;
      const fade = this.age <= holdTime ? 1 : 1 - (this.age - holdTime) / Math.max(0.001, lifetime - holdTime);
      material.opacity = Math.max(0, baseOpacity * fade);
      if (this.age >= lifetime) {
        group.traverse((child) => {
          if (child.isMesh) {
            child.geometry.dispose();
          }
        });
        material.dispose();
        this.done = true;
      }
    }
  });
}

function createTracerSegment(start, end, radius, material) {
  const delta = end.clone().sub(start);
  const length = Math.max(delta.length(), 0.001);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 0.5, length, 7), material);
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(WORLD_UP, delta.normalize());
  return mesh;
}

function spawnRingBurst(position, material) {
  const ringMaterial = material.clone();
  ringMaterial.transparent = true;
  ringMaterial.opacity = 0.9;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.018, 8, 32), ringMaterial);
  ring.position.copy(position);
  ring.rotation.x = Math.PI / 2;
  scene.add(ring);

  effects.push({
    object: ring,
    age: 0,
    update(dt) {
      this.age += dt;
      ring.scale.setScalar(1 + this.age * 4.2);
      ringMaterial.opacity = Math.max(0, 0.9 * (1 - this.age / 0.34));
      if (this.age >= 0.34) {
        ring.geometry.dispose();
        ringMaterial.dispose();
        this.done = true;
      }
    }
  });
}

function getWeaponCollisionPull() {
  const origin = camera.getWorldPosition(tempVec3).clone();
  const direction = cameraForwardFlat();
  let nearest = WEAPON_CLIP_DISTANCE;

  for (const collider of colliders) {
    const hit = raycastCollider2D(collider, origin.x, origin.z, direction.x, direction.z, WEAPON_CLIP_DISTANCE, PLAYER_RADIUS + 0.18);
    if (hit !== null) {
      nearest = Math.min(nearest, hit);
    }
  }

  return THREE.MathUtils.clamp((WEAPON_CLIP_DISTANCE - nearest) / WEAPON_CLIP_DISTANCE, 0, 1);
}

function showPulseMarker(type = "hit") {
  if (!hud.pulseMarker) {
    return;
  }
  hud.pulseMarker.classList.remove("active", "hit", "kill", "damage");
  hud.pulseMarker.classList.add(type);
  void hud.pulseMarker.offsetWidth;
  hud.pulseMarker.classList.add("active");
}

function addCombatFeed(text, type = "hit") {
  if (!hud.combatFeed || !text) {
    return;
  }
  const item = document.createElement("div");
  item.className = `combat-feed-item ${type}`;
  item.textContent = text;
  hud.combatFeed.prepend(item);
  while (hud.combatFeed.children.length > 5) {
    hud.combatFeed.lastElementChild?.remove();
  }
  setTimeout(() => {
    item.classList.add("leaving");
    setTimeout(() => item.remove(), 180);
  }, 3600);
}

function showToast(text) {
  hud.statusToast.textContent = text;
  hud.statusToast.classList.add("active");
  state.toastTimer = 0.86;
}

function updateHud() {
  if (state.mode === GAME_MODES.RACING) {
    hud.speedValue.textContent = String(Math.round(Math.abs(race.speed) * 18));
    hud.raceLapValue.textContent = `${race.lap}/${race.laps}`;
    hud.raceCheckpointValue.textContent = `${race.nextCheckpoint + 1}/${raceCheckpoints.length}`;
    return;
  }

  const speed = Math.round(getHorizontalSpeed() * 10);
  hud.boostValue.textContent = String(Math.round(state.stamina));
  hud.boostBar.style.transform = `scaleX(${THREE.MathUtils.clamp(state.stamina / 100, 0, 1)})`;
  hud.pulseBar.style.transform = `scaleX(${THREE.MathUtils.clamp(state.bhopChain / 12, 0, 1)})`;
  hud.pulseValue.textContent = `${state.bhopChain}x`;
  hud.speedValue.textContent = String(speed);
  updateWeaponHud();
  updateCrosshair(speed);
}

function updateWeaponHud() {
  const profile = getSelectedWeaponProfile();
  const weaponState = getWeaponRuntimeState(profile);
  const reloadDuration = weaponState.reloadDuration || profile.reloadTime;
  const reloadRatio = weaponState.reloadTimer > 0
    ? 1 - THREE.MathUtils.clamp(weaponState.reloadTimer / reloadDuration, 0, 1)
    : 1;
  const cooldownRatio = profile.interval > 0
    ? 1 - THREE.MathUtils.clamp(state.fireTimer / profile.interval, 0, 1)
    : 1;
  const ready = weaponState.reloadTimer <= 0 && state.fireTimer <= 0 && weaponState.ammo > 0;

  if (hud.weaponPanel) {
    hud.weaponPanel.dataset.state = weaponState.reloadTimer > 0 ? "reloading" : ready ? "ready" : "cooldown";
  }
  if (hud.weaponSlotLabel) {
    hud.weaponSlotLabel.textContent = String(state.weaponSlot + 1);
  }
  if (hud.weaponNameValue) {
    hud.weaponNameValue.textContent = profile.name;
  }
  if (hud.weaponAmmoValue) {
    hud.weaponAmmoValue.textContent = `${weaponState.ammo}/${profile.magazine}`;
  }
  if (hud.weaponStateValue) {
    hud.weaponStateValue.textContent = weaponState.reloadTimer > 0
      ? "RELOAD"
      : ready ? "READY" : "COOLDOWN";
  }
  if (hud.weaponReloadBar) {
    hud.weaponReloadBar.style.transform = `scaleX(${(weaponState.reloadTimer > 0 ? reloadRatio : cooldownRatio).toFixed(3)})`;
  }
}

function updateCrosshair(speed) {
  if (!hud.crosshair) {
    return;
  }
  const profile = getSelectedWeaponProfile();
  const weaponState = getWeaponRuntimeState(profile);
  const speedPressure = THREE.MathUtils.clamp(speed / 180, 0, 1);
  const airPressure = state.grounded ? 0 : 1;
  const reloadPressure = weaponState.reloadTimer > 0 ? 1 : 0;
  const styleGap = {
    shotgun: 18,
    sniper: 5.5,
    ray: 7,
    lightning: 11,
    "hand-cannon": 9,
    sidearm: 8
  }[profile.style] ?? 9;
  const styleLength = {
    shotgun: 7,
    sniper: 16,
    ray: 12,
    lightning: 9,
    "hand-cannon": 10,
    sidearm: 9.5
  }[profile.style] ?? 11;
  const gap = THREE.MathUtils.clamp(
    styleGap + speedPressure * 6.5 + airPressure * 3.4 + state.recoil * 7 + profile.spread * 120,
    profile.style === "sniper" ? 4.5 : 7,
    profile.style === "shotgun" ? 34 : 22
  );
  const length = THREE.MathUtils.clamp(styleLength + profile.hitRadius * 9 - profile.spread * 60, 6, 18);
  const ring = THREE.MathUtils.clamp(gap * (profile.style === "shotgun" ? 3.2 : 2.4), 34, 112);
  const color = `#${profile.tracerColor.toString(16).padStart(6, "0")}`;
  hud.crosshair.dataset.style = profile.style;
  hud.crosshair.classList.toggle("reloading", reloadPressure > 0);
  hud.crosshair.style.setProperty("--aim-gap", `${gap.toFixed(1)}px`);
  hud.crosshair.style.setProperty("--aim-length", `${length.toFixed(1)}px`);
  hud.crosshair.style.setProperty("--aim-ring", `${ring.toFixed(1)}px`);
  hud.crosshair.style.setProperty("--aim-color", color);
  hud.crosshair.style.setProperty("--aim-opacity", reloadPressure > 0 ? "0.42" : state.firing ? "1" : "0.94");
}

function updateLocalSnapshot() {
  if (state.mode === GAME_MODES.RACING) {
    localSnapshot.position[0] = Number(race.car.position.x.toFixed(3));
    localSnapshot.position[1] = Number(race.car.position.y.toFixed(3));
    localSnapshot.position[2] = Number(race.car.position.z.toFixed(3));
    localSnapshot.rotation[0] = Number(race.heading.toFixed(4));
    localSnapshot.rotation[1] = 0;
    localSnapshot.velocity[0] = Number(race.velocity.x.toFixed(3));
    localSnapshot.velocity[1] = 0;
    localSnapshot.velocity[2] = Number(race.velocity.y.toFixed(3));
    localSnapshot.grounded = true;
    localSnapshot.bhopChain = 0;
    localSnapshot.weaponSlot = 0;
    localSnapshot.animation = race.drift > 0.18 ? "drift" : race.speed > 1 ? "drive" : "idle";
    localSnapshot.alive = true;
    return;
  }

  localSnapshot.position[0] = Number(player.position.x.toFixed(3));
  localSnapshot.position[1] = Number(player.position.y.toFixed(3));
  localSnapshot.position[2] = Number(player.position.z.toFixed(3));
  localSnapshot.rotation[0] = Number(player.rotation.y.toFixed(4));
  localSnapshot.rotation[1] = Number(pitch.rotation.x.toFixed(4));
  localSnapshot.velocity[0] = Number(velocity.x.toFixed(3));
  localSnapshot.velocity[1] = Number(state.verticalVelocity.toFixed(3));
  localSnapshot.velocity[2] = Number(velocity.z.toFixed(3));
  localSnapshot.grounded = state.grounded;
  localSnapshot.bhopChain = state.bhopChain;
  localSnapshot.weaponSlot = state.weaponSlot;
  localSnapshot.animation = getLocalAnimationState();
  localSnapshot.alive = state.alive;
}

function getLocalAnimationState() {
  if (!state.alive) {
    return "dead";
  }
  const speed = getHorizontalSpeed();
  const crouching = isCtrlHeld();
  if (state.slideTimer > 0) {
    return "slide";
  }
  if (crouching) {
    return "crouch";
  }
  if (!state.grounded) {
    return state.verticalVelocity > 0.4 ? "jump" : "fall";
  }
  if (state.firing) {
    return "shoot";
  }
  if (speed > 5.5) {
    return "run";
  }
  if (speed > 0.35) {
    return "walk";
  }
  return "idle";
}

function getLocalSnapshot() {
  return {
    id: localSnapshot.id,
    position: [...localSnapshot.position],
    rotation: [...localSnapshot.rotation],
    velocity: [...localSnapshot.velocity],
    grounded: localSnapshot.grounded,
    bhopChain: localSnapshot.bhopChain,
    weaponSlot: localSnapshot.weaponSlot,
    animation: localSnapshot.animation,
    alive: localSnapshot.alive
  };
}

function connectNetwork(afterConnect = null) {
  if (network.connected) {
    if (afterConnect) {
      afterConnect();
    }
    return;
  }
  if (network.connecting) {
    network.afterConnect = afterConnect;
    return;
  }

  const serverUrl = getServerUrlInput();
  const playerName = getPlayerNameInput();
  let url = appendQuery(serverUrl, "player_name", playerName);
  url = appendAccessToken(url, BACKEND_ACCESS_TOKEN);
  network.connecting = true;
  network.afterConnect = afterConnect;
  setServerUrlInput(serverUrl);
  setPlayerNameInput(playerName);
  setNetworkStatus("Connecting...");

  try {
    const socket = new WebSocket(url);
    network.socket = socket;

    socket.addEventListener("open", () => {
      network.connecting = false;
      network.connected = true;
      localStorage.setItem("neon_player_name", playerName);
      setNetworkStatus("Connected, waiting for lobby");
    });

    socket.addEventListener("message", (event) => {
      try {
        handleNetworkMessage(JSON.parse(event.data));
      } catch {
        setNetworkStatus("Invalid server message");
      }
    });

    socket.addEventListener("close", () => {
      network.connected = false;
      network.connecting = false;
      network.socket = null;
      network.clientId = null;
      network.matchId = null;
      network.afterConnect = null;
      localSnapshot.id = "local";
      setMatchIdInput("");
      clearRemotePlayers();
      clearScoreboard();
      setNetworkStatus("Disconnected");
    });

    socket.addEventListener("error", () => {
      setNetworkStatus("WebSocket connection error");
    });
  } catch {
    network.connecting = false;
    setNetworkStatus("Could not open WebSocket");
  }
}

function createNetworkMatch() {
  connectNetwork(() => {
    sendNetwork({
      type: "create_match",
      settings: {
        mode: state.mode === GAME_MODES.RACING ? "racing" : "deathmatch",
        map: state.mode === GAME_MODES.RACING ? "neon_circuit" : "aim_arena",
        max_players: 12
      }
    });
  });
}

function joinNetworkMatch(matchId) {
  const cleanMatchId = (matchId || getMatchIdInput()).trim();
  if (!cleanMatchId) {
    setNetworkStatus("Enter a Match ID or create a match");
    return;
  }
  setMatchIdInput(cleanMatchId);
  connectNetwork(() => {
    sendNetwork({ type: "join_match", match_id: cleanMatchId });
  });
}

function disconnectNetwork() {
  if (network.socket) {
    if (network.socket.readyState === WebSocket.OPEN) {
      sendNetwork({ type: "leave_match" });
    }
    network.socket.close();
  }
  network.connected = false;
  network.connecting = false;
  network.socket = null;
  network.clientId = null;
  network.matchId = null;
  network.afterConnect = null;
  localSnapshot.id = "local";
  setMatchIdInput("");
  clearRemotePlayers();
  clearScoreboard();
  setNetworkStatus("Disconnected");
}

function destroy() {
  if (disposed) {
    return;
  }
  disposed = true;
  cancelAnimationFrame(animationFrameId);
  while (eventCleanups.length) {
    eventCleanups.pop()();
  }
  if (document.pointerLockElement === renderer.domElement) {
    document.exitPointerLock();
  }
  disconnectNetwork();
  scene.traverse((object) => {
    object.geometry?.dispose?.();
    const material = object.material;
    if (Array.isArray(material)) {
      material.forEach((item) => item.dispose?.());
    } else {
      material?.dispose?.();
    }
  });
  renderer.dispose();
  renderer.domElement.remove();
  if (window.NeonAimNet?.getLocalSnapshot === getLocalSnapshot) {
    delete window.NeonAimNet;
  }
  if (window.NeonYardNet?.getLocalSnapshot === getLocalSnapshot) {
    delete window.NeonYardNet;
  }
}

function handleNetworkMessage(message) {
  if (!message || typeof message.type !== "string") {
    return;
  }

  if (message.type === "connected") {
    network.clientId = message.player?.id ?? null;
    localSnapshot.id = network.clientId ?? "local";
    setNetworkStatus(`Connected: ${localSnapshot.id}`);
    if (network.afterConnect) {
      const callback = network.afterConnect;
      network.afterConnect = null;
      callback();
    }
    return;
  }

  if (message.type === "match_created" || message.type === "joined_match" || message.type === "match_state") {
    syncMatchState(message.match);
    return;
  }

  if (message.type === "lobby_matches" && !network.matchId) {
    const count = Array.isArray(message.matches) ? message.matches.length : 0;
    setNetworkStatus(network.connected ? `Connected, available matches: ${count}` : "Disconnected");
    return;
  }

  if (message.type === "player_joined") {
    upsertRemotePlayer(message.player);
    setNetworkStatus(`Player joined: ${message.player?.name ?? "Player"}`);
    return;
  }

  if (message.type === "player_left") {
    removeRemotePlayer(message.player_id);
    return;
  }

  if (message.type === "player_update") {
    updateRemotePlayerState(message.player_id, message.state);
    return;
  }

  if (message.type === "player_damaged") {
    handlePlayerDamaged(message);
    return;
  }

  if (message.type === "player_killed") {
    handlePlayerKilled(message);
    return;
  }

  if (message.type === "player_respawned") {
    handlePlayerRespawned(message);
    return;
  }

  if (message.type === "player_action" && message.action === "shoot") {
    drawRemoteAction(message.payload, message.player_id);
    return;
  }

  if (message.type === "error") {
    setNetworkStatus(`${message.code}: ${message.message}`);
  }
}

function syncMatchState(match) {
  if (!match || !match.id) {
    return;
  }
  const matchMode = match.mode === "racing" ? GAME_MODES.RACING : GAME_MODES.SHOOTER;
  if (state.mode !== matchMode) {
    clearRemotePlayers();
    if (matchMode === GAME_MODES.RACING) {
      resetRace();
    } else {
      state.mode = GAME_MODES.SHOOTER;
      applyGameMode();
    }
  }
  network.matchId = match.id;
  setMatchIdInput(match.id);
  setNetworkStatus(`In match: ${match.id} | Players: ${match.players?.length ?? 1}/${match.max_players ?? "?"}`);
  if (runtimeOptions.autoStart && !state.running && runtimeOptions.roomAction === "join") {
    startGame();
  }
  window.dispatchEvent(new CustomEvent("arcade:room-ready", {
    detail: {
      matchId: match.id,
      serverUrl: getServerUrlInput(),
      playerName: getPlayerNameInput(),
      mode: state.mode,
      players: match.players?.length ?? 1,
      maxPlayers: match.max_players ?? null
    }
  }));
  updateScoreboard(match.players ?? []);

  if (state.mode === GAME_MODES.RACING) {
    const seen = new Set();
    for (const playerInfo of match.players ?? []) {
      if (playerInfo.id === network.clientId) {
        continue;
      }
      seen.add(playerInfo.id);
      upsertRemotePlayer(playerInfo);
    }

    for (const playerId of [...remotePlayers.keys()]) {
      if (!seen.has(playerId)) {
        removeRemotePlayer(playerId);
      }
    }
    return;
  }

  const seen = new Set();
  for (const playerInfo of match.players ?? []) {
    if (playerInfo.id === network.clientId) {
      applyLocalPlayerInfo(playerInfo);
      continue;
    }
    seen.add(playerInfo.id);
    upsertRemotePlayer(playerInfo);
  }

  for (const playerId of [...remotePlayers.keys()]) {
    if (!seen.has(playerId)) {
      removeRemotePlayer(playerId);
    }
  }
}

function handlePlayerDamaged(message) {
  const damage = Number.isFinite(Number(message.damage)) ? Number(message.damage) : null;
  const damageText = damage ? ` -${damage}` : "";
  if (message.victim_id === network.clientId) {
    showPulseMarker("damage");
    addCombatFeed(`${message.attacker_name ?? "Player"}${damageText}`, "damage");
    showToast(`Hit${damageText} - HP ${message.health}/${message.max_health}`);
  } else if (message.attacker_id === network.clientId) {
    showPulseMarker("hit");
    addCombatFeed(`Hit ${message.victim_name ?? "Player"}${damageText}`, "hit");
    audio.hit();
  }

  if (message.match) {
    syncMatchState(message.match);
  } else {
    updateScoreboard();
  }
}

function handlePlayerKilled(message) {
  if (message.victim_id === network.clientId) {
    setLocalAlive(false);
    showPulseMarker("damage");
    addCombatFeed(`${message.killer_name ?? "Player"} eliminated you`, "damage");
    showToast(`Killed by ${message.killer_name ?? "Player"} - respawn 1s`);
  } else {
    const victim = remotePlayers.get(message.victim_id);
    if (victim) {
      victim.alive = false;
      victim.group.visible = false;
    }
    if (message.killer_id === network.clientId) {
      showPulseMarker("kill");
      addCombatFeed(`Eliminated ${message.victim_name ?? "Player"}`, "kill");
      showToast(`Kill +1: ${message.victim_name ?? "Player"}`);
      audio.finish();
    } else {
      addCombatFeed(`${message.killer_name ?? "Player"} eliminated ${message.victim_name ?? "Player"}`, "kill");
    }
  }

  if (message.match) {
    syncMatchState(message.match);
  } else {
    updateScoreboard();
  }
}

function handlePlayerRespawned(message) {
  if (message.player_id === network.clientId) {
    respawnLocalPlayer(message.state);
  } else {
    const remote = remotePlayers.get(message.player_id);
    if (remote) {
      remote.alive = true;
      remote.group.visible = true;
      updateRemotePlayerState(message.player_id, message.state);
    }
  }

  if (message.match) {
    syncMatchState(message.match);
  } else {
    updateScoreboard();
  }
}

function applyLocalPlayerInfo(playerInfo) {
  const isAlive = playerInfo.alive !== false;
  if (!isAlive && state.alive) {
    setLocalAlive(false);
  } else if (isAlive && !state.alive) {
    respawnLocalPlayer(playerInfo.state);
  }
}

function setLocalAlive(alive) {
  state.alive = alive;
  localSnapshot.alive = alive;
  if (!alive) {
    clearGameplayInput();
    velocity.set(0, 0, 0);
    state.firing = false;
    state.verticalVelocity = 0;
    resetMotionTech();
  }
}

function respawnLocalPlayer(remoteState = null) {
  const position = Array.isArray(remoteState?.position) ? remoteState.position : [0, 0, 27];
  player.position.set(Number(position[0]) || 0, Number(position[1]) || 0, Number(position[2]) || 27);
  velocity.set(0, 0, 0);
  state.verticalVelocity = 0;
  state.grounded = false;
  state.coyote = 0;
  resetMotionTech();
  state.stamina = 100;
  state.fireTimer = 0;
  state.weaponSwitchTimer = 0;
  resetWeaponInventory();
  state.recoil = 0;
  state.firing = false;
  state.alive = true;
  localSnapshot.alive = true;
  showToast("Respawn");
  updateLocalSnapshot();
  updateHud();
}

function sendNetworkUpdate(dt) {
  if (!network.connected || !network.matchId) {
    return;
  }
  network.sendTimer += dt;
  if (network.sendTimer < 0.05) {
    return;
  }
  network.sendTimer = 0;
  sendNetwork({ type: "player_update", state: getLocalSnapshot() });
}

function sendNetworkAction(action, payload) {
  if (!network.connected || !network.matchId) {
    return;
  }
  sendNetwork({ type: action, payload: { action, ...payload } });
}

function sendNetwork(message) {
  if (!network.socket || network.socket.readyState !== WebSocket.OPEN) {
    return false;
  }
  network.socket.send(JSON.stringify(message));
  return true;
}

function upsertRemotePlayer(playerInfo) {
  if (!playerInfo?.id || playerInfo.id === network.clientId) {
    return;
  }
  const wantedKind = state.mode === GAME_MODES.RACING ? "racing" : "shooter";
  let remote = remotePlayers.get(playerInfo.id);
  if (remote && remote.kind !== wantedKind) {
    removeRemotePlayer(playerInfo.id);
    remote = null;
  }
  if (!remote) {
    remote = wantedKind === "racing" ? createRemoteRacePlayer(playerInfo) : createRemotePlayer(playerInfo);
    remotePlayers.set(playerInfo.id, remote);
  }
  remote.name = playerInfo.name ?? remote.name;
  remote.kills = playerInfo.kills ?? remote.kills;
  remote.deaths = playerInfo.deaths ?? remote.deaths;
  remote.health = playerInfo.health ?? remote.health;
  remote.maxHealth = playerInfo.max_health ?? remote.maxHealth;
  remote.alive = playerInfo.alive !== false;
  updateRemotePlayerState(playerInfo.id, playerInfo.state);
}

function createRemoteHitbox(geometry, playerId) {
  const material = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    colorWrite: false
  });
  const hitbox = new THREE.Mesh(geometry, material);
  hitbox.userData.remotePlayerId = playerId;
  return hitbox;
}

function createRemotePlayer(playerInfo) {
  const group = new THREE.Group();
  group.position.set(0, 0, 0);
  scene.add(group);

  const color = colorFromId(playerInfo.id);
  const characterMount = new THREE.Group();
  const fallbackBodyGroup = new THREE.Group();
  const hitboxGroup = new THREE.Group();
  const weaponMount = new THREE.Group();
  const fallbackWeaponGroup = new THREE.Group();

  weaponMount.position.set(-0.24, 1.08, -0.52);
  weaponMount.rotation.set(-0.08, 0.04, 0.1);
  group.add(characterMount, fallbackBodyGroup, fallbackWeaponGroup, weaponMount, hitboxGroup);

  const bodyMaterial = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.48,
    metalness: 0.08
  });
  const visorMaterial = new THREE.MeshStandardMaterial({
    color: 0x101820,
    emissive: color,
    emissiveIntensity: 0.28,
    roughness: 0.28,
    metalness: 0.12
  });
  const armorMaterial = new THREE.MeshStandardMaterial({
    color: 0xf4fbff,
    emissive: color,
    emissiveIntensity: 0.1,
    roughness: 0.36,
    metalness: 0.08
  });

  const bodyHitbox = createRemoteHitbox(new THREE.CapsuleGeometry(0.33, 0.78, 6, 12), playerInfo.id);
  bodyHitbox.position.y = 0.95;
  hitboxGroup.add(bodyHitbox);

  const chestHitbox = createRemoteHitbox(new THREE.BoxGeometry(0.58, 0.42, 0.18), playerInfo.id);
  chestHitbox.position.set(0, 1.13, -0.17);
  hitboxGroup.add(chestHitbox);

  const headHitbox = createRemoteHitbox(new THREE.SphereGeometry(0.26, 18, 12), playerInfo.id);
  headHitbox.position.y = 1.58;
  hitboxGroup.add(headHitbox);

  const visorHitbox = createRemoteHitbox(new THREE.BoxGeometry(0.34, 0.08, 0.08), playerInfo.id);
  visorHitbox.position.set(0, 1.61, -0.25);
  hitboxGroup.add(visorHitbox);

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.33, 0.78, 6, 12), bodyMaterial);
  body.position.y = 0.95;
  body.castShadow = true;
  fallbackBodyGroup.add(body);

  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.42, 0.18), armorMaterial);
  chest.position.set(0, 1.13, -0.17);
  chest.castShadow = true;
  fallbackBodyGroup.add(chest);

  const spineLight = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.58, 0.035), materials.accentBlue);
  spineLight.position.set(0, 1.12, 0.24);
  fallbackBodyGroup.add(spineLight);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 18, 12), bodyMaterial);
  head.position.y = 1.58;
  head.castShadow = true;
  fallbackBodyGroup.add(head);

  const helmet = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.36), armorMaterial);
  helmet.position.y = 1.69;
  helmet.castShadow = true;
  fallbackBodyGroup.add(helmet);

  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.06, 0.06), visorMaterial);
  visor.position.set(0, 1.61, -0.25);
  fallbackBodyGroup.add(visor);

  for (const side of [-1, 1]) {
    const shoulder = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.14, 0.22), armorMaterial);
    shoulder.position.set(side * 0.39, 1.3, -0.02);
    shoulder.rotation.z = side * 0.2;
    shoulder.castShadow = true;
    fallbackBodyGroup.add(shoulder);

    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.5, 5, 8), bodyMaterial);
    arm.position.set(side * 0.47, 0.98, -0.08);
    arm.rotation.z = side * 0.16;
    arm.castShadow = true;
    fallbackBodyGroup.add(arm);

    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.095, 0.52, 5, 8), bodyMaterial);
    leg.position.set(side * 0.14, 0.36, 0.01);
    leg.castShadow = true;
    fallbackBodyGroup.add(leg);

    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.09, 0.28), materials.platformDark);
    boot.position.set(side * 0.14, 0.08, -0.06);
    boot.castShadow = true;
    fallbackBodyGroup.add(boot);
  }

  const rifle = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.82), materials.weapon);
  rifle.position.set(0, 0, 0.1);
  fallbackWeaponGroup.add(rifle);

  const rifleBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.032, 0.42, 10), materials.weapon);
  rifleBarrel.position.set(0, 0, -0.5);
  rifleBarrel.rotation.x = Math.PI / 2;
  fallbackWeaponGroup.position.copy(weaponMount.position);
  fallbackWeaponGroup.rotation.copy(weaponMount.rotation);
  fallbackWeaponGroup.add(rifleBarrel);

  const label = createNameSprite(playerInfo.name ?? "Player", color);
  label.position.y = 2.16;
  group.add(label);

  const remote = {
    id: playerInfo.id,
    kind: "shooter",
    name: playerInfo.name ?? "Player",
    kills: playerInfo.kills ?? 0,
    deaths: playerInfo.deaths ?? 0,
    health: playerInfo.health ?? 5,
    maxHealth: playerInfo.max_health ?? 5,
    alive: playerInfo.alive !== false,
    group,
    characterMount,
    fallbackBodyGroup,
    hitboxGroup,
    weaponMount,
    fallbackWeaponGroup,
    label,
    hitboxes: [bodyHitbox, chestHitbox, headHitbox, visorHitbox],
    targetPosition: new THREE.Vector3(0, 0, 0),
    targetYaw: 0,
    targetPitch: 0,
    targetSpeed: 0,
    targetVerticalVelocity: 0,
    grounded: true,
    animationHint: "idle",
    animationSpeed: 0,
    postureBlend: 0,
    airborneBlend: 0,
    shootTimer: 0,
    weaponKick: 0,
    weaponSlot: 0,
    weaponHand: null,
    weaponAttachedToHand: false,
    weaponBasePosition: new THREE.Vector3(),
    weaponBaseRotation: new THREE.Euler(),
    pendingHit: 0,
    lastSeen: performance.now(),
    mixer: null,
    animation: null,
    characterModel: null,
    weaponModel: null,
    weaponModelEntry: null
  };

  mountRemoteCharacterModel(remote);
  mountRemoteWeaponModel(remote);
  return remote;
}

function createRemoteRacePlayer(playerInfo) {
  const color = colorFromId(playerInfo.id);
  const bodyMaterial = materials.raceCarBody.clone();
  bodyMaterial.color.setHex(color);
  bodyMaterial.emissive.setHex(color);
  bodyMaterial.emissiveIntensity = 0.22;

  const accentMaterial = materials.accentGreen.clone();
  accentMaterial.color.setHex(0xffffff);
  accentMaterial.emissive.setHex(color);
  accentMaterial.emissiveIntensity = 0.24;

  const group = createRaceCar(bodyMaterial, accentMaterial);
  group.scale.setScalar(0.94);
  race.world.add(group);

  const label = createNameSprite(playerInfo.name ?? "Player", color);
  label.position.y = 1.72;
  group.add(label);

  return {
    id: playerInfo.id,
    kind: "racing",
    name: playerInfo.name ?? "Player",
    kills: playerInfo.kills ?? 0,
    deaths: playerInfo.deaths ?? 0,
    health: playerInfo.health ?? 5,
    maxHealth: playerInfo.max_health ?? 5,
    alive: playerInfo.alive !== false,
    group,
    label,
    hitboxes: [],
    targetPosition: new THREE.Vector3(0, 0.18, 24),
    targetYaw: -Math.PI / 2,
    pendingHit: 0,
    lastSeen: performance.now()
  };
}

function updateRemotePlayerState(playerId, remoteState) {
  const remote = remotePlayers.get(playerId);
  if (!remote || !remoteState) {
    return;
  }

  if (typeof remoteState.alive === "boolean") {
    remote.alive = remoteState.alive;
  }

  if (typeof remoteState.grounded === "boolean") {
    remote.grounded = remoteState.grounded;
  }

  if (typeof remoteState.animation === "string") {
    remote.animationHint = remoteState.animation.slice(0, 32);
  }

  if (Array.isArray(remoteState.position) && remoteState.position.length >= 3) {
    remote.targetPosition.set(
      Number(remoteState.position[0]) || 0,
      Number(remoteState.position[1]) || 0,
      Number(remoteState.position[2]) || 0
    );
  }

  if (Array.isArray(remoteState.rotation) && remoteState.rotation.length >= 1) {
    remote.targetYaw = Number(remoteState.rotation[0]) || 0;
    remote.targetPitch = Number(remoteState.rotation[1]) || 0;
  }

  if (Array.isArray(remoteState.velocity) && remoteState.velocity.length >= 3) {
    const velocityX = Number(remoteState.velocity[0]) || 0;
    const velocityY = Number(remoteState.velocity[1]) || 0;
    const velocityZ = Number(remoteState.velocity[2]) || 0;
    remote.targetSpeed = Math.hypot(velocityX, velocityZ);
    remote.targetVerticalVelocity = velocityY;
  }

  if (Number.isFinite(remoteState.weaponSlot) && runtimeModels.weapons.length) {
    const nextSlot = THREE.MathUtils.clamp(Math.trunc(remoteState.weaponSlot), 0, runtimeModels.weapons.length - 1);
    if (nextSlot !== remote.weaponSlot) {
      remote.weaponSlot = nextSlot;
      mountRemoteWeaponModel(remote);
    }
  }

  remote.lastSeen = performance.now();
}

function updateRemotePlayers(dt) {
  const now = performance.now();
  const activeKind = state.mode === GAME_MODES.RACING ? "racing" : "shooter";
  for (const remote of remotePlayers.values()) {
    remote.group.position.lerp(remote.targetPosition, 1 - Math.exp(-16 * dt));
    remote.group.rotation.y = THREE.MathUtils.damp(remote.group.rotation.y, remote.targetYaw, 14, dt);
    updateRemoteCharacterMotion(remote, dt);
    remote.mixer?.update(dt);
    remote.label.lookAt(camera.getWorldPosition(tempVec3));
    remote.group.visible = remote.kind === activeKind && remote.alive && now - remote.lastSeen < 6000;
  }
}

function updateRemoteCharacterMotion(remote, dt) {
  if (remote.kind !== "shooter") {
    return;
  }
  remote.animationSpeed = THREE.MathUtils.damp(remote.animationSpeed, remote.targetSpeed, 8, dt);
  remote.shootTimer = Math.max(0, remote.shootTimer - dt);
  remote.weaponKick = THREE.MathUtils.damp(remote.weaponKick, 0, 18, dt);

  const posture = getRemotePosture(remote);
  updateRemoteProceduralPose(remote, posture, dt);
  updateRemoteWeaponPose(remote);

  if (!remote.animation) {
    return;
  }

  const moving = remote.animationSpeed > 0.28;
  const running = remote.animationSpeed > 5.5;
  const animationName = remote.shootTimer > 0 && remote.animation.actions.shoot
    ? "shoot"
    : moving ? (running ? "run" : "walk") : "idle";
  setRemoteAnimation(remote, animationName);

  const moveAction = running ? remote.animation.actions.run : remote.animation.actions.walk;
  if (moveAction) {
    moveAction.timeScale = THREE.MathUtils.clamp(remote.animationSpeed / 5.8, posture === "slide" ? 1.05 : 0.75, 1.55);
  }
}

function getRemotePosture(remote) {
  if (remote.animationHint === "slide") {
    return "slide";
  }
  if (remote.animationHint === "crouch") {
    return "crouch";
  }
  if (!remote.grounded || remote.animationHint === "jump" || remote.animationHint === "fall") {
    return remote.targetVerticalVelocity > 0.4 || remote.animationHint === "jump" ? "jump" : "fall";
  }
  return "stand";
}

function updateRemoteProceduralPose(remote, posture, dt) {
  const slide = posture === "slide";
  const crouch = posture === "crouch";
  const airborne = posture === "jump" || posture === "fall";
  remote.postureBlend = THREE.MathUtils.damp(remote.postureBlend, slide ? 1 : crouch ? 0.62 : 0, 9, dt);
  remote.airborneBlend = THREE.MathUtils.damp(remote.airborneBlend, airborne ? 1 : 0, 7, dt);

  const slideLean = remote.postureBlend;
  const jumpLean = remote.airborneBlend * (posture === "jump" ? -0.14 : 0.12);
  remote.characterMount.position.y = THREE.MathUtils.damp(remote.characterMount.position.y, 0.12 * slideLean, 10, dt);
  remote.characterMount.rotation.x = THREE.MathUtils.damp(remote.characterMount.rotation.x, -0.52 * slideLean + jumpLean, 9, dt);
  remote.characterMount.rotation.z = THREE.MathUtils.damp(remote.characterMount.rotation.z, 0.12 * slideLean, 9, dt);
  remote.characterMount.scale.y = THREE.MathUtils.damp(remote.characterMount.scale.y, 1 - 0.22 * slideLean, 9, dt);

  if (remote.hitboxGroup) {
    remote.hitboxGroup.position.y = THREE.MathUtils.damp(remote.hitboxGroup.position.y, 0, 10, dt);
    remote.hitboxGroup.scale.y = THREE.MathUtils.damp(remote.hitboxGroup.scale.y, 1 - 0.24 * slideLean, 10, dt);
  }
}

function updateRemoteWeaponPose(remote) {
  if (!remote.weaponModel) {
    return;
  }
  remote.weaponModel.position.copy(remote.weaponBasePosition);
  remote.weaponModel.rotation.copy(remote.weaponBaseRotation);
  if (remote.weaponAttachedToHand) {
    remote.weaponModel.position.y -= remote.weaponKick * 0.085;
  } else {
    remote.weaponModel.position.z += remote.weaponKick * 0.08;
    remote.weaponMount.rotation.x = -0.08 + THREE.MathUtils.clamp(remote.targetPitch, -0.8, 0.8) * 0.2;
  }
}

function removeRemotePlayer(playerId) {
  const remote = remotePlayers.get(playerId);
  if (!remote) {
    return;
  }
  remote.mixer?.stopAllAction();
  remote.group.parent?.remove(remote.group);
  remotePlayers.delete(playerId);
}

function clearRemotePlayers() {
  for (const playerId of [...remotePlayers.keys()]) {
    removeRemotePlayer(playerId);
  }
}

function updateScoreboard(players = null) {
  if (Array.isArray(players)) {
    scorePlayers.clear();
    for (const playerInfo of players) {
      if (playerInfo?.id) {
        scorePlayers.set(playerInfo.id, playerInfo);
      }
    }
  }

  if (!hud.scoreRows) {
    return;
  }

  hud.scoreRows.replaceChildren();
  const entries = [...scorePlayers.values()].sort((a, b) => {
    const killDelta = (b.kills ?? 0) - (a.kills ?? 0);
    if (killDelta !== 0) {
      return killDelta;
    }
    const deathDelta = (a.deaths ?? 0) - (b.deaths ?? 0);
    if (deathDelta !== 0) {
      return deathDelta;
    }
    return String(a.name ?? "").localeCompare(String(b.name ?? ""));
  });

  if (entries.length === 0) {
    const empty = document.createElement("div");
    empty.className = "score-empty";
    empty.textContent = "Deathmatch";
    hud.scoreRows.append(empty);
    return;
  }

  for (const playerInfo of entries.slice(0, 6)) {
    const row = document.createElement("div");
    row.className = "score-row";
    if (playerInfo.id === network.clientId) {
      row.classList.add("local");
    }
    if (playerInfo.alive === false) {
      row.classList.add("dead");
    }

    const name = document.createElement("span");
    const health = playerInfo.alive === false ? 0 : playerInfo.health ?? playerInfo.max_health ?? 5;
    const maxHealth = playerInfo.max_health ?? 5;
    name.textContent = `${playerInfo.name ?? "Player"}${playerInfo.alive === false ? " - DEAD" : ""}`;
    const score = document.createElement("strong");
    score.textContent = `${health}/${maxHealth} | ${playerInfo.kills ?? 0}/${playerInfo.deaths ?? 0}`;
    row.append(name, score);
    hud.scoreRows.append(row);
  }
}

function clearScoreboard() {
  scorePlayers.clear();
  updateScoreboard([]);
}

function drawRemoteAction(payload, playerId = null) {
  if (!payload?.origin || !payload?.direction) {
    return;
  }
  const origin = new THREE.Vector3(payload.origin[0], payload.origin[1], payload.origin[2]);
  const direction = new THREE.Vector3(payload.direction[0], payload.direction[1], payload.direction[2]).normalize();
  const profile = payload.weapon
    ? getWeaponProfileById(payload.weapon)
    : getWeaponProfile(getWeaponEntryForSlot(payload.weaponSlot)?.asset);
  for (let index = 0; index < profile.projectiles; index++) {
    const projectileProfile = getProjectileProfile(profile);
    spawnTracer(
      origin,
      createShotDirection(direction, projectileProfile, index),
      Math.min(projectileProfile.missDistance, projectileProfile.range),
      false,
      projectileProfile
    );
  }
  if (playerId) {
    const remote = remotePlayers.get(playerId);
    if (remote) {
      const weaponSlot = getWeaponSlotById(payload.weapon);
      if (weaponSlot >= 0 && weaponSlot !== remote.weaponSlot) {
        remote.weaponSlot = weaponSlot;
        mountRemoteWeaponModel(remote);
      }
      triggerRemoteShoot(remote);
    }
  }
}

function triggerRemoteShoot(remote) {
  remote.shootTimer = 0.22;
  remote.weaponKick = 1;
  const shootAction = remote.animation?.actions?.shoot;
  if (shootAction) {
    if (remote.animation.current === "shoot") {
      shootAction.reset().play();
    } else {
      setRemoteAnimation(remote, "shoot", 0.04);
    }
  }
}

function createNameSprite(name, color) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "rgba(255,255,255,0.82)";
  ctx.strokeStyle = `#${color.toString(16).padStart(6, "0")}`;
  ctx.lineWidth = 4;
  roundRect(ctx, 10, 10, 236, 44, 10);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#102028";
  ctx.font = "700 24px Segoe UI, Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(name.slice(0, 16), 128, 33);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(1.6, 0.4, 1);
  return sprite;
}

function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function colorFromId(id) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  const color = new THREE.Color();
  color.setHSL((hash % 360) / 360, 0.72, 0.52);
  return color.getHex();
}

function setNetworkStatus(text) {
  if (hud.networkStatus) {
    hud.networkStatus.textContent = text;
  }
  if (hud.settingsNetworkStatus) {
    hud.settingsNetworkStatus.textContent = text;
  }
  updateSettingsPanel();
}

function hydrateNetworkForm() {
  const storedName = localStorage.getItem("neon_player_name");
  setServerUrlInput(DEFAULT_SERVER_URL);
  setPlayerNameInput(storedName || hud.playerNameInput?.value || DEFAULT_PLAYER_NAME);
  setMatchIdInput(hud.matchIdInput?.value || "");
  updateSettingsPanel();
}

function bindSyncedInputs(primary, secondary) {
  if (!primary || !secondary) {
    return;
  }
  addEvent(primary, "input", () => {
    syncInputValue(primary, secondary);
    updateSettingsPanel();
  });
  addEvent(secondary, "input", () => {
    syncInputValue(secondary, primary);
    updateSettingsPanel();
  });
}

function syncInputValue(source, target) {
  if (!source || !target || target.value === source.value) {
    return;
  }
  target.value = source.value;
}

function getPlayerNameInput() {
  return getSyncedInputValue(hud.playerNameInput, hud.settingsPlayerNameInput, DEFAULT_PLAYER_NAME);
}

function getServerUrlInput() {
  return normalizeWebSocketUrl(getSyncedInputValue(hud.serverUrlInput, hud.settingsServerUrlInput, DEFAULT_SERVER_URL));
}

function getMatchIdInput() {
  return getSyncedInputValue(hud.matchIdInput, hud.settingsMatchIdInput, "");
}

function getSyncedInputValue(primary, secondary, fallback) {
  const value = (secondary?.value || primary?.value || "").trim();
  return value || fallback;
}

function setPlayerNameInput(value) {
  const cleanValue = value || DEFAULT_PLAYER_NAME;
  if (hud.playerNameInput) {
    hud.playerNameInput.value = cleanValue;
  }
  if (hud.settingsPlayerNameInput) {
    hud.settingsPlayerNameInput.value = cleanValue;
  }
}

function setServerUrlInput(value) {
  const cleanValue = normalizeWebSocketUrl(value || DEFAULT_SERVER_URL);
  if (hud.serverUrlInput) {
    hud.serverUrlInput.value = cleanValue;
  }
  if (hud.settingsServerUrlInput) {
    hud.settingsServerUrlInput.value = cleanValue;
  }
}

function normalizeWebSocketUrl(value) {
  const cleanValue = (value || "").trim();
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

function setMatchIdInput(value) {
  const cleanValue = value || "";
  if (hud.matchIdInput) {
    hud.matchIdInput.value = cleanValue;
  }
  if (hud.settingsMatchIdInput) {
    hud.settingsMatchIdInput.value = cleanValue;
  }
  updateSettingsPanel();
}

function updateSettingsPanel() {
  if (hud.sessionIdValue) {
    hud.sessionIdValue.value = network.matchId || network.clientId || EMPTY_SESSION_LABEL;
  }
  syncInputValue(hud.playerNameInput, hud.settingsPlayerNameInput);
  syncInputValue(hud.serverUrlInput, hud.settingsServerUrlInput);
  syncInputValue(hud.matchIdInput, hud.settingsMatchIdInput);
  if (hud.networkStatus && hud.settingsNetworkStatus) {
    hud.settingsNetworkStatus.textContent = hud.networkStatus.textContent;
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

function getHorizontalSpeed() {
  return Math.hypot(velocity.x, velocity.z);
}

function cameraForwardFlat() {
  camera.getWorldDirection(tempVec3);
  tempVec3.y = 0;
  if (tempVec3.lengthSq() < 0.001) {
    tempVec3.set(0, 0, -1).applyAxisAngle(WORLD_UP, player.rotation.y);
  }
  return tempVec3.normalize().clone();
}

function isCtrlHeld() {
  return keys.has("control") || keys.has("ctrl");
}

function getTopNumberSlot(event) {
  if (!/^Digit[1-9]$/.test(event.code)) {
    return null;
  }
  return Number(event.code.slice(5)) - 1;
}

function normalizeInputKey(event) {
  if (event.code === "Space") {
    return " ";
  }
  if (event.key === "Control" || event.code === "ControlLeft" || event.code === "ControlRight") {
    return "control";
  }
  return event.key.toLowerCase();
}

function shouldCaptureKey(event, key) {
  if (!state.running) {
    return false;
  }
  if (GAMEPLAY_KEYS.has(key)) {
    return true;
  }
  return event.ctrlKey && MOVEMENT_KEYS.has(key);
}

function onResize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.55));
  renderer.setSize(width, height);
}

function resolveRotatedCollider(collider, position, radius) {
  const local = worldToColliderLocal(collider, position.x, position.z);
  const closestX = THREE.MathUtils.clamp(local.x, -collider.halfW, collider.halfW);
  const closestZ = THREE.MathUtils.clamp(local.y, -collider.halfD, collider.halfD);
  const diffX = local.x - closestX;
  const diffZ = local.y - closestZ;
  const distSq = diffX * diffX + diffZ * diffZ;

  if (distSq > radius * radius) {
    return;
  }

  if (distSq < 0.00001) {
    const pushX = collider.halfW - Math.abs(local.x);
    const pushZ = collider.halfD - Math.abs(local.y);
    if (pushX < pushZ) {
      local.x += (local.x >= 0 ? 1 : -1) * (pushX + radius);
      velocity.x *= -0.06;
    } else {
      local.y += (local.y >= 0 ? 1 : -1) * (pushZ + radius);
      velocity.z *= -0.06;
    }
  } else {
    const dist = Math.sqrt(distSq);
    local.x += (diffX / dist) * (radius - dist);
    local.y += (diffZ / dist) * (radius - dist);
    velocity.x *= 0.95;
    velocity.z *= 0.95;
  }

  const world = colliderLocalToWorld(collider, local.x, local.y);
  position.x = world.x;
  position.z = world.y;
}

function makeRotatedCollider(position, width, depth, rotation) {
  return {
    x: position.x,
    z: position.z,
    halfW: width / 2,
    halfD: depth / 2,
    rotation,
    cos: Math.cos(-rotation),
    sin: Math.sin(-rotation)
  };
}

function worldToColliderLocal(collider, x, z) {
  const dx = x - collider.x;
  const dz = z - collider.z;
  return tempVec2.set(dx * collider.cos - dz * collider.sin, dx * collider.sin + dz * collider.cos);
}

function colliderLocalToWorld(collider, x, z) {
  const cos = Math.cos(collider.rotation);
  const sin = Math.sin(collider.rotation);
  return tempVec2.set(x * cos - z * sin + collider.x, x * sin + z * cos + collider.z);
}

function raycastCollider2D(collider, x, z, dx, dz, maxDistance, inflate = 0) {
  const localOrigin = worldToColliderLocal(collider, x, z).clone();
  const localEnd = worldToColliderLocal(collider, x + dx, z + dz).clone();
  const localDirX = localEnd.x - localOrigin.x;
  const localDirZ = localEnd.y - localOrigin.y;
  const halfW = collider.halfW + inflate;
  const halfD = collider.halfD + inflate;
  let tMin = 0;
  let tMax = maxDistance;

  if (Math.abs(localDirX) < 0.0001) {
    if (localOrigin.x < -halfW || localOrigin.x > halfW) {
      return null;
    }
  } else {
    const inv = 1 / localDirX;
    let t1 = (-halfW - localOrigin.x) * inv;
    let t2 = (halfW - localOrigin.x) * inv;
    if (t1 > t2) {
      [t1, t2] = [t2, t1];
    }
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
  }

  if (Math.abs(localDirZ) < 0.0001) {
    if (localOrigin.y < -halfD || localOrigin.y > halfD) {
      return null;
    }
  } else {
    const inv = 1 / localDirZ;
    let t1 = (-halfD - localOrigin.y) * inv;
    let t2 = (halfD - localOrigin.y) * inv;
    if (t1 > t2) {
      [t1, t2] = [t2, t1];
    }
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
  }

  if (tMax < 0 || tMin > tMax || tMin > maxDistance) {
    return null;
  }
  return Math.max(0, tMin);
}

function horizontalDistance(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function createFloorTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#94ad75";
  ctx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 900; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const radius = randomRange(1.5, 6);
    const hue = Math.random() > 0.54 ? "rgba(103, 135, 78, 0.22)" : "rgba(178, 150, 98, 0.16)";
    ctx.fillStyle = hue;
    ctx.beginPath();
    ctx.ellipse(x, y, radius * randomRange(0.7, 1.8), radius, randomRange(0, Math.PI), 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = "rgba(76, 94, 59, 0.22)";
  ctx.lineWidth = 2;
  for (let i = 0; i < 36; i++) {
    const y = Math.random() * 512;
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x <= 512; x += 64) {
      ctx.lineTo(x, y + Math.sin(x * 0.02 + i) * randomRange(2, 7));
    }
    ctx.stroke();
  }

  return new THREE.CanvasTexture(canvas);
}

function createSkyTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 16;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createLinearGradient(0, 0, 0, 256);
  gradient.addColorStop(0, "#a8d8ff");
  gradient.addColorStop(0.54, "#dcefff");
  gradient.addColorStop(1, "#f2f5ee");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 16, 256);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createAudioSystem() {
  const noop = () => {};
  return {
    resume: noop,
    shoot: noop,
    reload: noop,
    reloadReady: noop,
    hit: noop,
    miss: noop,
    jump: noop,
    bhop: noop,
    boost: noop,
    finish: noop
  };
}

function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

function round4(value) {
  return Number(value.toFixed(4));
}
}
