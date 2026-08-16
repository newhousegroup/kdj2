import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";

const TEAM = {
  british: { label: "British", ship: "HMS Resolute", color: 0xc34f4f },
  french: { label: "French", ship: "Fleur Royale", color: 0x4d72c7 }
};
const MAX_USERS = 6;
const GRAPPLE_RANGE = 48;
const STATE_INTERVAL = 80;
const $ = (s) => document.querySelector(s);

const ui = {
  lobby: $("#lobby"), deployment: $("#deployment"), hud: $("#hud"), victory: $("#victory"),
  name: $("#playerName"), lobbyHome: $("#lobbyHome"), joinPanel: $("#joinPanel"),
  create: $("#createRoomBtn"), showJoin: $("#showJoinBtn"), back: $("#joinBackBtn"), join: $("#joinRoomBtn"),
  joinCode: $("#joinCode"), palette: $("#colorPalette"), status: $("#lobbyStatus"),
  teamName: $("#teamName"), teamShip: $("#teamShipName"), spawn: $("#spawnBtn"),
  teamBadge: $("#teamBadge"), roomCode: $("#currentRoomCode"), people: $("#peopleCount"), dot: $("#connectionDot"),
  leave: $("#leaveBtn"), victoryLeave: $("#victoryLeaveBtn"), britishMobility: $("#britishMobility"), frenchMobility: $("#frenchMobility"),
  objective: $("#objective"), prompt: $("#interactionPrompt"), toast: $("#toast"),
  victoryTitle: $("#victoryTitle"), victoryText: $("#victoryText"),
  joystick: $("#joystick"), joystickKnob: $("#joystickKnob"), touchInteract: $("#touchInteract"),
  touchGrapple: $("#touchGrapple"), touchRigging: $("#touchRigging")
};

let joinCode = [];
let localId = null;
let localTeam = null;
let spawned = false;
let state = null;
let lastBroadcast = 0;
let toastTimer = null;
let seqInteract = 0;
let seqGrapple = 0;
let seqRig = 0;
let touchPointer = null;
const touch = { x: 0, y: 0 };
const keys = { w: false, a: false, s: false, d: false };
const inputs = new Map();
const processed = new Map();
const playerMeshes = new Map();
const shipMeshes = {};
const grappleFx = [];

const network = new window.KDJNetwork({
  onStatus: (text, kind) => setStatus(text, kind),
  onError: (error) => showToast(error?.message || "Network error"),
  onJoinRequest: ({ peerId, name }) => hostAddPlayer(peerId, name),
  onGuestLeft: (peerId) => hostRemovePlayer(peerId),
  onPacket: (from, packet) => onPacket(from, packet),
  onHostLeft: () => returnToMenu("The host left the battle.")
});

