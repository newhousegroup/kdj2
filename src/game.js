import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";

const TEAM_INFO = {
  british: { label: "British", shipName: "HMS Resolute", color: 0xc34f4f, accent: 0xf0d7c8 },
  french: { label: "French", shipName: "Fleur Royale", color: 0x4d72c7, accent: 0xd7e0f0 }
};
const MAX_USERS = 6;
const STATE_HZ = 12;
const SIM_HZ = 30;
const SHIP_HALF_WIDTH = 4.4;
const SHIP_HALF_LENGTH = 15;
const GRAPPLE_RANGE = 48;
const CANNON_RANGE = 105;
const CANNON_COOLDOWN = 3000;

const $ = (s) => document.querySelector(s);
const lobby = $("#lobby");
const deployment = $("#deployment");
const hud = $("#hud");
const victory = $("#victory");
const playerName = $("#playerName");
const lobbyHome = $("#lobbyHome");
const joinPanel = $("#joinPanel");
const createRoomBtn = $("#createRoomBtn");
const showJoinBtn = $("#showJoinBtn");
const joinBackBtn = $("#joinBackBtn");
const joinRoomBtn = $("#joinRoomBtn");
const joinCodeEl = $("#joinCode");
const colorPalette = $("#colorPalette");
const lobbyStatus = $("#lobbyStatus");
const teamName = $("#teamName");
const teamShipName = $("#teamShipName");
const spawnBtn = $("#spawnBtn");
const teamBadge = $("#teamBadge");
const currentRoomCodeEl = $("#currentRoomCode");
const peopleCount = $("#peopleCount");
const connectionDot = $("#connectionDot");
const leaveBtn = $("#leaveBtn");
const victoryLeaveBtn = $("#victoryLeaveBtn");
const britishMobility = $("#britishMobility");
const frenchMobility = $("#frenchMobility");
const objective = $("#objective");
const interactionPrompt = $("#interactionPrompt");
const toast = $("#toast");
const victoryTitle = $("#victoryTitle");
const victoryText = $("#victoryText");
const joystick = $("#joystick");
const joystickKnob = $("#joystickKnob");
const touchInteract = $("#touchInteract");
const touchGrapple = $("#touchGrapple");
const touchFire = $("#touchFire");

let joinCode = [];
let localId = null;
let localTeam = null;
let spawned = false;
let gameState = null;
let lastStateBroadcast = 0;
let localToastTimer = null;
let shotEvents = [];
let grappleEvents = [];
const playerMeshes = new Map();
const shipVisuals = {};
const inputs = new Map();
const localKeys = { w: false, a: false, s: false, d: false, interactSeq: 0, grappleSeq: 0, fireSeq: 0 };
const touchVector = { x: 0, y: 0 };
let touchPointerId = null;
let seqInteract = 0;
let seqGrapple = 0;
let seqFire = 0;

function blankInput() {
  return { w: false, a: false, s: false, d: false, interactSeq: 0, grappleSeq: 0, fireSeq: 0 };
}

const network = new window.KDJNetwork({
  onStatus: (text, kind) => setNetworkStatus(text, kind),
  onError: (error) => showToast(error?.message || "Network error"),
  onJoinRequest: ({ peerId, name }) => hostAcceptPlayer(peerId, name),
  onGuestLeft: (peerId) => hostRemovePlayer(peerId),
  onPacket: (from, packet) => handleNetworkPacket(from, packet),
  onHostLeft: () => returnToMenu("The host left the battle.")
});

function setNetworkStatus(text, kind = "ready") {
  connectionDot.className = `connection-dot ${kind}`;
  connectionDot.title = text;
  if (!lobby.classList.contains("hidden")) {
    lobbyStatus.textContent = text;
    lobbyStatus.classList.toggle("error", kind === "failure");
  }
}

function showToast(text, ms = 2200) {
  toast.textContent = text;
  toast.classList.remove("hidden");
  clearTimeout(localToastTimer);
  localToastTimer = setTimeout(() => toast.classList.add("hidden"), ms);
}

function safeName() {
  const name = playerName.value.trim().replace(/\s+/g, " ").slice(0, 20);
  return name || `Sailor ${Math.floor(10 + Math.random() * 90)}`;
}

function renderCode(container, code, large = false) {
  container.replaceChildren();
  code.forEach((key, index) => {
    const c = window.KDJNetwork.colors.find((x) => x.key === String(key));
    if (!c) return;
    const chip = document.createElement(large ? "button" : "span");
    chip.className = "room-chip";
    chip.style.background = c.hex;
    chip.title = c.name;
    if (large) chip.addEventListener("click", () => { joinCode.splice(index, 1); renderJoinPicker(); });
    container.appendChild(chip);
  });
  if (large && code.length < 4) {
    for (let i = code.length; i < 4; i += 1) {
      const chip = document.createElement("span");
      chip.className = "room-chip";
      chip.style.background = "#14232e";
      chip.style.boxShadow = "inset 0 0 0 1px #34444f";
      container.appendChild(chip);
    }
  }
}

