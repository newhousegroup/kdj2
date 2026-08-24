import { patchGameSource as patch0209 } from "./patch-0.20.9.js?v=0.20.9";

const NativeBlob = globalThis.Blob;
let patchedFinalGame = false;

class KDJPatchedBlob0209 extends NativeBlob {
  constructor(parts = [], options = {}) {
    let nextParts = parts;
    if (
      !patchedFinalGame &&
      options?.type === "text/javascript" &&
      parts.length === 1 &&
      typeof parts[0] === "string" &&
      parts[0].includes("function returnToMenu(message") &&
      parts[0].includes("function processPlayer(p, input, dt)") &&
      parts[0].includes("function updateObjective(p)")
    ) {
      nextParts = [patch0209(parts[0])];
      patchedFinalGame = true;
      globalThis.__KDJ_0209_PATCHED__ = true;
    }
    super(nextParts, options);
  }
}

globalThis.Blob = KDJPatchedBlob0209;

try {
  await import("./game-0.20.6.js?v=0.20.6-hotfix1");
} catch (error) {
  document.querySelector("#loadingScreen")?.remove();
  console.error("KdJ2 boot failed", error);
  const status = document.querySelector("#lobbyStatus");
  if (status) {
    status.textContent = "KdJ2 boot failed";
    status.classList.add("error");
  }
}
