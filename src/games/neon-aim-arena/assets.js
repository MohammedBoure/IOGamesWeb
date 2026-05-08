const basePath = "/assets/games/neon-aim-arena/models";
const weaponPackPath = `${basePath}/weapons/arena-pack`;

export const neonAimArenaAssets = {
  loadout: {
    primaryWeaponId: "rifle"
  },
  character: {
    id: "swat",
    name: "SWAT",
    type: "remote-player",
    format: "gltf",
    path: `${basePath}/characters/swat.gltf`,
    suitability: "Best current fit for the shooter theme and much lighter than the previous Ninja GLB."
  },
  weapons: [
    {
      id: "pistol",
      name: "Pistol",
      modelLength: 0.76,
      remoteLength: 0.6,
      handLength: 0.58,
      viewPosition: [0.32, -0.43, -0.76],
      viewRotation: [-0.075, -0.32, 0.045],
      localOffset: [0.05, -0.04, -0.18],
      localRotation: [0.012, 0.56, -0.12],
      muzzleOffset: [0.02, 0.04, -0.5],
      fire: { style: "sidearm", auto: false, interval: 0.15, range: 64, damage: 3, spread: 0.0012, recoil: 0.065, pitchKick: 0.0028, yawKick: 0.001, aimAssist: 0.018, hitRadius: 0.135, mobility: 1.08, tracerSpeed: 185, tracerLength: 2.1, tracerRadius: 0.026, tracerLifetime: 1, flashScale: 1.12, muzzleIntensity: 15, tracerColor: 0xffd68a, hitColor: 0xfff0b8, missDistance: 38 }
    },
    {
      id: "long-pistol",
      name: "Hand Cannon",
      modelLength: 0.92,
      remoteLength: 0.74,
      handLength: 0.72,
      viewPosition: [0.3, -0.46, -0.82],
      viewRotation: [-0.078, -0.34, 0.04],
      localOffset: [0.05, -0.08, -0.28],
      localRotation: [0.012, 0.72, -0.12],
      muzzleOffset: [0.02, 0.04, -0.66],
      fire: { style: "hand-cannon", auto: false, interval: 0.3, range: 82, damage: 2, spread: 0.0009, recoil: 0.24, pitchKick: 0.0078, yawKick: 0.002, aimAssist: 0.018, hitRadius: 0.15, mobility: 1, tracerSpeed: 118, tracerLength: 1.45, tracerRadius: 0.034, tracerLifetime: 1, flashScale: 1.5, muzzleIntensity: 18, tracerColor: 0xff8a32, hitColor: 0xffdf8a, missDistance: 52 }
    },
    {
      id: "long-pistol-small",
      name: "Shotgun",
      modelLength: 0.82,
      remoteLength: 0.64,
      handLength: 0.62,
      viewPosition: [0.31, -0.45, -0.78],
      viewRotation: [-0.076, -0.32, 0.044],
      localOffset: [0.05, -0.07, -0.22],
      localRotation: [0.012, 0.62, -0.12],
      muzzleOffset: [0.02, 0.04, -0.56],
      fire: { style: "shotgun", auto: false, interval: 0.72, range: 26, damage: 3, spread: 0.07, projectiles: 10, recoil: 0.3, pitchKick: 0.011, yawKick: 0.0048, aimAssist: 0.006, hitRadius: 0.08, mobility: 0.96, tracerSpeed: 0, tracerLength: 26, tracerRadius: 0.01, tracerLifetime: 0.75, flashScale: 1.7, muzzleIntensity: 23, tracerColor: 0xfff0b8, hitColor: 0xfff8d2, missDistance: 24, pelletMinRange: 8, pelletRadiusVariance: 0.55 }
    },
    {
      id: "rifle",
      name: "Rifle",
      modelLength: 1.22,
      remoteLength: 0.92,
      handLength: 0.98,
      viewPosition: [0.25, -0.48, -0.88],
      viewRotation: [-0.085, -0.36, 0.035],
      localOffset: [0.05, -0.1, -0.44],
      localRotation: [0.008, 0.7, -0.095],
      muzzleOffset: [0.03, 0.045, -0.88],
      fire: { style: "rifle", auto: true, interval: 0.14, range: 82, damage: 1, spread: 0.0025, recoil: 0.105, pitchKick: 0.0042, yawKick: 0.0018, aimAssist: 0.014, hitRadius: 0.115, mobility: 1, tracerSpeed: 245, tracerLength: 3.4, tracerRadius: 0.006, tracerLifetime: 1, flashScale: 1.02, muzzleIntensity: 12, tracerColor: 0x64d6ff, hitColor: 0xffdf8a, missDistance: 48 }
    },
    {
      id: "sniper-rifle",
      name: "Sniper Rifle",
      modelLength: 1.38,
      remoteLength: 1.04,
      handLength: 1.12,
      viewPosition: [0.2, -0.5, -0.94],
      viewRotation: [-0.088, -0.38, 0.032],
      localOffset: [0.04, -0.1, -0.54],
      localRotation: [0.006, 0.66, -0.085],
      muzzleOffset: [0.03, 0.045, -1.04],
      fire: { style: "sniper", auto: false, interval: 0.58, range: 132, damage: 3, spread: 0.00025, recoil: 0.42, pitchKick: 0.016, yawKick: 0.003, aimAssist: 0.013, hitRadius: 0.13, mobility: 0.92, tracerSpeed: 0, tracerLength: 132, tracerRadius: 0.038, tracerLifetime: 1, flashScale: 1.9, muzzleIntensity: 24, tracerColor: 0xf7fbff, hitColor: 0xffffff, missDistance: 92 }
    },
    {
      id: "ray-gun",
      name: "Ray Gun",
      modelLength: 0.9,
      remoteLength: 0.78,
      handLength: 0.76,
      viewPosition: [0.29, -0.47, -0.8],
      viewRotation: [-0.08, -0.34, 0.04],
      localOffset: [0.05, -0.1, -0.3],
      localRotation: [0.012, 0.62, -0.12],
      muzzleOffset: [0.02, 0.045, -0.68],
      fire: { style: "ray", auto: true, interval: 0.145, range: 72, damage: 1, spread: 0.0004, recoil: 0.03, pitchKick: 0.0018, yawKick: 0.0007, aimAssist: 0.012, hitRadius: 0.105, mobility: 0.98, tracerSpeed: 0, tracerLength: 72, tracerRadius: 0.018, tracerLifetime: 1, flashScale: 1.08, muzzleIntensity: 16, tracerColor: 0x36ffe2, hitColor: 0x8afff1, missDistance: 58 }
    },
    {
      id: "lightning-gun",
      name: "Lightning Gun",
      modelLength: 0.95,
      remoteLength: 0.82,
      handLength: 0.84,
      viewPosition: [0.28, -0.47, -0.82],
      viewRotation: [-0.082, -0.35, 0.036],
      localOffset: [0.05, -0.08, -0.28],
      localRotation: [0.012, 0.64, -0.12],
      muzzleOffset: [0.02, 0.045, -0.7],
      fire: { style: "lightning", auto: true, interval: 0.17, range: 44, damage: 1, spread: 0.008, projectiles: 4, recoil: 0.16, pitchKick: 0.0048, yawKick: 0.0028, aimAssist: 0.02, hitRadius: 0.18, mobility: 0.93, tracerSpeed: 0, tracerLength: 44, tracerRadius: 0.011, tracerLifetime: 1, flashScale: 1.35, muzzleIntensity: 18, tracerColor: 0xb465ff, hitColor: 0xf1d6ff, missDistance: 34 }
    }
  ].map((weapon, index) => ({
    ...weapon,
    slot: index,
    type: "weapon",
    format: "obj",
    obj: `${weaponPackPath}/${weapon.id}/model.obj`,
    mtl: `${weaponPackPath}/${weapon.id}/model.mtl`
  })),
  notes: [
    "The active weapon pack uses runtime-ready OBJ/MTL files only.",
    "Source FBX and Blend files were removed to avoid consuming project space."
  ]
};