function renderJoinPicker() {
  renderCode(joinCodeEl, joinCode, true);
  joinRoomBtn.disabled = joinCode.length !== 4;
}

function buildPalette() {
  colorPalette.replaceChildren();
  window.KDJNetwork.colors.forEach((c) => {
    const btn = document.createElement("button");
    btn.style.background = c.hex;
    btn.title = c.name;
    btn.addEventListener("click", () => {
      if (joinCode.length >= 4) return;
      joinCode.push(c.key);
      renderJoinPicker();
    });
    colorPalette.appendChild(btn);
  });
}

function chooseTeam(state) {
  const counts = { british: 0, french: 0 };
  Object.values(state.players).forEach((p) => { if (p.team) counts[p.team] += 1; });
  if (counts.british < counts.french) return "british";
  if (counts.french < counts.british) return "french";
  return Math.random() < 0.5 ? "british" : "french";
}

function createInitialState(hostId, name) {
  const state = {
    phase: "playing",
    winner: null,
    createdAt: Date.now(),
    ships: {
      british: { team: "british", x: -28, z: 0, heading: Math.PI / 2, speed: 0, mobility: 100, captainId: null, gunnerId: null, lastShotAt: 0 },
      french: { team: "french", x: 28, z: 0, heading: -Math.PI / 2, speed: 0, mobility: 100, captainId: null, gunnerId: null, lastShotAt: 0 }
    },
    players: {}
  };
  const team = chooseTeam(state);
  state.players[hostId] = makePlayer(hostId, name, team);
  return state;
}

function makePlayer(id, name, team) {
  return { id, name, team, ship: team, deck: "upper", px: 0, pz: 10, role: null, spawned: false };
}

function hostAcceptPlayer(peerId, name) {
  if (!network.isHost || !gameState) return;
  if (Object.keys(gameState.players).length >= MAX_USERS) return network.rejectGuest(peerId, "Battle is full (6 / 6).");
  const team = chooseTeam(gameState);
  gameState.players[peerId] = makePlayer(peerId, name, team);
  inputs.set(peerId, blankInput());
  network.acceptGuest(peerId, { selfId: peerId, team, roomCode: network.roomCode, state: gameState });
  network.broadcast({ type: "state", state: gameState });
  updatePeopleCount();
  showToast(`${name} joined the ${TEAM_INFO[team].label} crew.`);
}

function hostRemovePlayer(peerId) {
  if (!network.isHost || !gameState?.players[peerId]) return;
  releaseRole(peerId);
  delete gameState.players[peerId];
  inputs.delete(peerId);
  network.broadcast({ type: "state", state: gameState });
  updatePeopleCount();
}

function handleNetworkPacket(from, packet) {
  if (!packet || typeof packet !== "object") return;
  if (network.isHost) {
    if (packet.type === "input" && gameState?.players[from]) inputs.set(from, sanitizeInput(packet.input));
    else if (packet.type === "spawn" && gameState?.players[from]) hostSpawnPlayer(from);
    return;
  }
  if (packet.type === "state" && packet.state) {
    gameState = packet.state;
    syncLocalAssignmentFromState();
  }
  if (packet.type === "event") receiveEvent(packet.event);
}

function sanitizeInput(input) {
  return {
    w: !!input?.w,
    a: !!input?.a,
    s: !!input?.s,
    d: !!input?.d,
    interactSeq: Number(input?.interactSeq) || 0,
    grappleSeq: Number(input?.grappleSeq) || 0,
    fireSeq: Number(input?.fireSeq) || 0
  };
}

function syncLocalAssignmentFromState() {
  const p = gameState?.players?.[localId];
  if (!p) return;
  localTeam = p.team;
  spawned = p.spawned;
  teamBadge.textContent = TEAM_INFO[localTeam].label;
  teamBadge.className = `team-badge ${localTeam}`;
}

async function createBattle() {
  lobbyStatus.textContent = "";
  try {
    const room = await network.createRoom(safeName());
    localId = room.id;
    gameState = createInitialState(localId, room.name);
    localTeam = gameState.players[localId].team;
    inputs.set(localId, blankInput());
    renderCode(currentRoomCodeEl, room.code);
    updatePeopleCount();
    showDeployment();
  } catch (error) {
    lobbyStatus.textContent = error?.message || "Could not create battle.";
    lobbyStatus.classList.add("error");
  }
}

