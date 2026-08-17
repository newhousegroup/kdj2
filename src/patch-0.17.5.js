export function patchGameSource(source) {
  function replaceRequired(search, replacement, label) {
    if (!source.includes(search)) throw new Error(`0.17.5 patch failed: ${label}`);
    source = source.replace(search, replacement);
  }

  const movementSpeedMatch = source.match(/  const speed = p\.deck === "lower" \? ([0-9.]+) : ([0-9.]+);/);
  if (!movementSpeedMatch) throw new Error("0.17.5 patch failed: player movement speed marker");
  const lowerSpeed = movementSpeedMatch[1];
  const upperSpeed = movementSpeedMatch[2];

  // Keep the 30 Hz ceiling from 0.17.1, but stop transmitting identical guest
  // input packets continuously while idle. A heartbeat still refreshes the host
  // every 250 ms, while key/look/action changes are sent on the next 33 ms tick.
  replaceRequired(
    `let lastMotionBroadcast = 0;`,
    `let lastMotionBroadcast = 0;\nlet lastGuestInputSignature = "";\nlet lastGuestInputSentAt = 0;`,
    "guest input transmission state"
  );

  replaceRequired(
    `setInterval(() => {
  if (!spawned || !state?.players?.[localId] || state.phase !== "playing") return;
  const input = inputSnapshot();
  if (network.isHost) inputs.set(localId, input);
  else network.send({ type: "input", input });
}, 33);`,
    `setInterval(() => {
  if (!spawned || !state?.players?.[localId] || state.phase !== "playing") return;
  const input = inputSnapshot();
  if (network.isHost) {
    inputs.set(localId, input);
    return;
  }
  const now = performance.now();
  const signature = JSON.stringify(input);
  if (signature !== lastGuestInputSignature || now - lastGuestInputSentAt >= 250) {
    network.send({ type: "input", input });
    lastGuestInputSignature = signature;
    lastGuestInputSentAt = now;
  }
}, 33);`,
    "deduplicated guest input stream"
  );

  // Guest prediction is visual-only. The authoritative player record remains the
  // host's state; prediction supplies a render/camera position between packets.
  // Small differences are intentionally tolerated so ordinary network latency is
  // not reintroduced as visual delay. Large differences reconcile to the host.
  replaceRequired(
    `function renderState(now = performance.now()) {
  if (!state) return;`,
    `const GUEST_PREDICTION_SOFT_ERROR = 1.1;
const GUEST_PREDICTION_HARD_ERROR = 2.8;
const guestPrediction = {
  initialized: false,
  playerId: null,
  x: 0,
  z: 0,
  ship: null,
  deck: null,
  role: null,
  spawned: false,
  alive: true,
  lastFrameAt: 0
};

function resetGuestPrediction(p, now = performance.now()) {
  if (!p) {
    guestPrediction.initialized = false;
    guestPrediction.playerId = null;
    guestPrediction.lastFrameAt = now;
    return;
  }
  guestPrediction.initialized = true;
  guestPrediction.playerId = p.id;
  guestPrediction.x = p.x;
  guestPrediction.z = p.z;
  guestPrediction.ship = p.ship;
  guestPrediction.deck = p.deck;
  guestPrediction.role = p.role || null;
  guestPrediction.spawned = Boolean(p.spawned);
  guestPrediction.alive = p.alive !== false;
  guestPrediction.lastFrameAt = now;
}

function guestPredictionContextChanged(p) {
  return !guestPrediction.initialized ||
    guestPrediction.playerId !== p?.id ||
    guestPrediction.ship !== p?.ship ||
    guestPrediction.deck !== p?.deck ||
    guestPrediction.role !== (p?.role || null) ||
    guestPrediction.spawned !== Boolean(p?.spawned) ||
    guestPrediction.alive !== (p?.alive !== false);
}

function reconcileGuestPrediction(p) {
  if (network.isHost || !p || p.id !== localId) return;
  if (guestPredictionContextChanged(p)) {
    resetGuestPrediction(p);
    return;
  }
  const dx = p.x - guestPrediction.x;
  const dz = p.z - guestPrediction.z;
  const error = Math.hypot(dx, dz);
  if (error >= GUEST_PREDICTION_HARD_ERROR) {
    guestPrediction.x = p.x;
    guestPrediction.z = p.z;
    return;
  }
  if (error > GUEST_PREDICTION_SOFT_ERROR) {
    const range = GUEST_PREDICTION_HARD_ERROR - GUEST_PREDICTION_SOFT_ERROR;
    const severity = THREE.MathUtils.clamp((error - GUEST_PREDICTION_SOFT_ERROR) / range, 0, 1);
    const correction = THREE.MathUtils.lerp(0.16, 0.52, severity);
    guestPrediction.x += dx * correction;
    guestPrediction.z += dz * correction;
  }
}

function advanceGuestPrediction(now) {
  if (network.isHost) return;
  const p = state?.players?.[localId];
  if (!p) {
    resetGuestPrediction(null, now);
    return;
  }
  if (guestPredictionContextChanged(p)) resetGuestPrediction(p, now);

  const dt = Math.min(0.05, Math.max(0, (now - guestPrediction.lastFrameAt) / 1000));
  guestPrediction.lastFrameAt = now;
  if (!p.spawned || p.alive === false || state.phase !== "playing" || p.role || dt <= 0) return;

  const input = inputSnapshot();
  const forward = (input.w ? 1 : 0) - (input.s ? 1 : 0);
  const strafe = (input.d ? 1 : 0) - (input.a ? 1 : 0);
  const magnitude = Math.hypot(forward, strafe);

  if (magnitude < 0.001) {
    // Once movement stops, quietly converge the visual prediction back onto the
    // exact authoritative position so no residual offset can accumulate.
    const settle = 1 - Math.exp(-10 * dt);
    guestPrediction.x = THREE.MathUtils.lerp(guestPrediction.x, p.x, settle);
    guestPrediction.z = THREE.MathUtils.lerp(guestPrediction.z, p.z, settle);
    return;
  }

  const yaw = Number.isFinite(input.yaw) ? input.yaw : (p.yaw || 0);
  const dx = strafe * Math.cos(yaw) - forward * Math.sin(yaw);
  const dz = strafe * Math.sin(yaw) - forward * Math.cos(yaw);
  const directionLength = Math.hypot(dx, dz);
  if (directionLength < 0.001) return;

  const speed = p.deck === "lower" ? ${lowerSpeed} : ${upperSpeed};
  const step = speed * dt / directionLength;
  const predicted = { deck: p.deck, x: guestPrediction.x, z: guestPrediction.z };
  slideMove(predicted, dx * step, dz * step);
  guestPrediction.x = predicted.x;
  guestPrediction.z = predicted.z;
}

function guestRenderCoordinates(p) {
  if (network.isHost || p?.id !== localId || !guestPrediction.initialized) return { x: p.x, z: p.z };
  if (guestPredictionContextChanged(p)) resetGuestPrediction(p);
  return { x: guestPrediction.x, z: guestPrediction.z };
}

function renderState(now = performance.now()) {
  if (!state) return;
  advanceGuestPrediction(now);`,
    "guest prediction helpers"
  );

  // Reconcile whenever fresh host authority arrives, but do not overwrite the
  // prediction object itself with every 30 Hz packet.
  replaceRequired(
    `  if (packet.type === "motion") {
    applyMotionSnapshot(packet);
    return;
  }
  if (packet.type === "state") {
    state = packet.state;
    syncLocal();
  }`,
    `  if (packet.type === "motion") {
    applyMotionSnapshot(packet);
    reconcileGuestPrediction(state?.players?.[localId]);
    return;
  }
  if (packet.type === "state") {
    state = packet.state;
    syncLocal();
    reconcileGuestPrediction(state?.players?.[localId]);
  }`,
    "authoritative prediction reconciliation"
  );

  // Render the local guest at the predicted coordinates. Remote sailors and the
  // host still render directly from authoritative state/smoothing as before.
  replaceRequired(
    `    const y = climbingPlayerY(p);
    mesh.position.lerp(toWorld(state.ships[p.ship], p.x, p.z, y), p.id === localId ? 1 : 0.35);
    mesh.rotation.y = state.ships[p.ship].heading + (p.yaw || 0) + Math.PI;`,
    `    const y = climbingPlayerY(p);
    const renderPosition = guestRenderCoordinates(p);
    mesh.position.lerp(toWorld(state.ships[p.ship], renderPosition.x, renderPosition.z, y), p.id === localId ? 1 : 0.35);
    const renderYaw = (!network.isHost && p.id === localId) ? viewYaw : (p.yaw || 0);
    mesh.rotation.y = state.ships[p.ship].heading + renderYaw + Math.PI;`,
    "predicted local player rendering"
  );

  // The local guest camera follows the same predicted coordinates, which removes
  // the input -> host -> motion-packet round trip from perceived WASD movement.
  replaceRequired(
    `  const ship = state.ships[p.ship];
  const eye = toWorld(ship, p.x, p.z, climbingEyeY(p));`,
    `  const ship = state.ships[p.ship];
  const cameraPosition = guestRenderCoordinates(p);
  const eye = toWorld(ship, cameraPosition.x, cameraPosition.z, climbingEyeY(p));`,
    "predicted local camera position"
  );

  return source;
}
