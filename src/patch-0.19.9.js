export function patchGameSource(source) {
  function replaceRequired(search, replacement, label) {
    if (!source.includes(search)) throw new Error(`0.19.9 patch failed: ${label}`);
    source = source.replace(search, replacement);
  }

  // The local guest predicts their own walking between authoritative packets.
  // In 0.17.5, releasing movement immediately pulled that prediction toward the
  // host's slightly older position, so a clean stop could look like a small
  // backwards bounce before the host caught up. Keep the predicted stop point
  // while authority is still visibly behind along the direction we just moved.
  replaceRequired(
    `  alive: true,\n  lastFrameAt: 0\n};`,
    `  alive: true,
  lastFrameAt: 0,
  wasMoving: false,
  stoppedAt: 0,
  lastMoveX: 0,
  lastMoveZ: 0
};`,
    "guest prediction stop state"
  );

  replaceRequired(
    `  guestPrediction.alive = p.alive !== false;\n  guestPrediction.lastFrameAt = now;`,
    `  guestPrediction.alive = p.alive !== false;
  guestPrediction.lastFrameAt = now;
  guestPrediction.wasMoving = false;
  guestPrediction.stoppedAt = 0;
  guestPrediction.lastMoveX = 0;
  guestPrediction.lastMoveZ = 0;`,
    "guest prediction reset stop state"
  );

  replaceRequired(
    `  const dx = p.x - guestPrediction.x;\n  const dz = p.z - guestPrediction.z;\n  const error = Math.hypot(dx, dz);`,
    `  const dx = p.x - guestPrediction.x;
  const dz = p.z - guestPrediction.z;
  const error = Math.hypot(dx, dz);

  // For a short time after releasing movement, an authoritative packet may
  // still describe a point behind the client's predicted stop. Pulling toward
  // that stale point is the visible bounce. Hold only corrections that would
  // move backwards along the last travel direction; forward/side corrections
  // and large safety corrections still work normally.
  if (guestPrediction.stoppedAt > 0 && performance.now() - guestPrediction.stoppedAt < 450 && error < GUEST_PREDICTION_HARD_ERROR) {
    const backwards = dx * guestPrediction.lastMoveX + dz * guestPrediction.lastMoveZ;
    if (backwards < -0.025) return;
  }`,
    "stop-aware authoritative reconciliation"
  );

  replaceRequired(
    `  if (magnitude < 0.001) {\n    // Once movement stops, quietly converge the visual prediction back onto the\n    // exact authoritative position so no residual offset can accumulate.\n    const settle = 1 - Math.exp(-10 * dt);\n    guestPrediction.x = THREE.MathUtils.lerp(guestPrediction.x, p.x, settle);\n    guestPrediction.z = THREE.MathUtils.lerp(guestPrediction.z, p.z, settle);\n    return;\n  }`,
    `  if (magnitude < 0.001) {
    if (guestPrediction.wasMoving) {
      guestPrediction.wasMoving = false;
      guestPrediction.stoppedAt = now;
    }

    const authorityDx = p.x - guestPrediction.x;
    const authorityDz = p.z - guestPrediction.z;
    const authorityError = Math.hypot(authorityDx, authorityDz);
    const backwards = authorityDx * guestPrediction.lastMoveX + authorityDz * guestPrediction.lastMoveZ;
    const stopAge = guestPrediction.stoppedAt > 0 ? now - guestPrediction.stoppedAt : Infinity;

    // Do not visibly rewind toward a stale host snapshot immediately after a
    // stop. The normal 30 Hz motion stream usually catches up within a few
    // frames. A 450 ms ceiling still guarantees eventual correction if the host
    // rejected movement because of collision or severe packet delay.
    if (stopAge < 450 && authorityError < GUEST_PREDICTION_HARD_ERROR && backwards < -0.025) return;

    if (authorityError < 0.035) {
      guestPrediction.x = p.x;
      guestPrediction.z = p.z;
      return;
    }

    const settle = 1 - Math.exp(-10 * dt);
    guestPrediction.x = THREE.MathUtils.lerp(guestPrediction.x, p.x, settle);
    guestPrediction.z = THREE.MathUtils.lerp(guestPrediction.z, p.z, settle);
    return;
  }

  guestPrediction.wasMoving = true;
  guestPrediction.stoppedAt = 0;`,
    "bounce-free stop reconciliation"
  );

  replaceRequired(
    `  const directionLength = Math.hypot(dx, dz);\n  if (directionLength < 0.001) return;\n\n  const speed = p.deck === "lower" ?`,
    `  const directionLength = Math.hypot(dx, dz);
  if (directionLength < 0.001) return;
  guestPrediction.lastMoveX = dx / directionLength;
  guestPrediction.lastMoveZ = dz / directionLength;

  const speed = p.deck === "lower" ?`,
    "remember guest movement direction"
  );

  return source;
}
