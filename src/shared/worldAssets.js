const worldBasePath = "/assets/world/models";

export const worldAssetPacks = {
  farm: {
    id: "farm",
    name: "Low Poly Farm Landmarks",
    license: "CC0 1.0",
    basePath: `${worldBasePath}/farm`,
    assets: [
      { id: "barn", name: "Barn", role: "large-cover", games: ["shooter", "racing"] },
      { id: "open-barn", name: "Open Barn", role: "landmark", games: ["shooter", "racing"] },
      { id: "silo", name: "Silo", role: "vertical-landmark", games: ["shooter", "racing"] },
      { id: "water-tower", name: "Water Tower", role: "vertical-landmark", games: ["shooter", "racing"] },
      { id: "windmill", name: "Windmill", role: "landmark", games: ["racing"] },
      { id: "fence", name: "Fence", role: "track-edge", games: ["shooter", "racing"] },
      { id: "fence-2", name: "Fence 2", role: "track-edge", games: ["shooter", "racing"] },
      { id: "well", name: "Well", role: "small-cover", games: ["shooter"] }
    ].map((asset) => ({
      ...asset,
      obj: `${worldBasePath}/farm/${asset.name.replace(/ /g, "")}.obj`,
      mtl: `${worldBasePath}/farm/${asset.name.replace(/ /g, "")}.mtl`
    }))
  },
  nature: {
    id: "nature",
    name: "Low Poly Nature Props",
    license: "CC0 1.0",
    basePath: `${worldBasePath}/nature`,
    assets: [
      { id: "common-tree-1", file: "CommonTree_1", name: "Common Tree", role: "foliage", games: ["shooter", "racing"] },
      { id: "pine-tree-1", file: "PineTree_1", name: "Pine Tree", role: "foliage", games: ["shooter", "racing"] },
      { id: "palm-tree-1", file: "PalmTree_1", name: "Palm Tree", role: "foliage", games: ["racing"] },
      { id: "cactus-1", file: "Cactus_1", name: "Cactus", role: "desert-prop", games: ["shooter", "racing"] },
      { id: "rock-1", file: "Rock_1", name: "Rock", role: "small-cover", games: ["shooter", "racing"] },
      { id: "rock-moss-1", file: "Rock_Moss_1", name: "Moss Rock", role: "small-cover", games: ["shooter", "racing"] },
      { id: "bush-1", file: "Bush_1", name: "Bush", role: "foliage", games: ["shooter", "racing"] },
      { id: "grass", file: "Grass", name: "Grass", role: "ground-detail", games: ["shooter", "racing"] },
      { id: "wood-log", file: "WoodLog", name: "Wood Log", role: "small-cover", games: ["shooter"] },
      { id: "tree-stump", file: "TreeStump", name: "Tree Stump", role: "small-cover", games: ["shooter"] },
      { id: "plant-1", file: "Plant_1", name: "Plant", role: "ground-detail", games: ["shooter", "racing"] }
    ].map((asset) => ({
      ...asset,
      obj: `${worldBasePath}/nature/${asset.file}.obj`,
      mtl: `${worldBasePath}/nature/${asset.file}.mtl`
    }))
  }
};

export const worldAssets = Object.values(worldAssetPacks).flatMap((pack) =>
  pack.assets.map((asset) => ({
    ...asset,
    packId: pack.id,
    license: pack.license
  }))
);
