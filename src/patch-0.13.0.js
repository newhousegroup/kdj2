export function patchGameSource(source) {
  function replaceRequired(search, replacement, label) {
    if (!source.includes(search)) throw new Error(`0.13.0 patch failed: ${label}`);
    source = source.replace(search, replacement);
  }

  function replaceBetween(startMarker, endMarker, replacement, label) {
    const start = source.indexOf(startMarker);
    if (start < 0) throw new Error(`0.13.0 patch failed: ${label} start`);
    const end = source.indexOf(endMarker, start);
    if (end < 0) throw new Error(`0.13.0 patch failed: ${label} end`);
    source = source.slice(0, start) + replacement + source.slice(end);
  }

  // UI bindings for the online-members panel.
  replaceRequired(
    'deathNotice: $("#deathNotice")',
    'deathNotice: $("#deathNotice"), membersBtn: $("#membersBtn"), membersPanel: $("#membersPanel"), membersList: $("#membersList")',
    'online member UI bindings'
  );

  // Track the short battle-intro objective independently from contextual station hints.
  replaceRequired(
    'let seenRound = 0;',
    'let seenRound = 0;\nlet objectiveRoundShown = 0;\nlet objectiveVisibleUntil = 0;',
    'battle intro timer state'
  );

  // Water state is host-authoritative and reset at the start of every round.
  replaceRequired(
    'captureStartedAt: 0, spawned: false',
    'captureStartedAt: 0, inWater: false, waterX: 0, waterZ: 0, lastGrappleAt: 0, spawned: false',
    'player water state'
  );
  replaceRequired(
    '  p.captureStartedAt = 0;\n  p.spawned = spawn;',
    '  p.captureStartedAt = 0;\n  p.inWater = false;\n  p.waterX = 0;\n  p.waterZ = 0;\n  p.lastGrappleAt = 0;\n  p.spawned = spawn;',
    'round water reset'
  );

  // A sailor in the sea is rendered in world space instead of remaining attached to a ship.
  replaceRequired(
    '    const y = p.deck === "lower" ? LOWER_PLAYER_Y : 4.34;\n    mesh.position.lerp(toWorld(state.ships[p.ship], p.x, p.z, y), p.id === localId ? 1 : 0.35);\n    mesh.rotation.y = state.ships[p.ship].heading + (p.role === "captain" ? 0 : (p.yaw || 0)) + Math.PI;',
    '    const y = p.deck === "lower" ? LOWER_PLAYER_Y : 4.34;\n    const targetPosition = p.inWater && Number.isFinite(p.waterX) && Number.isFinite(p.waterZ)\n      ? new THREE.Vector3(p.waterX, 0.22 + Math.sin(now * 0.004 + p.id.length) * 0.08, p.waterZ)\n      : toWorld(state.ships[p.ship], p.x, p.z, y);\n    mesh.position.lerp(targetPosition, p.id === localId ? 1 : 0.35);\n    mesh.rotation.y = p.inWater\n      ? (p.yaw || 0) + Math.PI\n      : state.ships[p.ship].heading + (p.role === "captain" ? 0 : (p.yaw || 0)) + Math.PI;',
    'water player rendering'
  );

  // Fix the team badge by deriving it from the authoritative local player on every render,
  // and keep the online-player list live as snapshots arrive.
  replaceRequired(
    '  const local = state.players[localId];\n  updateHealthHud(local);\n  for (const team of ["british", "french"]) {',
    '  const local = state.players[localId];\n  if (local?.team) {\n    localTeam = local.team;\n    ui.teamBadge.textContent = TEAM[local.team].label;\n    ui.teamBadge.className = `team-badge ${local.team}`;\n  }\n  updateHealthHud(local);\n  updateMembersPanel(local);\n  for (const team of ["british", "french"]) {',
    'authoritative team badge and members refresh'
  );

  // Add the online-members renderer immediately before interaction logic.
  replaceRequired(
    'function interaction(p) {',
    `function updateMembersPanel(local) {
  if (!ui.membersList || !state?.players) return;
  const players = Object.values(state.players);
  ui.membersList.replaceChildren();
  for (const member of players) {
    const row = document.createElement("div");
    row.className = "member-row " + member.team;

    const identity = document.createElement("div");
    identity.className = "member-identity";
    const dot = document.createElement("span");
    dot.className = "member-team-dot " + member.team;
    const name = document.createElement("strong");
    name.textContent = member.name + (member.id === localId ? " · You" : "");
    identity.append(dot, name);

    const status = document.createElement("span");
    status.className = "member-status";
    if (member.alive === false) status.textContent = "Out this battle";
    else if (member.inWater) status.textContent = "In the water";
    else if (member.role === "captain") status.textContent = "Captain · " + TEAM[member.ship].ship;
    else if (member.role === "sailmaster") status.textContent = "Sailmaster · " + TEAM[member.ship].ship;
    else if (member.role === "gunner") status.textContent = "Gunner · " + TEAM[member.ship].ship;
    else status.textContent = (member.deck === "lower" ? "Lower deck · " : "Deck · ") + TEAM[member.ship].ship;

    row.append(identity, status);
    ui.membersList.appendChild(row);
  }
  if (ui.membersBtn) ui.membersBtn.textContent = "Players " + players.length;
}

function interaction(p) {`,
    'online members renderer'
  );

  // No deck interactions or sword attacks while swimming.
  replaceRequired(
    '  if (!p?.spawned || p.alive === false || state.phase !== "playing") return null;',
    '  if (!p?.spawned || p.alive === false || p.inWater || state.phase !== "playing") return null;',
    'water interaction lock'
  );
  replaceRequired(
    '  if (!p?.spawned || p.alive === false || p.role || state.phase !== "playing") return;',
    '  if (!p?.spawned || p.alive === false || p.inWater || p.role || state.phase !== "playing") return;',
    'water sword lock'
  );
  replaceRequired(
    'p?.spawned && p.alive !== false && cameraMode === "first" && !p.role && state?.phase === "playing"',
    'p?.spawned && p.alive !== false && !p.inWater && cameraMode === "first" && !p.role && state?.phase === "playing"',
    'hide first-person sword in water'
  );

  // Replace the objective function: the normal round objective is an intro banner that
  // fades after five seconds, while contextual station/enemy/water guidance remains useful.
  replaceBetween(
    'function updateObjective(p) {',
    'function normalizeAngle(value)',
    `function updateObjective(p) {
  if (!p?.spawned) {
    ui.touchRigging?.classList.add("hidden");
    ui.touchFire?.classList.add("hidden");
    ui.touchSword?.classList.add("hidden");
    ui.deathNotice?.classList.add("hidden");
    return;
  }

  if (p.alive === false) {
    ui.objective.classList.remove("objective-faded");
    ui.objective.textContent = "You are out for this battle · wait for the next round.";
    ui.prompt.classList.add("hidden");
    ui.touchRigging?.classList.add("hidden");
    ui.touchFire?.classList.add("hidden");
    ui.touchSword?.classList.add("hidden");
    ui.deathNotice?.classList.remove("hidden");
    return;
  }
  ui.deathNotice?.classList.add("hidden");

  if (state.phase === "cooldown") {
    ui.objective.classList.remove("objective-faded");
    ui.objective.textContent = "Battle over · next battle starting shortly.";
    ui.prompt.classList.add("hidden");
    ui.touchRigging?.classList.add("hidden");
    ui.touchFire?.classList.add("hidden");
    ui.touchSword?.classList.add("hidden");
    return;
  }

  const round = state.round || 1;
  if (objectiveRoundShown !== round) {
    objectiveRoundShown = round;
    objectiveVisibleUntil = Date.now() + 5000;
  }

  if (p.inWater) {
    const wait = Math.max(0, 1000 - (Date.now() - (p.lastGrappleAt || 0)));
    ui.objective.classList.remove("objective-faded");
    ui.objective.textContent = "Overboard · grapple back onto a ship";
    ui.prompt.textContent = wait > 0 ? "G · Grapple ready in " + (wait / 1000).toFixed(1) + "s" : "G · Grapple back up · 40% success";
    ui.prompt.classList.remove("hidden");
    ui.touchRigging?.classList.add("hidden");
    ui.touchFire?.classList.add("hidden");
    ui.touchSword?.classList.add("hidden");
    return;
  }

  let persistent = true;
  if (p.role === "captain") {
    ui.objective.textContent = \`Captain of \${TEAM[p.ship].ship} · W/S speed · A/D steer · E to leave helm\`;
  } else if (p.role === "sailmaster") {
    const trim = ["Reefed", "Cruising", "Full"][state.ships[p.ship].sailTrim ?? 1];
    ui.objective.textContent = \`Sailmaster on \${TEAM[p.ship].ship} · \${trim} sails · Space / SAILS to change · E to leave rigging\`;
  } else if (p.role === "gunner") {
    const cannon = state.ships[p.ship].cannons?.[p.cannonIndex];
    const wait = cannon ? Math.max(0, CANNON_COOLDOWN_MS - (Date.now() - (cannon.lastFire || 0))) : 0;
    const reload = wait > 0 ? \` · ready in \${(wait / 1000).toFixed(1)}s\` : " · ready";
    ui.objective.textContent = \`Cannon · A/D aim · Space / FIRE · E to leave\${reload}\`;
  } else if (p.ship !== p.team) {
    ui.objective.textContent = p.deck === "lower" ? "Find and capture the enemy flag." : "On enemy ship · find the hatch.";
  } else {
    persistent = false;
    ui.objective.textContent = \`Battle \${round} · take opponent flag to win.\`;
  }
  ui.objective.classList.toggle("objective-faded", !persistent && Date.now() >= objectiveVisibleUntil);

  const action = interaction(p);
  if (action) {
    ui.prompt.textContent = \`E · \${action.label}\`;
    if (action.type === "capture") {
      const elapsed = p.captureStartedAt ? Math.min(FLAG_CAPTURE_HOLD_MS, Date.now() - p.captureStartedAt) : 0;
      const remaining = Math.max(0, (FLAG_CAPTURE_HOLD_MS - elapsed) / 1000);
      ui.prompt.textContent = elapsed > 0 ? "Hold E · Capturing · " + remaining.toFixed(1) + "s" : "Hold E · " + action.label;
    }
    ui.prompt.classList.remove("hidden");
  } else {
    ui.prompt.classList.add("hidden");
  }
  ui.touchRigging?.classList.toggle("hidden", p.role !== "sailmaster");
  if (ui.touchRigging) ui.touchRigging.textContent = p.role === "sailmaster" ? \`SAILS · \${["REEFED", "CRUISE", "FULL"][state.ships[p.ship].sailTrim ?? 1]}\` : "SAILS";
  ui.touchFire?.classList.toggle("hidden", p.role !== "gunner");
  ui.touchSword?.classList.toggle("hidden", Boolean(p.role) || p.alive === false);
}

function normalizeAngle(value)`,
    'battle objective lifecycle'
  );

  // Process grapple input before locking a swimmer out of normal deck movement.
  replaceRequired(
    '  if (Number.isFinite(input.yaw)) p.yaw = normalizeAngle(input.yaw);\n  if (p.role === "gunner") {',
    '  if (Number.isFinite(input.yaw)) p.yaw = normalizeAngle(input.yaw);\n  if (p.inWater) return;\n  if (p.role === "gunner") {',
    'water movement lock'
  );

  // Host-authoritative grappling risk: 20% boarding failure. A failed sailor remains at
  // a fixed world-space water position and may retry once per second with 40% success.
  replaceBetween(
    'function handleGrapple(p) {',
    'function personal(id, text) {',
    `const GRAPPLE_RETRY_MS = 1000;
const GRAPPLE_BOARD_FAIL_CHANCE = 0.20;
const WATER_GRAPPLE_SUCCESS_CHANCE = 0.40;

function handleGrapple(p) {
  if (state.phase !== "playing" || p.alive === false) return;
  const now = Date.now();

  if (p.inWater) {
    if (now - (p.lastGrappleAt || 0) < GRAPPLE_RETRY_MS) return;
    p.lastGrappleAt = now;
    if (Math.random() >= WATER_GRAPPLE_SUCCESS_CHANCE) {
      personal(p.id, "The grapple slipped — try again.");
      return;
    }

    let targetTeam = "british";
    let bestDistance = Infinity;
    for (const team of ["british", "french"]) {
      const ship = state.ships[team];
      const distance = Math.hypot(ship.x - p.waterX, ship.z - p.waterZ);
      if (distance < bestDistance) {
        bestDistance = distance;
        targetTeam = team;
      }
    }

    const fromWater = { x: p.waterX, z: p.waterZ };
    p.inWater = false;
    p.ship = targetTeam;
    p.deck = "upper";
    p.x = p.team === "british" ? -3 : 3;
    p.z = 0;
    p.waterX = 0;
    p.waterZ = 0;
    personal(p.id, "Grapple caught — you're back aboard.");
    event({ kind: "grapple", playerId: p.id, from: targetTeam, to: targetTeam, waterFrom: fromWater });
    return;
  }

  if (p.role || p.deck !== "upper") return personal(p.id, "Leave your station before boarding.");
  const other = p.ship === "british" ? "french" : "british";
  const a = state.ships[p.ship];
  const b = state.ships[other];
  if (Math.hypot(a.x - b.x, a.z - b.z) > GRAPPLE_RANGE) return personal(p.id, "The other ship is too far away.");
  if (now - (p.lastGrappleAt || 0) < GRAPPLE_RETRY_MS) return;
  p.lastGrappleAt = now;

  const from = p.ship;
  event({ kind: "grapple", playerId: p.id, from, to: other });

  if (Math.random() < GRAPPLE_BOARD_FAIL_CHANCE) {
    releaseRole(p.id);
    p.inWater = true;
    p.deck = "upper";
    p.waterX = THREE.MathUtils.lerp(a.x, b.x, 0.48);
    p.waterZ = THREE.MathUtils.lerp(a.z, b.z, 0.48);
    p.x = 0;
    p.z = 0;
    personal(p.id, "The grapple missed — you're in the water. Press G to grapple back up.");
    return;
  }

  p.ship = other;
  p.deck = "upper";
  p.x = p.team === "british" ? -3 : 3;
  p.z = 0;
}

function personal(id, text) {`,
    'grapple failure and water recovery'
  );

  // Water camera sits at the surface and still permits free look in both camera modes.
  replaceRequired(
    '  const ship = state.ships[p.ship];\n  const eye = toWorld(ship, p.x, p.z, p.deck === "lower" ? LOWER_EYE_Y : 6.08);',
    `  if (p.inWater && Number.isFinite(p.waterX) && Number.isFinite(p.waterZ)) {
    const cp = Math.cos(viewPitch);
    const dir = new THREE.Vector3(Math.sin(viewYaw + Math.PI) * cp, Math.sin(viewPitch), Math.cos(viewYaw + Math.PI) * cp).normalize();
    const eye = new THREE.Vector3(p.waterX, 1.05, p.waterZ);
    if (cameraMode === "first") {
      camera.position.copy(eye);
      camera.lookAt(eye.clone().add(dir));
    } else {
      const flat = new THREE.Vector3(dir.x, 0, dir.z).normalize();
      const desired = eye.clone().addScaledVector(flat, -Math.min(6.8, thirdPersonDistance)).add(new THREE.Vector3(0, 2.4, 0));
      camera.position.lerp(desired, 0.17);
      camera.lookAt(eye.clone().addScaledVector(dir, 2.2));
    }
    return;
  }
  const ship = state.ships[p.ship];
  const eye = toWorld(ship, p.x, p.z, p.deck === "lower" ? LOWER_EYE_Y : 6.08);`,
    'water camera'
  );

  // Online-members popover toggle.
  replaceRequired(
    'ui.settings.onclick = openSettings;',
    'if (ui.membersBtn && ui.membersPanel) ui.membersBtn.onclick = () => { ui.membersPanel.classList.toggle("hidden"); };\nui.settings.onclick = openSettings;',
    'members panel toggle'
  );

  return source;
}
