export function patchGameSource(source) {
  function replaceRequired(search, replacement, label) {
    if (!source.includes(search)) throw new Error(`0.20.2 patch failed: ${label}`);
    source = source.replace(search, replacement);
  }

  // Keep a host-authoritative match score in the same state object that is already
  // synchronized to every guest. It survives resetRound because only ships/players
  // are refreshed between battles.
  replaceRequired(
    '    phase: "playing", round: 1, winner: null, loser: null, resetAt: 0,',
    '    phase: "playing", round: 1, winner: null, loser: null, resetAt: 0,\n    score: { british: 0, french: 0 },',
    'initial match score'
  );

  replaceRequired(
    '  state.winner = winner;\n  state.loser = loser;\n  state.winReason = reason;',
    '  state.winner = winner;\n  state.loser = loser;\n  state.score ||= { british: 0, french: 0 };\n  if (winner === "british" || winner === "french") state.score[winner] = Number(state.score[winner] || 0) + 1;\n  state.winReason = reason;',
    'increment match score'
  );

  // From battle 2 onward the top objective pill is the scoreboard, even while a
  // player is occupying a station. Battle 1 keeps all existing contextual copy.
  replaceRequired(
    '  if (p.role === "captain") ui.objective.textContent = `Captain of ${TEAM[p.ship].ship} · WASD to steer · E to leave helm`;',
    '  if ((state.round || 1) > 1) ui.objective.textContent = `British ${Number(state.score?.british || 0)} - ${Number(state.score?.french || 0)} French`;\n  else if (p.role === "captain") ui.objective.textContent = `Captain of ${TEAM[p.ship].ship} · WASD to steer · E to leave helm`;',
    'persistent later-round scoreboard'
  );

  // On the first battle remove only the requested phrase; the rest of the mission
  // wording remains unchanged.
  replaceRequired(
    '  else ui.objective.textContent = `Protect ${TEAM[p.team].ship} · keep her afloat · capture the enemy flag or destroy their ship.`;',
    '  else ui.objective.textContent = `Protect ${TEAM[p.team].ship} · capture the enemy flag or destroy their ship.`;',
    'round-one mission copy'
  );

  return source;
}
