import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";

const TEAM = {
  british: { label: "British", ship: "HMS Resolute", color: 0xc34f4f, stripe: 0xe7d7c8 },
  french: { label: "French", ship: "Fleur Royale", color: 0x4d72c7, stripe: 0xd9e0ee }
};
const MAX_USERS = 6;
const GRAPPLE_RANGE = 48;
const STATE_INTERVAL = 80;
const CAMERA_KEY = "kdj2-camera-mode";
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
function settingsOpen() { return !ui.settingsPanel?.classList.contains("hidden"); }

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
  return { id, name, team, ship: team, deck: "upper", x: 0, z: 10, yaw: 0, role: null, spawned: false };
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
  p.ship = p.team; p.deck = "upper"; p.x = 0; p.z = 10; p.yaw = 0; p.role = null; p.spawned = true;
  syncState();
}
function spawnLocal() {
  if (network.isHost) spawnPlayer(localId); else network.send({ type: "spawn" });
  spawned = true;
  viewYaw = 0;
  viewPitch = -0.04;
  ui.deployment.classList.add("hidden");
  ui.hud.classList.remove("hidden");
  const lookHelp = matchMedia("(hover: none), (pointer: coarse)").matches ? "Drag open space to look around." : "Click the world for mouse look.";
  showToast(`${TEAM[localTeam].label} crew · ${lookHelp}`, 3200);
}
function returnToMenu(message = "") {
  document.exitPointerLock?.();
  closeSettings();
  network.cleanup();
  localId = localTeam = null; spawned = false; state = null;
  ui.victory.classList.add("hidden"); ui.deployment.classList.add("hidden"); ui.hud.classList.add("hidden"); ui.lobby.classList.remove("hidden");
  ui.lobbyHome.classList.remove("hidden"); ui.joinPanel.classList.add("hidden"); joinCode = []; renderJoinCode(); ui.status.textContent = message;
}

const renderer = new THREE.WebGLRenderer({ canvas: $("#gameCanvas"), antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x8aaeba, 150, 560);
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, .06, 1000);

