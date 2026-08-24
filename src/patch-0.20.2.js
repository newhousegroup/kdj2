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

  // Battle 1 keeps the original mission copy, minus "keep her afloat". From
  // battle 2 onward the ordinary top pill becomes the persistent match score.
  replaceRequired(
    '  else ui.objective.textContent = `Protect ${TEAM[p.team].ship} · keep her afloat · capture the enemy flag or destroy their ship.`;',
    '  else ui.objective.textContent = (state.round || 1) > 1\n    ? `British ${Number(state.score?.british || 0)} - ${Number(state.score?.french || 0)} French`\n    : `Protect ${TEAM[p.team].ship} · capture the enemy flag or destroy their ship.`;',
    'round-one objective and later scoreboard'
  );

  return source;
}
