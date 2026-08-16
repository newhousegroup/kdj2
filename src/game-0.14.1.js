import { patchGameSource as patch010 } from "./patch-0.10.0.js?v=0.10.0";
import { patchGameSource011 as patch011 } from "./patch-0.11.0.js?v=0.11.0";
import { patchGameSource as patch0111 } from "./patch-0.11.1.js?v=0.11.1";
import { patchGameSource as patch0112 } from "./patch-0.11.2.js?v=0.11.2";
import { patchGameSource as patch0113 } from "./patch-0.11.3.js?v=0.11.3";
import { patchGameSource as patch0120 } from "./patch-0.12.0.js?v=0.12.0";
import { patchGameSource as patch0121 } from "./patch-0.12.1.js?v=0.12.1";
import { patchGameSource as patch0141 } from "./patch-0.14.1.js?v=0.14.1";

const originalNetworkStatus = window.KDJNetwork?.prototype?.status;
if (originalNetworkStatus) {
  window.KDJNetwork.prototype.status = function status0141(text, kind = "ready") {
    return originalNetworkStatus.call(this, text === "Preparing relay…" ? "Connecting..." : text, kind);
  };
}

const NativeBlob = globalThis.Blob;
let patchedFinalGame = false;
class KDJPatchedBlob0141 extends NativeBlob {
  constructor(parts = [], options = {}) {
    let nextParts = parts;
    if (!patchedFinalGame && options?.type === "text/javascript" && parts.length === 1 && typeof parts[0] === "string" && parts[0].includes("function makeShip(team)") && parts[0].includes("function makePlayer(p)") && parts[0].includes("function simulateShips(dt)")) {
      nextParts = [patch0141(patch0121(patch0120(patch0113(patch0112(patch0111(patch011(patch010(parts[0]))))))))];
      patchedFinalGame = true;
      globalThis.__KDJ_0141_PATCHED__ = true;
    }
    super(nextParts, options);
  }
}
globalThis.Blob = KDJPatchedBlob0141;
try {
  await import("./game-0.9.3.js?v=0.9.3");
} catch (error) {
  console.error("KDJ2 0.14.1 boot failed", error);
  const status = document.querySelector("#lobbyStatus");
  if (status) {
    status.textContent = `Game failed to load: ${error?.message || error}`;
    status.classList.add("error");
  }
}