const sky = new THREE.Mesh(
  new THREE.SphereGeometry(700, 28, 16),
  new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: { uSun: { value: new THREE.Vector3(.45, .65, .3).normalize() } },
    vertexShader: `varying vec3 vWorld; void main(){ vec4 w=modelMatrix*vec4(position,1.0); vWorld=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `varying vec3 vWorld; uniform vec3 uSun; void main(){ vec3 d=normalize(vWorld); float h=clamp(d.y*.5+.5,0.0,1.0); vec3 horizon=vec3(.58,.72,.77); vec3 zenith=vec3(.20,.43,.58); vec3 c=mix(horizon,zenith,smoothstep(.25,.95,h)); float glow=pow(max(dot(d,uSun),0.0),28.0); c+=vec3(1.0,.72,.42)*glow*.32; gl_FragColor=vec4(c,1.0); }`
  })
);
scene.add(sky);
scene.add(new THREE.HemisphereLight(0xdff4ff, 0x26311f, 1.65));
scene.add(new THREE.AmbientLight(0xffffff, .18));
const sun = new THREE.DirectionalLight(0xffefcf, 2.8);
sun.position.set(80, 120, 55);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -90; sun.shadow.camera.right = 90; sun.shadow.camera.top = 90; sun.shadow.camera.bottom = -90;
sun.shadow.camera.near = 20; sun.shadow.camera.far = 260;
scene.add(sun);

const oceanMaterial = new THREE.ShaderMaterial({
  uniforms: { uTime: { value: 0 } },
  vertexShader: `uniform float uTime; varying float vWave; varying vec3 vWorld; void main(){ vec3 p=position; float w=sin(p.x*.035+uTime*1.25)*.36+cos(p.y*.029-uTime*.92)*.27+sin((p.x+p.y)*.018+uTime*.58)*.18; p.z+=w; vWave=w; vec4 world=modelMatrix*vec4(p,1.0); vWorld=world.xyz; gl_Position=projectionMatrix*viewMatrix*world; }`,
  fragmentShader: `uniform float uTime; varying float vWave; varying vec3 vWorld; void main(){ vec3 deep=vec3(.025,.20,.30); vec3 high=vec3(.08,.39,.52); float t=smoothstep(-.65,.72,vWave); vec3 c=mix(deep,high,t); float sparkle=pow(max(0.0,sin((vWorld.x-vWorld.z)*.11+uTime*1.7)),22.0)*.08; c+=vec3(.65,.82,.87)*sparkle; float dist=length(cameraPosition.xz-vWorld.xz); float haze=smoothstep(210.0,560.0,dist); c=mix(c,vec3(.43,.63,.70),haze); gl_FragColor=vec4(c,1.0); }`
});
const ocean = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400, 86, 86), oceanMaterial);
ocean.rotation.x = -Math.PI / 2;
ocean.receiveShadow = true;
scene.add(ocean);

const clouds = new THREE.Group();
const cloudMat = new THREE.MeshBasicMaterial({ color: 0xf2f0e7, transparent: true, opacity: .36, depthWrite: false });
for (let i = 0; i < 14; i += 1) {
  const c = new THREE.Group();
  const puffCount = 3 + (i % 3);
  for (let j = 0; j < puffCount; j += 1) {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(7 + (j % 2) * 3, 8, 6), cloudMat);
    puff.scale.y = .45;
    puff.position.set(j * 8 - puffCount * 3, (j % 2) * 2, (j % 3) * 2);
    c.add(puff);
  }
  c.position.set((Math.random() - .5) * 480, 70 + Math.random() * 45, (Math.random() - .5) * 480);
  c.userData.speed = .45 + Math.random() * .35;
  clouds.add(c);
}
scene.add(clouds);

const world = new THREE.Group(); scene.add(world);
const effects = new THREE.Group(); scene.add(effects);

function canvasTexture(size, draw) {
  const c = document.createElement("canvas"); c.width = c.height = size;
  const ctx = c.getContext("2d"); draw(ctx, size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
const deckTexture = canvasTexture(512, (ctx, s) => {
  ctx.fillStyle = "#a97e4f"; ctx.fillRect(0,0,s,s);
  ctx.strokeStyle = "rgba(52,31,18,.34)"; ctx.lineWidth = 3;
  for (let x = 0; x <= s; x += 64) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,s); ctx.stroke(); }
  for (let y = 0; y <= s; y += 32) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(s,y); ctx.stroke(); }
  ctx.fillStyle = "rgba(45,28,18,.22)";
  for (let i = 0; i < 30; i++) ctx.fillRect((i*97)%s, (i*53)%s, 5, 3);
});
deckTexture.repeat.set(4, 12);

function sailTexture(team) {
  return canvasTexture(256, (ctx, s) => {
    ctx.fillStyle = "#e8dfc8"; ctx.fillRect(0,0,s,s);
    ctx.strokeStyle = "rgba(92,74,52,.12)"; ctx.lineWidth = 2;
    for (let y = 16; y < s; y += 18) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(s,y); ctx.stroke(); }
    ctx.fillStyle = `#${TEAM[team].color.toString(16).padStart(6,"0")}`;
    ctx.globalAlpha = .78; ctx.fillRect(s*.46,0,s*.08,s); ctx.fillRect(0,s*.46,s,s*.08); ctx.globalAlpha = 1;
  });
}
function addBox(parent, size, material, position, rotation = null) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  m.position.set(...position); if (rotation) m.rotation.set(...rotation); parent.add(m); return m;
}
function addCylinder(parent, radius, height, material, position, rotation = null, segments = 12) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, segments), material);
  m.position.set(...position); if (rotation) m.rotation.set(...rotation); parent.add(m); return m;
}
function addRope(parent, points, color = 0x46382c) {
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points.map((p) => new THREE.Vector3(...p))), new THREE.LineBasicMaterial({ color, transparent: true, opacity: .76 }));
  parent.add(line); return line;
}
function setShadows(root) {
  root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
}

