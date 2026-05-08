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
      fire: { style: "sidearm", auto: false, interval: 0.2, range: 70, damage: 1, spread: 0.0014, recoil: 0.078, pitchKick: 0.0032, yawKick: 0.0011, aimAssist: 0.019, hitRadius: 0.15, tracerColor: 0xffd68a, hitColor: 0xfff0b8, missDistance: 42 }
    },
    {
      id: "long-pistol",
      name: "Long Pistol",
      modelLength: 0.92,
      remoteLength: 0.74,
      handLength: 0.72,
      viewPosition: [0.3, -0.46, -0.82],
      viewRotation: [-0.078, -0.34, 0.04],
      localOffset: [0.05, -0.08, -0.28],
      localRotation: [0.012, 0.72, -0.12],
      muzzleOffset: [0.02, 0.04, -0.66],
      fire: { style: "hand-cannon", auto: false, interval: 0.44, range: 86, damage: 2, spread: 0.00075, recoil: 0.26, pitchKick: 0.008, yawKick: 0.0022, aimAssist: 0.013, hitRadius: 0.115, tracerColor: 0xffa14a, hitColor: 0xffdf8a, tracerRadius: 0.015, missDistance: 56 }
    },
    {
      id: "long-pistol-small",
      name: "Long Pistol Small",
      modelLength: 0.82,
      remoteLength: 0.64,
      handLength: 0.62,
      viewPosition: [0.31, -0.45, -0.78],
      viewRotation: [-0.076, -0.32, 0.044],
      localOffset: [0.05, -0.07, -0.22],
      localRotation: [0.012, 0.62, -0.12],
      muzzleOffset: [0.02, 0.04, -0.56],
      fire: { style: "quick-burst", auto: false, interval: 0.3, range: 58, damage: 1, spread: 0.002, projectiles: 2, recoil: 0.13, pitchKick: 0.0044, yawKick: 0.0017, aimAssist: 0.019, hitRadius: 0.15, tracerColor: 0x9fe8ff, hitColor: 0xd8fbff, missDistance: 38 }
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
      fire: { style: "rifle", auto: true, interval: 0.102, range: 90, damage: 1, spread: 0.002, recoil: 0.092, pitchKick: 0.0038, yawKick: 0.0016, aimAssist: 0.016, hitRadius: 0.13, tracerColor: 0x64d6ff, hitColor: 0xffdf8a, missDistance: 50 }
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
      fire: { style: "sniper", auto: false, interval: 0.94, range: 140, damage: 3, spread: 0.00018, recoil: 0.36, pitchKick: 0.0135, yawKick: 0.0028, aimAssist: 0.005, hitRadius: 0.065, tracerColor: 0xf7fbff, hitColor: 0xffffff, tracerRadius: 0.018, missDistance: 96 }
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
      fire: { style: "ray", auto: true, interval: 0.092, range: 76, damage: 1, spread: 0.0005, recoil: 0.04, pitchKick: 0.0022, yawKick: 0.0009, aimAssist: 0.014, hitRadius: 0.13, tracerColor: 0x36ffe2, hitColor: 0x8afff1, tracerRadius: 0.014, missDistance: 60 }
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
      fire: { style: "lightning", auto: true, interval: 0.19, range: 62, damage: 1, spread: 0.0045, projectiles: 3, recoil: 0.14, pitchKick: 0.0046, yawKick: 0.0024, aimAssist: 0.016, hitRadius: 0.12, tracerColor: 0xb465ff, hitColor: 0xf1d6ff, tracerRadius: 0.011, missDistance: 46 }
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
