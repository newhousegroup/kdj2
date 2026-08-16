import { patchGameSource as patch0147 } from "./patch-0.14.3.js?v=0.14.3";
import { patchGameSource as patchBeta1 } from "./patch-2.0.0-beta1.js?v=2.0.0-beta1";
import { patchGameSource as patchBeta2 } from "./patch-2.0.0-beta2.js?v=2.0.0-beta2";
import { patchGameSource as patchBeta3 } from "./patch-2.0.0-beta3.js?v=2.0.0-beta3";
import { patchGameSource as patchBeta4 } from "./patch-2.0.0-beta4.js?v=2.0.0-beta4";

// 2.0.0-beta4 keeps the stable 0.12.1 gameplay/render/input/camera chain,
// retains beta1-3 changes, and adds +1 second to an active flag capture
// whenever that capturer takes a successful sword hit.
const NativeBlob = globalThis.Blob;
let patchedFinalGame = false;

class KDJPatchedBlob200Beta4 extends NativeBlob {
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
      nextParts = [patchBeta4(patchBeta3(patchBeta2(patchBeta1(patch0147(parts[0])))))];
      patchedFinalGame = true;
      globalThis.__KDJ_0147_PATCHED__ = true;
      globalThis.__KDJ_200_BETA1_PATCHED__ = true;
      globalThis.__KDJ_200_BETA2_PATCHED__ = true;
      globalThis.__KDJ_200_BETA3_PATCHED__ = true;
      globalThis.__KDJ_200_BETA4_PATCHED__ = true;
    }
    super(nextParts, options);
  }
}

globalThis.Blob = KDJPatchedBlob200Beta4;

try {
  await import("./game-0.12.1.js?v=0.12.1");
} catch (error) {
  console.error("KDJ2 2.0.0-beta4 boot failed", error);
  const status = document.querySelector("#lobbyStatus");
  if (status) {
    status.textContent = `Game failed to load: ${error?.message || error}`;
    status.classList.add("error");
  }
}
