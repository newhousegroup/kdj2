export function patchGameSource(source) {
  function replaceRequired(search, replacement, label) {
    if (!source.includes(search)) throw new Error(`0.13.1 patch failed: ${label}`);
    source = source.replace(search, replacement);
  }

  function replaceBetween(startMarker, endMarker, replacement, label) {
    const start = source.indexOf(startMarker);
    if (start < 0) throw new Error(`0.13.1 patch failed: ${label} start`);
    const end = source.indexOf(endMarker, start);
    if (end < 0) throw new Error(`0.13.1 patch failed: ${label} end`);
    source = source.slice(0, start) + replacement + source.slice(end);
  }

  // 0.13.0 rebuilt the complete online-player DOM on every render frame, even while
  // the panel was hidden. On mobile/tablet this could monopolize the main thread and
  // make the WebGL view appear frozen. Keep the button count live, but only build rows
  // while the panel is actually open, at most four times per second, and only when the
  // roster/status signature changed.
  replaceBetween(
    'function updateMembersPanel(local) {',
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
  if (!force && now - membersPanelLastUpdate < 250) return;
  membersPanelLastUpdate = now;

  const signature = players.map((member) => [
    member.id,
    member.name,
    member.team,
    member.ship,
    member.deck,
    member.role || "",
    member.alive === false ? 0 : 1,
    member.inWater ? 1 : 0,
    member.spawned ? 1 : 0
  ].join(":" )).join("|");
  if (!force && signature === membersPanelSignature) return;
  membersPanelSignature = signature;

  const fragment = document.createDocumentFragment();
  for (const member of players) {
    const teamKey = TEAM[member.team] ? member.team : "british";
    const shipName = TEAM[member.ship]?.ship || "Unknown ship";
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
    else if (member.inWater) status.textContent = "In the water";
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

`,
    'throttled online members renderer'
  );

  // Avoid needless DOM writes for the team badge on every frame as well.
  replaceRequired(
    '  if (local?.team) {\n    localTeam = local.team;\n    ui.teamBadge.textContent = TEAM[local.team].label;\n    ui.teamBadge.className = `team-badge ${local.team}`;\n  }',
    '  if (local?.team && TEAM[local.team]) {\n    localTeam = local.team;\n    const badgeText = TEAM[local.team].label;\n    const badgeClass = `team-badge ${local.team}`;\n    if (ui.teamBadge.textContent !== badgeText) ui.teamBadge.textContent = badgeText;\n    if (ui.teamBadge.className !== badgeClass) ui.teamBadge.className = badgeClass;\n  }',
    'cheap authoritative team badge refresh'
  );

  // Populate immediately when the user opens the panel, then let the throttled refresh
  // take over. Closing the panel returns the per-frame cost to essentially zero.
  replaceRequired(
    'if (ui.membersBtn && ui.membersPanel) ui.membersBtn.onclick = () => { ui.membersPanel.classList.toggle("hidden"); };',
    'if (ui.membersBtn && ui.membersPanel) ui.membersBtn.onclick = () => {\n  const opening = ui.membersPanel.classList.contains("hidden");\n  ui.membersPanel.classList.toggle("hidden");\n  if (opening) updateMembersPanel(state?.players?.[localId] || null, performance.now(), true);\n};',
    'members panel open refresh'
  );

  return source;
}