async function joinBattle() {
  if (joinCode.length !== 4) return;
  lobbyStatus.textContent = "";
  try {
    const welcome = await network.joinRoom(safeName(), joinCode);
    localId = welcome.selfId || welcome.id;
    localTeam = welcome.team;
    gameState = welcome.state;
    renderCode(currentRoomCodeEl, welcome.roomCode || joinCode);
    syncLocalAssignmentFromState();
    updatePeopleCount();
    showDeployment();
  } catch (error) {
    lobbyStatus.textContent = error?.message || "Could not join battle.";
    lobbyStatus.classList.add("error");
  }
}

function showDeployment() {
  lobby.classList.add("hidden");
  hud.classList.add("hidden");
  deployment.classList.remove("hidden");
  const info = TEAM_INFO[localTeam];
  teamName.textContent = info.label;
  teamShipName.textContent = info.shipName;
  spawnBtn.textContent = `Spawn on ${info.shipName}`;
}

function hostSpawnPlayer(id) {
  const p = gameState.players[id];
  if (!p || p.spawned) return;
  p.ship = p.team;
  p.deck = "upper";
  p.px = 0;
  p.pz = 10;
  p.role = null;
  p.spawned = true;
  network.broadcast({ type: "state", state: gameState });
}

function spawnLocal() {
  if (!gameState?.players?.[localId]) return;
  if (network.isHost) hostSpawnPlayer(localId);
  else network.send({ type: "spawn" });
  spawned = true;
  deployment.classList.add("hidden");
  hud.classList.remove("hidden");
  syncLocalAssignmentFromState();
  showToast(`You are with the ${TEAM_INFO[localTeam].label} crew.`);
}

function returnToMenu(message = "") {
  network.cleanup();
  localId = null;
  localTeam = null;
  spawned = false;
  gameState = null;
  for (const mesh of playerMeshes.values()) worldGroup.remove(mesh);
  playerMeshes.clear();
  victory.classList.add("hidden");
  deployment.classList.add("hidden");
  hud.classList.add("hidden");
  lobby.classList.remove("hidden");
  lobbyHome.classList.remove("hidden");
  joinPanel.classList.add("hidden");
  joinCode = [];
  renderJoinPicker();
  lobbyStatus.textContent = message;
  lobbyStatus.classList.remove("error");
}

function updatePeopleCount() {
  const count = gameState ? Object.keys(gameState.players).length : 1;
  peopleCount.textContent = `${count} / ${MAX_USERS}`;
}

const canvas = $("#gameCanvas");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x94b3c2);
scene.fog = new THREE.Fog(0x94b3c2, 130, 430);
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 1000);
scene.add(new THREE.HemisphereLight(0xd7ecf4, 0x22343b, 2.1));
const sun = new THREE.DirectionalLight(0xfff0d3, 2.4);
sun.position.set(80, 120, 40);
sun.castShadow = true;
scene.add(sun);

const ocean = new THREE.Mesh(
  new THREE.PlaneGeometry(1600, 1600, 60, 60),
  new THREE.MeshPhongMaterial({ color: 0x174a65, shininess: 90, specular: 0x7ab8d3, side: THREE.DoubleSide })
);
ocean.rotation.x = -Math.PI / 2;
ocean.receiveShadow = true;
scene.add(ocean);
const worldGroup = new THREE.Group();
scene.add(worldGroup);

