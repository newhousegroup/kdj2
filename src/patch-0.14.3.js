export function patchGameSource(source) {
  const search = '  const local = state.players[localId];\n  updateHealthHud(local);\n  for (const team of ["british", "french"]) {';
  const replacement = '  const local = state.players[localId];\n  if (local?.team && TEAM[local.team]) {\n    localTeam = local.team;\n    const badgeText = TEAM[local.team].label;\n    const badgeClass = `team-badge ${local.team}`;\n    if (ui.teamBadge.textContent !== badgeText) ui.teamBadge.textContent = badgeText;\n    if (ui.teamBadge.className !== badgeClass) ui.teamBadge.className = badgeClass;\n  }\n  updateHealthHud(local);\n  for (const team of ["british", "french"]) {';
  if (!source.includes(search)) throw new Error('0.14.3 patch failed: authoritative team badge marker');
  return source.replace(search, replacement);
}