function makeShip(team) {
  const g = new THREE.Group();
  const exterior = new THREE.Group();
  const lower = new THREE.Group();
  g.add(exterior, lower);

  const wood = new THREE.MeshStandardMaterial({ color: team === "british" ? 0x4b3024 : 0x513629, roughness: .82 });
  const darkWood = new THREE.MeshStandardMaterial({ color: 0x2b211b, roughness: .9 });
  const deckMat = new THREE.MeshStandardMaterial({ color: 0xa97e4f, map: deckTexture, roughness: .86 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x343b3d, metalness: .68, roughness: .38 });
  const stripeMat = new THREE.MeshStandardMaterial({ color: TEAM[team].color, roughness: .7 });
  const sailMat = new THREE.MeshStandardMaterial({ map: sailTexture(team), color: 0xffffff, side: THREE.DoubleSide, roughness: .84 });

  const hull = addBox(exterior, [9.6, 3.8, 24], wood, [0, 2.1, 1.8]);
  const bow = new THREE.Mesh(new THREE.ConeGeometry(5.05, 9, 4, 1), wood);
  bow.rotation.set(-Math.PI / 2, Math.PI / 4, 0); bow.position.set(0, 2.1, -14.5); exterior.add(bow);
  addBox(exterior, [8.7, 4.1, 6], wood, [0, 2.25, 13.4]);
  addBox(exterior, [9.72, .52, 19], stripeMat, [0, 2.45, 2.5]);
  addBox(exterior, [1.1, 1.2, 30], darkWood, [0, .35, 0]);
  const deck = addBox(exterior, [9.15, .45, 29.5], deckMat, [0, 4.15, .4]);

  for (const side of [-1, 1]) {
    addBox(exterior, [.14, .14, 27], darkWood, [side * 4.48, 5.08, .4]);
    for (let z = -12; z <= 13; z += 4.2) addCylinder(exterior, .07, 1.15, darkWood, [side * 4.48, 4.58, z]);
  }
  addBox(exterior, [8.5, .14, .14], darkWood, [0, 5.08, 14.35]);

  const mastData = [{ z: -5.2, h: 16, sailW: 8.2, sailH: 7.1, y: 12.1 }, { z: 6.2, h: 13.5, sailW: 6.4, sailH: 5.5, y: 10.6 }];
  for (const m of mastData) {
    addCylinder(exterior, .25, m.h, darkWood, [0, 4.2 + m.h / 2, m.z]);
    addCylinder(exterior, .10, m.sailW + .8, darkWood, [0, m.y + m.sailH / 2 + .45, m.z], [0,0,Math.PI/2]);
    const sail = new THREE.Mesh(new THREE.PlaneGeometry(m.sailW, m.sailH, 5, 5), sailMat);
    const attr = sail.geometry.attributes.position;
    for (let i = 0; i < attr.count; i++) {
      const x = attr.getX(i) / (m.sailW / 2);
      attr.setZ(i, -.34 * (1 - Math.min(1, x * x)));
    }
    attr.needsUpdate = true; sail.geometry.computeVertexNormals();
    sail.position.set(0, m.y, m.z); exterior.add(sail);
  }
  addRope(exterior, [[0,19.8,-5.2],[0,5,-16.8]]);
  addRope(exterior, [[0,19.8,-5.2],[0,5,15.5]]);
  addRope(exterior, [[0,17.7,6.2],[0,5,15.5]]);
  addRope(exterior, [[-4.2,5,-12],[0,19.8,-5.2],[4.2,5,-12]]);

  const flagPole = addCylinder(exterior, .09, 8, darkWood, [0, 8.2, 12.5]);
  flagPole.castShadow = true;
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 1.35, 4, 2), new THREE.MeshStandardMaterial({ color: TEAM[team].color, side: THREE.DoubleSide, roughness: .75 }));
  flag.position.set(1.35, 11.2, 12.5); exterior.add(flag);

  const helm = new THREE.Mesh(new THREE.TorusGeometry(1.0, .12, 8, 24), darkWood); helm.position.set(0, 5.55, 9); exterior.add(helm);
  for (let i = 0; i < 8; i++) {
    const spoke = addBox(exterior, [.08, 1.85, .08], darkWood, [0,5.55,9], [0,0,i*Math.PI/4]);
    spoke.castShadow = true;
  }
  addCylinder(exterior, .12, 1.5, metal, [0,4.8,9]);

  addBox(exterior, [2.7, .7, 2.1], darkWood, [-2.25,4.72,-2.0]);
  const coil = new THREE.Mesh(new THREE.TorusGeometry(.62,.10,8,22), new THREE.MeshStandardMaterial({ color: 0x8f704f, roughness: 1 }));
  coil.rotation.x = Math.PI/2; coil.position.set(-2.25,5.15,-2); exterior.add(coil);
  addBox(exterior, [3.1,.16,3.25], darkWood, [0,4.42,3.3]);
  addBox(exterior, [2.55,.10,2.7], new THREE.MeshStandardMaterial({ color: 0x6c472f, roughness: 1 }), [0,4.54,3.3]);

  for (const x of [-3.4, 3.4]) for (const z of [-8, 0, 8]) {
    const port = new THREE.Mesh(new THREE.CylinderGeometry(.24,.24,.16,12), metal);
    port.rotation.z = Math.PI/2; port.position.set(x,2.2,z); exterior.add(port);
  }
  for (const x of [-3.5, 3.5]) {
    const lantern = new THREE.Mesh(new THREE.SphereGeometry(.18,8,6), new THREE.MeshStandardMaterial({ color: 0xffd986, emissive: 0xff9f3a, emissiveIntensity: 2 }));
    lantern.position.set(x,5.4,11.8); exterior.add(lantern);
  }

  const lowerFloor = addBox(lower, [8.2,.18,25], new THREE.MeshStandardMaterial({ color: 0x65442f, roughness: 1 }), [0,.18,0]);
  addBox(lower,[.18,2.7,25],wood,[-4.02,1.48,0]);
  addBox(lower,[.18,2.7,25],wood,[4.02,1.48,0]);
  for (let z=-10; z<=10; z+=5) addBox(lower,[8.1,.18,.22],darkWood,[0,2.72,z]);
  for (const x of [-2.8,2.8]) for (const z of [-4,5]) {
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(.48,.54,1.15,12), new THREE.MeshStandardMaterial({ color: 0x6f4a30, roughness: .95 }));
    barrel.position.set(x,.72,z); lower.add(barrel);
  }
  addCylinder(lower,.08,2.6,darkWood,[0,1.5,-7.5]);
  const lowerFlag = new THREE.Mesh(new THREE.PlaneGeometry(2,1), new THREE.MeshStandardMaterial({ color: TEAM[team].color, side: THREE.DoubleSide }));
  lowerFlag.position.set(1,2.2,-7.5); lower.add(lowerFlag);
  for (const z of [-8,2,10]) {
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(.16,8,6), new THREE.MeshStandardMaterial({ color: 0xffd986, emissive: 0xffa33f, emissiveIntensity: 2.6 }));
    lamp.position.set(0,2.45,z); lower.add(lamp);
  }
  lower.visible = false;
  setShadows(g);
  lowerFloor.receiveShadow = true; hull.receiveShadow = true; deck.receiveShadow = true;
  world.add(g);
  return { group: g, exterior, lower };
}
shipMeshes.british = makeShip("british"); shipMeshes.french = makeShip("french");

