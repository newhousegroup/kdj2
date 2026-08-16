import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";

const TEAM = {
british: { label: "British", ship: "HMS Resolute", color: 0xc34f4f, stripe: 0xe7d7c8 },
french: { label: "French", ship: "Fleur Royale", color: 0x4d72c7, stripe: 0xd9e0ee }
};

const MAX_USERS = 6;
const GRAPPLE_RANGE = 48;
const STATE_INTERVAL = 80;
const CAMERA_KEY = "kdj2-camera-mode";
const SHIP_HALF_WIDTH = 4.95;
const SHIP_HALF_LENGTH = 16.9;
const LOWER_FLOOR_Y = 0.68;
const LOWER_PLAYER_Y = 0.76;
const LOWER_EYE_Y = 2.72;
const $ = (s) => document.querySelector(s);

const ui = {
lobby: $("#lobby"), deployment: $("#deployment"), hud: $("#hud"), victory: $("#victory"),
name: $("#playerName"), lobbyHome: $("#lobbyHome"), joinPanel: $("#joinPanel"),
create: $("#createRoomBtn"), showJoin: $("#showJoinBtn"), back: $("#joinBackBtn"), join: $("#joinRoomBtn"),
joinCode: $("#joinCode"), palette: $("#colorPalette"), status: $("#lobbyStatus"),
teamName: $("#teamName"), teamShip: $("#teamShipName"), spawn: $("#spawnBtn"),
teamBadge: $("#teamBadge"), roomCode: $("#currentRoomCode"), people: $("#peopleCount"), dot: $("#connectionDot"),
settings: $("#settingsBtn"), settingsPanel: $("#settingsPanel"), settingsClose: $("#settingsCloseBtn"),
firstPerson: $("#firstPersonBtn"), thirdPerson: $("#thirdPersonBtn"), crosshair: $("#crosshair"),
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
let collisionToastAt = 0;
let seqInteract = 0;
let seqGrapple = 0;
let seqRig = 0;
let touchPointer = null;
let lookPointer = null;
let lookLastX = 0;
let lookLastY = 0;
let viewYaw = 0;
let viewPitch = -0.04;
let cameraMode = loadCameraMode();
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

function loadCameraMode() {
try { return localStorage.getItem(CAMERA_KEY) === "third" ? "third" : "first"; }
catch (_) { return "first"; }
}

function setCameraMode(mode) {
cameraMode = mode === "third" ? "third" : "first";
try { localStorage.setItem(CAMERA_KEY, cameraMode); } catch (_) {}
ui.firstPerson?.classList.toggle("active", cameraMode === "first");
ui.thirdPerson?.classList.toggle("active", cameraMode === "third");
ui.crosshair?.classList.toggle("third-person", cameraMode === "third");
}

function openSettings() {
if (!ui.settingsPanel) return;
document.exitPointerLock?.();
ui.settingsPanel.classList.remove("hidden");
ui.settingsPanel.setAttribute("aria-hidden", "false");
setCameraMode(cameraMode);
}

function closeSettings() {
if (!ui.settingsPanel) return;
ui.settingsPanel.classList.add("hidden");
ui.settingsPanel.setAttribute("aria-hidden", "true");
}

function settingsOpen() {
return !ui.settingsPanel?.classList.contains("hidden");
}

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
if (editable) {
for (let i = code.length; i < 4; i += 1) {
const empty = document.createElement("span");
empty.className = "room-chip";
empty.style.background = "#14232e";
empty.style.boxShadow = "inset 0 0 0 1px #34444f";
el.appendChild(empty);
}
}
}

function renderJoinCode() {
renderCode(ui.joinCode, joinCode, true);
ui.join.disabled = joinCode.length !== 4;
}

function buildPalette() {
window.KDJNetwork.colors.forEach((c) => {
const b = document.createElement("button");
b.style.background = c.hex;
b.onclick = () => {
if (joinCode.length < 4) {
joinCode.push(c.key);
renderJoinCode();
}
};
ui.palette.appendChild(b);
});
}

function chooseTeam() {
const count = { british: 0, french: 0 };
Object.values(state.players).forEach((p) => count[p.team]++);
if (count.british !== count.french) return count.british < count.french ? "british" : "french";
return Math.random() < 0.5 ? "british" : "french";
}

function playerRecord(id, name, team) {
return { id, name, team, ship: team, deck: "upper", x: 0, z: 10, yaw: 0, role: null, spawned: false };
}

function initialState(id, name) {
state = {
phase: "playing",
winner: null,
ships: {
british: { x: -30, z: 0, heading: Math.PI / 2, speed: 0, mobility: 100, captain: null, sailmaster: null, boostUntil: 0 },
french: { x: 30, z: 0, heading: -Math.PI / 2, speed: 0, mobility: 100, captain: null, sailmaster: null, boostUntil: 0 }
},
players: {}
};
const team = Math.random() < 0.5 ? "british" : "french";
state.players[id] = playerRecord(id, name, team);
}

function hostAddPlayer(id, name) {
if (!network.isHost || !state || Object.keys(state.players).length >= MAX_USERS) {
return network.rejectGuest(id, "Battle is full (6 / 6).");
}
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
if (packet.type === "state") {
state = packet.state;
syncLocal();
}
if (packet.type === "event") receiveEvent(packet.event);
}

function syncState() {
if (network.isHost) network.broadcast({ type: "state", state });
}

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
} catch (e) {
ui.status.textContent = e?.message || "Could not create battle.";
ui.status.classList.add("error");
}
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
} catch (e) {
ui.status.textContent = e?.message || "Could not join battle.";
ui.status.classList.add("error");
}
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
p.ship = p.team;
p.deck = "upper";
p.x = 0;
p.z = 10;
p.yaw = 0;
p.role = null;
p.spawned = true;
syncState();
}

