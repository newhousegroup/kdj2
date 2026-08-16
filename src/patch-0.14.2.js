export function patchGameSource(source) {
  function replaceRequired(search, replacement, label) {
    if (!source.includes(search)) throw new Error(`0.14.2 patch failed: ${label}`);
    source = source.replace(search, replacement);
  }

  function replaceBetween(startMarker, endMarker, replacement, label) {
    const start = source.indexOf(startMarker);
    if (start < 0) throw new Error(`0.14.2 patch failed: ${label} start`);
    const end = source.indexOf(endMarker, start);
    if (end < 0) throw new Error(`0.14.2 patch failed: ${label} end`);
    source = source.slice(0, start) + replacement + source.slice(end);
  }

  // 0.14.2 intentionally restores only the safe HUD changes. No online-members code,
  // water state, grappling changes, player-render changes, movement changes, or camera changes.
  replaceRequired(
    'let seenRound = 0;',
    'let seenRound = 0;\nlet objectiveRoundShown = 0;\nlet objectiveVisibleUntil = 0;',
    'battle intro timer state'
  );

  replaceRequired(
    '  const local = state.players[localId];\n  updateHealthHud(local);\n  for (const team of ["british", "french"]) {',
    '  const local = state.players[localId];\n  if (local?.team && TEAM[local.team]) {\n    localTeam = local.team;\n    const badgeText = TEAM[local.team].label;\n    const badgeClass = `team-badge ${local.team}`;\n    if (ui.teamBadge.textContent !== badgeText) ui.teamBadge.textContent = badgeText;\n    if (ui.teamBadge.className !== badgeClass) ui.teamBadge.className = badgeClass;\n  }\n  updateHealthHud(local);\n  for (const team of ["british", "french"]) {',
    'authoritative team badge'
  );

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
  } else ui.prompt.classList.add("hidden");
  ui.touchRigging?.classList.toggle("hidden", p.role !== "sailmaster");
  if (ui.touchRigging) ui.touchRigging.textContent = p.role === "sailmaster" ? \`SAILS · \${["REEFED", "CRUISE", "FULL"][state.ships[p.ship].sailTrim ?? 1]}\` : "SAILS";
  ui.touchFire?.classList.toggle("hidden", p.role !== "gunner");
  ui.touchSword?.classList.toggle("hidden", Boolean(p.role) || p.alive === false);
}

`,
    'battle objective lifecycle'
  );

  return source;
}
