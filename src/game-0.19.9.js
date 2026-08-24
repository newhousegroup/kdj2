import { patchGameSource as patch0199 } from "./patch-0.19.9.js?v=0.19.9";

// 0.19.9 deliberately layers only the stop-reconciliation repair on top of the
// stable 0.19.8 build. The 0.19.8 launcher still materializes the established
// gameplay patch chain; this outer Blob layer receives that completed source and
// applies the new multiplayer prediction fix last.
const NativeBlob = globalThis.Blob;
let patchedFinalGame = false;

class KDJPatchedBlob0199 extends NativeBlob {
  constructor(parts = [], options = {}) {
    let nextParts = parts;
    if (
      !patchedFinalGame &&
      options?.type === "text/javascript" &&
      parts.length === 1 &&
      typeof parts[0] === "string" &&
      parts[0].includes("const guestPrediction = {") &&
      parts[0].includes("function advanceGuestPrediction(now)") &&
      parts[0].includes("function simulateShips(dt)")
    ) {
      nextParts = [patch0199(parts[0])];
      patchedFinalGame = true;
      globalThis.__KDJ_0199_PATCHED__ = true;
    }
    super(nextParts, options);
  }
}

globalThis.Blob = KDJPatchedBlob0199;

try {
  await import("./game-0.19.8.js?v=0.19.8");
} catch (error) {
  document.querySelector("#loadingScreen")?.remove();
  console.error("KDJ2 0.19.9 boot failed", error);
  const status = document.querySelector("#lobbyStatus");
  if (status) {
    status.textContent = `Game failed to load: ${error?.message || error}`;
    status.classList.add("error");
  }
}
