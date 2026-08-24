import { patchGameSource as patch0206 } from "./patch-0.20.6.js?v=0.20.6-hotfix1";

const NativeBlob = globalThis.Blob;
let patchedFinalGame = false;

class KDJPatchedBlob0206 extends NativeBlob {
  constructor(parts = [], options = {}) {
    let nextParts = parts;
    if (
      !patchedFinalGame &&
      options?.type === "text/javascript" &&
      parts.length === 1 &&
      typeof parts[0] === "string" &&
      parts[0].includes("function processPlayer(p, input, dt)") &&
      parts[0].includes("function advanceGuestPrediction(now)") &&
      parts[0].includes("British ${Number(state.score?.british || 0)} - ${Number(state.score?.french || 0)} French")
    ) {
      nextParts = [patch0206(parts[0])];
      patchedFinalGame = true;
      globalThis.__KDJ_0206_PATCHED__ = true;
    }
    super(nextParts, options);
  }
}

globalThis.Blob = KDJPatchedBlob0206;

try {
  await import("./game-0.20.5.js?v=0.20.5");
} catch (error) {
  document.querySelector("#loadingScreen")?.remove();
  console.error("KDJ2 0.20.6 boot failed", error);
  const status = document.querySelector("#lobbyStatus");
  if (status) {
    status.textContent = `Game failed to load: ${error?.message || error}`;
    status.classList.add("error");
  }
}
