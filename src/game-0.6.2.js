const BASE_URL = new URL("./game-0.5.js?v=0.5.0", import.meta.url);

function showBootError(error) {
  console.error("KDJ2 0.6.2 boot failed", error);
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
    if (next === source) throw new Error(`0.6.2 patch failed: ${label}`);
    source = next;
  }

  patch("const RESET_MS = 10000;", "const RESET_MS = 6000;", "round reset time");

  patch(
    /function freshShip\(team\) \{[\s\S]*?\n\}/,
    `function freshShip(team) {
  const sailDecayAt = Date.now() + 20000;
  return team === "british"
    ? { x: -150, z: 0, heading: Math.PI / 2, speed: 0, mobility: 100, captain: null, sailmaster: null, boostUntil: 0, sailTrim: 1, sailDecayAt }
    : { x: 150, z: 0, heading: -Math.PI / 2, speed: 0, mobility: 100, captain: null, sailmaster: null, boostUntil: 0, sailTrim: 1, sailDecayAt };
}`,
    "starting ships"
  );

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
    '  const speed = p.deck === "lower" ? 5 : 6.2;',
    '  const speed = p.deck === "lower" ? 4.02 : 4.98;',
    "player speed"
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
    }`,
    "visual sail trim"
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
    '  else if (p.role === "sailmaster") ui.objective.textContent = `Sailmaster on ${TEAM[p.ship].ship} · Space / SAILS to trim sails · E to leave rigging`;',
    `  else if (p.role === "sailmaster") {
    const trim = ["Reefed", "Cruising", "Full"][state.ships[p.ship].sailTrim ?? 1];
    ui.objective.textContent = \`Sailmaster on \${TEAM[p.ship].ship} · \${trim} sails · Space / SAILS to change · E to leave rigging\`;
  }`,
    "sailmaster HUD"
  );
  patch(
    '  ui.touchRigging?.classList.toggle("hidden", p.role !== "sailmaster");',
    `  ui.touchRigging?.classList.toggle("hidden", p.role !== "sailmaster");
  if (ui.touchRigging) ui.touchRigging.textContent = p.role === "sailmaster" ? \`SAILS · \${["REEFED", "CRUISE", "FULL"][state.ships[p.ship].sailTrim ?? 1]}\` : "SAILS";`,
    "touch sail label"
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

  const moduleUrl = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
  try {
    await import(moduleUrl);
  } finally {
    URL.revokeObjectURL(moduleUrl);
  }
}

boot().catch(showBootError);