function setStatus(text, kind = "ready") {
  ui.dot.className = `connection-dot ${kind}`;
  ui.dot.title = text;
  if (!ui.lobby.classList.contains("hidden")) {
    ui.status.textContent = text;
    ui.status.classList.toggle("error", kind === "failure");
  }
}
function showToast(text, ms = 1900) {
  ui.toast.textContent = text;
  ui.toast.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ui.toast.classList.add("hidden"), ms);
}
function safeName() {
  return ui.name.value.trim().replace(/\s+/g, " ").slice(0, 20) || `Sailor ${Math.floor(10 + Math.random() * 90)}`;
}
function renderCode(el, code, editable = false) {
  el.replaceChildren();
  code.forEach((key, index) => {
    const color = window.KDJNetwork.colors.find((c) => c.key === String(key));
    const chip = document.createElement(editable ? "button" : "span");
    chip.className = "room-chip";
    chip.style.background = color?.hex || "#22313b";
    if (editable) chip.onclick = () => { joinCode.splice(index, 1); renderJoinCode(); };
    el.appendChild(chip);
  });
  if (editable) for (let i = code.length; i < 4; i += 1) {
    const empty = document.createElement("span");
    empty.className = "room-chip";
    empty.style.background = "#14232e";
    empty.style.boxShadow = "inset 0 0 0 1px #34444f";
    el.appendChild(empty);
  }
}
function renderJoinCode() { renderCode(ui.joinCode, joinCode, true); ui.join.disabled = joinCode.length !== 4; }
function buildPalette() {
  window.KDJNetwork.colors.forEach((c) => {
    const b = document.createElement("button");
    b.style.background = c.hex;
    b.onclick = () => { if (joinCode.length < 4) { joinCode.push(c.key); renderJoinCode(); } };
    ui.palette.appendChild(b);
  });
}
function chooseTeam() {
  const count = { british: 0, french: 0 };
  Object.values(state.players).forEach((p) => count[p.team]++);
  if (count.british !== count.french) return count.british < count.french ? "british" : "french";
  return Math.random() < .5 ? "british" : "french";
}
function playerRecord(id, name, team) {
  return { id, name, team, ship: team, deck: "upper", x: 0, z: 10, role: null, spawned: false };
}
function initialState(id, name) {
  state = {
    phase: "playing", winner: null,
    ships: {
      british: { x: -28, z: 0, heading: Math.PI / 2, speed: 0, mobility: 100, captain: null, sailmaster: null, boostUntil: 0 },
      french: { x: 28, z: 0, heading: -Math.PI / 2, speed: 0, mobility: 100, captain: null, sailmaster: null, boostUntil: 0 }
    }, players: {}
  };
  const team = Math.random() < .5 ? "british" : "french";
  state.players[id] = playerRecord(id, name, team);
}
function hostAddPlayer(id, name) {
  if (!network.isHost || !state || Object.keys(state.players).length >= MAX_USERS) return network.rejectGuest(id, "Battle is full (6 / 6).");
  const team = chooseTeam();
  state.players[id] = playerRecord(id, name, team);
  inputs.set(id, inputSnapshot());
  network.acceptGuest(id, { selfId: id, team, roomCode: network.roomCode, state });
  syncState();
}
function hostRemovePlayer(id) {
  if (!state?.players[id]) return;
  releaseRole(id);
  delete state.players[id];
  inputs.delete(id);
  syncState();
}
function onPacket(from, packet) {
  if (!packet || typeof packet !== "object") return;
  if (network.isHost) {
    if (packet.type === "input" && state?.players[from]) inputs.set(from, packet.input || {});
    if (packet.type === "spawn" && state?.players[from]) spawnPlayer(from);
    return;
  }
  if (packet.type === "state") { state = packet.state; syncLocal(); }
  if (packet.type === "event") receiveEvent(packet.event);
}
function syncState() { if (network.isHost) network.broadcast({ type: "state", state }); }
function syncLocal() {
  const p = state?.players?.[localId];
  if (!p) return;
  localTeam = p.team;
  spawned = p.spawned;
  ui.teamBadge.textContent = TEAM[localTeam].label;
  ui.teamBadge.className = `team-badge ${localTeam}`;
}

async function createBattle() {
  try {
    const room = await network.createRoom(safeName());
    localId = room.id;
    initialState(localId, room.name);
    localTeam = state.players[localId].team;
    inputs.set(localId, inputSnapshot());
    renderCode(ui.roomCode, room.code);
    showDeployment();
  } catch (e) { ui.status.textContent = e?.message || "Could not create battle."; ui.status.classList.add("error"); }
}
async function joinBattle() {
  try {
    const welcome = await network.joinRoom(safeName(), joinCode);
    localId = welcome.selfId || welcome.id;
    localTeam = welcome.team;
    state = welcome.state;
    renderCode(ui.roomCode, welcome.roomCode || joinCode);
    syncLocal();
    showDeployment();
  } catch (e) { ui.status.textContent = e?.message || "Could not join battle."; ui.status.classList.add("error"); }
}
function showDeployment() {
  ui.lobby.classList.add("hidden");
  ui.deployment.classList.remove("hidden");
  ui.teamName.textContent = TEAM[localTeam].label;
  ui.teamShip.textContent = TEAM[localTeam].ship;
  ui.spawn.textContent = `Spawn on ${TEAM[localTeam].ship}`;
}
function spawnPlayer(id) {
  const p = state.players[id];
  p.ship = p.team; p.deck = "upper"; p.x = 0; p.z = 10; p.role = null; p.spawned = true;
  syncState();
}
function spawnLocal() {
  if (network.isHost) spawnPlayer(localId); else network.send({ type: "spawn" });
  spawned = true;
  ui.deployment.classList.add("hidden");
  ui.hud.classList.remove("hidden");
  showToast(`Assigned to the ${TEAM[localTeam].label} crew.`);
}
function returnToMenu(message = "") {
  network.cleanup();
  localId = localTeam = null; spawned = false; state = null;
  ui.victory.classList.add("hidden"); ui.deployment.classList.add("hidden"); ui.hud.classList.add("hidden"); ui.lobby.classList.remove("hidden");
  ui.lobbyHome.classList.remove("hidden"); ui.joinPanel.classList.add("hidden"); joinCode = []; renderJoinCode(); ui.status.textContent = message;
}