function createShip(team) {
  const info = TEAM_INFO[team];
  const group = new THREE.Group();
  const hullMat = new THREE.MeshStandardMaterial({ color: team === "british" ? 0x5a3428 : 0x4b362c, roughness: .72 });
  const deckMat = new THREE.MeshStandardMaterial({ color: 0xaa8154, roughness: .9 });
  const railMat = new THREE.MeshStandardMaterial({ color: 0x33251f, roughness: .8 });
  const hull = new THREE.Mesh(new THREE.BoxGeometry(9.5, 4.2, 31), hullMat);
  hull.position.y = 1.8;
  hull.castShadow = hull.receiveShadow = true;
  group.add(hull);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(9, .55, 30), deckMat);
  deck.position.y = 4.05;
  deck.castShadow = deck.receiveShadow = true;
  group.add(deck);
  [-4.35, 4.35].forEach((x) => {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(.22, 1.1, 29), railMat);
    rail.position.set(x, 4.65, 0);
    group.add(rail);
  });
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(.23, .28, 14, 10), railMat);
  mast.position.set(0, 10.5, -1);
  group.add(mast);
  const sail = new THREE.Mesh(new THREE.PlaneGeometry(8.5, 7), new THREE.MeshStandardMaterial({ color: 0xe7dfc7, side: THREE.DoubleSide, roughness: 1 }));
  sail.position.set(0, 11.5, -1);
  sail.rotation.y = Math.PI / 2;
  group.add(sail);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 1.3), new THREE.MeshBasicMaterial({ color: info.color, side: THREE.DoubleSide }));
  flag.position.set(0, 17, -1);
  flag.rotation.y = Math.PI / 2;
  group.add(flag);
  const helm = new THREE.Mesh(new THREE.TorusGeometry(1.1, .13, 8, 24), new THREE.MeshStandardMaterial({ color: 0x2c211b }));
  helm.position.set(0, 5.25, 9);
  helm.rotation.y = Math.PI / 2;
  group.add(helm);
  const cannonMat = new THREE.MeshStandardMaterial({ color: 0x20272a, metalness: .4, roughness: .55 });
  for (const x of [-4.55, 4.55]) {
    for (const z of [-7, -2, 3, 8]) {
      const cannon = new THREE.Mesh(new THREE.CylinderGeometry(.22, .29, 2.0, 10), cannonMat);
      cannon.rotation.z = Math.PI / 2;
      cannon.position.set(x, 4.85, z);
      group.add(cannon);
    }
  }
  const hatch = new THREE.Mesh(new THREE.BoxGeometry(2.8, .18, 3.2), new THREE.MeshStandardMaterial({ color: 0x51392c }));
  hatch.position.set(0, 4.38, 3.3);
  group.add(hatch);
  const lower = new THREE.Group();
  const floor = new THREE.Mesh(new THREE.BoxGeometry(8, .22, 25), new THREE.MeshStandardMaterial({ color: 0x704c34 }));
  floor.position.y = 0.25;
  lower.add(floor);
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x4b3427, side: THREE.DoubleSide });
  const sideA = new THREE.Mesh(new THREE.BoxGeometry(.18, 3.2, 25), wallMat); sideA.position.set(-4, 1.8, 0); lower.add(sideA);
  const sideB = sideA.clone(); sideB.position.x = 4; lower.add(sideB);
  const endA = new THREE.Mesh(new THREE.BoxGeometry(8, 3.2, .18), wallMat); endA.position.set(0, 1.8, -12.4); lower.add(endA);
  const endB = endA.clone(); endB.position.z = 12.4; lower.add(endB);
  const flagPole = new THREE.Mesh(new THREE.CylinderGeometry(.08, .08, 2.6, 8), new THREE.MeshStandardMaterial({ color: 0x29231e }));
  flagPole.position.set(0, 1.55, -7.5); lower.add(flagPole);
  const lowerFlag = new THREE.Mesh(new THREE.PlaneGeometry(2, 1), new THREE.MeshBasicMaterial({ color: info.color, side: THREE.DoubleSide }));
  lowerFlag.position.set(1, 2.35, -7.5); lower.add(lowerFlag);
  group.add(lower);
  worldGroup.add(group);
  return { group, hull, deck, lower };
}
shipVisuals.british = createShip("british");
shipVisuals.french = createShip("french");

function createPlayerMesh(player) {
  const info = TEAM_INFO[player.team];
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(.45, .5, 1.4, 12), new THREE.MeshStandardMaterial({ color: info.color, roughness: .8 }));
  body.position.y = .75;
  body.castShadow = true;
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(.38, 12, 8), new THREE.MeshStandardMaterial({ color: 0xe1b98b, roughness: .9 }));
  head.position.y = 1.75;
  head.castShadow = true;
  g.add(head);
  const hat = new THREE.Mesh(new THREE.CylinderGeometry(.45, .52, .18, 12), new THREE.MeshStandardMaterial({ color: 0x171c20 }));
  hat.position.y = 2.1;
  g.add(hat);
  worldGroup.add(g);
  playerMeshes.set(player.id, g);
  return g;
}

function shipLocalToWorld(ship, px, pz, y = 0) {
  const sin = Math.sin(ship.heading), cos = Math.cos(ship.heading);
  return new THREE.Vector3(ship.x + px * cos + pz * sin, y, ship.z - px * sin + pz * cos);
}

function renderState() {
  if (!gameState) return;
  for (const team of ["british", "french"]) {
    const ship = gameState.ships[team];
    const visual = shipVisuals[team];
    visual.group.position.set(ship.x, 0, ship.z);
    visual.group.rotation.y = ship.heading;
  }
  const aliveIds = new Set();
  Object.values(gameState.players).forEach((p) => {
    if (!p.spawned) return;
    aliveIds.add(p.id);
    const mesh = playerMeshes.get(p.id) || createPlayerMesh(p);
    const ship = gameState.ships[p.ship];
    const y = p.deck === "lower" ? 0.55 : 4.38;
    const world = shipLocalToWorld(ship, p.px, p.pz, y);
    mesh.position.lerp(world, p.id === localId ? 1 : .35);
    mesh.visible = true;
  });
  for (const [id, mesh] of playerMeshes.entries()) {
    if (!aliveIds.has(id)) { worldGroup.remove(mesh); playerMeshes.delete(id); }
  }
  updateInteriorVisibility();
  updateHud();
}

