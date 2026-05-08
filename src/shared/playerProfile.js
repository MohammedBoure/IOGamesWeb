const PLAYER_NAME_KEY = "neon_player_name";
const LAST_MATCH_ID_KEY = "iogamesweb_last_match_id";

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

export function getStoredMatchId() {
  return sanitizeMatchId(localStorage.getItem(LAST_MATCH_ID_KEY));
}

export function saveMatchId(value) {
  const cleanValue = sanitizeMatchId(value);
  if (cleanValue) {
    localStorage.setItem(LAST_MATCH_ID_KEY, cleanValue);
  }
  return cleanValue;
}

export function sanitizeMatchId(value) {
  return String(value || "").replace(/\D/g, "").slice(0, 6);
}
