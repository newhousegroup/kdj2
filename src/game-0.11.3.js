import { patchGameSource as patch010 } from "./patch-0.10.0.js?v=0.10.0";
import { patchGameSource011 as patch011 } from "./patch-0.11.0.js?v=0.11.0";
import { patchGameSource as patch0111 } from "./patch-0.11.1.js?v=0.11.1";
import { patchGameSource as patch0112 } from "./patch-0.11.2.js?v=0.11.2";
import { patchGameSource as patch0113 } from "./patch-0.11.3.js?v=0.11.3";

const NativeBlob = globalThis.Blob;
let patchedFinalGame = false;

class KDJPatchedBlob0113 extends NativeBlob {
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
      nextParts = [patch0113(patch0112(patch0111(patch011(patch010(parts[0])))))];
      patchedFinalGame = true;
      globalThis.__KDJ_010_PATCHED__ = true;
      globalThis.__KDJ_011_PATCHED__ = true;
      globalThis.__KDJ_0111_PATCHED__ = true;
      globalThis.__KDJ_0112_PATCHED__ = true;
      globalThis.__KDJ_0113_PATCHED__ = true;
    }
    super(nextParts, options);
  }
}

globalThis.Blob = KDJPatchedBlob0113;

try {
  await import("./game-0.9.3.js?v=0.9.3");
} catch (error) {
  console.error("KDJ2 0.11.3 boot failed", error);
  const status = document.querySelector("#lobbyStatus");
  if (status) {
    status.textContent = `Game failed to load: ${error?.message || error}`;
    status.classList.add("error");
  }
}
