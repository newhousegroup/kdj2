export function patchGameSource(source) {
  function replaceRequired(search, replacement, label) {
    if (!source.includes(search)) throw new Error(`0.14.1 patch failed: ${label}`);
    source = source.replace(search, replacement);
  }

  function replaceBetween(startMarker, endMarker, replacement, label) {
    const start = source.indexOf(startMarker);
    if (start < 0) throw new Error(`0.14.1 patch failed: ${label} start`);
    const end = source.indexOf(endMarker, start);
    if (end < 0) throw new Error(`0.14.1 patch failed: ${label} end`);
    source = source.slice(0, start) + replacement + source.slice(end);
  }

  // Safe 0.14.1 UI-only restoration. Deliberately no water state, grapple changes,
  // player rendering changes, movement changes, or camera changes.
  replaceRequired(
    'deathNotice: $("#deathNotice")',
    'deathNotice: $("#deathNotice"), membersBtn: $("#membersBtn"), membersPanel: $("#membersPanel"), membersList: $("#membersList")',
    'online member UI bindings'
  );

  replaceRequired(
    'let seenRound = 0;',
    'let seenRound = 0;\nlet objectiveRoundShown = 0;\nlet objectiveVisibleUntil = 0;',
    'battle intro timer state'
  );

  replaceRequired(
    '  const local = state.players[localId];\n  updateHealthHud(local);\n  for (const team of ["british", "french"]) {',
    '  const local = state.players[localId];\n  if (local?.team && TEAM[local.team]) {\n    localTeam = local.team;\n    const badgeText = TEAM[local.team].label;\n    const badgeClass = `team-badge ${local.team}`;\n    if (ui.teamBadge.textContent !== badgeText) ui.teamBadge.textContent = badgeText;\n    if (ui.teamBadge.className !== badgeClass) ui.teamBadge.className = badgeClass;\n  }\n  updateHealthHud(local);\n  updateMembersPanel(local, now);\n  for (const team of ["british", "french"]) {',
    'authoritative team badge and members refresh'
  );

  replaceRequired(
    'function interaction(p) {',
    `let membersPanelLastUpdate = 0;
let membersPanelSignature = "";

function updateMembersPanel(local, now = performance.now(), force = false) {
  if (!state?.players) return;
  const players = Object.values(state.players);

  if (ui.membersBtn) {
    const label = "Players " + players.length;
    if (ui.membersBtn.textContent !== label) ui.membersBtn.textContent = label;
  }

  if (!ui.membersList || !ui.membersPanel || ui.membersPanel.classList.contains("hidden")) return;
  if (!force && now - membersPanelLastUpdate < 300) return;
  membersPanelLastUpdate = now;

  const signature = players.map((member) => [
    member.id,
    member.name || "",
    member.team || "",
    member.ship || "",
    member.deck || "",
    member.role || "",
    member.alive === false ? 0 : 1,
    member.spawned ? 1 : 0
  ].join(":" )).join("|");
  if (!force && signature === membersPanelSignature) return;
  membersPanelSignature = signature;

  const fragment = document.createDocumentFragment();
  for (const member of players) {
    const teamKey = TEAM[member.team] ? member.team : "british";
    const shipName = TEAM[member.ship]?.ship || "Not deployed";
    const row = document.createElement("div");
    row.className = "member-row " + teamKey;

    const identity = document.createElement("div");
    identity.className = "member-identity";
    const dot = document.createElement("span");
    dot.className = "member-team-dot " + teamKey;
    const name = document.createElement("strong");
    name.textContent = (member.name || "Sailor") + (member.id === localId ? " · You" : "");
    identity.append(dot, name);

    const status = document.createElement("span");
    status.className = "member-status";
    if (member.alive === false) status.textContent = "Out this battle";
    else if (!member.spawned) status.textContent = "Deploying";
    else if (member.role === "captain") status.textContent = "Captain · " + shipName;
    else if (member.role === "sailmaster") status.textContent = "Sailmaster · " + shipName;
    else if (member.role === "gunner") status.textContent = "Gunner · " + shipName;
    else status.textContent = (member.deck === "lower" ? "Lower deck · " : "Deck · ") + shipName;

    row.append(identity, status);
    fragment.appendChild(row);
  }
  ui.membersList.replaceChildren(fragment);
}

function interaction(p) {`,
    'throttled online members renderer'
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
  } else {
    ui.prompt.classList.add("hidden");
  }
  ui.touchRigging?.classList.toggle("hidden", p.role !== "sailmaster");
  if (ui.touchRigging) ui.touchRigging.textContent = p.role === "sailmaster" ? \`SAILS · \${["REEFED", "CRUISE", "FULL"][state.ships[p.ship].sailTrim ?? 1]}\` : "SAILS";
  ui.touchFire?.classList.toggle("hidden", p.role !== "gunner");
  ui.touchSword?.classList.toggle("hidden", Boolean(p.role) || p.alive === false);
}

`,
    'battle objective lifecycle'
  );

  replaceRequired(
    'ui.settings.onclick = openSettings;',
    'if (ui.membersBtn && ui.membersPanel) ui.membersBtn.onclick = () => {\n  const opening = ui.membersPanel.classList.contains("hidden");\n  ui.membersPanel.classList.toggle("hidden");\n  if (opening) updateMembersPanel(state?.players?.[localId] || null, performance.now(), true);\n};\nui.settings.onclick = openSettings;',
    'members panel toggle'
  );

  return source;
}
