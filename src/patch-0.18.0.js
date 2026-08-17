export function patchGameSource(source) {
  function replaceRequired(search, replacement, label) {
    if (!source.includes(search)) throw new Error(`0.18.0 patch failed: ${label}`);
    source = source.replace(search, replacement);
  }

  // Boarding is no longer an instantaneous authoritative teleport. The host
  // reserves the transfer, broadcasts a two-stage visual event, and completes
  // the ship switch after the hook-extension + crossing duration.
  replaceRequired(
    `function handleGrapple(p) {
  if (state.phase !== "playing") return;
  if (p.role || p.deck !== "upper") return personal(p.id, "Leave your station before boarding.");
  const other = p.ship === "british" ? "french" : "british";
  const a = state.ships[p.ship];
  const b = state.ships[other];
  if (Math.hypot(a.x - b.x, a.z - b.z) > GRAPPLE_RANGE) return personal(p.id, "The other ship is too far away.");
  const from = p.ship;
  p.ship = other;
  p.deck = "upper";
  p.x = p.team === "british" ? -3 : 3;
  p.z = 0;
  event({ kind: "grapple", playerId: p.id, from, to: other });
}`,
    `function handleGrapple(p) {
  if (state.phase !== "playing") return;
  if (p.role || p.deck !== "upper") return personal(p.id, "Leave your station before boarding.");
  if (p.boardingCompleteAt) return;
  const other = p.ship === "british" ? "french" : "british";
  const a = state.ships[p.ship];
  const b = state.ships[other];
  if (Math.hypot(a.x - b.x, a.z - b.z) > GRAPPLE_RANGE) return personal(p.id, "The other ship is too far away.");

  const from = p.ship;
  const targetX = p.team === "british" ? -3 : 3;
  const targetZ = 0;
  const stretchMs = 360;
  const travelMs = 620;

  p.boardingFrom = from;
  p.boardingTo = other;
  p.boardingTargetX = targetX;
  p.boardingTargetZ = targetZ;
  p.boardingCompleteAt = Date.now() + stretchMs + travelMs;

  event({
    kind: "grapple",
    playerId: p.id,
    from,
    to: other,
    fromX: p.x,
    fromZ: p.z,
    toX: targetX,
    toZ: targetZ,
    stretchMs,
    travelMs
  });
  personal(p.id, "Grappling across...");
}`,
    "two-stage grappling transfer"
  );

  replaceRequired(
    `function processPlayer(p, input, dt) {
  if (!p.spawned || p.alive === false || state.phase !== "playing") return;`,
    `function processPlayer(p, input, dt) {
  if (!p.spawned || p.alive === false || state.phase !== "playing") return;
  if (p.boardingCompleteAt) {
    if (Date.now() < p.boardingCompleteAt) return;
    const destination = p.boardingTo;
    if (destination && state.ships[destination]) {
      p.ship = destination;
      p.deck = "upper";
      p.x = Number.isFinite(p.boardingTargetX) ? p.boardingTargetX : (p.team === "british" ? -3 : 3);
      p.z = Number.isFinite(p.boardingTargetZ) ? p.boardingTargetZ : 0;
    }
    p.boardingFrom = null;
    p.boardingTo = null;
    p.boardingTargetX = null;
    p.boardingTargetZ = null;
    p.boardingCompleteAt = 0;
  }`,
    "authoritative boarding completion"
  );

  replaceRequired(
    `  p.spawned = spawn;`,
    `  p.boardingFrom = null;
  p.boardingTo = null;
  p.boardingTargetX = null;
  p.boardingTargetZ = null;
  p.boardingCompleteAt = 0;
  p.spawned = spawn;`,
    "reset boarding state"
  );

  // Visual event state for cannon impacts. Grapple events already exist and are
  // now also used to animate the sailor's world-space crossing.
  replaceRequired(
    `const grappleFx = [];`,
    `const grappleFx = [];
const cannonImpactFx = [];`,
    "cannon impact effect state"
  );

  replaceRequired(
    `  if (e.kind === "grapple") grappleFx.push({ ...e, start: performance.now() });`,
    `  if (e.kind === "grapple") grappleFx.push({ ...e, start: performance.now() });
  if (e.kind === "cannonImpact") cannonImpactFx.push({ ...e, start: performance.now() });`,
    "cannon impact event reception"
  );

  // Remove the historical 25% mobility floor. Every cannon hit gets a visible
  // impact event; reaching zero destroys the target ship and ends the round.
  replaceRequired(
    `    target.mobility = Math.max(25, target.mobility - damage);`,
    `    target.mobility = Math.max(0, target.mobility - damage);`,
    "zero-mobility cannon damage"
  );

  replaceRequired(
    `    if (shooter) personal(shooter.id, "Hit — enemy mobility " + Math.round(target.mobility) + "%.");`,
    `    const destroyed = target.mobility <= 0;
    if (shooter) personal(shooter.id, destroyed ? "Hit — enemy ship destroyed!" : "Hit — enemy mobility " + Math.round(target.mobility) + "%.");
    event({ kind: "cannonImpact", x: shot.x, y: shot.y, z: shot.z, team: enemy, destroyed });
    if (destroyed) {
      target.destroyed = true;
      target.speed = 0;
      finishBattle(shot.team, enemy, "destroyed");
      return;
    }`,
    "cannon destruction win condition"
  );

  // Preserve the existing flag-capture win path while letting the victory UI
  // accurately report a cannon-destruction victory.
  replaceRequired(
    `function finishBattle(winner, loser) {`,
    `function finishBattle(winner, loser, reason = "flag") {`,
    "battle win reason argument"
  );
  replaceRequired(
    `  state.loser = loser;
  state.resetAt = Date.now() + RESET_MS;`,
    `  state.loser = loser;
  state.winReason = reason;
  state.resetAt = Date.now() + RESET_MS;`,
    "store battle win reason"
  );
  replaceRequired(
    `  state.winner = null;
  state.loser = null;
  state.resetAt = 0;`,
    `  state.winner = null;
  state.loser = null;
  state.winReason = null;
  state.resetAt = 0;`,
    "reset battle win reason"
  );
  replaceRequired(
    '  ui.victoryText.textContent = loser ? `${TEAM[loser].label} flag captured.` : "Flag captured.";',
    '  ui.victoryText.textContent = state.winReason === "destroyed" && loser ? `${TEAM[loser].ship} was destroyed.` : (loser ? `${TEAM[loser].label} flag captured.` : "Flag captured.");',
    "destruction victory copy"
  );

  // Hide the destroyed ship group (including its flag) during the victory
  // cooldown. The next round recreates fresh ships normally.
  replaceRequired(
    `    visual.group.position.set(ship.x, 0, ship.z);`,
    `    visual.group.visible = ship.destroyed !== true;
    visual.group.position.set(ship.x, 0, ship.z);`,
    "destroyed ship visibility"
  );
  replaceRequired(
    `    mesh.visible = !(p.id === localId && cameraMode === "first");`,
    `    mesh.visible = state.ships[p.ship]?.destroyed !== true && !(p.id === localId && cameraMode === "first");`,
    "hide crew with destroyed ship"
  );

  // Client prediction must stop advancing the local guest while the boarding FX
  // owns their visual position. Host authority still determines the final ship.
  replaceRequired(
    `  if (!p.spawned || p.alive === false || state.phase !== "playing" || p.role || dt <= 0) return;`,
    `  if (!p.spawned || p.alive === false || state.phase !== "playing" || p.role || activeBoardingFx(p.id) || dt <= 0) return;`,
    "pause prediction while boarding"
  );

  // Replace the simple fading grapple line with a two-stage animation and add a
  // compact cannon explosion effect. All geometry remains transient and local;
  // only the event itself travels across the network.
  replaceRequired(
    `function renderEffects(now) {
  effects.clear();
  for (let i = grappleFx.length - 1; i >= 0; i -= 1) {
    const e = grappleFx[i];
    if (now - e.start > 1400) { grappleFx.splice(i, 1); continue; }
    const a = state?.ships[e.from];
    const b = state?.ships[e.to];
    if (!a || !b) continue;
    const material = new THREE.LineBasicMaterial({ color: 0xd8c29e, transparent: true, opacity: Math.max(0, 1 - (now - e.start) / 1400) });
    effects.add(new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(a.x, 5, a.z), new THREE.Vector3(b.x, 5, b.z)]),
      material
    ));
  }
}`,
    `function activeBoardingFx(playerId, now = performance.now()) {
  for (let i = grappleFx.length - 1; i >= 0; i -= 1) {
    const e = grappleFx[i];
    const total = Number(e.stretchMs || 360) + Number(e.travelMs || 620);
    if (e.playerId === playerId && now - e.start <= total + 180) return e;
  }
  return null;
}

function boardingWorldPosition(playerId, y, now = performance.now()) {
  const e = activeBoardingFx(playerId, now);
  if (!e) return null;
  const a = state?.ships?.[e.from];
  const b = state?.ships?.[e.to];
  if (!a || !b) return null;
  const start = toWorld(a, Number(e.fromX || 0), Number(e.fromZ || 0), y);
  const end = toWorld(b, Number(e.toX || 0), Number(e.toZ || 0), y);
  const stretchMs = Number(e.stretchMs || 360);
  const travelMs = Number(e.travelMs || 620);
  const age = now - e.start;
  if (age <= stretchMs) return start;
  const raw = THREE.MathUtils.clamp((age - stretchMs) / travelMs, 0, 1);
  const t = raw * raw * (3 - 2 * raw);
  return start.lerp(end, t);
}

function renderEffects(now) {
  effects.clear();

  for (let i = grappleFx.length - 1; i >= 0; i -= 1) {
    const e = grappleFx[i];
    const stretchMs = Number(e.stretchMs || 360);
    const travelMs = Number(e.travelMs || 620);
    const total = stretchMs + travelMs;
    const age = now - e.start;
    if (age > total + 180) { grappleFx.splice(i, 1); continue; }
    const a = state?.ships?.[e.from];
    const b = state?.ships?.[e.to];
    if (!a || !b) continue;

    const start = toWorld(a, Number(e.fromX || 0), Number(e.fromZ || 0), 5.18);
    const end = toWorld(b, Number(e.toX || 0), Number(e.toZ || 0), 5.18);
    const hookT = THREE.MathUtils.clamp(age / stretchMs, 0, 1);
    const hookEase = 1 - Math.pow(1 - hookT, 3);
    const tip = start.clone().lerp(end, hookEase);
    const fade = age > total ? 1 - (age - total) / 180 : 1;

    const ropeMaterial = new THREE.LineBasicMaterial({ color: 0xd8c29e, transparent: true, opacity: Math.max(0, fade) });
    effects.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([start, tip]), ropeMaterial));

    if (age <= stretchMs + 80) {
      const hookMaterial = new THREE.MeshStandardMaterial({ color: 0x596268, metalness: 0.8, roughness: 0.28 });
      const hook = new THREE.Mesh(new THREE.TorusGeometry(0.23, 0.055, 6, 12, Math.PI * 1.55), hookMaterial);
      hook.position.copy(tip);
      hook.rotation.set(Math.PI / 2, 0, Math.atan2(end.z - start.z, end.x - start.x));
      effects.add(hook);
    }
  }

  for (let i = cannonImpactFx.length - 1; i >= 0; i -= 1) {
    const e = cannonImpactFx[i];
    const duration = e.destroyed ? 1250 : 720;
    const age = now - e.start;
    if (age > duration) { cannonImpactFx.splice(i, 1); continue; }
    const t = THREE.MathUtils.clamp(age / duration, 0, 1);
    const strength = e.destroyed ? 1.65 : 1;
    const center = new THREE.Vector3(Number(e.x || 0), Number(e.y || 4.5), Number(e.z || 0));

    const flashMaterial = new THREE.MeshBasicMaterial({
      color: 0xffa43a,
      transparent: true,
      opacity: Math.max(0, (1 - t) * 0.82),
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const flash = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), flashMaterial);
    flash.position.copy(center);
    const flashScale = strength * (0.35 + t * 2.8);
    flash.scale.setScalar(flashScale);
    effects.add(flash);

    const smokeMaterial = new THREE.MeshBasicMaterial({ color: 0x30363a, transparent: true, opacity: Math.max(0, 0.48 * (1 - t)) });
    const smoke = new THREE.Mesh(new THREE.SphereGeometry(1, 9, 7), smokeMaterial);
    smoke.position.copy(center).add(new THREE.Vector3(0, 0.6 + t * 2.7 * strength, 0));
    smoke.scale.setScalar(strength * (0.55 + t * 1.7));
    effects.add(smoke);

    const sparkMaterial = new THREE.MeshBasicMaterial({ color: 0xffd07a, transparent: true, opacity: Math.max(0, 1 - t) });
    for (let s = 0; s < 8; s += 1) {
      const angle = (s / 8) * Math.PI * 2 + (e.destroyed ? 0.19 : 0);
      const distance = t * 3.5 * strength;
      const spark = new THREE.Mesh(new THREE.SphereGeometry(0.085, 5, 4), sparkMaterial);
      spark.position.set(
        center.x + Math.cos(angle) * distance,
        center.y + 0.25 + Math.sin(angle * 2) * distance * 0.22 + t * 1.25,
        center.z + Math.sin(angle) * distance
      );
      effects.add(spark);
    }
  }
}`,
    "grapple and cannon impact rendering"
  );

  // Move the player model and local camera across the rope during stage two.
  replaceRequired(
    `    mesh.position.lerp(toWorld(state.ships[p.ship], renderPosition.x, renderPosition.z, y), p.id === localId ? 1 : 0.35);`,
    `    const boardingPosition = boardingWorldPosition(p.id, y, now);
    mesh.position.lerp(boardingPosition || toWorld(state.ships[p.ship], renderPosition.x, renderPosition.z, y), p.id === localId ? 1 : 0.35);`,
    "boarding player crossing render"
  );
  replaceRequired(
    `  const eye = toWorld(ship, cameraPosition.x, cameraPosition.z, climbingEyeY(p));`,
    `  const boardingEye = boardingWorldPosition(p.id, climbingEyeY(p), now);
  const eye = boardingEye || toWorld(ship, cameraPosition.x, cameraPosition.z, climbingEyeY(p));`,
    "boarding camera crossing render"
  );

  return source;
}
