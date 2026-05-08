import { createNeonArenaRuntime } from "../shared/neonRuntime.js";
import { neonAimArenaAssets } from "./assets.js";

export const neonAimArena = {
  id: "neon-aim-arena",
  title: "Neon Aim Arena",
  mode: "shooter",
  roomMode: "deathmatch",
  map: "aim_arena",
  summary: "Fast deathmatch movement and clean aim inside a 3D arena.",
  controls: "Z/S/Q/D move, Space jump, Mouse aim, Left Click shoot",
  assets: neonAimArenaAssets
};

export function mountGame(options = {}) {
  return createNeonArenaRuntime({
    ...options,
    assets: neonAimArenaAssets,
    mode: "shooter"
  });
}
