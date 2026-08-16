const patchUrl = new URL("./game-0.5.2.js?v=0.5.2", import.meta.url);
const baseGameUrl = new URL("./game-0.5.js?v=0.5.0", import.meta.url).href;

const response = await fetch(patchUrl, { cache: "no-store" });
if (!response.ok) throw new Error(`Could not load KDj2 0.5.2 patch (${response.status}).`);

let source = await response.text();

function patchOnce(pattern, replacement, label) {
  const next = source.replace(pattern, replacement);
  if (next === source) throw new Error(`KDJ 0.5.3 patch failed: ${label}`);
  source = next;
}

// game-0.5.2 normally resolves its 0.5.0 base relative to its own module URL.
// 0.5.3 runs the patched 0.5.2 source from a Blob, so preserve that base URL explicitly.
patchOnce(
  'const baseUrl = new URL("./game-0.5.js?v=0.5.0", import.meta.url);',
  `const baseUrl = new URL(${JSON.stringify(baseGameUrl)});`,
  "base game URL"
);

// New battles begin on Cruising sails and begin their first 20-second decay immediately.
const freshTrimMatches = source.match(/sailTrim: 1 \}/g) || [];
if (freshTrimMatches.length !== 2) {
  throw new Error(`KDJ 0.5.3 patch failed: expected 2 fresh sail states, got ${freshTrimMatches.length}`);
}
source = source.replaceAll(
  "sailTrim: 1 }",
  "sailTrim: 1, sailDecayAt: Date.now() + 20000 }"
);

// Any manual sail change restarts the 20-second clock from the newly selected level.
patchOnce(
  '  ship.boostUntil = 0;\n  personal(p.id, "Sails set to " + labels[ship.sailTrim] + ".");',
  '  ship.boostUntil = 0;\n  ship.sailDecayAt = ship.sailTrim > 0 ? Date.now() + 20000 : 0;\n  personal(p.id, "Sails set to " + labels[ship.sailTrim] + ".");',
  "manual sail timer reset"
);

// Host-authoritative decay: Full -> Cruising -> Reefed, one level every 20 seconds.
// Reefed is the floor and does not decay further.
patchOnce(
  '    const sailTrim = ship.sailTrim ?? 1;\\n    const sailPower',
  '    if ((ship.sailTrim ?? 1) > 0 && Date.now() >= (ship.sailDecayAt || 0)) {\\n      ship.sailTrim = Math.max(0, (ship.sailTrim ?? 1) - 1);\\n      ship.sailDecayAt = ship.sailTrim > 0 ? Date.now() + 20000 : 0;\\n    }\\n    const sailTrim = ship.sailTrim ?? 1;\\n    const sailPower',
  "automatic sail decay"
);

const moduleUrl = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
try {
  await import(moduleUrl);
} finally {
  URL.revokeObjectURL(moduleUrl);
}