const renderer = new THREE.WebGLRenderer({ canvas: $("#gameCanvas"), antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8fb2c2);
scene.fog = new THREE.Fog(0x8fb2c2, 120, 420);
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, .1, 900);
scene.add(new THREE.HemisphereLight(0xd9eef6, 0x21343c, 2));
const sun = new THREE.DirectionalLight(0xffefd0, 2.2); sun.position.set(70, 110, 40); scene.add(sun);
const ocean = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400, 32, 32), new THREE.MeshPhongMaterial({ color: 0x174a65, shininess: 80, side: THREE.DoubleSide }));
ocean.rotation.x = -Math.PI / 2; scene.add(ocean);
const world = new THREE.Group(); scene.add(world);
const effects = new THREE.Group(); scene.add(effects);

function makeShip(team) {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x55392c, roughness: .8 });
  const deckMat = new THREE.MeshStandardMaterial({ color: 0xaa8154, roughness: .9 });
  const hull = new THREE.Mesh(new THREE.BoxGeometry(9.5, 4, 31), wood); hull.position.y = 1.8; g.add(hull);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(9, .5, 30), deckMat); deck.position.y = 4; g.add(deck);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(.22, .28, 14, 10), wood); mast.position.set(0, 10.5, -1); g.add(mast);
  const sail = new THREE.Mesh(new THREE.PlaneGeometry(8.5, 7), new THREE.MeshStandardMaterial({ color: 0xe7dfc7, side: THREE.DoubleSide })); sail.position.set(0, 11.5, -1); sail.rotation.y = Math.PI / 2; g.add(sail);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.2), new THREE.MeshBasicMaterial({ color: TEAM[team].color, side: THREE.DoubleSide })); flag.position.set(0, 17, -1); flag.rotation.y = Math.PI / 2; g.add(flag);
  const helm = new THREE.Mesh(new THREE.TorusGeometry(1.0, .13, 8, 20), new THREE.MeshStandardMaterial({ color: 0x231c18 })); helm.position.set(0, 5.1, 9); helm.rotation.y = Math.PI / 2; g.add(helm);
  const rigging = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1, 2.4), wood); rigging.position.set(0, 4.7, -2); g.add(rigging);
  const hatch = new THREE.Mesh(new THREE.BoxGeometry(2.8, .15, 3), new THREE.MeshStandardMaterial({ color: 0x493126 })); hatch.position.set(0, 4.32, 3.3); g.add(hatch);
  const lower = new THREE.Group();
  const floor = new THREE.Mesh(new THREE.BoxGeometry(8, .2, 25), new THREE.MeshStandardMaterial({ color: 0x704c34 })); floor.position.y = .2; lower.add(floor);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(.08, .08, 2.6, 8), wood); pole.position.set(0, 1.5, -7.5); lower.add(pole);
  const lowerFlag = new THREE.Mesh(new THREE.PlaneGeometry(2, 1), new THREE.MeshBasicMaterial({ color: TEAM[team].color, side: THREE.DoubleSide })); lowerFlag.position.set(1, 2.2, -7.5); lower.add(lowerFlag);
  g.add(lower); world.add(g);
  return { group: g, hull, deck, lower };
}
shipMeshes.british = makeShip("british"); shipMeshes.french = makeShip("french");

