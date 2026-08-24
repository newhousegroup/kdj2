export function patchGameSource(source) {
  function replaceRequired(search, replacement, label) {
    if (!source.includes(search)) throw new Error(`0.20.6 patch failed: ${label}`);
    source = source.replace(search, replacement);
  }

  // 0.17.3 swapped desktop A/D while leaving touch alone. That patch affected
  // ordinary sailor movement too, not just the helm. Restore one shared input
  // convention: A/joystick-left -> a, D/joystick-right -> d.
  replaceRequired(
    '    // Desktop keyboard steering/strafe correction: testers reported A/D mirrored.\n    // Swap keyboard A/D only; keep touch joystick left/right semantics unchanged.\n    a: keys.d || touch.x < -0.18,\n    d: keys.a || touch.x > 0.18,',
    '    // Unified 0.20.6 movement convention: keyboard and joystick use the same fields.\n    a: keys.a || touch.x < -0.18,\n    d: keys.d || touch.x > 0.18,',
    'unified keyboard and joystick A/D mapping'
  );

  // Player movement is stored in ship-local coordinates. Forward already used the
  // correct camera-relative transform, but strafe used +sin(yaw) for local Z.
  // That makes left/right gradually rotate the wrong way as the camera turns and
  // becomes fully reversed around a quarter-turn. Use -sin(yaw) instead.
  // The same vector appears once in authoritative processPlayer() and once in the
  // guest prediction path; both must match or online movement will reconcile badly.
  const badStrafeVector =
    '  const dx = strafe * Math.cos(yaw) - forward * Math.sin(yaw);\n' +
    '  const dz = strafe * Math.sin(yaw) - forward * Math.cos(yaw);';
  const goodStrafeVector =
    '  const dx = strafe * Math.cos(yaw) - forward * Math.sin(yaw);\n' +
    '  const dz = -strafe * Math.sin(yaw) - forward * Math.cos(yaw);';
  const strafeMatches = source.split(badStrafeVector).length - 1;
  if (strafeMatches !== 2) {
    throw new Error(`0.20.6 patch failed: expected two player strafe vectors, found ${strafeMatches}`);
  }
  source = source.split(badStrafeVector).join(goodStrafeVector);

  // Intentionally leave the existing ship/helm steering model untouched. This
  // release's left/right bug report concerns walking movement, not vessel steering.

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