function spawnLocal() {
if (network.isHost) spawnPlayer(localId);
else network.send({ type: "spawn" });
spawned = true;
viewYaw = 0;
viewPitch = -0.04;
ui.deployment.classList.add("hidden");
ui.hud.classList.remove("hidden");
const lookHelp = matchMedia("(hover: none), (pointer: coarse)").matches
? "Drag open space to look around."
: "Click the world for mouse look.";
showToast(`${TEAM[localTeam].label} crew · ${lookHelp}`, 3200);
}

function returnToMenu(message = "") {
document.exitPointerLock?.();
closeSettings();
network.cleanup();
localId = null;
localTeam = null;
spawned = false;
state = null;
ocean.visible = true;
ui.touchRigging?.classList.add("hidden");
ui.victory.classList.add("hidden");
ui.deployment.classList.add("hidden");
ui.hud.classList.add("hidden");
ui.lobby.classList.remove("hidden");
ui.lobbyHome.classList.remove("hidden");
ui.joinPanel.classList.add("hidden");
joinCode = [];
renderJoinCode();
ui.status.textContent = message;
}

const renderer = new THREE.WebGLRenderer({
canvas: $("#gameCanvas"),
antialias: true,
powerPreference: "high-performance"
});
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x8aaeba, 150, 560);
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.06, 1000);

const sky = new THREE.Mesh(
new THREE.SphereGeometry(700, 28, 16),
new THREE.ShaderMaterial({
side: THREE.BackSide,
depthWrite: false,
uniforms: { uSun: { value: new THREE.Vector3(0.45, 0.65, 0.3).normalize() } },
vertexShader: `varying vec3 vWorld; void main(){ vec4 w=modelMatrix*vec4(position,1.0); vWorld=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
fragmentShader: `varying vec3 vWorld; uniform vec3 uSun; void main(){ vec3 d=normalize(vWorld); float h=clamp(d.y*.5+.5,0.0,1.0); vec3 horizon=vec3(.58,.72,.77); vec3 zenith=vec3(.20,.43,.58); vec3 c=mix(horizon,zenith,smoothstep(.25,.95,h)); float glow=pow(max(dot(d,uSun),0.0),28.0); c+=vec3(1.0,.72,.42)*glow*.32; gl_FragColor=vec4(c,1.0); }`
})
);
scene.add(sky);
scene.add(new THREE.HemisphereLight(0xdff4ff, 0x26311f, 1.65));
scene.add(new THREE.AmbientLight(0xffffff, 0.18));

const sun = new THREE.DirectionalLight(0xffefcf, 2.8);
sun.position.set(80, 120, 55);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -90;
sun.shadow.camera.right = 90;
sun.shadow.camera.top = 90;
sun.shadow.camera.bottom = -90;
sun.shadow.camera.near = 20;
sun.shadow.camera.far = 260;
scene.add(sun);

const oceanMaterial = new THREE.ShaderMaterial({
uniforms: { uTime: { value: 0 } },
vertexShader: `uniform float uTime; varying float vWave; varying vec3 vWorld; void main(){ vec3 p=position; float w=sin(p.x*.035+uTime*1.25)*.28+cos(p.y*.029-uTime*.92)*.20+sin((p.x+p.y)*.018+uTime*.58)*.12; p.z+=w; vWave=w; vec4 world=modelMatrix*vec4(p,1.0); vWorld=world.xyz; gl_Position=projectionMatrix*viewMatrix*world; }`,
fragmentShader: `uniform float uTime; varying float vWave; varying vec3 vWorld; void main(){ vec3 deep=vec3(.025,.20,.30); vec3 high=vec3(.08,.39,.52); float t=smoothstep(-.55,.58,vWave); vec3 c=mix(deep,high,t); float sparkle=pow(max(0.0,sin((vWorld.x-vWorld.z)*.11+uTime*1.7)),22.0)*.08; c+=vec3(.65,.82,.87)*sparkle; float dist=length(cameraPosition.xz-vWorld.xz); float haze=smoothstep(210.0,560.0,dist); c=mix(c,vec3(.43,.63,.70),haze); gl_FragColor=vec4(c,1.0); }`
});

const ocean = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400, 86, 86), oceanMaterial);
ocean.rotation.x = -Math.PI / 2;
ocean.receiveShadow = true;
scene.add(ocean);

const clouds = new THREE.Group();
const cloudMat = new THREE.MeshBasicMaterial({ color: 0xf2f0e7, transparent: true, opacity: 0.36, depthWrite: false });
for (let i = 0; i < 14; i += 1) {
const c = new THREE.Group();
const puffCount = 3 + (i % 3);
for (let j = 0; j < puffCount; j += 1) {
const puff = new THREE.Mesh(new THREE.SphereGeometry(7 + (j % 2) * 3, 8, 6), cloudMat);
puff.scale.y = 0.45;
puff.position.set(j * 8 - puffCount * 3, (j % 2) * 2, (j % 3) * 2);
c.add(puff);
}
c.position.set((Math.random() - 0.5) * 480, 70 + Math.random() * 45, (Math.random() - 0.5) * 480);
c.userData.speed = 0.45 + Math.random() * 0.35;
clouds.add(c);
}
scene.add(clouds);

const world = new THREE.Group();
const effects = new THREE.Group();
scene.add(world, effects);

function canvasTexture(size, draw) {
const c = document.createElement("canvas");
c.width = c.height = size;
const ctx = c.getContext("2d");
draw(ctx, size);
const t = new THREE.CanvasTexture(c);
t.colorSpace = THREE.SRGBColorSpace;
t.wrapS = t.wrapT = THREE.RepeatWrapping;
return t;
}

const deckTexture = canvasTexture(512, (ctx, s) => {
ctx.fillStyle = "#a97e4f";
ctx.fillRect(0, 0, s, s);
ctx.strokeStyle = "rgba(52,31,18,.34)";
ctx.lineWidth = 3;
for (let x = 0; x <= s; x += 64) {
ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, s); ctx.stroke();
}
for (let y = 0; y <= s; y += 32) {
ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(s, y); ctx.stroke();
}
ctx.fillStyle = "rgba(45,28,18,.22)";
for (let i = 0; i < 30; i += 1) ctx.fillRect((i * 97) % s, (i * 53) % s, 5, 3);
});
deckTexture.repeat.set(4, 12);

function sailTexture(team) {
return canvasTexture(256, (ctx, s) => {
const teamHex = `#${TEAM[team].color.toString(16).padStart(6, "0")}`;
ctx.fillStyle = "#e8dfc8";
ctx.fillRect(0, 0, s, s);
ctx.strokeStyle = "rgba(92,74,52,.16)";
ctx.lineWidth = 2;
for (let y = 12; y < s; y += 18) {
ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(s, y); ctx.stroke();
}
ctx.strokeStyle = "rgba(70,53,36,.13)";
for (let x = 18; x < s; x += 30) {
ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, s); ctx.stroke();
}
ctx.fillStyle = teamHex;
ctx.globalAlpha = 0.8;
ctx.fillRect(s * 0.465, 0, s * 0.07, s);
ctx.fillRect(0, s * 0.465, s, s * 0.07);
ctx.globalAlpha = 1;
});
}

