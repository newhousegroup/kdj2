export function patchGameSource(source) {
  function replaceRequired(search, replacement, label) {
    if (!source.includes(search)) throw new Error(`0.19.6 patch failed: ${label}`);
    source = source.replace(search, replacement);
  }

  // Every four-colour room code maps to one unique British/French name pair.
  // There are 6^4 = 1296 possible room codes and 36 x 36 = 1296 pairs, so two
  // different room codes cannot receive the same pair.
  replaceRequired(
    'function initialState(id, name) {',
    `const BRITISH_SHIP_NAMES = [
  "HMS Resolute", "HMS Valiant", "HMS Dauntless", "HMS Vanguard", "HMS Defiant", "HMS Intrepid",
  "HMS Sovereign", "HMS Endeavour", "HMS Victory", "HMS Reliant", "HMS Gallant", "HMS Sentinel",
  "HMS Triumph", "HMS Courageous", "HMS Guardian", "HMS Renown", "HMS Monarch", "HMS Invincible",
  "HMS Audacious", "HMS Ardent", "HMS Tempest", "HMS Lionheart", "HMS Steadfast", "HMS Venture",
  "HMS Dominion", "HMS Liberty", "HMS Vigilant", "HMS Raven", "HMS Falcon", "HMS Phoenix",
  "HMS Thunderer", "HMS Dragon", "HMS Neptune", "HMS Orion", "HMS Eclipse", "HMS Concord"
];

const FRENCH_SHIP_NAMES = [
  "Fleur Royale", "La Victoire", "L'Aurore", "L'Intrépide", "Le Vaillant", "L'Étoile",
  "Le Triomphant", "La Gloire", "Le Courageux", "La Renommée", "Le Souverain", "L'Aigle",
  "La Fortune", "La Tempête", "Le Gardien", "L'Invincible", "La Liberté", "Le Téméraire",
  "La Concorde", "Le Phénix", "L'Orage", "Le Neptune", "L'Orion", "La Comète",
  "Le Dauphin", "La Couronne", "Le Soleil", "La Reine", "L'Espérance", "Le Vigilant",
  "L'Audacieux", "La Foudre", "Le Lys", "La Sirène", "Le Dragon", "La Belle"
];

function roomCodeShipIndex(roomCode) {
  if (!Array.isArray(roomCode) || roomCode.length < 4) return Math.floor(Math.random() * 1296);
  let value = 0;
  for (let i = 0; i < 4; i += 1) {
    const digit = Number(roomCode[i]);
    if (!Number.isInteger(digit) || digit < 0 || digit > 5) return Math.floor(Math.random() * 1296);
    value = value * 6 + digit;
  }
  return value;
}

function makeRoomShipNames(roomCode) {
  const index = roomCodeShipIndex(roomCode);
  return {
    british: BRITISH_SHIP_NAMES[index % 36],
    french: FRENCH_SHIP_NAMES[Math.floor(index / 36) % 36]
  };
}

function roomShipName(team) {
  return state?.shipNames?.[team] || TEAM[team]?.ship || "Ship";
}

function initialState(id, name, roomCode) {`,
    "room ship-name helpers"
  );

  replaceRequired(
    '  seenRound = 1;',
    '  state.shipNames = makeRoomShipNames(roomCode);\n  seenRound = 1;',
    "authoritative room ship names"
  );

  replaceRequired(
    '    initialState(localId, room.name);',
    '    initialState(localId, room.name, room.code);',
    "room code passed to initial state"
  );

  // Use the room-specific names everywhere the crew is introduced to its vessel.
  replaceRequired(
    '  ui.teamShip.textContent = TEAM[localTeam].ship;\n  ui.spawn.textContent = `Spawn on ${TEAM[localTeam].ship}`;',
    `  ui.teamShip.textContent = roomShipName(localTeam);
  ui.spawn.textContent = \`Spawn on \${roomShipName(localTeam)}\`;
  const britishPanelName = document.querySelector(".ship-panel.british strong");
  const frenchPanelName = document.querySelector(".ship-panel.french strong");
  if (britishPanelName) britishPanelName.textContent = roomShipName("british");
  if (frenchPanelName) frenchPanelName.textContent = roomShipName("french");`,
    "deployment and HUD room ship names"
  );

  replaceRequired(
    '  if (p.role === "captain") ui.objective.textContent = `Captain of ${TEAM[p.ship].ship} · WASD to steer · E to leave helm`;',
    '  if (p.role === "captain") ui.objective.textContent = `Captain of ${roomShipName(p.ship)} · WASD to steer · E to leave helm`;',
    "captain room ship name"
  );

  replaceRequired(
    '  else if (p.role === "sailmaster") ui.objective.textContent = `Sailmaster on ${TEAM[p.ship].ship} · Space / SAILS to trim sails · E to leave rigging`;',
    '  else if (p.role === "sailmaster") ui.objective.textContent = `Sailmaster on ${roomShipName(p.ship)} · Space / SAILS to trim sails · E to leave rigging`;',
    "sailmaster room ship name"
  );

  // Requested copy: comma after the vessel name, then a bullet before the attack objective.
  replaceRequired(
    '  else ui.objective.textContent = `Protect ${TEAM[p.team].ship} · keep her afloat · capture the enemy flag or destroy their ship.`;',
    '  else ui.objective.textContent = `Protect ${roomShipName(p.team)}, keep her afloat • capture the enemy flag or destroy their ship.`;',
    "ship stewardship punctuation"
  );

  replaceRequired(
    '      const shipName = TEAM[e.team]?.ship || "Our ship";',
    '      const shipName = roomShipName(e.team);',
    "room ship name in damage feedback"
  );

  replaceRequired(
    '  ui.victoryText.textContent = state.winReason === "destroyed" && loser ? `${TEAM[loser].ship} was destroyed.` : (loser ? `${TEAM[loser].label} flag captured.` : "Flag captured.");',
    '  ui.victoryText.textContent = state.winReason === "destroyed" && loser ? `${roomShipName(loser)} was destroyed.` : (loser ? `${TEAM[loser].label} flag captured.` : "Flag captured.");',
    "room ship name in destruction victory"
  );

  return source;
}
