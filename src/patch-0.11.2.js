export function patchGameSource(source) {
  function replaceRequired(search, replacement, label) {
    if (!source.includes(search)) throw new Error(`0.11.2 patch failed: ${label}`);
    source = source.replace(search, replacement);
  }

  // Keep helm left/right direct and predictable at every speed. 0.11.1 reversed the
  // rudder sign while travelling backwards, which made the touch joystick appear to
  // change direction depending on whether the ship had crossed through zero speed.
  replaceRequired(
    '      const direction = ship.speed >= 0 ? 1 : -1;\n      ship.heading += steer * 0.42 * mobility * (0.28 + 0.72 * speedScale) * dt * direction;',
    '      ship.heading += steer * 0.42 * mobility * (0.28 + 0.72 * speedScale) * dt;',
    'consistent helm steering direction'
  );

  // The single 0.11.0 reference island is centred at (28, 185). Treat its rocky
  // shoreline as a circular obstacle, but collide it against the ship's oriented
  // rectangular hull rather than an oversized centre-point radius.
  replaceRequired(
    'function simulateShips(dt) {',
    `const REFERENCE_ISLAND_X = 28;
const REFERENCE_ISLAND_Z = 185;
const REFERENCE_ISLAND_RADIUS = 49;

function shipTouchesReferenceIsland(ship) {
  const toIslandX = REFERENCE_ISLAND_X - ship.x;
  const toIslandZ = REFERENCE_ISLAND_Z - ship.z;

  const forwardX = -Math.sin(ship.heading);
  const forwardZ = -Math.cos(ship.heading);
  const rightX = Math.cos(ship.heading);
  const rightZ = -Math.sin(ship.heading);

  const localX = toIslandX * rightX + toIslandZ * rightZ;
  const localZ = toIslandX * forwardX + toIslandZ * forwardZ;
  const closestX = THREE.MathUtils.clamp(localX, -SHIP_HALF_WIDTH, SHIP_HALF_WIDTH);
  const closestZ = THREE.MathUtils.clamp(localZ, -SHIP_HALF_LENGTH, SHIP_HALF_LENGTH);

  const closestWorldX = ship.x + rightX * closestX + forwardX * closestZ;
  const closestWorldZ = ship.z + rightZ * closestX + forwardZ * closestZ;
  const dx = closestWorldX - REFERENCE_ISLAND_X;
  const dz = closestWorldZ - REFERENCE_ISLAND_Z;
  return dx * dx + dz * dz < REFERENCE_ISLAND_RADIUS * REFERENCE_ISLAND_RADIUS;
}

function simulateShips(dt) {`,
    'reference island collision helper'
  );

  replaceRequired(
    '    ship.x -= Math.sin(ship.heading) * ship.speed * dt;\n    ship.z -= Math.cos(ship.heading) * ship.speed * dt;',
    `    const islandPrevX = ship.x;
    const islandPrevZ = ship.z;
    ship.x -= Math.sin(ship.heading) * ship.speed * dt;
    ship.z -= Math.cos(ship.heading) * ship.speed * dt;
    if (shipTouchesReferenceIsland(ship)) {
      ship.x = islandPrevX;
      ship.z = islandPrevZ;
      ship.speed = 0;
    }`,
    'host-authoritative island collision response'
  );

  return source;
}