function makePlayer(p) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(.45, .5, 1.4, 10), new THREE.MeshStandardMaterial({ color: TEAM[p.team].color })); body.position.y = .75; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(.36, 10, 8), new THREE.MeshStandardMaterial({ color: 0xe1b98b })); head.position.y = 1.7; g.add(head);
  world.add(g); playerMeshes.set(p.id, g); return g;
}
function toWorld(ship, x, z, y) {
  const s = Math.sin(ship.heading), c = Math.cos(ship.heading);
  return new THREE.Vector3(ship.x + x * c + z * s, y, ship.z - x * s + z * c);
}
function renderState() {
  if (!state) return;
  ["british", "french"].forEach((team) => {
    const s = state.ships[team], v = shipMeshes[team];
    v.group.position.set(s.x, 0, s.z); v.group.rotation.y = s.heading;
  });
  const alive = new Set();
  Object.values(state.players).forEach((p) => {
    if (!p.spawned) return;
    alive.add(p.id);
    const mesh = playerMeshes.get(p.id) || makePlayer(p);
    mesh.position.lerp(toWorld(state.ships[p.ship], p.x, p.z, p.deck === "lower" ? .5 : 4.35), p.id === localId ? 1 : .35);
  });
  for (const [id, mesh] of playerMeshes) if (!alive.has(id)) { world.remove(mesh); playerMeshes.delete(id); }
  const local = state.players[localId];
  ["british", "french"].forEach((team) => {
    const inside = local?.spawned && local.ship === team && local.deck === "lower";
    const v = shipMeshes[team];
    v.hull.material.transparent = inside; v.hull.material.opacity = inside ? .12 : 1;
    v.deck.material.transparent = inside; v.deck.material.opacity = inside ? .12 : 1;
    v.lower.visible = inside;
  });
  ui.britishMobility.textContent = `Mobility ${Math.round(state.ships.british.mobility)}%`;
  ui.frenchMobility.textContent = `Mobility ${Math.round(state.ships.french.mobility)}%`;
  ui.people.textContent = `${Object.keys(state.players).length} / ${MAX_USERS}`;
  updateObjective(local);
}

function interaction(p) {
  if (!p?.spawned) return null;
  if (p.role) return { type: "leave", label: p.role === "captain" ? "Leave helm" : "Leave rigging" };
  const near = (x, z, r) => Math.hypot(p.x - x, p.z - z) <= r;
  if (p.deck === "upper") {
    if (p.team === p.ship && near(0, 9, 2.4)) return { type: "captain", label: "Take the helm" };
    if (p.team === p.ship && near(0, -2, 2.6)) return { type: "sailmaster", label: "Work the rigging" };
    if (near(0, 3.3, 2.2)) return { type: "down", label: "Go below deck" };
  } else {
    if (near(0, 3.3, 2.2)) return { type: "up", label: "Return to deck" };
    if (near(0, -7.5, 2.5)) return p.team === p.ship ? { type: "own", label: "Your flag" } : { type: "capture", label: `Capture ${TEAM[p.ship].label} flag` };
  }
  return null;
}
function updateObjective(p) {
  if (!p?.spawned) return;
  if (p.role === "captain") ui.objective.textContent = `Captain of ${TEAM[p.ship].ship} · WASD to steer · E to leave helm`;
  else if (p.role === "sailmaster") ui.objective.textContent = `Sailmaster on ${TEAM[p.ship].ship} · Space / SAILS to trim sails · E to leave rigging`;
  else if (p.ship !== p.team) ui.objective.textContent = p.deck === "lower" ? "Find and capture the enemy flag." : "Boarding enemy ship · find the hatch.";
  else ui.objective.textContent = "Capture the enemy flag below deck.";
  const a = interaction(p);
  if (a) { ui.prompt.textContent = `E · ${a.label}`; ui.prompt.classList.remove("hidden"); } else ui.prompt.classList.add("hidden");
}

