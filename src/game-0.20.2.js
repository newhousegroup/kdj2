import { patchGameSource as patch0202 } from "./patch-0.20.2.js?v=0.20.2";

const NativeBlob = globalThis.Blob;
let patchedFinalGame = false;

class KDJPatchedBlob0202 extends NativeBlob {
  constructor(parts = [], options = {}) {
    let nextParts = parts;
    if (
      !patchedFinalGame &&
      options?.type === "text/javascript" &&
      parts.length === 1 &&
      typeof parts[0] === "string" &&
      parts[0].includes("function finishBattle(winner, loser, reason") &&
      parts[0].includes("function updateObjective(p)") &&
      parts[0].includes("Protect ${TEAM[p.team].ship} · keep her afloat")
    ) {
      nextParts = [patch0202(parts[0])];
      patchedFinalGame = true;
      globalThis.__KDJ_0202_PATCHED__ = true;
    }
    super(nextParts, options);
  }
}

globalThis.Blob = KDJPatchedBlob0202;

try {
  await import("./game-0.20.1.js?v=0.20.1");
} catch (error) {
  document.querySelector("#loadingScreen")?.remove();
  console.error("KDJ2 0.20.2 boot failed", error);
  const status = document.querySelector("#lobbyStatus");
  if (status) {
    status.textContent = `Game failed to load: ${error?.message || error}`;
    status.classList.add("error");
  }
}
