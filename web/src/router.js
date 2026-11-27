export const ROOM_NAMES = ["hall", "town", "routes", "night"];

export function currentRoom() {
  const raw = window.location.hash.replace(/^#\/?/, "");
  return ROOM_NAMES.includes(raw) ? raw : "hall";
}

export function roomHash(room) {
  return `#/${room}`;
}

export function writeRoomHash(room, { replace = false } = {}) {
  const next = roomHash(ROOM_NAMES.includes(room) ? room : "hall");
  if (window.location.hash === next) return;
  if (replace) {
    window.history.replaceState(null, "", next);
  } else {
    window.location.hash = next;
  }
}

export function onRoomHashChange(handler) {
  window.addEventListener("hashchange", () => handler(currentRoom()));
}

export function isQaBoot() {
  return window.location.hash === "#qa";
}
