export const games = [
  {
    id: "neon-aim-arena",
    title: "Neon Aim Arena",
    mode: "shooter",
    roomMode: "deathmatch",
    map: "aim_arena",
    summary: "Fast deathmatch movement and clean aim inside a 3D arena.",
    controls: "Z/S/Q/D move, Space jump, Mouse aim, Left Click shoot",
    label: "Shooter",
    pace: "Fast rounds",
    capacity: "12 players",
    image: "/assets/games/neon-aim-arena.png",
    accent: "blue",
    load: () => import("./neon-aim-arena/index.js")
  },
  {
    id: "neon-race-circuit",
    title: "Neon Race Circuit",
    mode: "racing",
    roomMode: "racing",
    map: "neon_circuit",
    summary: "A 3D circuit race with checkpoints and drifting.",
    controls: "Z accelerate, S brake, Q/D steer, Space drift",
    label: "Racing",
    pace: "Circuit laps",
    capacity: "12 players",
    image: "/assets/games/neon-race-circuit.png",
    accent: "green",
    load: () => import("./neon-race-circuit/index.js")
  }
];

export function findGame(gameId) {
  return games.find((game) => game.id === gameId) ?? games[0];
}
