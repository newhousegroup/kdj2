export function patchGameSource(source) {
  function replaceRequired(search, replacement, label) {
    if (!source.includes(search)) throw new Error(`0.20.6 patch failed: ${label}`);
    source = source.replace(search, replacement);
  }

  // 0.17.3 swapped desktop A/D while leaving touch alone. Combined with the
  // later speed-dependent helm sign, keyboard and joystick could disagree and
  // steering could reverse after the ship crossed through zero speed.
  // Restore one input convention for both devices: A/left -> a, D/right -> d.
  replaceRequired(
    '    // Desktop keyboard steering/strafe correction: testers reported A/D mirrored.\n    // Swap keyboard A/D only; keep touch joystick left/right semantics unchanged.\n    a: keys.d || touch.x < -0.18,\n    d: keys.a || touch.x > 0.18,',
    '    // Unified 0.20.6 steering convention: keyboard and joystick use the same fields.\n    a: keys.a || touch.x < -0.18,\n    d: keys.d || touch.x > 0.18,',
    'unified keyboard and joystick A/D mapping'
  );

  // Bow-left/bow-right should not change merely because the vessel is moving
  // backwards or coasting through zero. With steer=(D-A), subtracting steer is
  // the stable bow-relative convention: A/left increases heading (left turn),
  // D/right decreases heading (right turn), at every signed ship speed.
  replaceRequired(
    '      const helmDirection = ship.speed >= 0 ? -1 : 1;\n      ship.heading += steer * 0.42 * mobility * (0.28 + 0.72 * speedScale) * dt * helmDirection;',
    '      ship.heading -= steer * 0.42 * mobility * (0.28 + 0.72 * speedScale) * dt;',
    'speed-independent helm direction'
  );

  // The match score belongs only in the ordinary/default objective slot. Captain,
  // sailmaster, gunner and enemy-ship objective branches above this fallback retain
  // priority and continue to replace the scoreboard whenever they apply.
  replaceRequired(
    '  else ui.objective.textContent = (state.round || 1) > 1\n    ? `British ${Number(state.score?.british || 0)} - ${Number(state.score?.french || 0)} French`\n    : `Protect ${TEAM[p.team].ship} · capture the enemy flag or destroy their ship.`;',
    '  else {\n    ui.objective.textContent = (state.round || 1) > 1\n      ? `British ${Number(state.score?.british || 0)} - ${Number(state.score?.french || 0)} French`\n      : `Protect ${TEAM[p.team].ship} · capture the enemy flag or destroy their ship.`;\n  }',
    'scoreboard default-objective priority'
  );

  return source;
}
