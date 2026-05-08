const PLAYER_NAME_KEY = "neon_player_name";

export function getStoredPlayerName(fallback = "Player") {
  return localStorage.getItem(PLAYER_NAME_KEY) || fallback;
}

export function savePlayerName(value, fallback = "Player") {
  const cleanValue = sanitizePlayerName(value, fallback);
  localStorage.setItem(PLAYER_NAME_KEY, cleanValue);
  return cleanValue;
}

export function sanitizePlayerName(value, fallback = "Player") {
  const cleanValue = String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 32);
  return cleanValue || fallback;
}
