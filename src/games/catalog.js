export const games = [
  {
    id: "neon-aim-arena",
    title: "Neon Aim Arena",
    mode: "shooter",
    roomMode: "deathmatch",
    map: "aim_arena",
    summary: "Fast deathmatch movement, precision hops, power slides, and clean aim inside a 3D arena.",
    controls: "Z/S/Q/D move, Space jump, 1-7 switch weapons, Ctrl + Wheel Up precision hop",
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
    summary: "A long 3D hillside circuit with irregular turns, elevation changes, checkpoints, and drifting.",
    controls: "Z accelerate, S brake, Q/D steer, Space drift",
    label: "Racing",
    pace: "Circuit laps",
    capacity: "12 players",
    image: "/assets/games/neon-race-circuit.png",
    accent: "green",
    load: () => import("./neon-race-circuit/index.js")
  },
  {
    id: "chess-arena",
    title: "Chess Arena",
    mode: "chess",
    roomMode: "chess",
    map: "classic_board",
    summary: "A focused two-player chess board with legal moves, room play, roles, move history, and clean turn feedback.",
    controls: "Click a piece, choose a highlighted square, promote to queen automatically.",
    label: "Strategy",
    pace: "Turn based",
    capacity: "2 players",
    maxPlayers: 2,
    image: "/assets/games/chess-arena.svg",
    accent: "amber",
    usesArcadeHud: false,
    load: () => import("./chess-arena/index.js")
  }
];

export function findGame(gameId) {
  return games.find((game) => game.id === gameId) ?? games[0];
}