function addBox(parent, size, material, position, rotation = null) {
const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
mesh.position.set(...position);
if (rotation) mesh.rotation.set(...rotation);
parent.add(mesh);
return mesh;
}

function addCylinder(parent, radius, height, material, position, rotation = null, segments = 12) {
const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, segments), material);
mesh.position.set(...position);
if (rotation) mesh.rotation.set(...rotation);
parent.add(mesh);
return mesh;
}

function addRope(parent, points, color = 0x46382c) {
const line = new THREE.Line(
new THREE.BufferGeometry().setFromPoints(points.map((p) => new THREE.Vector3(...p))),
new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.78 })
);
parent.add(line);
return line;
}

function setShadows(root) {
root.traverse((o) => {
if (o.isMesh) {
o.castShadow = true;
o.receiveShadow = true;
}
});
}

function billowGeometry(width, height, bend = 0.42, segmentsX = 7, segmentsY = 7) {
const geometry = new THREE.PlaneGeometry(width, height, segmentsX, segmentsY);
const attr = geometry.attributes.position;
for (let i = 0; i < attr.count; i += 1) {
const nx = attr.getX(i) / (width / 2);
const ny = attr.getY(i) / (height / 2);
const edge = Math.max(0, 1 - nx * nx) * Math.max(0.2, 1 - 0.45 * ny * ny);
attr.setZ(i, -bend * edge);
}
attr.needsUpdate = true;
geometry.computeVertexNormals();
return geometry;
}

function addSquareSail(parent, sailMat, darkWood, spec, sails) {
const { z, y, width, height, bend = 0.42 } = spec;
addCylinder(parent, 0.09, width + 0.8, darkWood, [0, y + height / 2 + 0.34, z], [0, 0, Math.PI / 2]);
addCylinder(parent, 0.07, width + 0.35, darkWood, [0, y - height / 2 - 0.18, z], [0, 0, Math.PI / 2]);
const sail = new THREE.Mesh(billowGeometry(width, height, bend), sailMat);
sail.position.set(0, y, z);
sail.userData.baseRotationY = 0;
parent.add(sail);
sails.push(sail);
addRope(parent, [[-width / 2, y + height / 2, z], [-width / 2, y - height / 2, z]]);
addRope(parent, [[width / 2, y + height / 2, z], [width / 2, y - height / 2, z]]);
return sail;
}

function addTriangleSail(parent, material, points, z, sails) {
const shape = new THREE.Shape();
shape.moveTo(points[0][0], points[0][1]);
shape.lineTo(points[1][0], points[1][1]);
shape.lineTo(points[2][0], points[2][1]);
shape.closePath();
const sail = new THREE.Mesh(new THREE.ShapeGeometry(shape, 6), material);
sail.position.z = z;
sail.userData.baseRotationY = 0;
parent.add(sail);
sails.push(sail);
return sail;
}

