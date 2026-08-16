export function patchGameSource(source) {
  function replaceRequired(search, replacement, label) {
    if (!source.includes(search)) throw new Error(`0.11.1 patch failed: ${label}`);
    source = source.replace(search, replacement);
  }

  replaceRequired(
    '? { x: -150, z: 0, heading: Math.PI / 2, speed: 0, mobility: 100, captain: null, sailmaster: null, boostUntil: 0, sailTrim: 1, sailDecayAt, cannons }',
    '? { x: -150, z: 0, heading: -Math.PI / 2, speed: 0, mobility: 100, captain: null, sailmaster: null, boostUntil: 0, sailTrim: 1, sailDecayAt, cannons }',
    'British starting heading'
  );
  replaceRequired(
    ': { x: 150, z: 0, heading: -Math.PI / 2, speed: 0, mobility: 100, captain: null, sailmaster: null, boostUntil: 0, sailTrim: 1, sailDecayAt, cannons };',
    ': { x: 150, z: 0, heading: Math.PI / 2, speed: 0, mobility: 100, captain: null, sailmaster: null, boostUntil: 0, sailTrim: 1, sailDecayAt, cannons };',
    'French starting heading'
  );

  replaceRequired(
    '    const steer = captain ? (input.a ? 1 : 0) - (input.d ? 1 : 0) : 0;',
    '    const steer = captain ? (input.d ? 1 : 0) - (input.a ? 1 : 0) : 0;',
    'helm steering sign'
  );

  replaceRequired(
    '    const sailPower = [0.55, 0.78, 1.0][sailTrim] ?? 0.78;',
    '    const sailPower = [0.50, 0.78, 1.0][sailTrim] ?? 0.78;',
    'reefed half-speed power'
  );

  replaceRequired(
    '    ship.x += Math.sin(ship.heading) * ship.speed * dt;\n    ship.z += Math.cos(ship.heading) * ship.speed * dt;',
    '    ship.x -= Math.sin(ship.heading) * ship.speed * dt;\n    ship.z -= Math.cos(ship.heading) * ship.speed * dt;',
    'bow-aligned ship translation'
  );

  replaceRequired(
    '  const heading = ((THREE.MathUtils.radToDeg(ship.heading) % 360) + 360) % 360;',
    '  const heading = ((THREE.MathUtils.radToDeg(ship.heading + Math.PI) % 360) + 360) % 360;',
    'bow-aligned compass heading'
  );

  return source;
}
