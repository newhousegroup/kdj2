export function patchGameSource(source) {
  function replaceRequired(search, replacement, label) {
    if (!source.includes(search)) throw new Error(`0.17.4 patch failed: ${label}`);
    source = source.replace(search, replacement);
  }

  // Treat sailors as having a real footprint instead of a zero-radius point at
  // the bow. This keeps the visible triangular forward barrier/rail from being
  // penetrated by the player model while preserving the existing deck shape.
  replaceRequired(
    `function validDeckPosition(deck, x, z) {
  if (deck === "lower") return z >= -11.65 && z <= 11.65 && Math.abs(x) <= 3.62;
  if (z < -13.9 || z > 14.45) return false;
  return Math.abs(x) <= upperDeckHalfWidth(z);
}`,
    `const UPPER_PLAYER_Y = 4.34;
const UPPER_EYE_Y = 6.08;
const PLAYER_BARRIER_CLEARANCE = 0.42;
const CLIMB_DURATION_MS = 720;

function climbProgress(p) {
  const startedAt = Number(p?.climbStartedAt || 0);
  if (!startedAt) return null;
  const raw = (Date.now() - startedAt) / CLIMB_DURATION_MS;
  if (raw < 0 || raw >= 1) return null;
  const t = THREE.MathUtils.clamp(raw, 0, 1);
  return t * t * (3 - 2 * t);
}

function climbingPlayerY(p) {
  const target = p.deck === "lower" ? LOWER_PLAYER_Y : UPPER_PLAYER_Y;
  const from = p.climbFromDeck === "lower" ? LOWER_PLAYER_Y : UPPER_PLAYER_Y;
  const t = climbProgress(p);
  return t == null ? target : THREE.MathUtils.lerp(from, target, t);
}

function climbingEyeY(p) {
  const target = p.deck === "lower" ? LOWER_EYE_Y : UPPER_EYE_Y;
  const from = p.climbFromDeck === "lower" ? LOWER_EYE_Y : UPPER_EYE_Y;
  const t = climbProgress(p);
  return t == null ? target : THREE.MathUtils.lerp(from, target, t);
}

function validDeckPosition(deck, x, z) {
  if (deck === "lower") return z >= -11.65 && z <= 11.65 && Math.abs(x) <= 3.62;
  // Keep the sailor's body inside the visible rails, especially along the
  // narrowing triangular bow where point-only collision allowed clipping.
  if (z < -13.9 + PLAYER_BARRIER_CLEARANCE || z > 14.45 - PLAYER_BARRIER_CLEARANCE) return false;
  return Math.abs(x) <= Math.max(0.2, upperDeckHalfWidth(z) - PLAYER_BARRIER_CLEARANCE);
}`,
    "solid bow barrier collision"
  );

  // Deck changes now carry a short authoritative transition timestamp. The
  // destination deck is still authoritative immediately, while render/camera
  // interpolate vertically for a visible climbing motion.
  replaceRequired(
    `  if (action.type === "down") { p.deck = "lower"; p.x = 0; p.z = 3.3; }
  if (action.type === "up") { p.deck = "upper"; p.x = 0; p.z = 3.3; }`,
    `  if (action.type === "down") {
    p.climbFromDeck = p.deck;
    p.climbStartedAt = Date.now();
    p.deck = "lower";
    p.x = 0;
    p.z = 3.3;
  }
  if (action.type === "up") {
    p.climbFromDeck = p.deck;
    p.climbStartedAt = Date.now();
    p.deck = "upper";
    p.x = 0;
    p.z = 3.3;
  }`,
    "deck transition state"
  );

  // Include the transition metadata in the compact 0.17.1 motion stream so
  // guests start the animation immediately instead of waiting for a full state.
  replaceRequired(
    `    players.push([p.id, p.x, p.z, p.yaw, p.ship, p.deck]);`,
    `    players.push([p.id, p.x, p.z, p.yaw, p.ship, p.deck, p.climbStartedAt || 0, p.climbFromDeck || null]);`,
    "climb metadata motion snapshot"
  );
  replaceRequired(
    `    if (typeof values[4] === "string") p.ship = values[4];
    if (typeof values[5] === "string") p.deck = values[5];`,
    `    if (typeof values[4] === "string") p.ship = values[4];
    if (typeof values[5] === "string") p.deck = values[5];
    if (Number.isFinite(values[6])) p.climbStartedAt = values[6];
    if (typeof values[7] === "string") p.climbFromDeck = values[7];`,
    "climb metadata motion apply"
  );

  // Animate alternating arms/legs during the vertical transition. This runs only
  // for the brief climb window and falls back to the existing walk animation.
  replaceRequired(
    `function animatePlayer(mesh, p) {
  const data = mesh.userData;
  const dx = p.x - data.lastLocalX;`,
    `function animatePlayer(mesh, p) {
  const data = mesh.userData;
  const climb = climbProgress(p);
  if (climb != null) {
    const phase = climb * Math.PI * 4;
    const armSwing = Math.sin(phase) * 0.86;
    const legSwing = Math.sin(phase + Math.PI) * 0.62;
    data.leftArm.rotation.x = THREE.MathUtils.lerp(data.leftArm.rotation.x, armSwing, 0.52);
    data.rightArm.rotation.x = THREE.MathUtils.lerp(data.rightArm.rotation.x, -armSwing, 0.52);
    data.leftLeg.rotation.x = THREE.MathUtils.lerp(data.leftLeg.rotation.x, legSwing, 0.5);
    data.rightLeg.rotation.x = THREE.MathUtils.lerp(data.rightLeg.rotation.x, -legSwing, 0.5);
    data.lastLocalX = p.x;
    data.lastLocalZ = p.z;
    return;
  }
  const dx = p.x - data.lastLocalX;`,
    "climbing limb animation"
  );

  replaceRequired(
    `    const y = p.deck === "lower" ? LOWER_PLAYER_Y : 4.34;
    mesh.position.lerp(toWorld(state.ships[p.ship], p.x, p.z, y), p.id === localId ? 1 : 0.35);`,
    `    const y = climbingPlayerY(p);
    mesh.position.lerp(toWorld(state.ships[p.ship], p.x, p.z, y), p.id === localId ? 1 : 0.35);`,
    "climbing player vertical render"
  );

  replaceRequired(
    `  const eye = toWorld(ship, p.x, p.z, p.deck === "lower" ? LOWER_EYE_Y : 6.08);`,
    `  const eye = toWorld(ship, p.x, p.z, climbingEyeY(p));`,
    "climbing camera vertical render"
  );

  return source;
}