function inputSnapshot() {
  return { w: keys.w || touch.y < -.18, s: keys.s || touch.y > .18, a: keys.a || touch.x < -.18, d: keys.d || touch.x > .18, interactSeq: seqInteract, grappleSeq: seqGrapple, rigSeq: seqRig };
}
function processPlayer(p, input, dt) {
  if (!p.spawned) return;
  const seq = processed.get(p.id) || { interact: 0, grapple: 0, rig: 0 };
  if ((input.interactSeq || 0) > seq.interact) { seq.interact = input.interactSeq; handleInteract(p); }
  if ((input.grappleSeq || 0) > seq.grapple) { seq.grapple = input.grappleSeq; handleGrapple(p); }
  if ((input.rigSeq || 0) > seq.rig) { seq.rig = input.rigSeq; handleRigging(p); }
  processed.set(p.id, seq);
  if (p.role) return;
  const speed = p.deck === "lower" ? 5 : 6.2;
  p.x = THREE.MathUtils.clamp(p.x + ((input.d ? 1 : 0) - (input.a ? 1 : 0)) * speed * dt, -3.9, 3.9);
  p.z = THREE.MathUtils.clamp(p.z + ((input.s ? 1 : 0) - (input.w ? 1 : 0)) * speed * dt, -14, 14);
}
function simulateShips(dt) {
  for (const team of ["british", "french"]) {
    const ship = state.ships[team];
    const captain = ship.captain ? state.players[ship.captain] : null;
    const input = captain ? (captain.id === localId ? inputSnapshot() : inputs.get(captain.id) || {}) : {};
    const throttle = captain ? (input.w ? 1 : 0) + (input.s ? -.5 : 0) : 0;
    const steer = captain ? (input.a ? 1 : 0) - (input.d ? 1 : 0) : 0;
    const boost = Date.now() < ship.boostUntil ? 1.18 : 1;
    const desired = throttle * 10.5 * boost;
    ship.speed += THREE.MathUtils.clamp(desired - ship.speed, -7 * dt, 4 * dt);
    if (Math.abs(ship.speed) < .04) ship.speed = 0;
    if (captain && Math.abs(ship.speed) > .2) ship.heading += steer * .62 * dt * Math.sign(ship.speed);
    ship.x += Math.sin(ship.heading) * ship.speed * dt;
    ship.z += Math.cos(ship.heading) * ship.speed * dt;
  }
}
function handleInteract(p) {
  const a = interaction(p); if (!a) return;
  if (a.type === "leave") return releaseRole(p.id);
  if (a.type === "captain") {
    const ship = state.ships[p.ship]; if (ship.captain && ship.captain !== p.id) return personal(p.id, "The helm is occupied.");
    releaseRole(p.id); ship.captain = p.id; p.role = "captain"; p.x = 0; p.z = 9;
  }
  if (a.type === "sailmaster") {
    const ship = state.ships[p.ship]; if (ship.sailmaster && ship.sailmaster !== p.id) return personal(p.id, "The rigging station is occupied.");
    releaseRole(p.id); ship.sailmaster = p.id; p.role = "sailmaster"; p.x = 0; p.z = -2;
  }
  if (a.type === "down") { p.deck = "lower"; p.x = 0; p.z = 3.3; }
  if (a.type === "up") { p.deck = "upper"; p.x = 0; p.z = 3.3; }
  if (a.type === "own") personal(p.id, "That is your own flag.");
  if (a.type === "capture") finishBattle(p.team, p.ship);
}
function releaseRole(id) {
  const p = state?.players?.[id]; if (!p) return;
  for (const ship of Object.values(state.ships)) { if (ship.captain === id) ship.captain = null; if (ship.sailmaster === id) ship.sailmaster = null; }
  p.role = null;
}
function handleRigging(p) {
  if (p.role !== "sailmaster") return;
  const ship = state.ships[p.ship]; if (ship.sailmaster !== p.id) return;
  ship.boostUntil = Date.now() + 1800; personal(p.id, "Sails trimmed — speed boost active.");
}
function handleGrapple(p) {
  if (p.role || p.deck !== "upper") return personal(p.id, "Leave your station before boarding.");
  const other = p.ship === "british" ? "french" : "british";
  const a = state.ships[p.ship], b = state.ships[other];
  if (Math.hypot(a.x - b.x, a.z - b.z) > GRAPPLE_RANGE) return personal(p.id, "The other ship is too far away.");
  const from = p.ship; p.ship = other; p.deck = "upper"; p.x = p.team === "british" ? -3 : 3; p.z = 0;
  event({ kind: "grapple", playerId: p.id, from, to: other });
}
function personal(id, text) { if (id === localId) showToast(text); else network.sendTo(id, { type: "event", event: { kind: "toast", text } }); }
function event(e) { receiveEvent(e); if (network.isHost) network.broadcast({ type: "event", event: e }); }
function receiveEvent(e) {
  if (!e) return;
  if (e.kind === "toast") showToast(e.text);
  if (e.kind === "grapple") grappleFx.push({ ...e, start: performance.now() });
  if (e.kind === "victory") showVictory(e.winner, e.loser);
}
function finishBattle(winner, loser) { if (state.phase !== "playing") return; state.phase = "victory"; state.winner = winner; event({ kind: "victory", winner, loser }); syncState(); }
function showVictory(winner, loser) { ui.victoryTitle.textContent = `${TEAM[winner].label} victory`; ui.victoryText.textContent = `${TEAM[loser].label} flag captured.`; ui.victory.classList.remove("hidden"); }

