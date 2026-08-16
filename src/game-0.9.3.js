const previousUrl = new URL("./game-0.9.2.js?v=0.9.2", import.meta.url);
const source091Url = new URL("./game-0.9.1.js?v=0.9.1", import.meta.url).href;
const source070Url = new URL("./game-0.7.0.js?v=0.7.0", import.meta.url).href;
const base050Url = new URL("./game-0.5.js?v=0.5.0", import.meta.url).href;

function showBootError(error) {
  console.error("KDJ2 0.9.3 boot failed", error);
  const status = document.querySelector("#lobbyStatus");
  if (status) {
    status.textContent = `Game failed to load: ${error?.message || error}`;
    status.classList.add("error");
  }
}

async function boot() {
  const response = await fetch(previousUrl, { cache: "no-store" });
  if (!response.ok) throw new Error(`Could not load KDj2 0.9.2 source (${response.status})`);
  let source = await response.text();

  const previous091Line = 'const previousUrl = new URL("./game-0.9.1.js?v=0.9.1", import.meta.url);';
  const source070Line = 'const source070Url = new URL("./game-0.7.0.js?v=0.7.0", import.meta.url).href;';
  const base050Line = 'const base050Url = new URL("./game-0.5.js?v=0.5.0", import.meta.url).href;';
  if (!source.includes(previous091Line)) throw new Error("0.9.3 repair failed: 0.9.1 URL marker missing");
  if (!source.includes(source070Line)) throw new Error("0.9.3 repair failed: 0.7.0 URL marker missing");
  if (!source.includes(base050Line)) throw new Error("0.9.3 repair failed: 0.5.0 URL marker missing");
  source = source.replace(previous091Line, `const previousUrl = new URL(${JSON.stringify(source091Url)});`);
  source = source.replace(source070Line, `const source070Url = ${JSON.stringify(source070Url)};`);
  source = source.replace(base050Line, `const base050Url = ${JSON.stringify(base050Url)};`);

  const speedControlOld = '    if (captain && speedControl > 0) ship.speed = Math.min(maxForward, ship.speed + 1.72 * sailPower * mobility * dt);\\n    else if (captain && speedControl < 0) ship.speed = Math.max(maxReverse, ship.speed - 1.95 * sailPower * mobility * dt);';
  const speedControlNew = '    if (!Number.isFinite(ship.speed)) ship.speed = 0;\\n    if (captain && speedControl > 0 && ship.speed < maxForward) {\\n      ship.speed = Math.min(maxForward, ship.speed + 1.72 * sailPower * mobility * dt);\\n    } else if (captain && speedControl < 0 && ship.speed > maxReverse) {\\n      ship.speed = Math.max(maxReverse, ship.speed - 1.95 * sailPower * mobility * dt);\\n    }';
  const speedHudOld = '  const speed = Number(state?.ships?.[p?.team]?.speed || 0);\\n  if (ui.speedText) ui.speedText.textContent = Math.abs(speed) < 0.05 ? "Speed 0.0" : (speed < 0 ? "Speed " + Math.abs(speed).toFixed(1) + " REV" : "Speed " + speed.toFixed(1));';
  const speedHudNew = '  const speed = Number(state?.ships?.[p?.team]?.speed || 0);\\n  const safeSpeed = Number.isFinite(speed) ? speed : 0;\\n  const displaySpeed = THREE.MathUtils.clamp((Math.abs(safeSpeed) / 6.03) * 35, 0, 35);\\n  if (ui.speedText) ui.speedText.textContent = displaySpeed < 0.1 ? "Speed 0.0" : (safeSpeed < 0 ? "Speed " + displaySpeed.toFixed(1) + " REV" : "Speed " + displaySpeed.toFixed(1));';

  const injection = [
    `  const speedControlOld = ${JSON.stringify(speedControlOld)};`,
    `  const speedControlNew = ${JSON.stringify(speedControlNew)};`,
    '  if (!source.includes(speedControlOld)) throw new Error("0.9.3 patch failed: speed control marker missing");',
    '  source = source.replace(speedControlOld, speedControlNew);',
    `  const speedHudOld = ${JSON.stringify(speedHudOld)};`,
    `  const speedHudNew = ${JSON.stringify(speedHudNew)};`,
    '  if (!source.includes(speedHudOld)) throw new Error("0.9.3 patch failed: speed HUD marker missing");',
    '  source = source.replace(speedHudOld, speedHudNew);'
  ].join("\n");

  const importMarker = '  const moduleUrl = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));';
  if (!source.includes(importMarker)) throw new Error("0.9.3 patch failed: 0.9.2 import marker missing");
  source = source.replace(importMarker, injection + "\n" + importMarker);
  source = source.replaceAll("KDJ2 0.9.2 boot failed", "KDJ2 0.9.3 boot failed");

  const moduleUrl = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
  try {
    await import(moduleUrl);
  } finally {
    URL.revokeObjectURL(moduleUrl);
  }
}

boot().catch(showBootError);
