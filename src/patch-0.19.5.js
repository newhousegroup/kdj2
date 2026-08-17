export function patchGameSource(source) {
  function replaceRequired(search, replacement, label) {
    if (!source.includes(search)) throw new Error(`0.19.5 patch failed: ${label}`);
    source = source.replace(search, replacement);
  }

  // Feedback 1: derive the enemy marker directly in ship-local space instead of
  // converting through the historical heading/compass convention. Positive angle
  // is starboard/right, negative is port/left.
  replaceRequired(
    '    const enemyBearing = ((THREE.MathUtils.radToDeg(Math.atan2(enemyShip.x - ship.x, enemyShip.z - ship.z)) % 360) + 360) % 360;\n    const enemyDiff = ((enemyBearing - heading + 540) % 360) - 180;',
    `    const enemyDx = enemyShip.x - ship.x;
    const enemyDz = enemyShip.z - ship.z;
    const forwardX = -Math.sin(ship.heading);
    const forwardZ = -Math.cos(ship.heading);
    const rightX = Math.cos(ship.heading);
    const rightZ = -Math.sin(ship.heading);
    const enemyForward = enemyDx * forwardX + enemyDz * forwardZ;
    const enemyRight = enemyDx * rightX + enemyDz * rightZ;
    const enemyDiff = THREE.MathUtils.radToDeg(Math.atan2(enemyRight, enemyForward));`,
    'enemy compass direction'
  );

  // Feedback 2: give each named vessel a readable condition rather than presenting
  // mobility as a bare number. This is deliberately descriptive only; combat
  // balance and mobility values are unchanged.
  replaceRequired(
    'function renderState(now = performance.now()) {',
    `function shipConditionLabel(mobility) {
  const m = Number(mobility || 0);
  if (m <= 0) return "Lost";
  if (m <= 25) return "Critical";
  if (m <= 50) return "Wounded";
  if (m <= 75) return "Scarred";
  return "Sound";
}

function renderState(now = performance.now()) {`,
    'ship condition helper'
  );

  replaceRequired(
    '  ui.britishMobility.textContent = `Mobility ${Math.round(state.ships.british.mobility)}% · Sails ${["Reefed", "Cruising", "Full"][state.ships.british.sailTrim ?? 1]}`;\n  ui.frenchMobility.textContent = `Mobility ${Math.round(state.ships.french.mobility)}% · Sails ${["Reefed", "Cruising", "Full"][state.ships.french.sailTrim ?? 1]}`;',
    '  ui.britishMobility.textContent = `Condition ${shipConditionLabel(state.ships.british.mobility)} · Mobility ${Math.round(state.ships.british.mobility)}% · Sails ${["Reefed", "Cruising", "Full"][state.ships.british.sailTrim ?? 1]}`;\n  ui.frenchMobility.textContent = `Condition ${shipConditionLabel(state.ships.french.mobility)} · Mobility ${Math.round(state.ships.french.mobility)}% · Sails ${["Reefed", "Cruising", "Full"][state.ships.french.sailTrim ?? 1]}`;',
    'named ship condition HUD'
  );

  replaceRequired(
    '  else ui.objective.textContent = `Battle ${state.round || 1} · capture the enemy flag below deck.`;',
    '  else ui.objective.textContent = `Protect ${TEAM[p.team].ship} · keep her afloat · capture the enemy flag or destroy their ship.`;',
    'ship stewardship objective'
  );

  // Carry the post-hit mobility value with the existing lightweight impact event so
  // every member of the struck crew can immediately feel their own ship react.
  replaceRequired(
    '    event({ kind: "cannonImpact", x: shot.x, y: shot.y, z: shot.z, team: enemy, destroyed });',
    '    event({ kind: "cannonImpact", x: shot.x, y: shot.y, z: shot.z, team: enemy, destroyed, mobility: target.mobility });',
    'cannon impact mobility payload'
  );

  replaceRequired(
    '  if (e.kind === "cannonImpact") cannonImpactFx.push({ ...e, start: performance.now() });',
    `  if (e.kind === "cannonImpact") {
    cannonImpactFx.push({ ...e, start: performance.now() });
    if (e.team === localTeam) {
      const shipName = TEAM[e.team]?.ship || "Our ship";
      const mobility = Math.max(0, Math.round(Number(e.mobility ?? state?.ships?.[e.team]?.mobility ?? 0)));
      showToast(e.destroyed
        ? shipName + " is lost."
        : shipName + " shudders — " + mobility + "% mobility. Keep her afloat.", 2700);
    }
  }`,
    'crew ship-hit feedback'
  );

  // Persistent but very cheap damage smoke: two sprites per ship, created once and
  // only shown below 70% mobility. It makes accumulated damage visible without a
  // particle system, simulation, or extra networking.
  replaceRequired(
    'function makeShip(team) {',
    `const shipDamageSmokeTexture = canvasTexture(64, (ctx, s) => {
  const c = s / 2;
  const g = ctx.createRadialGradient(c, c, 0, c, c, c);
  g.addColorStop(0, "rgba(255,255,255,0.86)");
  g.addColorStop(0.28, "rgba(220,225,226,0.56)");
  g.addColorStop(0.68, "rgba(145,153,157,0.18)");
  g.addColorStop(1, "rgba(90,98,102,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
});

function makeShip(team) {`,
    'damage smoke texture'
  );

  replaceRequired(
    '  deck.receiveShadow = true;\n  world.add(group);\n  return { group, exterior, lower, sails, cannonVisuals, rigX, rigZ };',
    `  deck.receiveShadow = true;

  const damageSmokeMaterial = new THREE.SpriteMaterial({
    map: shipDamageSmokeTexture,
    color: 0x42494d,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    fog: true
  });
  const damageSmoke = new THREE.Group();
  for (const [x, y, z, scale] of [[-1.45, 5.25, -2.8, 3.2], [1.25, 5.05, 4.6, 2.8]]) {
    const puff = new THREE.Sprite(damageSmokeMaterial);
    puff.position.set(x, y, z);
    puff.scale.set(scale, scale, 1);
    puff.userData.baseY = y;
    puff.userData.baseScale = scale;
    damageSmoke.add(puff);
  }
  damageSmoke.visible = false;
  exterior.add(damageSmoke);

  world.add(group);
  return { group, exterior, lower, sails, cannonVisuals, damageSmoke, damageSmokeMaterial, rigX, rigZ };`,
    'persistent ship damage smoke'
  );

  replaceRequired(
    '    visual.group.rotation.y = ship.heading;',
    `    visual.group.rotation.y = ship.heading;
    if (visual.damageSmoke && visual.damageSmokeMaterial) {
      const damageStrength = THREE.MathUtils.clamp((70 - Number(ship.mobility || 0)) / 70, 0, 1);
      visual.damageSmoke.visible = damageStrength > 0.01 && ship.destroyed !== true;
      visual.damageSmokeMaterial.opacity = 0.06 + damageStrength * 0.22;
      visual.damageSmoke.children.forEach((puff, index) => {
        const phase = now * 0.00115 + index * 2.2;
        puff.position.y = puff.userData.baseY + Math.sin(phase) * 0.16;
        const breathe = puff.userData.baseScale * (1 + damageStrength * 0.28 + Math.sin(phase * 0.73) * 0.045);
        puff.scale.set(breathe, breathe, 1);
      });
    }`,
    'damage smoke rendering'
  );

  return source;
}
