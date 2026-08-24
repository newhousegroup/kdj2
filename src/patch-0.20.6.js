export function patchGameSource(source) {
  function replaceRequired(search, replacement, label) {
    if (!source.includes(search)) throw new Error(`0.20.6 patch failed: ${label}`);
    source = source.replace(search, replacement);
  }

  // 0.17.3 swapped desktop A/D while leaving touch alone. That patch affected
  // ordinary sailor movement too, not just the helm. Restore one shared input
  // convention: A/joystick-left -> a, D/joystick-right -> d.
  const oldInputMapping =
    '    // Desktop keyboard steering/strafe correction: testers reported A/D mirrored.\n' +
    '    // Swap keyboard A/D only; keep touch joystick left/right semantics unchanged.\n' +
    '    a: keys.d || touch.x < -0.18,\n' +
    '    d: keys.a || touch.x > 0.18,';
  const fixedInputMapping =
    '    // Unified 0.20.6 movement convention: keyboard and joystick use the same fields.\n' +
    '    a: keys.a || touch.x < -0.18,\n' +
    '    d: keys.d || touch.x > 0.18,';
  if (source.includes(oldInputMapping)) source = source.replace(oldInputMapping, fixedInputMapping);
  else if (!source.includes(fixedInputMapping)) throw new Error('0.20.6 patch failed: unified keyboard and joystick A/D mapping');

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
  const badStrafeMatches = source.split(badStrafeVector).length - 1;
  const goodStrafeMatches = source.split(goodStrafeVector).length - 1;
  if (badStrafeMatches === 2) source = source.split(badStrafeVector).join(goodStrafeVector);
  else if (badStrafeMatches !== 0 || goodStrafeMatches !== 2) {
    throw new Error(`0.20.6 patch failed: player strafe vectors (bad=${badStrafeMatches}, fixed=${goodStrafeMatches})`);
  }

  // Intentionally leave the existing ship/helm steering model untouched. This
  // release's left/right bug report concerns walking movement, not vessel steering.

  // 0.20.2 put the later-round scoreboard at the very top of updateObjective(),
  // before captain/sailmaster/gunner/enemy-ship messages. Move it out of that
  // priority position so contextual information can win again.
  const oldScoreFirst =
    '  if ((state.round || 1) > 1) ui.objective.textContent = `British ${Number(state.score?.british || 0)} - ${Number(state.score?.french || 0)} French`;\n' +
    '  else if (p.role === "captain") ui.objective.textContent = `Captain of ${TEAM[p.ship].ship} · WASD to steer · E to leave helm`;';
  const captainFirst =
    '  if (p.role === "captain") ui.objective.textContent = `Captain of ${TEAM[p.ship].ship} · WASD to steer · E to leave helm`;';
  if (source.includes(oldScoreFirst)) source = source.replace(oldScoreFirst, captainFirst);
  else if (!source.includes(captainFirst)) throw new Error('0.20.6 patch failed: scoreboard priority removal');

  // The scoreboard now replaces only the ordinary own-ship mission text. Any
  // station role or enemy-ship context above this fallback keeps display priority.
  const oldDefaultMission =
    '  else ui.objective.textContent = `Protect ${TEAM[p.team].ship} · capture the enemy flag or destroy their ship.`;';
  const fixedDefaultMission =
    '  else ui.objective.textContent = (state.round || 1) > 1\n' +
    '    ? `British ${Number(state.score?.british || 0)} - ${Number(state.score?.french || 0)} French`\n' +
    '    : `Protect ${TEAM[p.team].ship} · capture the enemy flag or destroy their ship.`;';
  if (source.includes(oldDefaultMission)) source = source.replace(oldDefaultMission, fixedDefaultMission);
  else if (!source.includes(fixedDefaultMission)) throw new Error('0.20.6 patch failed: scoreboard default-objective placement');

  return source;
}