function makeShip(team) {
const group = new THREE.Group();
const exterior = new THREE.Group();
const lower = new THREE.Group();
const sails = [];
group.add(exterior, lower);

const wood = new THREE.MeshStandardMaterial({ color: team === "british" ? 0x4b3024 : 0x513629, roughness: 0.82 });
const darkWood = new THREE.MeshStandardMaterial({ color: 0x2b211b, roughness: 0.9 });
const interiorWood = new THREE.MeshStandardMaterial({ color: 0x5a3a29, roughness: 0.97 });
const deckMat = new THREE.MeshStandardMaterial({ color: 0xa97e4f, map: deckTexture, roughness: 0.86 });
const metal = new THREE.MeshStandardMaterial({ color: 0x343b3d, metalness: 0.68, roughness: 0.38 });
const stripeMat = new THREE.MeshStandardMaterial({ color: TEAM[team].color, roughness: 0.7 });
const sailMat = new THREE.MeshStandardMaterial({ map: sailTexture(team), color: 0xffffff, side: THREE.DoubleSide, roughness: 0.84 });

const hull = addBox(exterior, [9.6, 3.8, 24], wood, [0, 2.1, 1.8]);
const bow = new THREE.Mesh(new THREE.ConeGeometry(5.05, 9, 4, 1), wood);
bow.rotation.set(-Math.PI / 2, Math.PI / 4, 0);
bow.position.set(0, 2.1, -14.5);
exterior.add(bow);
addBox(exterior, [8.7, 4.1, 6], wood, [0, 2.25, 13.4]);
addBox(exterior, [9.72, 0.52, 19], stripeMat, [0, 2.45, 2.5]);
addBox(exterior, [1.1, 1.2, 30], darkWood, [0, 0.35, 0]);
const deck = addBox(exterior, [9.15, 0.45, 29.5], deckMat, [0, 4.15, 0.4]);

for (const side of [-1, 1]) {
addBox(exterior, [0.14, 0.14, 27], darkWood, [side * 4.48, 5.08, 0.4]);
for (let z = -12; z <= 13; z += 4.2) addCylinder(exterior, 0.07, 1.15, darkWood, [side * 4.48, 4.58, z]);
}
addBox(exterior, [8.5, 0.14, 0.14], darkWood, [0, 5.08, 14.35]);

const masts = [
{ z: -8.7, height: 16.0 },
{ z: -1.6, height: 18.0 },
{ z: 7.1, height: 13.2 }
];
for (const mast of masts) {
addCylinder(exterior, 0.25, mast.height, darkWood, [0, 4.2 + mast.height / 2, mast.z]);
}

addSquareSail(exterior, sailMat, darkWood, { z: -8.7, y: 10.8, width: 6.7, height: 5.1, bend: 0.38 }, sails);
addSquareSail(exterior, sailMat, darkWood, { z: -8.7, y: 15.3, width: 5.2, height: 3.3, bend: 0.31 }, sails);
addSquareSail(exterior, sailMat, darkWood, { z: -1.6, y: 11.8, width: 8.5, height: 6.2, bend: 0.48 }, sails);
addSquareSail(exterior, sailMat, darkWood, { z: -1.6, y: 17.3, width: 6.0, height: 3.8, bend: 0.34 }, sails);

const jib = addTriangleSail(exterior, sailMat, [[0, 5.8], [0, 14.0], [4.6, 6.2]], -13.5, sails);
jib.rotation.y = Math.PI / 2;
jib.userData.baseRotationY = jib.rotation.y;
jib.position.x = 0.03;
const mizzen = addTriangleSail(exterior, sailMat, [[0, 5.2], [0, 14.0], [-5.2, 6.0]], 7.15, sails);
mizzen.rotation.y = Math.PI / 2;
mizzen.userData.baseRotationY = mizzen.rotation.y;
mizzen.position.x = -0.03;

addRope(exterior, [[0, 20.2, -8.7], [0, 5.0, -16.8]]);
addRope(exterior, [[0, 22.0, -1.6], [0, 20.2, -8.7]]);
addRope(exterior, [[0, 22.0, -1.6], [0, 5.0, 15.5]]);
addRope(exterior, [[0, 17.4, 7.1], [0, 5.0, 15.5]]);
addRope(exterior, [[-4.2, 5.0, -12], [0, 22.0, -1.6], [4.2, 5.0, -12]]);
addRope(exterior, [[-4.2, 5.0, 10], [0, 17.4, 7.1], [4.2, 5.0, 10]]);

const flagPole = addCylinder(exterior, 0.09, 8, darkWood, [0, 8.2, 12.5]);
flagPole.castShadow = true;
const flag = new THREE.Mesh(
new THREE.PlaneGeometry(2.7, 1.35, 4, 2),
new THREE.MeshStandardMaterial({ color: TEAM[team].color, side: THREE.DoubleSide, roughness: 0.75 })
);
flag.position.set(1.35, 11.2, 12.5);
exterior.add(flag);

const helm = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.12, 8, 24), darkWood);
helm.position.set(0, 5.55, 9);
exterior.add(helm);
for (let i = 0; i < 8; i += 1) {
addBox(exterior, [0.08, 1.85, 0.08], darkWood, [0, 5.55, 9], [0, 0, i * Math.PI / 4]);
}
addCylinder(exterior, 0.12, 1.5, metal, [0, 4.8, 9]);

const rigX = -2.15;
const rigZ = -2.2;
addBox(exterior, [2.7, 0.7, 2.1], darkWood, [rigX, 4.72, rigZ]);
const coil = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.10, 8, 22), new THREE.MeshStandardMaterial({ color: 0x8f704f, roughness: 1 }));
coil.rotation.x = Math.PI / 2;
coil.position.set(rigX, 5.15, rigZ);
exterior.add(coil);
addCylinder(exterior, 0.08, 1.4, darkWood, [rigX - 0.75, 5.0, rigZ]);
addCylinder(exterior, 0.08, 1.4, darkWood, [rigX + 0.75, 5.0, rigZ]);

addBox(exterior, [3.1, 0.16, 3.25], darkWood, [0, 4.42, 3.3]);
addBox(exterior, [2.55, 0.10, 2.7], new THREE.MeshStandardMaterial({ color: 0x6c472f, roughness: 1 }), [0, 4.54, 3.3]);

for (const x of [-3.4, 3.4]) {
for (const z of [-8, 0, 8]) {
const port = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.16, 12), metal);
port.rotation.z = Math.PI / 2;
port.position.set(x, 2.2, z);
exterior.add(port);
}
}
for (const x of [-3.5, 3.5]) {
const lantern = new THREE.Mesh(
new THREE.SphereGeometry(0.18, 8, 6),
new THREE.MeshStandardMaterial({ color: 0xffd986, emissive: 0xff9f3a, emissiveIntensity: 2 })
);
lantern.position.set(x, 5.4, 11.8);
exterior.add(lantern);
}