function makePlayer(p) {
  const g = new THREE.Group();
  const coat = new THREE.MeshStandardMaterial({ color: TEAM[p.team].color, roughness: .78 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x20252a, roughness: .8 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xd4a77e, roughness: .9 });
  addBox(g,[.34,.7,.34],dark,[-.22,.36,0]); addBox(g,[.34,.7,.34],dark,[.22,.36,0]);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(.42,.50,1.0,10), coat); body.position.y=1.08; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(.34,12,9), skin); head.position.y=1.82; g.add(head);
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(.48,.48,.08,14),dark); brim.position.y=2.13; g.add(brim);
  const hat = new THREE.Mesh(new THREE.CylinderGeometry(.30,.35,.25,12),dark); hat.position.y=2.26; g.add(hat);
  setShadows(g); world.add(g); playerMeshes.set(p.id,g); return g;
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
    mesh.position.lerp(toWorld(state.ships[p.ship], p.x, p.z, p.deck === "lower" ? .48 : 4.34), p.id === localId ? 1 : .35);
    mesh.rotation.y = state.ships[p.ship].heading + (p.yaw || 0) + Math.PI;
    mesh.visible = !(p.id === localId && cameraMode === "first");
  });
  for (const [id, mesh] of playerMeshes) if (!alive.has(id)) { world.remove(mesh); playerMeshes.delete(id); }
  const local = state.players[localId];
  ["british", "french"].forEach((team) => {
    const inside = local?.spawned && local.ship === team && local.deck === "lower";
    const v = shipMeshes[team];
    v.exterior.visible = !inside;
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

function normalizeAngle(value) { return Math.atan2(Math.sin(value), Math.cos(value)); }
function inputSnapshot() {
  return { w: keys.w || touch.y < -.18, s: keys.s || touch.y > .18, a: keys.a || touch.x < -.18, d: keys.d || touch.x > .18, yaw: viewYaw, interactSeq: seqInteract, grappleSeq: seqGrapple, rigSeq: seqRig };
}
function processPlayer(p, input, dt) {
  if (!p.spawned) return;
  const seq = processed.get(p.id) || { interact: 0, grapple: 0, rig: 0 };
  if ((input.interactSeq || 0) > seq.interact) { seq.interact = input.interactSeq; handleInteract(p); }
  if ((input.grappleSeq || 0) > seq.grapple) { seq.grapple = input.grappleSeq; handleGrapple(p); }
  if ((input.rigSeq || 0) > seq.rig) { seq.rig = input.rigSeq; handleRigging(p); }
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
  p.x = THREE.MathUtils.clamp(p.x + dx / Math.max(1,magnitude) * speed * dt, -3.9, 3.9);
  p.z = THREE.MathUtils.clamp(p.z + dz / Math.max(1,magnitude) * speed * dt, -14, 14);
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
function showVictory(winner, loser) { document.exitPointerLock?.(); ui.victoryTitle.textContent = `${TEAM[winner].label} victory`; ui.victoryText.textContent = `${TEAM[loser].label} flag captured.`; ui.victory.classList.remove("hidden"); }

function lookDirection(ship) {
  const yaw = ship.heading + viewYaw + Math.PI;
  const cp = Math.cos(viewPitch);
  return new THREE.Vector3(Math.sin(yaw) * cp, Math.sin(viewPitch), Math.cos(yaw) * cp).normalize();
}
function updateCamera(now) {
  const p = state?.players?.[localId];
  if (!p?.spawned) {
    const a = now * .00006;
    const desired = new THREE.Vector3(Math.cos(a) * 72, 42, Math.sin(a) * 72);
    camera.position.lerp(desired, .025); camera.lookAt(0, 4, 0); return;
  }
  const ship = state.ships[p.ship];
  const eye = toWorld(ship, p.x, p.z, p.deck === "lower" ? 2.05 : 6.08);
  const dir = lookDirection(ship);
  if (cameraMode === "first") {
    camera.position.copy(eye);
    camera.lookAt(eye.clone().add(dir));
    return;
  }
  const flat = new THREE.Vector3(dir.x,0,dir.z).normalize();
  const distance = p.deck === "lower" ? 3.0 : 7.4;
  const lift = p.deck === "lower" ? .85 : 3.0;
  const desired = eye.clone().addScaledVector(flat,-distance).add(new THREE.Vector3(0,lift,0));
  const target = eye.clone().addScaledVector(dir,2.4);
  camera.position.lerp(desired,.17);
  camera.lookAt(target);
}
function renderEffects(now) {
  effects.clear();
  for (let i = grappleFx.length - 1; i >= 0; i--) {
    const e = grappleFx[i]; if (now - e.start > 1400) { grappleFx.splice(i, 1); continue; }
    const a = state?.ships[e.from], b = state?.ships[e.to]; if (!a || !b) continue;
    const material = new THREE.LineBasicMaterial({ color: 0xd8c29e, transparent: true, opacity: Math.max(0,1-(now-e.start)/1400) });
    effects.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(a.x,5,a.z),new THREE.Vector3(b.x,5,b.z)]),material));
  }
}
function updateAtmosphere(now) {
  oceanMaterial.uniforms.uTime.value = now / 1000;
  for (const c of clouds.children) {
    c.position.x += c.userData.speed * .012;
    if (c.position.x > 260) c.position.x = -260;
  }
}

