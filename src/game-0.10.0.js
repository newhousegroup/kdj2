import { patchGameSource } from "./patch-0.10.0.js?v=0.10.0";

const NativeBlob = globalThis.Blob;
let patchedFinalGame = false;

class KDJPatchedBlob extends NativeBlob {
  constructor(parts = [], options = {}) {
    let nextParts = parts;
    if (
      !patchedFinalGame &&
      options?.type === "text/javascript" &&
      parts.length === 1 &&
      typeof parts[0] === "string" &&
      parts[0].includes("function makeShip(team)") &&
      parts[0].includes("function renderState(now") &&
      parts[0].includes("function simulateShips(dt)")
    ) {
      nextParts = [patchGameSource(parts[0])];
      patchedFinalGame = true;
      globalThis.__KDJ_010_PATCHED__ = true;
    }
    super(nextParts, options);
  }
}

globalThis.Blob = KDJPatchedBlob;

try {
  await import("./game-0.9.3.js?v=0.9.3");
} catch (error) {
  console.error("KDJ2 0.10.0 boot failed", error);
  const status = document.querySelector("#lobbyStatus");
  if (status) {
    status.textContent = `Game failed to load: ${error?.message || error}`;
    status.classList.add("error");
  }
}