function updateInteriorVisibility() {
  const local = gameState?.players?.[localId];
  for (const team of ["british", "french"]) {
    const v = shipVisuals[team];
    const inside = local?.spawned && local.ship === team && local.deck === "lower";
    v.hull.material.transparent = inside;
    v.hull.material.opacity = inside ? .12 : 1;
    v.deck.material.transparent = inside;
    v.deck.material.opacity = inside ? .15 : 1;
    v.lower.visible = inside;
  }
}

function updateHud() {
  if (!gameState) return;
  britishMobility.textContent = `Mobility ${Math.round(gameState.ships.british.mobility)}%`;
  frenchMobility.textContent = `Mobility ${Math.round(gameState.ships.french.mobility)}%`;
  updatePeopleCount();
  const local = gameState.players[localId];
  if (!local?.spawned) return;
  if (local.role === "captain") objective.textContent = `Captain of ${TEAM_INFO[local.ship].shipName} · WASD to steer · E to leave helm`;
  else if (local.role === "gunner") objective.textContent = `Gunner on ${TEAM_INFO[local.ship].shipName} · Space / FIRE to fire · E to leave cannons`;
  else if (local.ship !== local.team) objective.textContent = local.deck === "lower" ? "Find and capture the enemy flag." : "Boarding enemy ship · find the hatch below deck.";
  else objective.textContent = "Capture the enemy flag below deck.";
  const prompt = interactionFor(local);
  if (prompt) { interactionPrompt.textContent = `E · ${prompt.label}`; interactionPrompt.classList.remove("hidden"); }
  else interactionPrompt.classList.add("hidden");
}

function interactionFor(player) {
  if (!player?.spawned) return null;
  if (player.role) return { type: "leave-role", label: player.role === "captain" ? "Leave helm" : "Leave cannons" };
  if (player.deck === "upper") {
    if (near(player, 0, 9, 2.4) && player.team === player.ship) return { type: "captain", label: "Take the helm" };
    if (near(player, 0, -2, 2.8) && player.team === player.ship) return { type: "gunner", label: "Man the cannons" };
    if (near(player, 0, 3.3, 2.2)) return { type: "down", label: "Go below deck" };
  } else {
    if (near(player, 0, 3.3, 2.2)) return { type: "up", label: "Return to deck" };
    if (near(player, 0, -7.5, 2.5)) {
      if (player.team === player.ship) return { type: "own-flag", label: "Your flag" };
      return { type: "capture", label: `Capture ${TEAM_INFO[player.ship].label} flag` };
    }
  }
  return null;
}
function near(p, x, z, radius) { return Math.hypot(p.px - x, p.pz - z) <= radius; }

function updateCamera() {
  if (!gameState || !spawned) {
    const t = performance.now() * .00008;
    camera.position.set(Math.cos(t) * 75, 48, Math.sin(t) * 75);
    camera.lookAt(0, 3, 0);
    return;
  }
  const p = gameState.players[localId];
  if (!p?.spawned) return;
  const ship = gameState.ships[p.ship];
  const y = p.deck === "lower" ? 1.1 : 5.0;
  const pos = shipLocalToWorld(ship, p.px, p.pz, y);
  let desired;
  if (p.role === "captain") {
    desired = shipLocalToWorld(ship, 0, 19, 13);
    camera.position.lerp(desired, .08);
    camera.lookAt(shipLocalToWorld(ship, 0, -3, 4.5));
  } else if (p.role === "gunner") {
    desired = shipLocalToWorld(ship, 10, -2, 8);
    camera.position.lerp(desired, .1);
    camera.lookAt(pos);
  } else if (p.deck === "lower") {
    desired = pos.clone().add(new THREE.Vector3(5.5, 4.2, 6.5));
    camera.position.lerp(desired, .15);
    camera.lookAt(pos.clone().add(new THREE.Vector3(0, .8, 0)));
  } else {
    desired = pos.clone().add(new THREE.Vector3(7.5, 8, 10));
    camera.position.lerp(desired, .12);
    camera.lookAt(pos.clone().add(new THREE.Vector3(0, 1.2, 0)));
  }
}

function animateOcean(time) {
  const pos = ocean.geometry.attributes.position;
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i), y = pos.getY(i);
    pos.setZ(i, Math.sin((x + time * .018) * .045) * .35 + Math.cos((y - time * .014) * .055) * .24);
  }
  pos.needsUpdate = true;
  ocean.geometry.computeVertexNormals();
}