const lowerFloor = addBox(lower, [8.2, 0.22, 25], interiorWood, [0, LOWER_FLOOR_Y, 0]);
const lowerCeilingY = 3.86;
const wallHeight = lowerCeilingY - LOWER_FLOOR_Y;
const wallCenter = LOWER_FLOOR_Y + wallHeight / 2;
addBox(lower, [0.22, wallHeight, 25], wood, [-4.02, wallCenter, 0]);
addBox(lower, [0.22, wallHeight, 25], wood, [4.02, wallCenter, 0]);
addBox(lower, [8.2, wallHeight, 0.22], wood, [0, wallCenter, -12.4]);
addBox(lower, [8.2, wallHeight, 0.22], wood, [0, wallCenter, 12.4]);
addBox(lower, [8.1, 0.18, 25], darkWood, [0, lowerCeilingY, 0]);
for (let z = -10; z <= 10; z += 5) addBox(lower, [8.1, 0.16, 0.24], darkWood, [0, lowerCeilingY - 0.16, z]);
for (const x of [-2.8, 2.8]) {
for (const z of [-4, 5]) {
const barrel = new THREE.Mesh(
new THREE.CylinderGeometry(0.48, 0.54, 1.15, 12),
new THREE.MeshStandardMaterial({ color: 0x6f4a30, roughness: 0.95 })
);
barrel.position.set(x, LOWER_FLOOR_Y + 0.65, z);
lower.add(barrel);
}
}
addCylinder(lower, 0.08, 2.9, darkWood, [0, LOWER_FLOOR_Y + 1.5, -7.5]);
const lowerFlag = new THREE.Mesh(
new THREE.PlaneGeometry(2, 1),
new THREE.MeshStandardMaterial({ color: TEAM[team].color, side: THREE.DoubleSide })
);
lowerFlag.position.set(1, LOWER_FLOOR_Y + 2.05, -7.5);
lower.add(lowerFlag);
for (const z of [-8, 2, 10]) {
const lamp = new THREE.Mesh(
new THREE.SphereGeometry(0.16, 8, 6),
new THREE.MeshStandardMaterial({ color: 0xffd986, emissive: 0xffa33f, emissiveIntensity: 2.6 })
);
lamp.position.set(0, lowerCeilingY - 0.35, z);
lower.add(lamp);
}

lower.visible = false;
setShadows(group);
lowerFloor.receiveShadow = true;
hull.receiveShadow = true;
deck.receiveShadow = true;
world.add(group);
return { group, exterior, lower, sails, rigX, rigZ };
}

shipMeshes.british = makeShip("british");
shipMeshes.french = makeShip("french");

function makePlayer(p) {
const group = new THREE.Group();
const coat = new THREE.MeshStandardMaterial({ color: TEAM[p.team].color, roughness: 0.78 });
const dark = new THREE.MeshStandardMaterial({ color: 0x20252a, roughness: 0.8 });
const skin = new THREE.MeshStandardMaterial({ color: 0xd4a77e, roughness: 0.9 });
addBox(group, [0.34, 0.7, 0.34], dark, [-0.22, 0.36, 0]);
addBox(group, [0.34, 0.7, 0.34], dark, [0.22, 0.36, 0]);
const body = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.50, 1.0, 10), coat);
body.position.y = 1.08;
group.add(body);
const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 9), skin);
head.position.y = 1.82;
group.add(head);
const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.08, 14), dark);
brim.position.y = 2.13;
group.add(brim);
const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.30, 0.35, 0.25, 12), dark);
hat.position.y = 2.26;
group.add(hat);
setShadows(group);
world.add(group);
playerMeshes.set(p.id, group);
return group;
}

function toWorld(ship, x, z, y) {
const s = Math.sin(ship.heading);
const c = Math.cos(ship.heading);
return new THREE.Vector3(ship.x + x * c + z * s, y, ship.z - x * s + z * c);
}

function renderState(now = performance.now()) {
if (!state) return;
for (const team of ["british", "french"]) {
const ship = state.ships[team];
const visual = shipMeshes[team];
visual.group.position.set(ship.x, 0, ship.z);
visual.group.rotation.y = ship.heading;
const sailLean = Math.sin(now * 0.00135 + (team === "british" ? 0 : 1.7)) * 0.025;
for (const sail of visual.sails) {
if (!Number.isFinite(sail.userData.baseRotationY)) sail.userData.baseRotationY = sail.rotation.y;
sail.rotation.y = sail.userData.baseRotationY + sailLean;
}
}

const alive = new Set();
for (const p of Object.values(state.players)) {
if (!p.spawned) continue;
alive.add(p.id);
const mesh = playerMeshes.get(p.id) || makePlayer(p);
const y = p.deck === "lower" ? LOWER_PLAYER_Y : 4.34;
mesh.position.lerp(toWorld(state.ships[p.ship], p.x, p.z, y), p.id === localId ? 1 : 0.35);
mesh.rotation.y = state.ships[p.ship].heading + (p.yaw || 0) + Math.PI;
mesh.visible = !(p.id === localId && cameraMode === "first");
}
for (const [id, mesh] of playerMeshes) {
if (!alive.has(id)) {
world.remove(mesh);
playerMeshes.delete(id);
}
}

const local = state.players[localId];
for (const team of ["british", "french"]) {
const inside = local?.spawned && local.ship === team && local.deck === "lower";
const visual = shipMeshes[team];
visual.exterior.visible = !inside;
visual.lower.visible = inside;
}

// The global ocean surface is hidden while the local camera is below deck.
// The lower deck is a closed interior, so waves can never visually cut through it.
ocean.visible = !(local?.spawned && local.deck === "lower");

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
const rig = shipMeshes[p.ship];
if (p.team === p.ship && rig && near(rig.rigX, rig.rigZ, 2.4)) return { type: "sailmaster", label: "Work the rigging" };
if (near(0, 3.3, 2.2)) return { type: "down", label: "Go below deck" };
} else {
if (near(0, 3.3, 2.2)) return { type: "up", label: "Return to deck" };
if (near(0, -7.5, 2.5)) {
return p.team === p.ship
? { type: "own", label: "Your flag" }
: { type: "capture", label: `Capture ${TEAM[p.ship].label} flag` };
}
}
return null;
}