setInterval(() => {
  if (!spawned || !state?.players?.[localId]) return;
  const input = inputSnapshot(); if (network.isHost) inputs.set(localId, input); else network.send({ type: "input", input });
}, 50);

function adjustLook(dx, dy, scale = .0022) {
  viewYaw = normalizeAngle(viewYaw - dx * scale);
  viewPitch = THREE.MathUtils.clamp(viewPitch - dy * scale * .82, -1.18, 1.05);
}
renderer.domElement.addEventListener("click", () => {
  if (!spawned || settingsOpen() || matchMedia("(hover: none), (pointer: coarse)").matches) return;
  if (document.pointerLockElement !== renderer.domElement) renderer.domElement.requestPointerLock?.();
});
document.addEventListener("mousemove", (e) => {
  if (document.pointerLockElement === renderer.domElement && spawned && !settingsOpen()) adjustLook(e.movementX,e.movementY);
});
renderer.domElement.addEventListener("pointerdown", (e) => {
  if (!spawned || settingsOpen() || e.pointerType === "mouse") return;
  lookPointer = e.pointerId; lookLastX = e.clientX; lookLastY = e.clientY; renderer.domElement.setPointerCapture?.(e.pointerId);
});
renderer.domElement.addEventListener("pointermove", (e) => {
  if (e.pointerId !== lookPointer || settingsOpen()) return;
  const dx=e.clientX-lookLastX, dy=e.clientY-lookLastY; lookLastX=e.clientX; lookLastY=e.clientY; adjustLook(dx,dy,.0042);
});
const stopLook = (e) => { if (!e || e.pointerId === lookPointer) lookPointer = null; };
renderer.domElement.addEventListener("pointerup",stopLook); renderer.domElement.addEventListener("pointercancel",stopLook);