function receiveEvent(event) {
  if (!event) return;
  if (event.kind === "toast") return showToast(event.text);
  if (event.kind === "cannon") {
    shotEvents.push({ ...event, started: performance.now() });
    showToast(event.hit ? `${TEAM_INFO[event.from].shipName} scored a hit on ${TEAM_INFO[event.to].shipName}.` : `${TEAM_INFO[event.from].shipName} fired.`);
  }
  if (event.kind === "grapple") {
    grappleEvents.push({ ...event, started: performance.now() });
    if (event.playerId === localId) showToast(`Grappling onto ${TEAM_INFO[event.to].shipName}…`);
  }
  if (event.kind === "victory") showVictory(event.winner, event.loser);
}

function broadcastEvent(event) {
  receiveEvent(event);
  if (network.isHost) network.broadcast({ type: "event", event });
}

const effectsGroup = new THREE.Group();
scene.add(effectsGroup);
function renderEffects(now) {
  effectsGroup.clear();
  shotEvents = shotEvents.filter((e) => now - e.started < 900);
  for (const e of shotEvents) {
    const a = gameState?.ships?.[e.from], b = gameState?.ships?.[e.to];
    if (!a || !b) continue;
    const t = Math.min(1, (now - e.started) / 650);
    const start = new THREE.Vector3(a.x, 6, a.z);
    const end = new THREE.Vector3(b.x, 5, b.z);
    const p = start.clone().lerp(end, t);
    p.y += Math.sin(Math.PI * t) * 8;
    const shell = new THREE.Mesh(new THREE.SphereGeometry(.36, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffd27b }));
    shell.position.copy(p);
    effectsGroup.add(shell);
  }
  grappleEvents = grappleEvents.filter((e) => now - e.started < 1500);
  for (const e of grappleEvents) {
    const a = gameState?.ships?.[e.from], b = gameState?.ships?.[e.to];
    if (!a || !b) continue;
    const points = [new THREE.Vector3(a.x, 5, a.z), new THREE.Vector3(b.x, 5, b.z)];
    effectsGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: 0xd8c29e })));
  }
}

const processedSeq = new Map();
function simStep(dt) {
  if (!network.isHost || !gameState || gameState.phase !== "playing") return;
  for (const [id, player] of Object.entries(gameState.players)) {
    const input = id === localId ? localInputSnapshot() : (inputs.get(id) || blankInput());
    processPlayerInput(player, input, dt);
  }
  simulateShips(dt);
  const now = performance.now();
  if (now - lastStateBroadcast > 1000 / STATE_HZ) {
    network.broadcast({ type: "state", state: gameState });
    lastStateBroadcast = now;
  }
}

function localInputSnapshot() {
  return {
    w: localKeys.w || touchVector.y < -.18,
    s: localKeys.s || touchVector.y > .18,
    a: localKeys.a || touchVector.x < -.18,
    d: localKeys.d || touchVector.x > .18,
    interactSeq: seqInteract,
    grappleSeq: seqGrapple,
    fireSeq: seqFire
  };
}

function processPlayerInput(player, input, dt) {
  if (!player.spawned) return;
  const seq = processedSeq.get(player.id) || { interact: 0, grapple: 0, fire: 0 };
  if ((input.interactSeq || 0) > seq.interact) { seq.interact = input.interactSeq; handleInteract(player); }
  if ((input.grappleSeq || 0) > seq.grapple) { seq.grapple = input.grappleSeq; handleGrapple(player); }
  if ((input.fireSeq || 0) > seq.fire) { seq.fire = input.fireSeq; handleFire(player); }
  processedSeq.set(player.id, seq);
  if (player.role) return;
  const speed = player.deck === "lower" ? 5.2 : 6.4;
  const dx = ((input.d ? 1 : 0) - (input.a ? 1 : 0)) * speed * dt;
  const dz = ((input.s ? 1 : 0) - (input.w ? 1 : 0)) * speed * dt;
  player.px = THREE.MathUtils.clamp(player.px + dx, -SHIP_HALF_WIDTH + .55, SHIP_HALF_WIDTH - .55);
  player.pz = THREE.MathUtils.clamp(player.pz + dz, -SHIP_HALF_LENGTH + 1, SHIP_HALF_LENGTH - 1);
}

