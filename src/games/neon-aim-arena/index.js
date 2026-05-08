import { createNeonArenaRuntime } from "../shared/neonRuntime.js";
import { neonAimArenaAssets } from "./assets.js";

export const neonAimArena = {
  id: "neon-aim-arena",
  title: "Neon Aim Arena",
  mode: "shooter",
  roomMode: "deathmatch",
  map: "aim_arena",
  summary: "Fast deathmatch movement, precision hops, power slides, and clean aim inside a 3D arena.",
  controls: "Z/S/Q/D move, Space jump, 1-7 switch weapons, Ctrl + Wheel Up precision hop",
  assets: neonAimArenaAssets
};

export function mountGame(options = {}) {
  return createNeonArenaRuntime({
    ...options,
    assets: neonAimArenaAssets,
    mode: "shooter"
  });
}
