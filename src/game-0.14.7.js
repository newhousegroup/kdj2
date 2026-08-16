import { patchGameSource as patch0147 } from "./patch-0.14.3.js?v=0.14.3";

// 0.14.7 keeps the exact 0.12.1 gameplay/render/input/camera chain and adds
// only the already-tested authoritative British/French HUD badge synchronization.
const NativeBlob = globalThis.Blob;
let patchedFinalGame = false;

class KDJPatchedBlob0147 extends NativeBlob {
  constructor(parts = [], options = {}) {
    let nextParts = parts;
    if (
      !patchedFinalGame &&
      options?.type === "text/javascript" &&
      parts.length === 1 &&
      typeof parts[0] === "string" &&
      parts[0].includes("function makeShip(team)") &&
      parts[0].includes("function makePlayer(p)") &&
      parts[0].includes("function simulateShips(dt)")
    ) {
      nextParts = [patch0147(parts[0])];
      patchedFinalGame = true;
      globalThis.__KDJ_0147_PATCHED__ = true;
    }
    super(nextParts, options);
  }
}

globalThis.Blob = KDJPatchedBlob0147;

try {
  await import("./game-0.12.1.js?v=0.12.1");
} catch (error) {
  console.error("KDJ2 0.14.7 boot failed", error);
  const status = document.querySelector("#lobbyStatus");
  if (status) {
    status.textContent = `Game failed to load: ${error?.message || error}`;
    status.classList.add("error");
  }
}