function updateObjective(p) {
if (!p?.spawned) {
ui.touchRigging?.classList.add("hidden");
return;
}
if (p.role === "captain") ui.objective.textContent = `Captain of ${TEAM[p.ship].ship} · WASD to steer · E to leave helm`;
else if (p.role === "sailmaster") ui.objective.textContent = `Sailmaster on ${TEAM[p.ship].ship} · Space / SAILS to trim sails · E to leave rigging`;
else if (p.ship !== p.team) ui.objective.textContent = p.deck === "lower" ? "Find and capture the enemy flag." : "Boarding enemy ship · find the hatch.";
else ui.objective.textContent = "Capture the enemy flag below deck.";

const action = interaction(p);
if (action) {
ui.prompt.textContent = `E · ${action.label}`;
ui.prompt.classList.remove("hidden");
} else {
ui.prompt.classList.add("hidden");
}

// Touch-only SAILS control appears only after the player has taken the sail station.
ui.touchRigging?.classList.toggle("hidden", p.role !== "sailmaster");
}

function normalizeAngle(value) {
return Math.atan2(Math.sin(value), Math.cos(value));
}

function inputSnapshot() {
return {
w: keys.w || touch.y < -0.18,
s: keys.s || touch.y > 0.18,
a: keys.a || touch.x < -0.18,
d: keys.d || touch.x > 0.18,
yaw: viewYaw,
interactSeq: seqInteract,
grappleSeq: seqGrapple,
rigSeq: seqRig
};
}

function processPlayer(p, input, dt) {
if (!p.spawned) return;
const seq = processed.get(p.id) || { interact: 0, grapple: 0, rig: 0 };
if ((input.interactSeq || 0) > seq.interact) {
seq.interact = input.interactSeq;
handleInteract(p);
}
if ((input.grappleSeq || 0) > seq.grapple) {
seq.grapple = input.grappleSeq;
handleGrapple(p);
}
if ((input.rigSeq || 0) > seq.rig) {
seq.rig = input.rigSeq;
handleRigging(p);
}
processed.set(p.id, seq);

if (Number.isFinite(input.yaw)) p.yaw = normalizeAngle(input.yaw);
if (p.role) return;

const speed = p.deck === "lower" ? 5 : 6.2;
const forward = (input.w ? 1 : 0) - (input.s ? 1 : 0);
const strafe = (input.d ? 1 : 0) - (input.a ? 1 : 0);
const yaw = p.yaw || 0;
const dx = strafe * Math.cos(yaw) - forward * Math.sin(yaw);
const dz = strafe * Math.sin(yaw) - forward * Math.cos(yaw);
const magnitude = Math.hypot(dx, dz) || 1;
p.x = THREE.MathUtils.clamp(p.x + (dx / Math.max(1, magnitude)) * speed * dt, -3.9, 3.9);
p.z = THREE.MathUtils.clamp(p.z + (dz / Math.max(1, magnitude)) * speed * dt, -14, 14);
}

function shipAxes(ship) {
return [
{ x: Math.cos(ship.heading), z: -Math.sin(ship.heading) },
{ x: Math.sin(ship.heading), z: Math.cos(ship.heading) }
];
}

function dot2(a, b) {
return a.x * b.x + a.z * b.z;
}

function projectionRadius(ship, axis) {
const [right, forward] = shipAxes(ship);
return Math.abs(dot2(axis, right)) * SHIP_HALF_WIDTH + Math.abs(dot2(axis, forward)) * SHIP_HALF_LENGTH;
}

function shipsOverlap(a, b) {
const delta = { x: b.x - a.x, z: b.z - a.z };
const axes = [...shipAxes(a), ...shipAxes(b)];
for (const axis of axes) {
const distance = Math.abs(dot2(delta, axis));
const limit = projectionRadius(a, axis) + projectionRadius(b, axis);
if (distance >= limit - 0.035) return false;
}
return true;
}

function restoreShip(ship, snapshot) {
ship.x = snapshot.x;
ship.z = snapshot.z;
ship.heading = snapshot.heading;
ship.speed = 0;
}

function resolveShipCollision(before) {
const british = state.ships.british;
const french = state.ships.french;
if (!shipsOverlap(british, french)) return false;

restoreShip(british, before.british);
restoreShip(french, before.french);

// A safety separation handles an old/stale state that was already overlapping.
if (shipsOverlap(british, french)) {
let dx = french.x - british.x;
let dz = french.z - british.z;
let len = Math.hypot(dx, dz);
if (len < 0.001) { dx = 1; dz = 0; len = 1; }
dx /= len;
dz /= len;
for (let i = 0; i < 30 && shipsOverlap(british, french); i += 1) {
british.x -= dx * 0.12;
british.z -= dz * 0.12;
french.x += dx * 0.12;
french.z += dz * 0.12;
}
}

if (performance.now() - collisionToastAt > 1400) {
collisionToastAt = performance.now();
const captains = [british.captain, french.captain].filter(Boolean);
for (const id of captains) personal(id, "Hull collision — ship stopped.");
}
return true;
}

function simulateShips(dt) {
const before = {
british: { x: state.ships.british.x, z: state.ships.british.z, heading: state.ships.british.heading, speed: state.ships.british.speed },
french: { x: state.ships.french.x, z: state.ships.french.z, heading: state.ships.french.heading, speed: state.ships.french.speed }
};

for (const team of ["british", "french"]) {
const ship = state.ships[team];
const captain = ship.captain ? state.players[ship.captain] : null;
const input = captain ? (captain.id === localId ? inputSnapshot() : inputs.get(captain.id) || {}) : {};
const throttle = captain ? (input.w ? 1 : 0) + (input.s ? -0.5 : 0) : 0;
const steer = captain ? (input.a ? 1 : 0) - (input.d ? 1 : 0) : 0;
const boost = Date.now() < ship.boostUntil ? 1.18 : 1;
const mobility = THREE.MathUtils.clamp(ship.mobility / 100, 0.22, 1);
const desired = throttle * 10.5 * boost * mobility;

ship.speed += THREE.MathUtils.clamp(desired - ship.speed, -7 * dt, 4 * dt);
if (Math.abs(ship.speed) < 0.04) ship.speed = 0;
if (captain && Math.abs(ship.speed) > 0.2) ship.heading += steer * 0.62 * mobility * dt * Math.sign(ship.speed);
ship.x += Math.sin(ship.heading) * ship.speed * dt;
ship.z += Math.cos(ship.heading) * ship.speed * dt;
}

resolveShipCollision(before);
}