window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && settingsOpen()) { e.preventDefault(); closeSettings(); return; }
  if (!spawned || settingsOpen() || ["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName)) return;
  const k = e.key.toLowerCase(); if (["w","a","s","d","e","g"," "].includes(k)) e.preventDefault();
  if (k in keys) keys[k] = true;
  if (k === "e" && !e.repeat) seqInteract++;
  if (k === "g" && !e.repeat) seqGrapple++;
  if (k === " " && !e.repeat) seqRig++;
});
window.addEventListener("keyup", (e) => { const k=e.key.toLowerCase(); if (k in keys) keys[k]=false; });
ui.touchInteract.onpointerdown = (e) => { e.preventDefault(); seqInteract++; };
ui.touchGrapple.onpointerdown = (e) => { e.preventDefault(); seqGrapple++; };
ui.touchRigging.onpointerdown = (e) => { e.preventDefault(); seqRig++; };
function joy(e) {
  const r=ui.joystick.getBoundingClientRect(), max=r.width/2-24;
  let x=e.clientX-r.left-r.width/2, y=e.clientY-r.top-r.height/2;
  const len=Math.hypot(x,y)||1; if (len>max) { x*=max/len; y*=max/len; }
  touch.x=x/max; touch.y=y/max; ui.joystickKnob.style.transform=`translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
}
ui.joystick.onpointerdown=(e)=>{ e.preventDefault(); touchPointer=e.pointerId; ui.joystick.setPointerCapture?.(e.pointerId); joy(e); };
ui.joystick.onpointermove=(e)=>{ if(e.pointerId===touchPointer) joy(e); };
const resetJoy=()=>{ touchPointer=null; touch.x=touch.y=0; ui.joystickKnob.style.transform="translate(-50%, -50%)"; };
ui.joystick.onpointerup=resetJoy; ui.joystick.onpointercancel=resetJoy;

buildPalette(); renderJoinCode(); setCameraMode(cameraMode);
ui.create.onclick=createBattle;
ui.showJoin.onclick=()=>{ ui.lobbyHome.classList.add("hidden"); ui.joinPanel.classList.remove("hidden"); };
ui.back.onclick=()=>{ ui.joinPanel.classList.add("hidden"); ui.lobbyHome.classList.remove("hidden"); joinCode=[]; renderJoinCode(); };
ui.join.onclick=joinBattle;
ui.spawn.onclick=spawnLocal;
ui.settings.onclick=openSettings;
ui.settingsClose.onclick=closeSettings;
ui.firstPerson.onclick=()=>setCameraMode("first");
ui.thirdPerson.onclick=()=>setCameraMode("third");
ui.settingsPanel.addEventListener("pointerdown",(e)=>{ if(e.target===ui.settingsPanel) closeSettings(); });
ui.leave.onclick=()=>returnToMenu("You left the battle.");
ui.victoryLeave.onclick=()=>returnToMenu();

function resize(){ camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth,innerHeight,false); }
window.addEventListener("resize",resize); resize();
let last=performance.now();
function frame(now){
  requestAnimationFrame(frame);
  const dt=Math.min(.05,(now-last)/1000); last=now;
  if(network.isHost&&state?.phase==="playing"){
    for(const [id,p] of Object.entries(state.players)) processPlayer(p,id===localId?inputSnapshot():inputs.get(id)||{},dt);
    simulateShips(dt);
    if(now-lastBroadcast>STATE_INTERVAL){ syncState(); lastBroadcast=now; }
  }
  if(state){ renderState(); renderEffects(now); }
  updateAtmosphere(now); updateCamera(now); renderer.render(scene,camera);
}
requestAnimationFrame(frame);
