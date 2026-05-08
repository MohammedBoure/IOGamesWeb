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
    { id: "pistol", name: "Pistol", modelLength: 0.92, remoteLength: 0.74, handLength: 0.72 },
    { id: "long-pistol", name: "Long Pistol", modelLength: 1.08, remoteLength: 0.88, handLength: 0.84 },
    { id: "long-pistol-small", name: "Long Pistol Small", modelLength: 0.98, remoteLength: 0.78, handLength: 0.76 },
    { id: "rifle", name: "Rifle", modelLength: 1.46, remoteLength: 0.98, handLength: 1.08 },
    { id: "sniper-rifle", name: "Sniper Rifle", modelLength: 1.68, remoteLength: 1.14, handLength: 1.2 },
    { id: "ray-gun", name: "Ray Gun", modelLength: 1.22, remoteLength: 0.94, handLength: 0.92 },
    { id: "lightning-gun", name: "Lightning Gun", modelLength: 1.34, remoteLength: 1.0, handLength: 1.02 }
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
