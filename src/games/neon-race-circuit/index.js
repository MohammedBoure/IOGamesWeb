import { createNeonArenaRuntime } from "../shared/neonRuntime.js";

export const neonRaceCircuit = {
  id: "neon-race-circuit",
  title: "Neon Race Circuit",
  mode: "racing",
  roomMode: "racing",
  map: "neon_circuit",
  summary: "A 3D circuit race with checkpoints and drifting.",
  controls: "Z accelerate, S brake, Q/D steer, Space drift"
};

export function mountGame(options = {}) {
  return createNeonArenaRuntime({
    ...options,
    mode: "racing"
  });
}
