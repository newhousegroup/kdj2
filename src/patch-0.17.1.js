export function patchGameSource(source) {
  function replaceRequired(search, replacement, label) {
    if (!source.includes(search)) throw new Error(`0.17.1 patch failed: ${label}`);
    source = source.replace(search, replacement);
  }

  // Guests previously saw world motion only when the full authoritative state
  // arrived (80 ms / 12.5 Hz). Keep that full state channel unchanged, but add
  // a compact 30 Hz motion stream containing only transforms needed for smooth
  // ship/player/camera motion.
  replaceRequired(
    'let lastBroadcast = 0;',
    'let lastBroadcast = 0;\nlet lastMotionBroadcast = 0;',
    'motion broadcast clock'
  );

  replaceRequired(
    'function syncState() {\n  if (network.isHost) network.broadcast({ type: "state", state });\n}',
    `function syncState() {
  if (network.isHost) network.broadcast({ type: "state", state });
}

const MOTION_INTERVAL_MS = 33;

function motionSnapshot() {
  const ships = {};
  for (const team of ["british", "french"]) {
    const s = state?.ships?.[team];
    if (s) ships[team] = [s.x, s.z, s.heading, s.speed];
  }
  const players = [];
  for (const p of Object.values(state?.players || {})) {
    players.push([p.id, p.x, p.z, p.yaw, p.ship, p.deck]);
  }
  return { type: "motion", ships, players };
}

function applyMotionSnapshot(packet) {
  if (!state || !packet) return;
  for (const team of ["british", "french"]) {
    const values = packet.ships?.[team];
    const s = state.ships?.[team];
    if (!s || !Array.isArray(values)) continue;
    if (Number.isFinite(values[0])) s.x = values[0];
    if (Number.isFinite(values[1])) s.z = values[1];
    if (Number.isFinite(values[2])) s.heading = values[2];
    if (Number.isFinite(values[3])) s.speed = values[3];
  }
  for (const values of packet.players || []) {
    if (!Array.isArray(values)) continue;
    const p = state.players?.[values[0]];
    if (!p) continue;
    if (Number.isFinite(values[1])) p.x = values[1];
    if (Number.isFinite(values[2])) p.z = values[2];
    if (Number.isFinite(values[3])) p.yaw = values[3];
    if (typeof values[4] === "string") p.ship = values[4];
    if (typeof values[5] === "string") p.deck = values[5];
  }
}`,
    'compact motion replication helpers'
  );

  replaceRequired(
    '  if (packet.type === "state") {\n    state = packet.state;\n    syncLocal();\n  }',
    `  if (packet.type === "motion") {
    applyMotionSnapshot(packet);
    return;
  }
  if (packet.type === "state") {
    state = packet.state;
    syncLocal();
  }`,
    'guest motion packet handling'
  );

  replaceRequired(
    '      regeneratePlayerHealth(Date.now());\n      simulateShips(dt);',
    `      regeneratePlayerHealth(Date.now());
      simulateShips(dt);
      if (now - lastMotionBroadcast >= MOTION_INTERVAL_MS) {
        network.broadcast(motionSnapshot());
        lastMotionBroadcast = now;
      }`,
    '30 Hz host motion broadcast'
  );

  // Guest control packets were capped at 20 Hz. Raising only the compact input
  // stream to roughly 30 Hz reduces steering/walking response delay without
  // increasing the size/frequency of full-state packets.
  replaceRequired(
    `setInterval(() => {
  if (!spawned || !state?.players?.[localId] || state.phase !== "playing") return;
  const input = inputSnapshot();
  if (network.isHost) inputs.set(localId, input);
  else network.send({ type: "input", input });
}, 50);`,
    `setInterval(() => {
  if (!spawned || !state?.players?.[localId] || state.phase !== "playing") return;
  const input = inputSnapshot();
  if (network.isHost) inputs.set(localId, input);
  else network.send({ type: "input", input });
}, 33);`,
    '30 Hz guest input stream'
  );

  return source;
}
