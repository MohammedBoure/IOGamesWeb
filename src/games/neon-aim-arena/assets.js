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
      modelLength: 0.72,
      remoteLength: 0.6,
      handLength: 0.58,
      localOffset: [0.08, -0.02, -0.1],
      localRotation: [0.02, 0.34, -0.08],
      muzzleOffset: [0, 0.03, -0.48],
      fire: { style: "sidearm", auto: false, interval: 0.18, range: 68, damage: 1, spread: 0.0022, recoil: 0.1, pitchKick: 0.004, yawKick: 0.0015, tracerColor: 0xffd68a, hitColor: 0xfff0b8, missDistance: 42 }
    },
    {
      id: "long-pistol",
      name: "Long Pistol",
      modelLength: 0.92,
      remoteLength: 0.74,
      handLength: 0.72,
      localOffset: [0.08, -0.08, -0.18],
      localRotation: [0.02, 0.58, -0.08],
      muzzleOffset: [0, 0.04, -0.62],
      fire: { style: "hand-cannon", auto: false, interval: 0.32, range: 88, damage: 2, spread: 0.0012, recoil: 0.22, pitchKick: 0.008, yawKick: 0.0024, tracerColor: 0xffa14a, hitColor: 0xffdf8a, tracerRadius: 0.015, missDistance: 58 }
    },
    {
      id: "long-pistol-small",
      name: "Long Pistol Small",
      modelLength: 0.78,
      remoteLength: 0.64,
      handLength: 0.62,
      localOffset: [0.08, -0.07, -0.12],
      localRotation: [0.02, 0.48, -0.08],
      muzzleOffset: [0, 0.035, -0.52],
      fire: { style: "quick-burst", auto: false, interval: 0.24, range: 62, damage: 1, spread: 0.003, projectiles: 2, recoil: 0.13, pitchKick: 0.005, yawKick: 0.002, tracerColor: 0x9fe8ff, hitColor: 0xd8fbff, missDistance: 38 }
    },
    {
      id: "rifle",
      name: "Rifle",
      modelLength: 1.16,
      remoteLength: 0.92,
      handLength: 0.98,
      localOffset: [0.08, -0.1, -0.26],
      localRotation: [0.015, 0.56, -0.06],
      muzzleOffset: [0, 0.04, -0.82],
      fire: { style: "rifle", auto: true, interval: 0.095, range: 92, damage: 1, spread: 0.0028, recoil: 0.12, pitchKick: 0.0045, yawKick: 0.002, tracerColor: 0x64d6ff, hitColor: 0xffdf8a, missDistance: 52 }
    },
    {
      id: "sniper-rifle",
      name: "Sniper Rifle",
      modelLength: 1.34,
      remoteLength: 1.04,
      handLength: 1.12,
      localOffset: [0.06, -0.1, -0.34],
      localRotation: [0.012, 0.52, -0.05],
      muzzleOffset: [0, 0.04, -1.0],
      fire: { style: "sniper", auto: false, interval: 0.78, range: 140, damage: 3, spread: 0.00035, recoil: 0.34, pitchKick: 0.014, yawKick: 0.003, tracerColor: 0xf7fbff, hitColor: 0xffffff, tracerRadius: 0.018, missDistance: 95 }
    },
    {
      id: "ray-gun",
      name: "Ray Gun",
      modelLength: 0.82,
      remoteLength: 0.78,
      handLength: 0.76,
      localOffset: [0.12, -0.13, -0.18],
      localRotation: [0.02, 0.46, -0.08],
      muzzleOffset: [0, 0.04, -0.62],
      fire: { style: "ray", auto: true, interval: 0.07, range: 78, damage: 1, spread: 0.0008, recoil: 0.055, pitchKick: 0.0025, yawKick: 0.001, tracerColor: 0x36ffe2, hitColor: 0x8afff1, tracerRadius: 0.014, missDistance: 62 }
    },
    {
      id: "lightning-gun",
      name: "Lightning Gun",
      modelLength: 0.82,
      remoteLength: 0.82,
      handLength: 0.84,
      localOffset: [0.14, -0.18, -0.2],
      localRotation: [0.02, 0.46, -0.1],
      muzzleOffset: [0, 0.04, -0.68],
      fire: { style: "lightning", auto: true, interval: 0.13, range: 72, damage: 1, spread: 0.006, projectiles: 3, recoil: 0.16, pitchKick: 0.005, yawKick: 0.003, tracerColor: 0xb465ff, hitColor: 0xf1d6ff, tracerRadius: 0.011, missDistance: 50 }
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
