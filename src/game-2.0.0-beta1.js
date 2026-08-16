import { patchGameSource as patch0147 } from "./patch-0.14.3.js?v=0.14.3";
import { patchGameSource as patchBeta1 } from "./patch-2.0.0-beta1.js?v=2.0.0-beta1";

// 2.0.0-beta1 keeps the exact stable 0.12.1 gameplay/render/input/camera chain,
// retains the tested 0.14.7 authoritative team-badge sync, and changes only
// cannon mobility damage from 4-9% to 12-20%.
const NativeBlob = globalThis.Blob;
let patchedFinalGame = false;

class KDJPatchedBlob200Beta1 extends NativeBlob {
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
      nextParts = [patchBeta1(patch0147(parts[0]))];
      patchedFinalGame = true;
      globalThis.__KDJ_0147_PATCHED__ = true;
      globalThis.__KDJ_200_BETA1_PATCHED__ = true;
    }
    super(nextParts, options);
  }
}

globalThis.Blob = KDJPatchedBlob200Beta1;

try {
  await import("./game-0.12.1.js?v=0.12.1");
} catch (error) {
  console.error("KDJ2 2.0.0-beta1 boot failed", error);
  const status = document.querySelector("#lobbyStatus");
  if (status) {
    status.textContent = `Game failed to load: ${error?.message || error}`;
    status.classList.add("error");
  }
}