function simulateShips(dt) {
  for (const team of ["british", "french"]) {
    const ship = gameState.ships[team];
    const captain = ship.captainId ? gameState.players[ship.captainId] : null;
    let targetSpeed = 0;
    let steer = 0;
    if (captain?.role === "captain" && captain.ship === team) {
      const input = captain.id === localId ? localInputSnapshot() : (inputs.get(captain.id) || blankInput());
      targetSpeed = (input.w ? 1 : 0) + (input.s ? -.55 : 0);
      steer = (input.a ? 1 : 0) - (input.d ? 1 : 0);
    }
    const mobilityFactor = .28 + .72 * (ship.mobility / 100);
    const maxSpeed = 10.5 * mobilityFactor;
    const desired = targetSpeed * maxSpeed;
    const accel = captain ? 4.2 : 7.5;
    ship.speed += THREE.MathUtils.clamp(desired - ship.speed, -accel * dt, accel * dt);
    if (Math.abs(ship.speed) < .03) ship.speed = 0;
    if (captain && Math.abs(ship.speed) > .25) ship.heading += steer * .62 * mobilityFactor * dt * Math.sign(ship.speed || 1);
    ship.x += Math.sin(ship.heading) * ship.speed * dt;
    ship.z += Math.cos(ship.heading) * ship.speed * dt;
    ship.x = THREE.MathUtils.clamp(ship.x, -310, 310);
    ship.z = THREE.MathUtils.clamp(ship.z, -310, 310);
  }
}

function handleInteract(player) {
  const action = interactionFor(player);
  if (!action) return;
  if (action.type === "leave-role") { releaseRole(player.id); return; }
  if (action.type === "captain") {
    const ship = gameState.ships[player.ship];
    if (ship.captainId && ship.captainId !== player.id) return sendPersonalToast(player.id, "The helm is occupied.");
    releaseRole(player.id);
    ship.captainId = player.id;
    player.role = "captain";
    player.px = 0;
    player.pz = 9;
  }
  if (action.type === "gunner") {
    const ship = gameState.ships[player.ship];
    if (ship.gunnerId && ship.gunnerId !== player.id) return sendPersonalToast(player.id, "The cannons are occupied.");
    releaseRole(player.id);
    ship.gunnerId = player.id;
    player.role = "gunner";
    player.px = 0;
    player.pz = -2;
  }
  if (action.type === "down") { player.deck = "lower"; player.px = 0; player.pz = 3.3; }
  if (action.type === "up") { player.deck = "upper"; player.px = 0; player.pz = 3.3; }
  if (action.type === "own-flag") sendPersonalToast(player.id, "That is your own flag.");
  if (action.type === "capture") finishBattle(player.team, player.ship, player.id);
}

function releaseRole(playerId) {
  const p = gameState?.players?.[playerId];
  if (!p) return;
  for (const ship of Object.values(gameState.ships)) {
    if (ship.captainId === playerId) ship.captainId = null;
    if (ship.gunnerId === playerId) ship.gunnerId = null;
  }
  p.role = null;
}

function handleGrapple(player) {
  if (player.role || player.deck !== "upper") return sendPersonalToast(player.id, "Leave your station before grappling.");
  const from = gameState.ships[player.ship];
  const targetTeam = player.ship === "british" ? "french" : "british";
  const target = gameState.ships[targetTeam];
  const distance = Math.hypot(target.x - from.x, target.z - from.z);
  if (distance > GRAPPLE_RANGE) return sendPersonalToast(player.id, "Enemy ship is too far away for the grappling hook.");
  const oldShip = player.ship;
  releaseRole(player.id);
  player.ship = targetTeam;
  player.deck = "upper";
  player.px = player.team === "british" ? -3.1 : 3.1;
  player.pz = 0;
  broadcastEvent({ kind: "grapple", playerId: player.id, from: oldShip, to: targetTeam });
}

function handleFire(player) {
  if (player.role !== "gunner") return;
  const ship = gameState.ships[player.ship];
  if (ship.gunnerId !== player.id) return;
  const now = Date.now();
  if (now - ship.lastShotAt < CANNON_COOLDOWN) return sendPersonalToast(player.id, "Cannons are reloading.");
  ship.lastShotAt = now;
  const targetTeam = player.ship === "british" ? "french" : "british";
  const target = gameState.ships[targetTeam];
  const dx = target.x - ship.x;
  const dz = target.z - ship.z;
  const distance = Math.hypot(dx, dz);
  const forwardX = Math.sin(ship.heading);
  const forwardZ = Math.cos(ship.heading);
  const dot = (dx * forwardX + dz * forwardZ) / Math.max(1, distance);
  const broadside = Math.abs(dot) < .58;
  const hit = distance <= CANNON_RANGE && broadside;
  if (hit) target.mobility = Math.max(20, target.mobility - 14);
  broadcastEvent({ kind: "cannon", from: player.ship, to: targetTeam, hit, mobility: target.mobility });
}