function updateCamera() {
  const p = state?.players?.[localId];
  if (!p?.spawned) { camera.position.lerp(new THREE.Vector3(64, 42, 64), .04); camera.lookAt(0, 3, 0); return; }
  const ship = state.ships[p.ship]; const pos = toWorld(ship, p.x, p.z, p.deck === "lower" ? 1 : 5);
  let desired = pos.clone().add(new THREE.Vector3(7, p.deck === "lower" ? 4 : 8, 10));
  if (p.role === "captain") desired = toWorld(ship, 0, 19, 13);
  camera.position.lerp(desired, .11); camera.lookAt(pos.clone().add(new THREE.Vector3(0, 1, 0)));
}
function renderEffects(now) {
  effects.clear();
  for (let i = grappleFx.length - 1; i >= 0; i--) {
    const e = grappleFx[i]; if (now - e.start > 1400) { grappleFx.splice(i, 1); continue; }
    const a = state?.ships[e.from], b = state?.ships[e.to]; if (!a || !b) continue;
    effects.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(a.x, 5, a.z), new THREE.Vector3(b.x, 5, b.z)]), new THREE.LineBasicMaterial({ color: 0xd8c29e })));
  }
}

setInterval(() => {
  if (!spawned || !state?.players?.[localId]) return;
  const input = inputSnapshot(); if (network.isHost) inputs.set(localId, input); else network.send({ type: "input", input });
}, 50);

window.addEventListener("keydown", (e) => {
  if (!spawned || ["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName)) return;
  const k = e.key.toLowerCase(); if (["w", "a", "s", "d", "e", "g", " "].includes(k)) e.preventDefault();
  if (k in keys) keys[k] = true;
  if (k === "e" && !e.repeat) seqInteract++;
  if (k === "g" && !e.repeat) seqGrapple++;
  if (k === " " && !e.repeat) seqRig++;
});
window.addEventListener("keyup", (e) => { const k = e.key.toLowerCase(); if (k in keys) keys[k] = false; });
ui.touchInteract.onpointerdown = (e) => { e.preventDefault(); seqInteract++; };
ui.touchGrapple.onpointerdown = (e) => { e.preventDefault(); seqGrapple++; };
ui.touchRigging.onpointerdown = (e) => { e.preventDefault(); seqRig++; };
function joy(e) {
  const r = ui.joystick.getBoundingClientRect(), max = r.width / 2 - 24;
  let x = e.clientX - r.left - r.width / 2, y = e.clientY - r.top - r.height / 2;
  const len = Math.hypot(x, y) || 1; if (len > max) { x *= max / len; y *= max / len; }
  touch.x = x / max; touch.y = y / max; ui.joystickKnob.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
}
ui.joystick.onpointerdown = (e) => { e.preventDefault(); touchPointer = e.pointerId; ui.joystick.setPointerCapture?.(e.pointerId); joy(e); };
ui.joystick.onpointermove = (e) => { if (e.pointerId === touchPointer) joy(e); };
const resetJoy = () => { touchPointer = null; touch.x = touch.y = 0; ui.joystickKnob.style.transform = "translate(-50%, -50%)"; };
ui.joystick.onpointerup = resetJoy; ui.joystick.onpointercancel = resetJoy;

buildPalette(); renderJoinCode();
ui.create.onclick = createBattle;
ui.showJoin.onclick = () => { ui.lobbyHome.classList.add("hidden"); ui.joinPanel.classList.remove("hidden"); };
ui.back.onclick = () => { ui.joinPanel.classList.add("hidden"); ui.lobbyHome.classList.remove("hidden"); joinCode = []; renderJoinCode(); };
ui.join.onclick = joinBattle;
ui.spawn.onclick = spawnLocal;
ui.leave.onclick = () => returnToMenu("You left the battle.");
ui.victoryLeave.onclick = () => returnToMenu();

function resize() { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight, false); }
window.addEventListener("resize", resize); resize();
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  if (network.isHost && state?.phase === "playing") {
    for (const [id, p] of Object.entries(state.players)) processPlayer(p, id === localId ? inputSnapshot() : inputs.get(id) || {}, dt);
    simulateShips(dt);
    if (now - lastBroadcast > STATE_INTERVAL) { syncState(); lastBroadcast = now; }
  }
  if (state) { renderState(); renderEffects(now); }
  updateCamera(); renderer.render(scene, camera);
}
requestAnimationFrame(frame);