function handleInteract(p) {
const action = interaction(p);
if (!action) return;
if (action.type === "leave") return releaseRole(p.id);

if (action.type === "captain") {
const ship = state.ships[p.ship];
if (ship.captain && ship.captain !== p.id) return personal(p.id, "The helm is occupied.");
releaseRole(p.id);
ship.captain = p.id;
p.role = "captain";
p.x = 0;
p.z = 9;
}

if (action.type === "sailmaster") {
const ship = state.ships[p.ship];
if (ship.sailmaster && ship.sailmaster !== p.id) return personal(p.id, "The rigging station is occupied.");
const rig = shipMeshes[p.ship];
releaseRole(p.id);
ship.sailmaster = p.id;
p.role = "sailmaster";
p.x = rig?.rigX ?? -2.15;
p.z = rig?.rigZ ?? -2.2;
}

if (action.type === "down") {
p.deck = "lower";
p.x = 0;
p.z = 3.3;
}
if (action.type === "up") {
p.deck = "upper";
p.x = 0;
p.z = 3.3;
}
if (action.type === "own") personal(p.id, "That is your own flag.");
if (action.type === "capture") finishBattle(p.team, p.ship);
}

function releaseRole(id) {
const p = state?.players?.[id];
if (!p) return;
for (const ship of Object.values(state.ships)) {
if (ship.captain === id) ship.captain = null;
if (ship.sailmaster === id) ship.sailmaster = null;
}
p.role = null;
}

function handleRigging(p) {
if (p.role !== "sailmaster") return;
const ship = state.ships[p.ship];
if (ship.sailmaster !== p.id) return;
ship.boostUntil = Date.now() + 1800;
personal(p.id, "Sails trimmed — speed boost active.");
}

function handleGrapple(p) {
if (p.role || p.deck !== "upper") return personal(p.id, "Leave your station before boarding.");
const other = p.ship === "british" ? "french" : "british";
const a = state.ships[p.ship];
const b = state.ships[other];
if (Math.hypot(a.x - b.x, a.z - b.z) > GRAPPLE_RANGE) return personal(p.id, "The other ship is too far away.");
const from = p.ship;
p.ship = other;
p.deck = "upper";
p.x = p.team === "british" ? -3 : 3;
p.z = 0;
event({ kind: "grapple", playerId: p.id, from, to: other });
}

function personal(id, text) {
if (id === localId) showToast(text);
else network.sendTo(id, { type: "event", event: { kind: "toast", text } });
}

function event(e) {
receiveEvent(e);
if (network.isHost) network.broadcast({ type: "event", event: e });
}

function receiveEvent(e) {
if (!e) return;
if (e.kind === "toast") showToast(e.text);
if (e.kind === "grapple") grappleFx.push({ ...e, start: performance.now() });
if (e.kind === "victory") showVictory(e.winner, e.loser);
}

function finishBattle(winner, loser) {
if (state.phase !== "playing") return;
state.phase = "victory";
state.winner = winner;
event({ kind: "victory", winner, loser });
syncState();
}

function showVictory(winner, loser) {
document.exitPointerLock?.();
ui.victoryTitle.textContent = `${TEAM[winner].label} victory`;
ui.victoryText.textContent = `${TEAM[loser].label} flag captured.`;
ui.victory.classList.remove("hidden");
}

function lookDirection(ship) {
const yaw = ship.heading + viewYaw + Math.PI;
const cp = Math.cos(viewPitch);
return new THREE.Vector3(Math.sin(yaw) * cp, Math.sin(viewPitch), Math.cos(yaw) * cp).normalize();
}

function updateCamera(now) {
const p = state?.players?.[localId];
if (!p?.spawned) {
const a = now * 0.00006;
const desired = new THREE.Vector3(Math.cos(a) * 72, 42, Math.sin(a) * 72);
camera.position.lerp(desired, 0.025);
camera.lookAt(0, 4, 0);
return;
}

const ship = state.ships[p.ship];
const eyeY = p.deck === "lower" ? LOWER_EYE_Y : 6.08;
const eye = toWorld(ship, p.x, p.z, eyeY);
const dir = lookDirection(ship);

if (cameraMode === "first") {
camera.position.copy(eye);
camera.lookAt(eye.clone().add(dir));
return;
}

const flat = new THREE.Vector3(dir.x, 0, dir.z).normalize();
const distance = p.deck === "lower" ? 2.8 : 7.4;
const lift = p.deck === "lower" ? 0.72 : 3.0;
const desired = eye.clone().addScaledVector(flat, -distance).add(new THREE.Vector3(0, lift, 0));
const target = eye.clone().addScaledVector(dir, 2.4);
camera.position.lerp(desired, 0.17);
camera.lookAt(target);
}

function renderEffects(now) {
effects.clear();
for (let i = grappleFx.length - 1; i >= 0; i -= 1) {
const e = grappleFx[i];
if (now - e.start > 1400) {
grappleFx.splice(i, 1);
continue;
}
const a = state?.ships[e.from];
const b = state?.ships[e.to];
if (!a || !b) continue;
const material = new THREE.LineBasicMaterial({
color: 0xd8c29e,
transparent: true,
opacity: Math.max(0, 1 - (now - e.start) / 1400)
});
effects.add(new THREE.Line(
new THREE.BufferGeometry().setFromPoints([
new THREE.Vector3(a.x, 5, a.z),
new THREE.Vector3(b.x, 5, b.z)
]),
material
));
}
}

