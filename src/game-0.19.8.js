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
import { patchGameSource as patch0176 } from "./patch-0.17.6.js?v=0.17.6";
import { patchGameSource as patch0180 } from "./patch-0.18.0.js?v=0.18.0";
import { patchGameSource as patch0181 } from "./patch-0.18.1.js?v=0.18.1";
import { patchGameSource as patch0183 } from "./patch-0.18.3.js?v=0.18.3";
import { patchGameSource as patch0190 } from "./patch-0.19.0.js?v=0.19.0";
import { patchGameSource as patch0191 } from "./patch-0.19.1.js?v=0.19.1";
import { patchGameSource as patch0192 } from "./patch-0.19.2.js?v=0.19.2";
import { patchGameSource as patch0194 } from "./patch-0.19.4.js?v=0.19.4";
import { patchGameSource as patch0195 } from "./patch-0.19.5.js?v=0.19.5";
import { patchGameSource as patch0198 } from "./patch-0.19.8.js?v=0.19.8";

// 0.19.8 is based directly on the stable 0.19.5 path. The broken 0.19.6
// room-name patch is intentionally excluded. Only the one-broadside cannon
// traverse direction is corrected here.
const SWORD_CONE_30 = "    if (facing < 0.8660254 || distance >= targetDistance) continue;";
const SWORD_CONE_45 = "    if (facing < 0.7071067811865476 || distance >= targetDistance) continue;";
const SPEED_SNAP_ALWAYS = "    if (Math.abs(ship.speed) < 0.025) ship.speed = 0;";
const SPEED_SNAP_IDLE_ONLY = "    if (!speedControl && Math.abs(ship.speed) < 0.025) ship.speed = 0;";

const NativeBlob = globalThis.Blob;
let patchedFinalGame = false;

class KDJPatchedBlob0198 extends NativeBlob {
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
      if (!parts[0].includes(SWORD_CONE_30)) {
        throw new Error("0.19.8 boot failed: current 30-degree sword cone marker missing");
      }

      const combatSource = parts[0].replace(SWORD_CONE_30, SWORD_CONE_45);
      let finalSource = patch0183(patch0181(patch0180(patch0176(patch0175(patch0174(patch0173(patch0171(patch0170(patchBeta4(patchBeta3(patchBeta2(patchBeta1(patch0147(combatSource))))))))))))));

      const speedSnapMatches = finalSource.split(SPEED_SNAP_ALWAYS).length - 1;
      if (speedSnapMatches !== 1) {
        throw new Error(`0.19.8 boot failed: expected one ship speed snap marker, found ${speedSnapMatches}`);
      }
      finalSource = finalSource.replace(SPEED_SNAP_ALWAYS, SPEED_SNAP_IDLE_ONLY);
      finalSource = patch0190(finalSource);
      finalSource = patch0191(finalSource);
      finalSource = patch0192(finalSource);
      finalSource = patch0194(finalSource);
      finalSource = patch0195(finalSource);
      finalSource = patch0198(finalSource);

      nextParts = [finalSource];
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
      globalThis.__KDJ_0176_PATCHED__ = true;
      globalThis.__KDJ_0180_PATCHED__ = true;
      globalThis.__KDJ_0181_PATCHED__ = true;
      globalThis.__KDJ_0183_PATCHED__ = true;
      globalThis.__KDJ_01810_PATCHED__ = true;
      globalThis.__KDJ_01811_PATCHED__ = true;
      globalThis.__KDJ_0190_PATCHED__ = true;
      globalThis.__KDJ_0191_PATCHED__ = true;
      globalThis.__KDJ_0192_PATCHED__ = true;
      globalThis.__KDJ_0194_PATCHED__ = true;
      globalThis.__KDJ_0195_PATCHED__ = true;
      globalThis.__KDJ_0198_PATCHED__ = true;
    }
    super(nextParts, options);
  }
}

globalThis.Blob = KDJPatchedBlob0198;

try {
  await import("./game-0.12.1.js?v=0.12.1");
} catch (error) {
  document.querySelector("#loadingScreen")?.remove();
  console.error("KDJ2 0.19.8 boot failed", error);
  const status = document.querySelector("#lobbyStatus");
  if (status) {
    status.textContent = `Game failed to load: ${error?.message || error}`;
    status.classList.add("error");
  }
}
