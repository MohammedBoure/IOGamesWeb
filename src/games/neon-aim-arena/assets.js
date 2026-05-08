const basePath = "/assets/games/neon-aim-arena/models";

export const neonAimArenaAssets = {
  character: {
    id: "ninja",
    name: "Ninja",
    type: "remote-player",
    format: "glb",
    path: `${basePath}/characters/ninja.glb`,
    suitability: "Ready for browser loading; consider mesh compression later because it is about 12 MB."
  },
  weapons: [
    "AR_1",
    "AR_2",
    "AR_3",
    "AR_4",
    "AR_5",
    "AR_6",
    "Pistol_1",
    "Pistol_2",
    "Pistol_3",
    "SMG_1",
    "SMG_2",
    "Sniper_1",
    "Sniper_2",
    "Sniper_3",
    "Crossbow_1",
    "Crossbow_2",
    "Grenade",
    "Grenade_1",
    "Grenade_2",
    "Grenade_3"
  ].map((id) => ({
    id,
    name: id.replace(/_/g, " "),
    type: id.startsWith("Grenade") ? "throwable" : "weapon",
    format: "gltf",
    path: `${basePath}/weapons/low-poly-guns/${id}.gltf`
  })),
  notes: [
    "The weapon glTF files are self-contained and do not need external textures or .bin files.",
    "Original source formats are kept out of Git under asset-sources/ to avoid bloating the runtime bundle."
  ]
};