function updateAtmosphere(now) {
oceanMaterial.uniforms.uTime.value = now / 1000;
for (const c of clouds.children) {
c.position.x += c.userData.speed * 0.012;
if (c.position.x > 260) c.position.x = -260;
}
}

setInterval(() => {
if (!spawned || !state?.players?.[localId]) return;
const input = inputSnapshot();
if (network.isHost) inputs.set(localId, input);
else network.send({ type: "input", input });
}, 50);

function adjustLook(dx, dy, scale = 0.0022) {
viewYaw = normalizeAngle(viewYaw - dx * scale);
viewPitch = THREE.MathUtils.clamp(viewPitch - dy * scale * 0.82, -1.18, 1.05);
}

renderer.domElement.addEventListener("click", () => {
if (!spawned || settingsOpen() || matchMedia("(hover: none), (pointer: coarse)").matches) return;
if (document.pointerLockElement !== renderer.domElement) renderer.domElement.requestPointerLock?.();
});

document.addEventListener("mousemove", (e) => {
if (document.pointerLockElement === renderer.domElement && spawned && !settingsOpen()) {
adjustLook(e.movementX, e.movementY);
}
});

renderer.domElement.addEventListener("pointerdown", (e) => {
if (!spawned || settingsOpen() || e.pointerType === "mouse") return;
lookPointer = e.pointerId;
lookLastX = e.clientX;
lookLastY = e.clientY;
renderer.domElement.setPointerCapture?.(e.pointerId);
});

renderer.domElement.addEventListener("pointermove", (e) => {
if (e.pointerId !== lookPointer || settingsOpen()) return;
const dx = e.clientX - lookLastX;
const dy = e.clientY - lookLastY;
lookLastX = e.clientX;
lookLastY = e.clientY;
adjustLook(dx, dy, 0.0042);
});

const stopLook = (e) => {
if (!e || e.pointerId === lookPointer) lookPointer = null;
};
renderer.domElement.addEventListener("pointerup", stopLook);
renderer.domElement.addEventListener("pointercancel", stopLook);

window.addEventListener("keydown", (e) => {
if (e.key === "Escape" && settingsOpen()) {
e.preventDefault();
closeSettings();
return;
}
if (!spawned || settingsOpen() || ["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName)) return;
const k = e.key.toLowerCase();
if (["w", "a", "s", "d", "e", "g", " "].includes(k)) e.preventDefault();
if (k in keys) keys[k] = true;
if (k === "e" && !e.repeat) seqInteract += 1;
if (k === "g" && !e.repeat) seqGrapple += 1;
if (k === " " && !e.repeat) seqRig += 1;
});

window.addEventListener("keyup", (e) => {
const k = e.key.toLowerCase();
if (k in keys) keys[k] = false;
});

ui.touchInteract.onpointerdown = (e) => { e.preventDefault(); seqInteract += 1; };
ui.touchGrapple.onpointerdown = (e) => { e.preventDefault(); seqGrapple += 1; };
ui.touchRigging.onpointerdown = (e) => { e.preventDefault(); seqRig += 1; };

function joy(e) {
const r = ui.joystick.getBoundingClientRect();
const max = r.width / 2 - 24;
let x = e.clientX - r.left - r.width / 2;
let y = e.clientY - r.top - r.height / 2;
const len = Math.hypot(x, y) || 1;
if (len > max) {
x *= max / len;
y *= max / len;
}
touch.x = x / max;
touch.y = y / max;
ui.joystickKnob.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
}

ui.joystick.onpointerdown = (e) => {
e.preventDefault();
touchPointer = e.pointerId;
ui.joystick.setPointerCapture?.(e.pointerId);
joy(e);
};
ui.joystick.onpointermove = (e) => {
if (e.pointerId === touchPointer) joy(e);
};
const resetJoy = () => {
touchPointer = null;
touch.x = touch.y = 0;
ui.joystickKnob.style.transform = "translate(-50%, -50%)";
};
ui.joystick.onpointerup = resetJoy;
ui.joystick.onpointercancel = resetJoy;

buildPalette();
renderJoinCode();
setCameraMode(cameraMode);
ui.touchRigging?.classList.add("hidden");

ui.create.onclick = createBattle;
ui.showJoin.onclick = () => {
ui.lobbyHome.classList.add("hidden");
ui.joinPanel.classList.remove("hidden");
};
ui.back.onclick = () => {
ui.joinPanel.classList.add("hidden");
ui.lobbyHome.classList.remove("hidden");
joinCode = [];
renderJoinCode();
};
ui.join.onclick = joinBattle;
ui.spawn.onclick = spawnLocal;
ui.settings.onclick = openSettings;
ui.settingsClose.onclick = closeSettings;
ui.firstPerson.onclick = () => setCameraMode("first");
ui.thirdPerson.onclick = () => setCameraMode("third");
ui.settingsPanel.addEventListener("pointerdown", (e) => {
if (e.target === ui.settingsPanel) closeSettings();
});
ui.leave.onclick = () => returnToMenu("You left the battle.");
ui.victoryLeave.onclick = () => returnToMenu();

function resize() {
camera.aspect = innerWidth / innerHeight;
camera.updateProjectionMatrix();
renderer.setSize(innerWidth, innerHeight, false);
}
window.addEventListener("resize", resize);
resize();

let last = performance.now();
function frame(now) {
requestAnimationFrame(frame);
const dt = Math.min(0.05, (now - last) / 1000);
last = now;

if (network.isHost && state?.phase === "playing") {
for (const [id, p] of Object.entries(state.players)) {
processPlayer(p, id === localId ? inputSnapshot() : inputs.get(id) || {}, dt);
}
simulateShips(dt);
if (now - lastBroadcast > STATE_INTERVAL) {
syncState();
lastBroadcast = now;
}
}

if (state) {
renderState(now);
renderEffects(now);
}
updateAtmosphere(now);
updateCamera(now);
renderer.render(scene, camera);
}
requestAnimationFrame(frame);
