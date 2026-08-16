const baseUrl = new URL("./game-0.5.js?v=0.5.0", import.meta.url);
const response = await fetch(baseUrl, { cache: "no-store" });
if (!response.ok) throw new Error(`Could not load KDj2 0.5.0 base (${response.status}).`);

let source = await response.text();

function patch(pattern, replacement, label) {
  const next = source.replace(pattern, replacement);
  if (next === source) throw new Error(`KDJ 0.5.1 patch failed: ${label}`);
  source = next;
}

// Replace the malformed triangular hatch-area sail with a conventional,
// compact raised sail. It stays just forward of the hatch but well above
// player head height, with its yardarms attached to its mast.
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

// Eyes are intentionally simple: two dark dots directly on the face.
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

// Slower crew movement. Upper deck remains a little quicker than below deck,
// but neither should feel like sprinting across a small ship.
patch(
  '  const speed = p.deck === "lower" ? 5 : 6.2;',
  '  const speed = p.deck === "lower" ? 3.35 : 4.15;',
  "player movement speed"
);

// Slow the visual walk cycle independently so the limbs follow the new pace
// instead of snapping through a very fast exaggerated stride.
patch(
  '    data.walkPhase += Math.min(0.65, moved * 6.6);\n    const swing = Math.sin(data.walkPhase) * 0.58;\n    data.leftLeg.rotation.x = THREE.MathUtils.lerp(data.leftLeg.rotation.x, swing, 0.45);\n    data.rightLeg.rotation.x = THREE.MathUtils.lerp(data.rightLeg.rotation.x, -swing, 0.45);\n    data.leftArm.rotation.x = THREE.MathUtils.lerp(data.leftArm.rotation.x, -swing * 0.55, 0.4);\n    data.rightArm.rotation.x = THREE.MathUtils.lerp(data.rightArm.rotation.x, swing * 0.55, 0.4);',
  '    data.walkPhase += Math.min(0.32, moved * 3.0);\n    const swing = Math.sin(data.walkPhase) * 0.40;\n    data.leftLeg.rotation.x = THREE.MathUtils.lerp(data.leftLeg.rotation.x, swing, 0.25);\n    data.rightLeg.rotation.x = THREE.MathUtils.lerp(data.rightLeg.rotation.x, -swing, 0.25);\n    data.leftArm.rotation.x = THREE.MathUtils.lerp(data.leftArm.rotation.x, -swing * 0.42, 0.22);\n    data.rightArm.rotation.x = THREE.MathUtils.lerp(data.rightArm.rotation.x, swing * 0.42, 0.22);',
  "walk animation speed"
);

// Reduce maximum sailing speed and soften acceleration so the scale of the
// ships reads better and captains have more time to maneuver.
patch(
  '    const desired = throttle * 10.5 * boost * mobility;\n    ship.speed += THREE.MathUtils.clamp(desired - ship.speed, -7 * dt, 4 * dt);',
  '    const desired = throttle * 6.7 * boost * mobility;\n    ship.speed += THREE.MathUtils.clamp(desired - ship.speed, -4.8 * dt, 2.7 * dt);',
  "ship speed"
);

const moduleUrl = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
try {
  await import(moduleUrl);
} finally {
  URL.revokeObjectURL(moduleUrl);
}
