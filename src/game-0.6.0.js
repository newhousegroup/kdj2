const patchUrl = new URL("./game-0.5.2.js?v=0.5.2", import.meta.url);
const baseGameUrl = new URL("./game-0.5.js?v=0.5.0", import.meta.url).href;

const response = await fetch(patchUrl, { cache: "no-store" });
if (!response.ok) throw new Error(`Could not load KDj2 0.5.2 patch (${response.status}).`);

let source = await response.text();

function patchOnce(pattern, replacement, label) {
  const next = source.replace(pattern, replacement);
  if (next === source) throw new Error(`KDJ 0.6.0 patch failed: ${label}`);
  source = next;
}

// Preserve the 0.5.0 base URL when the 0.5.2 patch is executed from a Blob URL.
patchOnce(
  'const baseUrl = new URL("./game-0.5.js?v=0.5.0", import.meta.url);',
  `const baseUrl = new URL(${JSON.stringify(baseGameUrl)});`,
  "base game URL"
);

// Retain 0.5.3 sail decay: each manual setting lasts ~20 seconds before dropping one level.
const freshTrimMatches = source.match(/sailTrim: 1 \}/g) || [];
if (freshTrimMatches.length !== 2) {
  throw new Error(`KDJ 0.6.0 patch failed: expected 2 fresh sail states, got ${freshTrimMatches.length}`);
}
source = source.replaceAll(
  "sailTrim: 1 }",
  "sailTrim: 1, sailDecayAt: Date.now() + 20000 }"
);
patchOnce(
  '  ship.boostUntil = 0;\\n  personal(p.id, "Sails set to " + labels[ship.sailTrim] + ".");',
  '  ship.boostUntil = 0;\\n  ship.sailDecayAt = ship.sailTrim > 0 ? Date.now() + 20000 : 0;\\n  personal(p.id, "Sails set to " + labels[ship.sailTrim] + ".");',
  "manual sail timer reset"
);
patchOnce(
  '    const sailTrim = ship.sailTrim ?? 1;\\n    const sailPower',
  '    if ((ship.sailTrim ?? 1) > 0 && Date.now() >= (ship.sailDecayAt || 0)) {\\n      ship.sailTrim = Math.max(0, (ship.sailTrim ?? 1) - 1);\\n      ship.sailDecayAt = ship.sailTrim > 0 ? Date.now() + 20000 : 0;\\n    }\\n    const sailTrim = ship.sailTrim ?? 1;\\n    const sailPower',
  "automatic sail decay"
);

// 0.6.0 movement tuning: crew 120% of 0.5.3, ships 90% of 0.5.3.
patchOnce(
  '  const speed = p.deck === "lower" ? 3.35 : 4.15;',
  '  const speed = p.deck === "lower" ? 4.02 : 4.98;',
  "player speed tuning"
);
patchOnce(
  '    const desired = throttle * 6.7 * boost * mobility;\\n    ship.speed += THREE.MathUtils.clamp(desired - ship.speed, -4.8 * dt, 2.7 * dt);',
  '    const desired = throttle * 6.03 * boost * mobility;\\n    ship.speed += THREE.MathUtils.clamp(desired - ship.speed, -4.32 * dt, 2.43 * dt);',
  "ship speed tuning"
);

// Append 0.6.0 base-game patches after the existing 0.5.2 transformations have run.
const extraPatches = String.raw`

// 0.6.0: six-second round restart.
patch(
  'const RESET_MS = 10000;',
  'const RESET_MS = 6000;',
  "six-second battle reset"
);

// Only show the local crew's own ship-status card.
patch(
  '  ui.britishMobility.textContent = \`Mobility \${Math.round(state.ships.british.mobility)}% · Sails \${["Reefed", "Cruising", "Full"][state.ships.british.sailTrim ?? 1]}\`;\\n  ui.frenchMobility.textContent = \`Mobility \${Math.round(state.ships.french.mobility)}% · Sails \${["Reefed", "Cruising", "Full"][state.ships.french.sailTrim ?? 1]}\`;',
  '  ui.britishMobility.textContent = \`Mobility \${Math.round(state.ships.british.mobility)}% · Sails \${["Reefed", "Cruising", "Full"][state.ships.british.sailTrim ?? 1]}\`;\\n  ui.frenchMobility.textContent = \`Mobility \${Math.round(state.ships.french.mobility)}% · Sails \${["Reefed", "Cruising", "Full"][state.ships.french.sailTrim ?? 1]}\`;\\n  document.querySelector(".ship-panel.british")?.classList.toggle("hidden", localTeam !== "british");\\n  document.querySelector(".ship-panel.french")?.classList.toggle("hidden", localTeam !== "french");',
  "own-team ship panel"
);

// Captain-only heading ribbon. Ship heading, not camera look direction, drives the compass.
patch(
  'function normalizeAngle(value) { return Math.atan2(Math.sin(value), Math.cos(value)); }',
  'function updateCaptainCompass(p) {\\n  const compass = document.querySelector("#captainCompass");\\n  if (!compass) return;\\n  const active = Boolean(p?.spawned && p.role === "captain" && state?.phase === "playing");\\n  compass.classList.toggle("hidden", !active);\\n  if (!active) return;\\n  const ship = state.ships[p.ship];\\n  const heading = ((THREE.MathUtils.radToDeg(ship.heading) % 360) + 360) % 360;\\n  const halfView = 62.5;\\n  for (const mark of compass.querySelectorAll("[data-bearing]")) {\\n    const bearing = Number(mark.dataset.bearing);\\n    const diff = ((bearing - heading + 540) % 360) - 180;\\n    const visible = Math.abs(diff) <= halfView;\\n    mark.style.display = visible ? "block" : "none";\\n    if (!visible) continue;\\n    mark.style.left = (50 + (diff / halfView) * 50) + "%";\\n    const edge = Math.abs(diff) / halfView;\\n    mark.style.opacity = String(Math.max(0.16, 1 - edge * edge));\\n  }\\n}\\n\\nfunction normalizeAngle(value) { return Math.atan2(Math.sin(value), Math.cos(value)); }',
  "captain compass function"
);
patch(
  '  updateObjective(local);\\n  if (state.phase === "cooldown") updateCooldownUi();',
  '  updateObjective(local);\\n  updateCaptainCompass(local);\\n  if (state.phase === "cooldown") updateCooldownUi();',
  "captain compass update"
);
`;

patchOnce(
  'const moduleUrl = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));',
  extraPatches + '\nconst moduleUrl = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));',
  "0.6.0 base-game patches"
);

const moduleUrl = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
try {
  await import(moduleUrl);
} finally {
  URL.revokeObjectURL(moduleUrl);
}
