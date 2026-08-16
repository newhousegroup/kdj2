const baseUrl = new URL("./game-0.5.js?v=0.5.0", import.meta.url);
const response = await fetch(baseUrl, { cache: "no-store" });
if (!response.ok) throw new Error(`Could not load KDj2 0.5.0 base (${response.status}).`);

let source = await response.text();

function patch(pattern, replacement, label) {
  const next = source.replace(pattern, replacement);
  if (next === source) throw new Error(`KDJ 0.5.2 patch failed: ${label}`);
  source = next;
}

// 0.5.1 fixes: clean raised hatch-area sail, simple eyes, slower crew and ships.
patch(
  /function addRaisedStaysail\(parent, sailMat, darkWood, sails\) \{[\s\S]*?\n\}\n\nfunction makeShip/,
  `function addRaisedStaysail(parent, sailMat, darkWood, sails) {
  const mastZ = 0.9;
  addCylinder(parent, 0.20, 14.6, darkWood, [0, 11.5, mastZ]);
  addSquareSail(parent, sailMat, darkWood, {
    z: mastZ,
    y: 14.6,
    width: 5.0,
    height: 3.2,
    bend: 0.28
  }, sails);
  addRope(parent, [[-2.5, 16.2, mastZ], [0, 18.8, mastZ], [2.5, 16.2, mastZ]]);
}

function makeShip`,
  "raised sail geometry"
);
patch(
  '  addRope(exterior, [[0, 20.6, -9.2], [0, 19.4, 0.75]]);',
  '  addRope(exterior, [[0, 20.6, -9.2], [0, 18.8, 0.9]]);',
  "forward mast rigging 1"
);
patch(
  '  addRope(exterior, [[0, 19.4, 0.75], [0, 5.2, 13.7]]);',
  '  addRope(exterior, [[0, 18.8, 0.9], [0, 5.2, 13.7]]);',
  "forward mast rigging 2"
);
patch(
  '  addRope(exterior, [[-4.2, 5.0, -12], [0, 19.4, 0.75], [4.2, 5.0, -12]]);',
  '  addRope(exterior, [[-4.2, 5.0, -12], [0, 18.8, 0.9], [4.2, 5.0, -12]]);',
  "forward mast rigging 3"
);
patch(
  '  const white = new THREE.MeshStandardMaterial({ color: 0xf6f5ef, roughness: 0.7 });\n  const pupil = new THREE.MeshStandardMaterial({ color: 0x121619, roughness: 0.7 });\n',
  '',
  "remove complex eye materials"
);
patch(
  /  for \(const x of \[-0\.12, 0\.12\]\) \{[\s\S]*?  headGroup\.add\(nose\);/,
  `  for (const x of [-0.11, 0.11]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), dark);
    eye.position.set(x, 0.045, 0.335);
    headGroup.add(eye);
  }`,
  "simple dot eyes"
);
patch(
  '  const speed = p.deck === "lower" ? 5 : 6.2;',
  '  const speed = p.deck === "lower" ? 3.35 : 4.15;',
  "player movement speed"
);
patch(
  '    data.walkPhase += Math.min(0.65, moved * 6.6);\n    const swing = Math.sin(data.walkPhase) * 0.58;\n    data.leftLeg.rotation.x = THREE.MathUtils.lerp(data.leftLeg.rotation.x, swing, 0.45);\n    data.rightLeg.rotation.x = THREE.MathUtils.lerp(data.rightLeg.rotation.x, -swing, 0.45);\n    data.leftArm.rotation.x = THREE.MathUtils.lerp(data.leftArm.rotation.x, -swing * 0.55, 0.4);\n    data.rightArm.rotation.x = THREE.MathUtils.lerp(data.rightArm.rotation.x, swing * 0.55, 0.4);',
  '    data.walkPhase += Math.min(0.32, moved * 3.0);\n    const swing = Math.sin(data.walkPhase) * 0.40;\n    data.leftLeg.rotation.x = THREE.MathUtils.lerp(data.leftLeg.rotation.x, swing, 0.25);\n    data.rightLeg.rotation.x = THREE.MathUtils.lerp(data.rightLeg.rotation.x, -swing, 0.25);\n    data.leftArm.rotation.x = THREE.MathUtils.lerp(data.leftArm.rotation.x, -swing * 0.42, 0.22);\n    data.rightArm.rotation.x = THREE.MathUtils.lerp(data.rightArm.rotation.x, swing * 0.42, 0.22);',
  "walk animation speed"
);
patch(
  '    const desired = throttle * 10.5 * boost * mobility;\n    ship.speed += THREE.MathUtils.clamp(desired - ship.speed, -7 * dt, 4 * dt);',
  '    const desired = throttle * 6.7 * boost * mobility;\n    ship.speed += THREE.MathUtils.clamp(desired - ship.speed, -4.8 * dt, 2.7 * dt);',
  "ship speed"
);

// 0.5.2: start five times farther apart and give each ship a persistent sail state.
patch(
  '    ? { x: -30, z: 0, heading: Math.PI / 2, speed: 0, mobility: 100, captain: null, sailmaster: null, boostUntil: 0 }\n    : { x: 30, z: 0, heading: -Math.PI / 2, speed: 0, mobility: 100, captain: null, sailmaster: null, boostUntil: 0 };',
  '    ? { x: -150, z: 0, heading: Math.PI / 2, speed: 0, mobility: 100, captain: null, sailmaster: null, boostUntil: 0, sailTrim: 1 }\n    : { x: 150, z: 0, heading: -Math.PI / 2, speed: 0, mobility: 100, captain: null, sailmaster: null, boostUntil: 0, sailTrim: 1 };',
  "five-times wider starting distance"
);

// Sailmaster now cycles a persistent three-stage trim instead of triggering a temporary boost.
patch(
  'function handleRigging(p) {\n  if (p.role !== "sailmaster" || state.phase !== "playing") return;\n  const ship = state.ships[p.ship];\n  if (ship.sailmaster !== p.id) return;\n  ship.boostUntil = Date.now() + 1800;\n  personal(p.id, "Sails trimmed — speed boost active.");\n}',
  `function handleRigging(p) {
  if (p.role !== "sailmaster" || state.phase !== "playing") return;
  const ship = state.ships[p.ship];
  if (ship.sailmaster !== p.id) return;
  const labels = ["Reefed", "Cruising", "Full"];
  ship.sailTrim = ((ship.sailTrim ?? 1) + 1) % labels.length;
  ship.boostUntil = 0;
  personal(p.id, "Sails set to " + labels[ship.sailTrim] + ".");
}`,
  "persistent sail trim control"
);

// Sail setting continuously determines propulsion: reefed, cruise, or full.
patch(
  '    const boost = Date.now() < ship.boostUntil ? 1.18 : 1;\n    const mobility = THREE.MathUtils.clamp(ship.mobility / 100, 0.22, 1);\n    const desired = throttle * 6.7 * boost * mobility;',
  '    const sailTrim = ship.sailTrim ?? 1;\n    const sailPower = [0.55, 0.78, 1.0][sailTrim] ?? 0.78;\n    const mobility = THREE.MathUtils.clamp(ship.mobility / 100, 0.22, 1);\n    const desired = throttle * 6.7 * sailPower * mobility;',
  "sail trim propulsion"
);

// The cloth visibly reefs or opens to match the synchronized sail state.
patch(
  '    const lean = Math.sin(now * 0.00135 + (team === "british" ? 0 : 1.7)) * 0.022;\n    for (const sail of visual.sails) {\n      if (!Number.isFinite(sail.userData.baseRotationY)) sail.userData.baseRotationY = sail.rotation.y;\n      sail.rotation.y = sail.userData.baseRotationY + lean;\n    }',
  `    const lean = Math.sin(now * 0.00135 + (team === "british" ? 0 : 1.7)) * 0.022;
    const sailTrim = ship.sailTrim ?? 1;
    const sailScaleX = [0.42, 0.72, 1.0][sailTrim] ?? 0.72;
    const sailScaleY = [0.72, 0.88, 1.0][sailTrim] ?? 0.88;
    for (const sail of visual.sails) {
      if (!Number.isFinite(sail.userData.baseRotationY)) sail.userData.baseRotationY = sail.rotation.y;
      sail.rotation.y = sail.userData.baseRotationY + lean;
      sail.scale.x = THREE.MathUtils.lerp(sail.scale.x, sailScaleX, 0.14);
      sail.scale.y = THREE.MathUtils.lerp(sail.scale.y, sailScaleY, 0.14);
    }`,
  "visual sail reefing"
);

// Show sail state to the sailmaster and to everyone in the ship status panels.
patch(
  '  else if (p.role === "sailmaster") ui.objective.textContent = `Sailmaster on ${TEAM[p.ship].ship} · Space / SAILS to trim sails · E to leave rigging`;',
  '  else if (p.role === "sailmaster") {\n    const trim = ["Reefed", "Cruising", "Full"][state.ships[p.ship].sailTrim ?? 1];\n    ui.objective.textContent = `Sailmaster on ${TEAM[p.ship].ship} · ${trim} sails · Space / SAILS to change · E to leave rigging`;\n  }',
  "sailmaster objective state"
);
patch(
  '  ui.touchRigging?.classList.toggle("hidden", p.role !== "sailmaster");',
  '  ui.touchRigging?.classList.toggle("hidden", p.role !== "sailmaster");\n  if (ui.touchRigging) ui.touchRigging.textContent = p.role === "sailmaster" ? `SAILS · ${["REEFED", "CRUISE", "FULL"][state.ships[p.ship].sailTrim ?? 1]}` : "SAILS";',
  "touch sail state label"
);
patch(
  '  ui.britishMobility.textContent = `Mobility ${Math.round(state.ships.british.mobility)}%`;\n  ui.frenchMobility.textContent = `Mobility ${Math.round(state.ships.french.mobility)}%`;',
  '  ui.britishMobility.textContent = `Mobility ${Math.round(state.ships.british.mobility)}% · Sails ${["Reefed", "Cruising", "Full"][state.ships.british.sailTrim ?? 1]}`;\n  ui.frenchMobility.textContent = `Mobility ${Math.round(state.ships.french.mobility)}% · Sails ${["Reefed", "Cruising", "Full"][state.ships.french.sailTrim ?? 1]}`;',
  "ship panel sail state"
);

const moduleUrl = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
try {
  await import(moduleUrl);
} finally {
  URL.revokeObjectURL(moduleUrl);
}
