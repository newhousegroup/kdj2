const BASE_URL = new URL("./game-0.5.js?v=0.5.0", import.meta.url);

function showBootError(error) {
  console.error("KDJ2 0.7.0 boot failed", error);
  const status = document.querySelector("#lobbyStatus");
  if (status) {
    status.textContent = `Game failed to load: ${error?.message || error}`;
    status.classList.add("error");
  }
}

async function boot() {
  const response = await fetch(BASE_URL, { cache: "no-store" });
  if (!response.ok) throw new Error(`Could not load base game (${response.status})`);

  let source = await response.text();

  function patch(pattern, replacement, label) {
    const next = source.replace(pattern, () => replacement);
    if (next === source) throw new Error(`0.7.0 patch failed: ${label}`);
    source = next;
  }

  patch("const RESET_MS = 10000;", `const RESET_MS = 6000;
const CANNON_COOLDOWN_MS = 2800;
const CANNON_DAMAGE = 12;
const CANNON_SHOT_SPEED = 34;
const CANNON_SHOT_TTL = 4400;`, "round and cannon constants");

  patch(
    /function freshShip\(team\) \{[\s\S]*?\n\}/,
    `function freshShip(team) {
  const sailDecayAt = Date.now() + 20000;
  const cannons = [
    { id: "port-fore", x: -3.25, z: -6.5, side: -1, gunner: null, aim: 0, lastFire: 0 },
    { id: "port-aft", x: -3.25, z: 5.5, side: -1, gunner: null, aim: 0, lastFire: 0 },
    { id: "starboard-fore", x: 3.25, z: -6.5, side: 1, gunner: null, aim: 0, lastFire: 0 },
    { id: "starboard-aft", x: 3.25, z: 5.5, side: 1, gunner: null, aim: 0, lastFire: 0 }
  ];
  return team === "british"
    ? { x: -150, z: 0, heading: Math.PI / 2, speed: 0, mobility: 100, captain: null, sailmaster: null, boostUntil: 0, sailTrim: 1, sailDecayAt, cannons }
    : { x: 150, z: 0, heading: -Math.PI / 2, speed: 0, mobility: 100, captain: null, sailmaster: null, boostUntil: 0, sailTrim: 1, sailDecayAt, cannons };
}`,
    "starting ships and cannon stations"
  );

  patch(
    'function playerRecord(id, name, team) {\n  return { id, name, team, ship: team, deck: "upper", x: 0, z: 10, yaw: 0, role: null, spawned: false };\n}',
    'function playerRecord(id, name, team) {\n  return { id, name, team, ship: team, deck: "upper", x: 0, z: 10, yaw: 0, role: null, cannonIndex: null, spawned: false };\n}',
    "player cannon assignment"
  );
  patch(
    '  p.role = null;\n  p.spawned = spawn;',
    '  p.role = null;\n  p.cannonIndex = null;\n  p.spawned = spawn;',
    "clear cannon assignment on spawn"
  );
  patch(
    '    ships: { british: freshShip("british"), french: freshShip("french") },\n    players: { [id]: playerRecord(id, name, team) }',
    '    ships: { british: freshShip("british"), french: freshShip("french") },\n    shots: [],\n    players: { [id]: playerRecord(id, name, team) }',
    "projectile state"
  );

  patch(
    '  touchGrapple: $("#touchGrapple"), touchRigging: $("#touchRigging")',
    '  touchGrapple: $("#touchGrapple"), touchRigging: $("#touchRigging"), touchFire: $("#touchFire")',
    "touch fire UI"
  );
  patch("let seqRig = 0;", "let seqRig = 0;\nlet seqFire = 0;", "fire input sequence");
  patch("const playerMeshes = new Map();", "const playerMeshes = new Map();\nconst shotMeshes = new Map();", "projectile meshes");

  patch(
    /function addRaisedStaysail\(parent, sailMat, darkWood, sails\) \{[\s\S]*?\n\}/,
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
}`,
    "raised sail"
  );
  patch(
    "  addRope(exterior, [[0, 20.6, -9.2], [0, 19.4, 0.75]]);",
    "  addRope(exterior, [[0, 20.6, -9.2], [0, 18.8, 0.9]]);",
    "forward rigging A"
  );
  patch(
    "  addRope(exterior, [[0, 19.4, 0.75], [0, 5.2, 13.7]]);",
    "  addRope(exterior, [[0, 18.8, 0.9], [0, 5.2, 13.7]]);",
    "forward rigging B"
  );
  patch(
    "  addRope(exterior, [[-4.2, 5.0, -12], [0, 19.4, 0.75], [4.2, 5.0, -12]]);",
    "  addRope(exterior, [[-4.2, 5.0, -12], [0, 18.8, 0.9], [4.2, 5.0, -12]]);",
    "forward rigging C"
  );

  patch("  const sails = [];", "  const sails = [];\n  const cannonVisuals = [];", "cannon visual collection");
  patch(
    "  const flagPole = addCylinder(exterior, 0.08, 7.5, darkWood, [0, 8.0, 12.5]);",
    `  const cannonLayout = [
    { x: -3.25, z: -6.5, side: -1 },
    { x: -3.25, z: 5.5, side: -1 },
    { x: 3.25, z: -6.5, side: 1 },
    { x: 3.25, z: 5.5, side: 1 }
  ];
  for (const spec of cannonLayout) {
    const mount = new THREE.Group();
    mount.position.set(spec.x, 4.62, spec.z);
    mount.userData.side = spec.side;
    mount.rotation.y = spec.side < 0 ? Math.PI : 0;
    addBox(mount, [1.2, 0.34, 0.82], darkWood, [0, 0, 0]);
    const barrel = addCylinder(mount, 0.18, 1.75, metal, [0.68, 0.32, 0], [0, 0, Math.PI / 2], 14);
    barrel.castShadow = true;
    addCylinder(mount, 0.16, 0.18, darkWood, [-0.35, -0.2, -0.3], [Math.PI / 2, 0, 0], 10);
    addCylinder(mount, 0.16, 0.18, darkWood, [-0.35, -0.2, 0.3], [Math.PI / 2, 0, 0], 10);
    exterior.add(mount);
    cannonVisuals.push(mount);
  }

  const flagPole = addCylinder(exterior, 0.08, 7.5, darkWood, [0, 8.0, 12.5]);`,
    "cannon models"
  );
  patch(
    "  return { group, exterior, lower, sails, rigX, rigZ };",
    "  return { group, exterior, lower, sails, cannonVisuals, rigX, rigZ };",
    "return cannon visuals"
  );

  patch(
    '  const white = new THREE.MeshStandardMaterial({ color: 0xf6f5ef, roughness: 0.7 });\n  const pupil = new THREE.MeshStandardMaterial({ color: 0x121619, roughness: 0.7 });\n',
    "",
    "old eye materials"
  );
  patch(
    /  for \(const x of \[-0\.12, 0\.12\]\) \{[\s\S]*?  headGroup\.add\(nose\);/,
    `  for (const x of [-0.11, 0.11]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), dark);
    eye.position.set(x, 0.045, 0.335);
    headGroup.add(eye);
  }`,
    "simple eyes"
  );

  patch(
    `    data.walkPhase += Math.min(0.65, moved * 6.6);
    const swing = Math.sin(data.walkPhase) * 0.58;
    data.leftLeg.rotation.x = THREE.MathUtils.lerp(data.leftLeg.rotation.x, swing, 0.45);
    data.rightLeg.rotation.x = THREE.MathUtils.lerp(data.rightLeg.rotation.x, -swing, 0.45);
    data.leftArm.rotation.x = THREE.MathUtils.lerp(data.leftArm.rotation.x, -swing * 0.55, 0.4);
    data.rightArm.rotation.x = THREE.MathUtils.lerp(data.rightArm.rotation.x, swing * 0.55, 0.4);`,
    `    data.walkPhase += Math.min(0.32, moved * 3.0);
    const swing = Math.sin(data.walkPhase) * 0.40;
    data.leftLeg.rotation.x = THREE.MathUtils.lerp(data.leftLeg.rotation.x, swing, 0.25);
    data.rightLeg.rotation.x = THREE.MathUtils.lerp(data.rightLeg.rotation.x, -swing, 0.25);
    data.leftArm.rotation.x = THREE.MathUtils.lerp(data.leftArm.rotation.x, -swing * 0.42, 0.22);
    data.rightArm.rotation.x = THREE.MathUtils.lerp(data.rightArm.rotation.x, swing * 0.42, 0.22);`,
    "walk animation"
  );

  patch(
    `    const lean = Math.sin(now * 0.00135 + (team === "british" ? 0 : 1.7)) * 0.022;
    for (const sail of visual.sails) {
      if (!Number.isFinite(sail.userData.baseRotationY)) sail.userData.baseRotationY = sail.rotation.y;
      sail.rotation.y = sail.userData.baseRotationY + lean;
    }`,
    `    const lean = Math.sin(now * 0.00135 + (team === "british" ? 0 : 1.7)) * 0.022;
    const sailTrim = ship.sailTrim ?? 1;
    const sailScaleX = [0.42, 0.72, 1.0][sailTrim] ?? 0.72;
    const sailScaleY = [0.72, 0.88, 1.0][sailTrim] ?? 0.88;
    for (const sail of visual.sails) {
      if (!Number.isFinite(sail.userData.baseRotationY)) sail.userData.baseRotationY = sail.rotation.y;
      sail.rotation.y = sail.userData.baseRotationY + lean;
      sail.scale.x = THREE.MathUtils.lerp(sail.scale.x, sailScaleX, 0.14);
      sail.scale.y = THREE.MathUtils.lerp(sail.scale.y, sailScaleY, 0.14);
    }
    visual.cannonVisuals?.forEach((mount, index) => {
      const cannon = ship.cannons?.[index];
      if (!cannon) return;
      mount.rotation.y = cannon.side < 0 ? Math.PI + (cannon.aim || 0) : -(cannon.aim || 0);
    });`,
    "visual sails and cannon aim"
  );

  patch(
    `  for (const [id, mesh] of playerMeshes) {
    if (!alive.has(id)) {
      world.remove(mesh);
      playerMeshes.delete(id);
    }
  }

  const local = state.players[localId];`,
    `  for (const [id, mesh] of playerMeshes) {
    if (!alive.has(id)) {
      world.remove(mesh);
      playerMeshes.delete(id);
    }
  }

  const liveShots = new Set();
  for (const shot of state.shots || []) {
    liveShots.add(shot.id);
    let mesh = shotMeshes.get(shot.id);
    if (!mesh) {
      const material = new THREE.MeshStandardMaterial({ color: 0x1b1e20, metalness: 0.58, roughness: 0.34, emissive: 0x24170c, emissiveIntensity: 0.5 });
      mesh = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), material);
      mesh.castShadow = true;
      mesh.position.set(shot.x, shot.y, shot.z);
      world.add(mesh);
      shotMeshes.set(shot.id, mesh);
    } else {
      mesh.position.lerp(new THREE.Vector3(shot.x, shot.y, shot.z), 0.72);
    }
  }
  for (const [id, mesh] of shotMeshes) {
    if (!liveShots.has(id)) {
      world.remove(mesh);
      shotMeshes.delete(id);
    }
  }

  const local = state.players[localId];`,
    "render cannon shots"
  );

  patch(
    `  ui.britishMobility.textContent = \`Mobility \${Math.round(state.ships.british.mobility)}%\`;
  ui.frenchMobility.textContent = \`Mobility \${Math.round(state.ships.french.mobility)}%\`;`,
    `  ui.britishMobility.textContent = \`Mobility \${Math.round(state.ships.british.mobility)}% · Sails \${["Reefed", "Cruising", "Full"][state.ships.british.sailTrim ?? 1]}\`;
  ui.frenchMobility.textContent = \`Mobility \${Math.round(state.ships.french.mobility)}% · Sails \${["Reefed", "Cruising", "Full"][state.ships.french.sailTrim ?? 1]}\`;
  document.querySelector(".ship-panel.british")?.classList.toggle("hidden", localTeam !== "british");
  document.querySelector(".ship-panel.french")?.classList.toggle("hidden", localTeam !== "french");`,
    "own-team ship card"
  );

  patch(
    `    if (p.team === p.ship && rig && near(rig.rigX, rig.rigZ, 2.4)) return { type: "sailmaster", label: "Work the rigging" };
    if (near(0, 3.3, 2.2)) return { type: "down", label: "Go below deck" };`,
    `    if (p.team === p.ship && rig && near(rig.rigX, rig.rigZ, 2.4)) return { type: "sailmaster", label: "Work the rigging" };
    if (p.team === p.ship) {
      const cannons = state.ships[p.ship].cannons || [];
      for (let index = 0; index < cannons.length; index += 1) {
        const cannon = cannons[index];
        if (near(cannon.x, cannon.z, 1.75)) return { type: "cannon", cannonIndex: index, label: "Man cannon" };
      }
    }
    if (near(0, 3.3, 2.2)) return { type: "down", label: "Go below deck" };`,
    "cannon interaction"
  );

  patch(
    `  if (!p?.spawned) {
    ui.touchRigging?.classList.add("hidden");
    return;
  }`,
    `  if (!p?.spawned) {
    ui.touchRigging?.classList.add("hidden");
    ui.touchFire?.classList.add("hidden");
    return;
  }`,
    "hide fire before spawn"
  );
  patch(
    `    ui.prompt.classList.add("hidden");
    ui.touchRigging?.classList.add("hidden");
    return;`,
    `    ui.prompt.classList.add("hidden");
    ui.touchRigging?.classList.add("hidden");
    ui.touchFire?.classList.add("hidden");
    return;`,
    "hide fire in cooldown"
  );
  patch(
    '  else if (p.role === "sailmaster") ui.objective.textContent = `Sailmaster on ${TEAM[p.ship].ship} · Space / SAILS to trim sails · E to leave rigging`;',
    `  else if (p.role === "sailmaster") {
    const trim = ["Reefed", "Cruising", "Full"][state.ships[p.ship].sailTrim ?? 1];
    ui.objective.textContent = \`Sailmaster on \${TEAM[p.ship].ship} · \${trim} sails · Space / SAILS to change · E to leave rigging\`;
  }
  else if (p.role === "gunner") {
    const cannon = state.ships[p.ship].cannons?.[p.cannonIndex];
    const wait = cannon ? Math.max(0, CANNON_COOLDOWN_MS - (Date.now() - (cannon.lastFire || 0))) : 0;
    const reload = wait > 0 ? \` · ready in \${(wait / 1000).toFixed(1)}s\` : " · ready";
    ui.objective.textContent = \`Cannon · A/D aim · Space / FIRE · E to leave\${reload}\`;
  }`,
    "gunner HUD"
  );
  patch(
    '  ui.touchRigging?.classList.toggle("hidden", p.role !== "sailmaster");',
    `  ui.touchRigging?.classList.toggle("hidden", p.role !== "sailmaster");
  if (ui.touchRigging) ui.touchRigging.textContent = p.role === "sailmaster" ? \`SAILS · \${["REEFED", "CRUISE", "FULL"][state.ships[p.ship].sailTrim ?? 1]}\` : "SAILS";
  ui.touchFire?.classList.toggle("hidden", p.role !== "gunner");`,
    "touch sail and fire buttons"
  );

  patch(
    '  const speed = p.deck === "lower" ? 5 : 6.2;',
    '  const speed = p.deck === "lower" ? 4.02 : 4.98;',
    "player speed"
  );
  patch(
    `  const seq = processed.get(p.id) || { interact: 0, grapple: 0, rig: 0 };
  if ((input.interactSeq || 0) > seq.interact) { seq.interact = input.interactSeq; handleInteract(p); }
  if ((input.grappleSeq || 0) > seq.grapple) { seq.grapple = input.grappleSeq; handleGrapple(p); }
  if ((input.rigSeq || 0) > seq.rig) { seq.rig = input.rigSeq; handleRigging(p); }
  processed.set(p.id, seq);`,
    `  const seq = processed.get(p.id) || { interact: 0, grapple: 0, rig: 0, fire: 0 };
  if ((input.interactSeq || 0) > seq.interact) { seq.interact = input.interactSeq; handleInteract(p); }
  if ((input.grappleSeq || 0) > seq.grapple) { seq.grapple = input.grappleSeq; handleGrapple(p); }
  if ((input.rigSeq || 0) > seq.rig) { seq.rig = input.rigSeq; handleRigging(p); }
  if ((input.fireSeq || 0) > seq.fire) { seq.fire = input.fireSeq; handleCannonFire(p); }
  processed.set(p.id, seq);`,
    "process cannon fire input"
  );
  patch(
    `  if (Number.isFinite(input.yaw)) p.yaw = normalizeAngle(input.yaw);
  if (p.role) return;`,
    `  if (Number.isFinite(input.yaw)) p.yaw = normalizeAngle(input.yaw);
  if (p.role === "gunner") {
    const cannon = state.ships[p.ship].cannons?.[p.cannonIndex];
    if (!cannon || cannon.gunner !== p.id) {
      p.role = null;
      p.cannonIndex = null;
      return;
    }
    const turn = (input.d ? 1 : 0) - (input.a ? 1 : 0);
    cannon.aim = THREE.MathUtils.clamp((cannon.aim || 0) + turn * 0.62 * dt, -0.49, 0.49);
    return;
  }
  if (p.role) return;`,
    "cannon aiming"
  );

  patch(
    `    const boost = Date.now() < ship.boostUntil ? 1.18 : 1;
    const mobility = THREE.MathUtils.clamp(ship.mobility / 100, 0.22, 1);
    const desired = throttle * 10.5 * boost * mobility;
    ship.speed += THREE.MathUtils.clamp(desired - ship.speed, -7 * dt, 4 * dt);`,
    `    if ((ship.sailTrim ?? 1) > 0 && Date.now() >= (ship.sailDecayAt || 0)) {
      ship.sailTrim = Math.max(0, (ship.sailTrim ?? 1) - 1);
      ship.sailDecayAt = ship.sailTrim > 0 ? Date.now() + 20000 : 0;
    }
    const sailTrim = ship.sailTrim ?? 1;
    const sailPower = [0.55, 0.78, 1.0][sailTrim] ?? 0.78;
    const mobility = THREE.MathUtils.clamp(ship.mobility / 100, 0.22, 1);
    const desired = throttle * 6.03 * sailPower * mobility;
    ship.speed += THREE.MathUtils.clamp(desired - ship.speed, -4.32 * dt, 2.43 * dt);`,
    "ship handling and sail decay"
  );

  patch(
    `  if (action.type === "sailmaster") {
    const ship = state.ships[p.ship];
    if (ship.sailmaster && ship.sailmaster !== p.id) return personal(p.id, "The rigging station is occupied.");
    const rig = shipMeshes[p.ship];
    releaseRole(p.id);
    ship.sailmaster = p.id;
    p.role = "sailmaster";
    p.x = rig?.rigX ?? -2.15;
    p.z = rig?.rigZ ?? -2.2;
  }
  if (action.type === "down")`,
    `  if (action.type === "sailmaster") {
    const ship = state.ships[p.ship];
    if (ship.sailmaster && ship.sailmaster !== p.id) return personal(p.id, "The rigging station is occupied.");
    const rig = shipMeshes[p.ship];
    releaseRole(p.id);
    ship.sailmaster = p.id;
    p.role = "sailmaster";
    p.x = rig?.rigX ?? -2.15;
    p.z = rig?.rigZ ?? -2.2;
  }
  if (action.type === "cannon") {
    const ship = state.ships[p.ship];
    const cannon = ship.cannons?.[action.cannonIndex];
    if (!cannon) return;
    if (cannon.gunner && cannon.gunner !== p.id) return personal(p.id, "That cannon is occupied.");
    releaseRole(p.id);
    cannon.gunner = p.id;
    p.role = "gunner";
    p.cannonIndex = action.cannonIndex;
    p.x = cannon.x - cannon.side * 0.78;
    p.z = cannon.z;
  }
  if (action.type === "down")`,
    "take cannon station"
  );
  patch(
    `  for (const ship of Object.values(state.ships)) {
    if (ship.captain === id) ship.captain = null;
    if (ship.sailmaster === id) ship.sailmaster = null;
  }
  p.role = null;`,
    `  for (const ship of Object.values(state.ships)) {
    if (ship.captain === id) ship.captain = null;
    if (ship.sailmaster === id) ship.sailmaster = null;
    for (const cannon of ship.cannons || []) if (cannon.gunner === id) cannon.gunner = null;
  }
  p.role = null;
  p.cannonIndex = null;`,
    "release cannon station"
  );

  patch(
    /function handleRigging\(p\) \{[\s\S]*?\n\}/,
    `function handleRigging(p) {
  if (p.role !== "sailmaster" || state.phase !== "playing") return;
  const ship = state.ships[p.ship];
  if (ship.sailmaster !== p.id) return;
  const labels = ["Reefed", "Cruising", "Full"];
  ship.sailTrim = ((ship.sailTrim ?? 1) + 1) % labels.length;
  ship.boostUntil = 0;
  ship.sailDecayAt = ship.sailTrim > 0 ? Date.now() + 20000 : 0;
  personal(p.id, "Sails set to " + labels[ship.sailTrim] + ".");
}`,
    "sail controls"
  );

  patch(
    "function handleGrapple(p) {",
    `function cannonDirection(ship, cannon) {
  const aim = THREE.MathUtils.clamp(cannon.aim || 0, -0.49, 0.49);
  const rightX = Math.cos(ship.heading);
  const rightZ = -Math.sin(ship.heading);
  const forwardX = Math.sin(ship.heading);
  const forwardZ = Math.cos(ship.heading);
  return {
    x: rightX * cannon.side * Math.cos(aim) + forwardX * Math.sin(aim),
    z: rightZ * cannon.side * Math.cos(aim) + forwardZ * Math.sin(aim)
  };
}

function handleCannonFire(p) {
  if (p.role !== "gunner" || state.phase !== "playing") return;
  const ship = state.ships[p.ship];
  const cannon = ship.cannons?.[p.cannonIndex];
  if (!cannon || cannon.gunner !== p.id) return;
  const now = Date.now();
  if (now - (cannon.lastFire || 0) < CANNON_COOLDOWN_MS) return;

  const direction = cannonDirection(ship, cannon);
  const origin = toWorld(ship, cannon.x + cannon.side * 1.05, cannon.z, 5.02);
  cannon.lastFire = now;
  state.shots ||= [];
  state.shots.push({
    id: p.id + "-" + now + "-" + Math.floor(Math.random() * 1000),
    team: p.team,
    owner: p.id,
    x: origin.x,
    y: origin.y,
    z: origin.z,
    vx: direction.x * CANNON_SHOT_SPEED,
    vz: direction.z * CANNON_SHOT_SPEED,
    born: now
  });
}

function pointInsideShip(ship, x, z) {
  const dx = x - ship.x;
  const dz = z - ship.z;
  const c = Math.cos(ship.heading);
  const s = Math.sin(ship.heading);
  const localX = dx * c - dz * s;
  const localZ = dx * s + dz * c;
  return Math.abs(localX) <= SHIP_HALF_WIDTH + 0.45 && Math.abs(localZ) <= SHIP_HALF_LENGTH + 0.6;
}

function simulateShots(dt) {
  state.shots ||= [];
  const now = Date.now();
  for (let i = state.shots.length - 1; i >= 0; i -= 1) {
    const shot = state.shots[i];
    shot.x += shot.vx * dt;
    shot.z += shot.vz * dt;
    if (now - shot.born > CANNON_SHOT_TTL) {
      state.shots.splice(i, 1);
      continue;
    }
    const enemy = shot.team === "british" ? "french" : "british";
    const target = state.ships[enemy];
    if (!target || !pointInsideShip(target, shot.x, shot.z)) continue;
    target.mobility = Math.max(25, target.mobility - CANNON_DAMAGE);
    state.shots.splice(i, 1);
    const shooter = state.players[shot.owner];
    if (shooter) personal(shooter.id, "Hit — enemy mobility " + Math.round(target.mobility) + "%.");
  }
}

function handleGrapple(p) {`,
    "cannon firing and hit simulation"
  );

  patch(
    `  return {
    w: keys.w || touch.y < -0.18,
    s: keys.s || touch.y > 0.18,
    a: keys.a || touch.x < -0.18,
    d: keys.d || touch.x > 0.18,
    yaw: viewYaw,
    interactSeq: seqInteract,
    grappleSeq: seqGrapple,
    rigSeq: seqRig
  };`,
    `  return {
    w: keys.w || touch.y < -0.18,
    s: keys.s || touch.y > 0.18,
    a: keys.a || touch.x < -0.18,
    d: keys.d || touch.x > 0.18,
    yaw: viewYaw,
    interactSeq: seqInteract,
    grappleSeq: seqGrapple,
    rigSeq: seqRig,
    fireSeq: seqFire
  };`,
    "fire input snapshot"
  );

  patch(
    '  if (k === " " && !e.repeat) seqRig += 1;',
    '  if (k === " " && !e.repeat) {\n    if (state?.players?.[localId]?.role === "gunner") seqFire += 1;\n    else seqRig += 1;\n  }',
    "keyboard cannon fire"
  );
  patch(
    'ui.touchRigging.onpointerdown = (e) => { e.preventDefault(); if (state?.phase === "playing") seqRig += 1; };',
    'ui.touchRigging.onpointerdown = (e) => { e.preventDefault(); if (state?.phase === "playing") seqRig += 1; };\nif (ui.touchFire) ui.touchFire.onpointerdown = (e) => { e.preventDefault(); if (state?.phase === "playing") seqFire += 1; };',
    "touch cannon fire"
  );

  patch(
    `  for (const ship of Object.values(state.ships)) {
    ship.speed = 0;
    ship.captain = null;
    ship.sailmaster = null;
    ship.boostUntil = 0;
  }`,
    `  for (const ship of Object.values(state.ships)) {
    ship.speed = 0;
    ship.captain = null;
    ship.sailmaster = null;
    ship.boostUntil = 0;
    for (const cannon of ship.cannons || []) cannon.gunner = null;
  }
  state.shots = [];`,
    "clear cannons after battle"
  );
  patch(
    '  state.ships = { british: freshShip("british"), french: freshShip("french") };',
    '  state.ships = { british: freshShip("british"), french: freshShip("french") };\n  state.shots = [];',
    "reset cannon state"
  );
  patch(
    '    processed.set(p.id, { interact: input.interactSeq || 0, grapple: input.grappleSeq || 0, rig: input.rigSeq || 0 });',
    '    processed.set(p.id, { interact: input.interactSeq || 0, grapple: input.grappleSeq || 0, rig: input.rigSeq || 0, fire: input.fireSeq || 0 });',
    "reset fire input sequence"
  );

  patch(
    `function updateCaptainCompass(p) {
  const compass = document.querySelector("#captainCompass");
  if (!compass) return;
  const active = Boolean(p?.spawned && p.role === "captain" && state?.phase === "playing");
  compass.classList.toggle("hidden", !active);
  if (!active) return;

  const ship = state.ships[p.ship];
  const heading = ((THREE.MathUtils.radToDeg(ship.heading) % 360) + 360) % 360;
  const halfView = 62.5;
  for (const mark of compass.querySelectorAll("[data-bearing]")) {
    const bearing = Number(mark.dataset.bearing);
    const diff = ((bearing - heading + 540) % 360) - 180;
    const visible = Math.abs(diff) <= halfView;
    mark.style.display = visible ? "block" : "none";
    if (!visible) continue;
    mark.style.left = (50 + (diff / halfView) * 50) + "%";
    const edge = Math.abs(diff) / halfView;
    mark.style.opacity = String(Math.max(0.16, 1 - edge * edge));
  }
}

function normalizeAngle(value) { return Math.atan2(Math.sin(value), Math.cos(value)); }`,
    `function updateCaptainCompass(p) {
  const compass = document.querySelector("#captainCompass");
  if (!compass) return;
  const active = Boolean(p?.spawned && p.role === "captain" && state?.phase === "playing");
  compass.classList.toggle("hidden", !active);
  if (!active) return;

  const ship = state.ships[p.ship];
  const heading = ((THREE.MathUtils.radToDeg(ship.heading) % 360) + 360) % 360;
  const halfView = 62.5;
  for (const mark of compass.querySelectorAll("[data-bearing]")) {
    const bearing = Number(mark.dataset.bearing);
    const diff = ((bearing - heading + 540) % 360) - 180;
    const visible = Math.abs(diff) <= halfView;
    mark.style.display = visible ? "block" : "none";
    if (!visible) continue;
    mark.style.left = (50 + (diff / halfView) * 50) + "%";
    const edge = Math.abs(diff) / halfView;
    mark.style.opacity = String(Math.max(0.16, 1 - edge * edge));
  }
}

function normalizeAngle(value) { return Math.atan2(Math.sin(value), Math.cos(value)); }`,
    "captain compass retained"
  );
  patch(
    'function normalizeAngle(value) { return Math.atan2(Math.sin(value), Math.cos(value)); }',
    `function updateCaptainCompass(p) {
  const compass = document.querySelector("#captainCompass");
  if (!compass) return;
  const active = Boolean(p?.spawned && p.role === "captain" && state?.phase === "playing");
  compass.classList.toggle("hidden", !active);
  if (!active) return;
  const ship = state.ships[p.ship];
  const heading = ((THREE.MathUtils.radToDeg(ship.heading) % 360) + 360) % 360;
  const halfView = 62.5;
  for (const mark of compass.querySelectorAll("[data-bearing]")) {
    const bearing = Number(mark.dataset.bearing);
    const diff = ((bearing - heading + 540) % 360) - 180;
    const visible = Math.abs(diff) <= halfView;
    mark.style.display = visible ? "block" : "none";
    if (!visible) continue;
    mark.style.left = (50 + (diff / halfView) * 50) + "%";
    const edge = Math.abs(diff) / halfView;
    mark.style.opacity = String(Math.max(0.16, 1 - edge * edge));
  }
}

function normalizeAngle(value) { return Math.atan2(Math.sin(value), Math.cos(value)); }`,
    "captain compass function"
  );
  patch(
    `  updateObjective(local);
  if (state.phase === "cooldown") updateCooldownUi();`,
    `  updateObjective(local);
  updateCaptainCompass(local);
  if (state.phase === "cooldown") updateCooldownUi();`,
    "captain compass update"
  );

  patch(
    `      simulateShips(dt);
    } else if (state.phase === "cooldown" && Date.now() >= state.resetAt) {`,
    `      simulateShips(dt);
      simulateShots(dt);
    } else if (state.phase === "cooldown" && Date.now() >= state.resetAt) {`,
    "simulate cannon shots"
  );

  const moduleUrl = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
  try {
    await import(moduleUrl);
  } finally {
    URL.revokeObjectURL(moduleUrl);
  }
}

boot().catch(showBootError);
