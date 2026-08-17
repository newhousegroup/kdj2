import { patchGameSource as patch0147 } from "./patch-0.14.3.js?v=0.14.3";
import { patchGameSource as patchBeta1 } from "./patch-2.0.0-beta1.js?v=2.0.0-beta1";
import { patchGameSource as patchBeta2 } from "./patch-2.0.0-beta2.js?v=2.0.0-beta2";
import { patchGameSource as patchBeta3 } from "./patch-2.0.0-beta3.js?v=2.0.0-beta3";
import { patchGameSource as patchBeta4 } from "./patch-2.0.0-beta4.js?v=2.0.0-beta4";
import { patchGameSource as patch0170 } from "./patch-0.17.0.js?v=0.17.0";
import { patchGameSource as patch0171 } from "./patch-0.17.1.js?v=0.17.1";
import { patchGameSource as patch0173 } from "./patch-0.17.3.js?v=0.17.3";
import { patchGameSource as patch0174 } from "./patch-0.17.4.js?v=0.17.4";
import { patchGameSource as patch0175 } from "./patch-0.17.5.js?v=0.17.5";

// 0.17.5 keeps the complete 0.17.4 gameplay path and improves non-host
// responsiveness with visual client prediction, host reconciliation, and
// deduplicated guest input traffic.
const NativeBlob = globalThis.Blob;
let patchedFinalGame = false;

class KDJPatchedBlob0175 extends NativeBlob {
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
      nextParts = [patch0175(patch0174(patch0173(patch0171(patch0170(patchBeta4(patchBeta3(patchBeta2(patchBeta1(patch0147(parts[0]))))))))))];
      patchedFinalGame = true;
      globalThis.__KDJ_0147_PATCHED__ = true;
      globalThis.__KDJ_200_BETA1_PATCHED__ = true;
      globalThis.__KDJ_200_BETA2_PATCHED__ = true;
      globalThis.__KDJ_200_BETA3_PATCHED__ = true;
      globalThis.__KDJ_200_BETA4_PATCHED__ = true;
      globalThis.__KDJ_0170_PATCHED__ = true;
      globalThis.__KDJ_0171_PATCHED__ = true;
      globalThis.__KDJ_0173_PATCHED__ = true;
      globalThis.__KDJ_0174_PATCHED__ = true;
      globalThis.__KDJ_0175_PATCHED__ = true;
    }
    super(nextParts, options);
  }
}

globalThis.Blob = KDJPatchedBlob0175;

try {
  await import("./game-0.12.1.js?v=0.12.1");
} catch (error) {
  console.error("KDJ2 0.17.5 boot failed", error);
  const status = document.querySelector("#lobbyStatus");
  if (status) {
    status.textContent = `Game failed to load: ${error?.message || error}`;
    status.classList.add("error");
  }
}