function sendPersonalToast(playerId, text) {
  if (playerId === localId) showToast(text);
  else network.sendTo(playerId, { type: "event", event: { kind: "toast", text } });
}

function finishBattle(winner, loser, playerId) {
  if (gameState.phase !== "playing") return;
  gameState.phase = "victory";
  gameState.winner = winner;
  for (const id of Object.keys(gameState.players)) releaseRole(id);
  broadcastEvent({ kind: "victory", winner, loser, playerId });
  network.broadcast({ type: "state", state: gameState });
}

function showVictory(winner, loser) {
  const info = TEAM_INFO[winner];
  victoryTitle.textContent = `${info.label} victory`;
  victoryText.textContent = `${TEAM_INFO[loser].label} flag captured.`;
  victory.classList.remove("hidden");
}

function sendCurrentInput() {
  if (!spawned || !gameState?.players?.[localId]) return;
  const input = localInputSnapshot();
  if (network.isHost) inputs.set(localId, input);
  else network.send({ type: "input", input });
}
setInterval(sendCurrentInput, 50);

window.addEventListener("keydown", (e) => {
  if (!spawned || ["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName)) return;
  const key = e.key.toLowerCase();
  if (["w", "a", "s", "d", " ", "e", "g"].includes(key)) e.preventDefault();
  if (key === "w") localKeys.w = true;
  if (key === "a") localKeys.a = true;
  if (key === "s") localKeys.s = true;
  if (key === "d") localKeys.d = true;
  if (key === "e" && !e.repeat) seqInteract += 1;
  if (key === "g" && !e.repeat) seqGrapple += 1;
  if (key === " " && !e.repeat) seqFire += 1;
  sendCurrentInput();
});
window.addEventListener("keyup", (e) => {
  const key = e.key.toLowerCase();
  if (key === "w") localKeys.w = false;
  if (key === "a") localKeys.a = false;
  if (key === "s") localKeys.s = false;
  if (key === "d") localKeys.d = false;
  sendCurrentInput();
});

touchInteract.addEventListener("pointerdown", (e) => { e.preventDefault(); seqInteract += 1; sendCurrentInput(); });
touchGrapple.addEventListener("pointerdown", (e) => { e.preventDefault(); seqGrapple += 1; sendCurrentInput(); });
touchFire.addEventListener("pointerdown", (e) => { e.preventDefault(); seqFire += 1; sendCurrentInput(); });

function updateJoystick(e) {
  const r = joystick.getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  let x = e.clientX - cx, y = e.clientY - cy;
  const max = r.width / 2 - 24;
  const len = Math.hypot(x, y) || 1;
  if (len > max) { x *= max / len; y *= max / len; }
  touchVector.x = x / max;
  touchVector.y = y / max;
  joystickKnob.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
}
joystick.addEventListener("pointerdown", (e) => { e.preventDefault(); touchPointerId = e.pointerId; joystick.setPointerCapture?.(e.pointerId); updateJoystick(e); });
joystick.addEventListener("pointermove", (e) => { if (e.pointerId === touchPointerId) updateJoystick(e); });
function resetJoystick(e) {
  if (touchPointerId !== null && e?.pointerId !== undefined && e.pointerId !== touchPointerId) return;
  touchPointerId = null;
  touchVector.x = touchVector.y = 0;
  joystickKnob.style.transform = "translate(-50%, -50%)";
}
joystick.addEventListener("pointerup", resetJoystick);
joystick.addEventListener("pointercancel", resetJoystick);

buildPalette();
renderJoinPicker();
createRoomBtn.addEventListener("click", createBattle);
showJoinBtn.addEventListener("click", () => { lobbyHome.classList.add("hidden"); joinPanel.classList.remove("hidden"); lobbyStatus.textContent = ""; });
joinBackBtn.addEventListener("click", () => { joinPanel.classList.add("hidden"); lobbyHome.classList.remove("hidden"); joinCode = []; renderJoinPicker(); });
joinRoomBtn.addEventListener("click", joinBattle);
spawnBtn.addEventListener("click", spawnLocal);
leaveBtn.addEventListener("click", () => returnToMenu("You left the battle."));
victoryLeaveBtn.addEventListener("click", () => returnToMenu());

window.addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight, false);
});
renderer.setSize(innerWidth, innerHeight, false);

let last = performance.now();
let simAccumulator = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(.05, (now - last) / 1000);
  last = now;
  animateOcean(now);
  if (gameState) {
    if (network.isHost) {
      simAccumulator += dt;
      const step = 1 / SIM_HZ;
      while (simAccumulator >= step) { simStep(step); simAccumulator -= step; }
    }
    renderState();
    renderEffects(now);
  }
  updateCamera();
  renderer.render(scene, camera);
}
requestAnimationFrame(frame);
