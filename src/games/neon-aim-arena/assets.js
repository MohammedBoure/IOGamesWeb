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
      modelLength: 0.66,
      remoteLength: 0.6,
      handLength: 0.58,
      viewPosition: [0.09, -0.52, -0.9],
      viewRotation: [-0.045, -0.2, 0.025],
      localOffset: [0.02, -0.09, -0.12],
      localRotation: [0.015, 0.44, -0.08],
      muzzleOffset: [0, 0.03, -0.44],
      fire: { style: "sidearm", auto: false, interval: 0.2, range: 70, damage: 1, spread: 0.0016, recoil: 0.08, pitchKick: 0.0035, yawKick: 0.0012, aimAssist: 0.022, hitRadius: 0.17, tracerColor: 0xffd68a, hitColor: 0xfff0b8, missDistance: 42 }
    },
    {
      id: "long-pistol",
      name: "Long Pistol",
      modelLength: 0.78,
      remoteLength: 0.74,
      handLength: 0.72,
      viewPosition: [0.06, -0.55, -0.94],
      viewRotation: [-0.05, -0.2, 0.022],
      localOffset: [0.01, -0.15, -0.2],
      localRotation: [0.018, 0.66, -0.08],
      muzzleOffset: [0, 0.035, -0.55],
      fire: { style: "hand-cannon", auto: false, interval: 0.42, range: 86, damage: 2, spread: 0.0009, recoil: 0.24, pitchKick: 0.0075, yawKick: 0.0022, aimAssist: 0.016, hitRadius: 0.13, tracerColor: 0xffa14a, hitColor: 0xffdf8a, tracerRadius: 0.015, missDistance: 56 }
    },
    {
      id: "long-pistol-small",
      name: "Long Pistol Small",
      modelLength: 0.7,
      remoteLength: 0.64,
      handLength: 0.62,
      viewPosition: [0.07, -0.55, -0.92],
      viewRotation: [-0.048, -0.2, 0.024],
      localOffset: [0.02, -0.13, -0.16],
      localRotation: [0.018, 0.54, -0.08],
      muzzleOffset: [0, 0.034, -0.48],
      fire: { style: "quick-burst", auto: false, interval: 0.28, range: 58, damage: 1, spread: 0.0023, projectiles: 2, recoil: 0.12, pitchKick: 0.0045, yawKick: 0.0018, aimAssist: 0.023, hitRadius: 0.17, tracerColor: 0x9fe8ff, hitColor: 0xd8fbff, missDistance: 38 }
    },
    {
      id: "rifle",
      name: "Rifle",
      modelLength: 1.02,
      remoteLength: 0.92,
      handLength: 0.98,
      viewPosition: [0.02, -0.58, -1.0],
      viewRotation: [-0.052, -0.22, 0.02],
      localOffset: [0, -0.17, -0.32],
      localRotation: [0.012, 0.62, -0.055],
      muzzleOffset: [0, 0.04, -0.68],
      fire: { style: "rifle", auto: true, interval: 0.105, range: 90, damage: 1, spread: 0.0022, recoil: 0.095, pitchKick: 0.004, yawKick: 0.0018, aimAssist: 0.019, hitRadius: 0.15, tracerColor: 0x64d6ff, hitColor: 0xffdf8a, missDistance: 50 }
    },
    {
      id: "sniper-rifle",
      name: "Sniper Rifle",
      modelLength: 1.18,
      remoteLength: 1.04,
      handLength: 1.12,
      viewPosition: [-0.02, -0.6, -1.06],
      viewRotation: [-0.055, -0.24, 0.018],
      localOffset: [0, -0.18, -0.42],
      localRotation: [0.01, 0.58, -0.045],
      muzzleOffset: [0, 0.04, -0.86],
      fire: { style: "sniper", auto: false, interval: 0.9, range: 140, damage: 3, spread: 0.0002, recoil: 0.34, pitchKick: 0.013, yawKick: 0.0028, aimAssist: 0.007, hitRadius: 0.08, tracerColor: 0xf7fbff, hitColor: 0xffffff, tracerRadius: 0.018, missDistance: 96 }
    },
    {
      id: "ray-gun",
      name: "Ray Gun",
      modelLength: 0.75,
      remoteLength: 0.78,
      handLength: 0.76,
      viewPosition: [0.05, -0.56, -0.94],
      viewRotation: [-0.05, -0.21, 0.022],
      localOffset: [0.02, -0.18, -0.22],
      localRotation: [0.018, 0.52, -0.08],
      muzzleOffset: [0, 0.04, -0.52],
      fire: { style: "ray", auto: true, interval: 0.09, range: 76, damage: 1, spread: 0.00055, recoil: 0.035, pitchKick: 0.0022, yawKick: 0.0009, aimAssist: 0.018, hitRadius: 0.15, tracerColor: 0x36ffe2, hitColor: 0x8afff1, tracerRadius: 0.014, missDistance: 60 }
    },
    {
      id: "lightning-gun",
      name: "Lightning Gun",
      modelLength: 0.78,
      remoteLength: 0.82,
      handLength: 0.84,
      viewPosition: [0.02, -0.55, -0.94],
      viewRotation: [-0.052, -0.22, 0.018],
      localOffset: [0.01, -0.16, -0.23],
      localRotation: [0.018, 0.54, -0.09],
      muzzleOffset: [0, 0.04, -0.54],
      fire: { style: "lightning", auto: true, interval: 0.18, range: 64, damage: 1, spread: 0.0048, projectiles: 3, recoil: 0.13, pitchKick: 0.0045, yawKick: 0.0025, aimAssist: 0.02, hitRadius: 0.14, tracerColor: 0xb465ff, hitColor: 0xf1d6ff, tracerRadius: 0.011, missDistance: 46 }
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
