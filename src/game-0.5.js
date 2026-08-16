import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";

const TEAM = {
  british: { label: "British", ship: "HMS Resolute", color: 0xc34f4f },
  french: { label: "French", ship: "Fleur Royale", color: 0x4d72c7 }
};

const MAX_USERS = 6;
const STATE_INTERVAL = 80;
const GRAPPLE_RANGE = 48;
const RESET_MS = 10000;
const CAMERA_KEY = "kdj2-camera-mode";
const THIRD_ZOOM_KEY = "kdj2-third-person-distance";
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
  leave: $("#leaveBtn"), britishMobility: $("#britishMobility"), frenchMobility: $("#frenchMobility"),
  objective: $("#objective"), prompt: $("#interactionPrompt"), toast: $("#toast"),
  victoryTitle: $("#victoryTitle"), victoryText: $("#victoryText"), resetCountdown: $("#resetCountdown"),
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
let viewYaw = 0;
let viewPitch = -0.04;
let cameraMode = loadCameraMode();
let thirdPersonDistance = loadThirdDistance();
let seenRound = 0;
let lookPointer = null;
let lookLastX = 0;
let lookLastY = 0;
let pinchStartDistance = 0;
let pinchStartZoom = thirdPersonDistance;
const lookTouches = new Map();
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
  onHostLeft: () => returnToMenu("The host left the room.")
});

function loadCameraMode() {
  try { return localStorage.getItem(CAMERA_KEY) === "third" ? "third" : "first"; }
  catch (_) { return "first"; }
}

function loadThirdDistance() {
  try {
    const n = Number(localStorage.getItem(THIRD_ZOOM_KEY));
    return Number.isFinite(n) ? THREE.MathUtils.clamp(n, 6.2, 18) : 7.4;
  } catch (_) { return 7.4; }
}

function setThirdDistance(value) {
  thirdPersonDistance = THREE.MathUtils.clamp(value, 6.2, 18);
  try { localStorage.setItem(THIRD_ZOOM_KEY, String(thirdPersonDistance)); } catch (_) {}
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
  if (ui.dot) {
    ui.dot.className = `connection-dot ${kind}`;
    ui.dot.title = text;
  }
  if (!ui.lobby.classList.contains("hidden")) {
    ui.status.textContent = text;
    ui.status.classList.toggle("error", kind === "failure");
  }
}

function showToast(text, ms = 1900) {
  if (!text || !ui.toast) return;
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
    const button = document.createElement("button");
    button.style.background = c.hex;
    button.onclick = () => {
      if (joinCode.length < 4) {
        joinCode.push(c.key);
        renderJoinCode();
      }
    };
    ui.palette.appendChild(button);
  });
}

function chooseTeam() {
  const count = { british: 0, french: 0 };
  Object.values(state.players).forEach((p) => count[p.team]++);
  if (count.british !== count.french) return count.british < count.french ? "british" : "french";
  return Math.random() < 0.5 ? "british" : "french";
}

function freshShip(team) {
  return team === "british"
    ? { x: -30, z: 0, heading: Math.PI / 2, speed: 0, mobility: 100, captain: null, sailmaster: null, boostUntil: 0 }
    : { x: 30, z: 0, heading: -Math.PI / 2, speed: 0, mobility: 100, captain: null, sailmaster: null, boostUntil: 0 };
}

function playerRecord(id, name, team) {
  return { id, name, team, ship: team, deck: "upper", x: 0, z: 10, yaw: 0, role: null, spawned: false };
}

function placePlayerOnOwnShip(p, spawn = true) {
  p.ship = p.team;
  p.deck = "upper";
  p.x = 0;
  p.z = 10;
  p.yaw = 0;
  p.role = null;
  p.spawned = spawn;
}

function initialState(id, name) {
  const team = Math.random() < 0.5 ? "british" : "french";
  state = {
    phase: "playing", round: 1, winner: null, loser: null, resetAt: 0,
    ships: { british: freshShip("british"), french: freshShip("french") },
    players: { [id]: playerRecord(id, name, team) }
  };
  seenRound = 1;
}

function hostAddPlayer(id, name) {
  if (!network.isHost || !state || Object.keys(state.players).length >= MAX_USERS) {
    return network.rejectGuest(id, "Room is full (6 / 6).");
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
  processed.delete(id);
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
  if (state.round && state.round !== seenRound) {
    seenRound = state.round;
    viewYaw = 0;
    viewPitch = -0.04;
    ui.victory.classList.add("hidden");
    ui.hud.classList.remove("hidden");
    showToast(`Battle ${state.round} started.`, 1800);
  }
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
    ui.status.textContent = e?.message || "Could not create room.";
    ui.status.classList.add("error");
  }
}

async function joinBattle() {
  try {
    const welcome = await network.joinRoom(safeName(), joinCode);
    localId = welcome.selfId || welcome.id;
    localTeam = welcome.team;
    state = welcome.state;
    seenRound = state.round || 1;
    renderCode(ui.roomCode, welcome.roomCode || joinCode);
    syncLocal();
    showDeployment();
  } catch (e) {
    ui.status.textContent = e?.message || "Could not join room.";
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
  if (!p) return;
  releaseRole(id);
  placePlayerOnOwnShip(p, true);
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
  if (state?.phase === "cooldown") updateCooldownUi();
  const coarse = matchMedia("(hover: none), (pointer: coarse)").matches;
  showToast(`${TEAM[localTeam].label} crew · ${coarse ? "Drag to look; pinch in third person to zoom." : "Click the world for mouse look."}`, 3200);
}

function returnToMenu(message = "") {
  document.exitPointerLock?.();
  closeSettings();
  network.cleanup();
  localId = null;
  localTeam = null;
  spawned = false;
  state = null;
  seenRound = 0;
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

const renderer = new THREE.WebGLRenderer({ canvas: $("#gameCanvas"), antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.domElement.style.touchAction = "none";

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
  const cloud = new THREE.Group();
  const puffCount = 3 + (i % 3);
  for (let j = 0; j < puffCount; j += 1) {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(7 + (j % 2) * 3, 8, 6), cloudMat);
    puff.scale.y = 0.45;
    puff.position.set(j * 8 - puffCount * 3, (j % 2) * 2, (j % 3) * 2);
    cloud.add(puff);
  }
  cloud.position.set((Math.random() - 0.5) * 480, 70 + Math.random() * 45, (Math.random() - 0.5) * 480);
  cloud.userData.speed = 0.45 + Math.random() * 0.35;
  clouds.add(cloud);
}
scene.add(clouds);

const world = new THREE.Group();
const effects = new THREE.Group();
scene.add(world, effects);

function canvasTexture(size, draw) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  draw(ctx, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

const deckTexture = canvasTexture(512, (ctx, s) => {
  ctx.fillStyle = "#a97e4f";
  ctx.fillRect(0, 0, s, s);
  ctx.strokeStyle = "rgba(52,31,18,.34)";
  ctx.lineWidth = 3;
  for (let x = 0; x <= s; x += 64) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, s); ctx.stroke(); }
  for (let y = 0; y <= s; y += 32) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(s, y); ctx.stroke(); }
});
deckTexture.repeat.set(4, 12);

function sailTexture(team) {
  return canvasTexture(256, (ctx, s) => {
    const teamHex = `#${TEAM[team].color.toString(16).padStart(6, "0")}`;
    ctx.fillStyle = "#e8dfc8";
    ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = "rgba(92,74,52,.16)";
    ctx.lineWidth = 2;
    for (let y = 12; y < s; y += 18) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(s, y); ctx.stroke(); }
    ctx.fillStyle = teamHex;
    ctx.globalAlpha = 0.78;
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

function billowGeometry(width, height, bend = 0.42, sx = 7, sy = 7) {
  const geometry = new THREE.PlaneGeometry(width, height, sx, sy);
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

function addRaisedStaysail(parent, sailMat, darkWood, sails) {
  const mastZ = 0.75;
  addCylinder(parent, 0.20, 15.2, darkWood, [0, 11.8, mastZ]);
  addCylinder(parent, 0.08, 6.5, darkWood, [0, 16.2, mastZ], [0, 0, Math.PI / 2]);
  const shape = new THREE.Shape();
  shape.moveTo(-2.8, -2.1);
  shape.lineTo(-2.8, 2.2);
  shape.lineTo(2.7, -1.45);
  shape.closePath();
  const sail = new THREE.Mesh(new THREE.ShapeGeometry(shape), sailMat);
  sail.position.set(0, 14.0, mastZ - 0.04);
  sail.userData.baseRotationY = 0;
  parent.add(sail);
  sails.push(sail);
  addRope(parent, [[-2.8, 16.2, mastZ], [-2.8, 11.9, mastZ]]);
  addRope(parent, [[2.7, 12.55, mastZ], [0, 19.4, mastZ]]);
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
  const stripeMat = new THREE.MeshStandardMaterial({ color: TEAM[team].color, roughness: 0.72 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x4c565a, metalness: 0.72, roughness: 0.32 });
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

  const railX = 4.48;
  const sternZ = 14.92;
  const foreZ = -12.72;
  const sideCenterZ = (sternZ + foreZ) / 2;
  const sideLength = sternZ - foreZ;
  for (const side of [-1, 1]) {
    addBox(exterior, [0.14, 0.14, sideLength], darkWood, [side * railX, 5.08, sideCenterZ]);
    for (let z = foreZ; z <= sternZ + 0.01; z += 3.95) {
      addCylinder(exterior, 0.07, 1.15, darkWood, [side * railX, 4.58, Math.min(z, sternZ)]);
    }
  }
  addBox(exterior, [railX * 2 + 0.14, 0.14, 0.14], darkWood, [0, 5.08, sternZ]);
  addRope(exterior, [[-railX, 5.08, foreZ], [0, 5.08, -15.25], [railX, 5.08, foreZ]], 0x2b211b);

  const cornerPoints = [
    [-railX, 5.08, sternZ], [railX, 5.08, sternZ],
    [-railX, 5.08, foreZ], [railX, 5.08, foreZ],
    [0, 5.08, -15.25]
  ];
  for (const [x, y, z] of cornerPoints) {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), metal);
    cap.position.set(x, y, z);
    exterior.add(cap);
  }

  addCylinder(exterior, 0.25, 16.5, darkWood, [0, 12.45, -9.2]);
  addSquareSail(exterior, sailMat, darkWood, { z: -9.2, y: 11.6, width: 6.8, height: 5.2, bend: 0.40 }, sails);
  addSquareSail(exterior, sailMat, darkWood, { z: -9.2, y: 16.2, width: 5.1, height: 3.0, bend: 0.30 }, sails);
  addRaisedStaysail(exterior, sailMat, darkWood, sails);
  addRope(exterior, [[0, 20.6, -9.2], [0, 5.0, -16.8]]);
  addRope(exterior, [[0, 20.6, -9.2], [0, 19.4, 0.75]]);
  addRope(exterior, [[0, 19.4, 0.75], [0, 5.2, 13.7]]);
  addRope(exterior, [[-4.2, 5.0, -12], [0, 19.4, 0.75], [4.2, 5.0, -12]]);

  const flagPole = addCylinder(exterior, 0.08, 7.5, darkWood, [0, 8.0, 12.5]);
  flagPole.castShadow = true;
  const flag = new THREE.Mesh(
    new THREE.PlaneGeometry(2.6, 1.25),
    new THREE.MeshStandardMaterial({ color: TEAM[team].color, side: THREE.DoubleSide, roughness: 0.75 })
  );
  flag.position.set(1.3, 10.8, 12.5);
  exterior.add(flag);

  const helm = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.12, 8, 24), darkWood);
  helm.position.set(0, 5.55, 9);
  exterior.add(helm);
  for (let i = 0; i < 8; i += 1) addBox(exterior, [0.08, 1.85, 0.08], darkWood, [0, 5.55, 9], [0, 0, i * Math.PI / 4]);
  addCylinder(exterior, 0.12, 1.5, metal, [0, 4.82, 9]);

  const rigX = -2.15;
  const rigZ = -2.2;
  addBox(exterior, [2.7, 0.7, 2.1], darkWood, [rigX, 4.72, rigZ]);
  const coil = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.10, 8, 22), new THREE.MeshStandardMaterial({ color: 0x8f704f, roughness: 1 }));
  coil.rotation.x = Math.PI / 2;
  coil.position.set(rigX, 5.15, rigZ);
  exterior.add(coil);

  addBox(exterior, [3.1, 0.16, 3.25], darkWood, [0, 4.42, 3.3]);
  addBox(exterior, [2.55, 0.10, 2.7], new THREE.MeshStandardMaterial({ color: 0x6c472f, roughness: 1 }), [0, 4.54, 3.3]);

  for (const side of [-1, 1]) {
    for (const z of [-7.5, 0.5, 8.5]) {
      addBox(exterior, [0.12, 0.52, 1.15], metal, [side * 4.84, 2.35, z]);
    }
  }

  const lowerCeilingY = 3.86;
  const wallHeight = lowerCeilingY - LOWER_FLOOR_Y;
  const wallCenter = LOWER_FLOOR_Y + wallHeight / 2;
  const lowerFloor = addBox(lower, [8.2, 0.22, 25], interiorWood, [0, LOWER_FLOOR_Y, 0]);
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

function makeLimb(material, width, length, depth) {
  const pivot = new THREE.Group();
  const mesh = addBox(pivot, [width, length, depth], material, [0, -length / 2, 0]);
  mesh.castShadow = true;
  return pivot;
}

function makePlayer(p) {
  const group = new THREE.Group();
  const coat = new THREE.MeshStandardMaterial({ color: TEAM[p.team].color, roughness: 0.78 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x20252a, roughness: 0.8 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xd4a77e, roughness: 0.9 });
  const white = new THREE.MeshStandardMaterial({ color: 0xf6f5ef, roughness: 0.7 });
  const pupil = new THREE.MeshStandardMaterial({ color: 0x121619, roughness: 0.7 });

  const leftLeg = makeLimb(dark, 0.30, 0.82, 0.32);
  const rightLeg = makeLimb(dark, 0.30, 0.82, 0.32);
  leftLeg.position.set(-0.22, 0.82, 0);
  rightLeg.position.set(0.22, 0.82, 0);
  group.add(leftLeg, rightLeg);

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.50, 1.02, 10), coat);
  body.position.y = 1.28;
  group.add(body);

  const leftArm = makeLimb(coat, 0.22, 0.78, 0.25);
  const rightArm = makeLimb(coat, 0.22, 0.78, 0.25);
  leftArm.position.set(-0.52, 1.62, 0);
  rightArm.position.set(0.52, 1.62, 0);
  group.add(leftArm, rightArm);

  const headGroup = new THREE.Group();
  headGroup.position.y = 1.95;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 9), skin);
  headGroup.add(head);
  for (const x of [-0.12, 0.12]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), white);
    eye.position.set(x, 0.045, 0.31);
    headGroup.add(eye);
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.034, 8, 6), pupil);
    dot.position.set(x, 0.045, 0.368);
    headGroup.add(dot);
  }
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.13, 6), skin);
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, -0.03, 0.34);
  headGroup.add(nose);
  group.add(headGroup);

  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.08, 14), dark);
  brim.position.y = 2.25;
  group.add(brim);
  const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.30, 0.35, 0.25, 12), dark);
  hat.position.y = 2.38;
  group.add(hat);

  group.userData = {
    leftLeg, rightLeg, leftArm, rightArm,
    walkPhase: 0,
    lastLocalX: p.x,
    lastLocalZ: p.z
  };
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

function animatePlayer(mesh, p) {
  const data = mesh.userData;
  const dx = p.x - data.lastLocalX;
  const dz = p.z - data.lastLocalZ;
  const moved = Math.hypot(dx, dz);
  data.lastLocalX = p.x;
  data.lastLocalZ = p.z;

  if (moved > 0.0015 && !p.role && state?.phase === "playing") {
    data.walkPhase += Math.min(0.65, moved * 6.6);
    const swing = Math.sin(data.walkPhase) * 0.58;
    data.leftLeg.rotation.x = THREE.MathUtils.lerp(data.leftLeg.rotation.x, swing, 0.45);
    data.rightLeg.rotation.x = THREE.MathUtils.lerp(data.rightLeg.rotation.x, -swing, 0.45);
    data.leftArm.rotation.x = THREE.MathUtils.lerp(data.leftArm.rotation.x, -swing * 0.55, 0.4);
    data.rightArm.rotation.x = THREE.MathUtils.lerp(data.rightArm.rotation.x, swing * 0.55, 0.4);
  } else {
    data.leftLeg.rotation.x *= 0.72;
    data.rightLeg.rotation.x *= 0.72;
    data.leftArm.rotation.x *= 0.72;
    data.rightArm.rotation.x *= 0.72;
  }
}

function renderState(now = performance.now()) {
  if (!state) return;
  for (const team of ["british", "french"]) {
    const ship = state.ships[team];
    const visual = shipMeshes[team];
    visual.group.position.set(ship.x, 0, ship.z);
    visual.group.rotation.y = ship.heading;
    const lean = Math.sin(now * 0.00135 + (team === "british" ? 0 : 1.7)) * 0.022;
    for (const sail of visual.sails) {
      if (!Number.isFinite(sail.userData.baseRotationY)) sail.userData.baseRotationY = sail.rotation.y;
      sail.rotation.y = sail.userData.baseRotationY + lean;
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
    animatePlayer(mesh, p);
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
  ocean.visible = !(local?.spawned && local.deck === "lower");

  ui.britishMobility.textContent = `Mobility ${Math.round(state.ships.british.mobility)}%`;
  ui.frenchMobility.textContent = `Mobility ${Math.round(state.ships.french.mobility)}%`;
  ui.people.textContent = `${Object.keys(state.players).length} / ${MAX_USERS}`;
  updateObjective(local);
  if (state.phase === "cooldown") updateCooldownUi();
}

function interaction(p) {
  if (!p?.spawned || state.phase !== "playing") return null;
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
  if (state.phase === "cooldown") {
    ui.objective.textContent = "Battle over · next battle starting shortly.";
    ui.prompt.classList.add("hidden");
    ui.touchRigging?.classList.add("hidden");
    return;
  }
  if (p.role === "captain") ui.objective.textContent = `Captain of ${TEAM[p.ship].ship} · WASD to steer · E to leave helm`;
  else if (p.role === "sailmaster") ui.objective.textContent = `Sailmaster on ${TEAM[p.ship].ship} · Space / SAILS to trim sails · E to leave rigging`;
  else if (p.ship !== p.team) ui.objective.textContent = p.deck === "lower" ? "Find and capture the enemy flag." : "On enemy ship · find the hatch.";
  else ui.objective.textContent = `Battle ${state.round || 1} · capture the enemy flag below deck.`;

  const action = interaction(p);
  if (action) {
    ui.prompt.textContent = `E · ${action.label}`;
    ui.prompt.classList.remove("hidden");
  } else {
    ui.prompt.classList.add("hidden");
  }
  ui.touchRigging?.classList.toggle("hidden", p.role !== "sailmaster");
}

function normalizeAngle(value) { return Math.atan2(Math.sin(value), Math.cos(value)); }

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

function upperDeckHalfWidth(z) {
  if (z <= -13.9) return 1.0;
  if (z < -11.0) {
    const t = (z + 13.9) / 2.9;
    return THREE.MathUtils.lerp(1.0, 4.08, THREE.MathUtils.clamp(t, 0, 1));
  }
  return 4.08;
}

function validDeckPosition(deck, x, z) {
  if (deck === "lower") return z >= -11.65 && z <= 11.65 && Math.abs(x) <= 3.62;
  if (z < -13.9 || z > 14.45) return false;
  return Math.abs(x) <= upperDeckHalfWidth(z);
}

function slideMove(p, moveX, moveZ) {
  const stepLen = Math.hypot(moveX, moveZ);
  if (stepLen < 1e-8) return;
  const fullX = p.x + moveX;
  const fullZ = p.z + moveZ;
  if (validDeckPosition(p.deck, fullX, fullZ)) {
    p.x = fullX;
    p.z = fullZ;
    return;
  }

  const zSign = Math.sign(moveZ);
  if (zSign && validDeckPosition(p.deck, p.x, p.z + zSign * stepLen)) {
    p.z += zSign * stepLen;
    return;
  }
  const xSign = Math.sign(moveX);
  if (xSign && validDeckPosition(p.deck, p.x + xSign * stepLen, p.z)) {
    p.x += xSign * stepLen;
    return;
  }

  const pieces = 5;
  for (let i = 0; i < pieces; i += 1) {
    const sx = moveX / pieces;
    const sz = moveZ / pieces;
    if (validDeckPosition(p.deck, p.x + sx, p.z + sz)) {
      p.x += sx;
      p.z += sz;
      continue;
    }
    if (validDeckPosition(p.deck, p.x, p.z + sz)) p.z += sz;
    else if (validDeckPosition(p.deck, p.x + sx, p.z)) p.x += sx;
  }
}

function processPlayer(p, input, dt) {
  if (!p.spawned || state.phase !== "playing") return;
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
  const magnitude = Math.hypot(dx, dz);
  if (magnitude < 0.001) return;
  const distance = speed * dt;
  slideMove(p, (dx / magnitude) * distance, (dz / magnitude) * distance);
}

function shipAxes(ship) {
  return [
    { x: Math.cos(ship.heading), z: -Math.sin(ship.heading) },
    { x: Math.sin(ship.heading), z: Math.cos(ship.heading) }
  ];
}

function dot2(a, b) { return a.x * b.x + a.z * b.z; }

function projectionRadius(ship, axis) {
  const [right, forward] = shipAxes(ship);
  return Math.abs(dot2(axis, right)) * SHIP_HALF_WIDTH + Math.abs(dot2(axis, forward)) * SHIP_HALF_LENGTH;
}

function shipsOverlap(a, b) {
  const delta = { x: b.x - a.x, z: b.z - a.z };
  for (const axis of [...shipAxes(a), ...shipAxes(b)]) {
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
  british.speed = 0;
  french.speed = 0;
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
  if (action.type === "down") { p.deck = "lower"; p.x = 0; p.z = 3.3; }
  if (action.type === "up") { p.deck = "upper"; p.x = 0; p.z = 3.3; }
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
  if (p.role !== "sailmaster" || state.phase !== "playing") return;
  const ship = state.ships[p.ship];
  if (ship.sailmaster !== p.id) return;
  ship.boostUntil = Date.now() + 1800;
  personal(p.id, "Sails trimmed — speed boost active.");
}

function handleGrapple(p) {
  if (state.phase !== "playing") return;
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
}

function finishBattle(winner, loser) {
  if (!network.isHost || state.phase !== "playing") return;
  state.phase = "cooldown";
  state.winner = winner;
  state.loser = loser;
  state.resetAt = Date.now() + RESET_MS;
  for (const ship of Object.values(state.ships)) {
    ship.speed = 0;
    ship.captain = null;
    ship.sailmaster = null;
    ship.boostUntil = 0;
  }
  for (const p of Object.values(state.players)) p.role = null;
  syncState();
  updateCooldownUi();
}

function resetRound() {
  if (!network.isHost || !state) return;
  state.round = (state.round || 1) + 1;
  state.phase = "playing";
  state.winner = null;
  state.loser = null;
  state.resetAt = 0;
  state.ships = { british: freshShip("british"), french: freshShip("french") };
  for (const p of Object.values(state.players)) {
    placePlayerOnOwnShip(p, true);
    const input = p.id === localId ? inputSnapshot() : inputs.get(p.id) || {};
    processed.set(p.id, { interact: input.interactSeq || 0, grapple: input.grappleSeq || 0, rig: input.rigSeq || 0 });
  }
  syncState();
  syncLocal();
}

function updateCooldownUi() {
  if (!state || state.phase !== "cooldown") return;
  document.exitPointerLock?.();
  const winner = state.winner;
  const loser = state.loser;
  ui.victoryTitle.textContent = winner ? `${TEAM[winner].label} victory` : "Battle over";
  ui.victoryText.textContent = loser ? `${TEAM[loser].label} flag captured.` : "Flag captured.";
  const seconds = Math.max(0, Math.ceil((state.resetAt - Date.now()) / 1000));
  if (ui.resetCountdown) ui.resetCountdown.textContent = `Next battle in ${seconds}s`;
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
  const eye = toWorld(ship, p.x, p.z, p.deck === "lower" ? LOWER_EYE_Y : 6.08);
  const dir = lookDirection(ship);
  if (cameraMode === "first") {
    camera.position.copy(eye);
    camera.lookAt(eye.clone().add(dir));
    return;
  }
  const flat = new THREE.Vector3(dir.x, 0, dir.z).normalize();
  const distance = p.deck === "lower" ? Math.min(4.2, thirdPersonDistance) : thirdPersonDistance;
  const lift = p.deck === "lower" ? 0.75 : 2.7 + Math.max(0, distance - 7.4) * 0.22;
  const desired = eye.clone().addScaledVector(flat, -distance).add(new THREE.Vector3(0, lift, 0));
  camera.position.lerp(desired, 0.17);
  camera.lookAt(eye.clone().addScaledVector(dir, 2.4));
}

function renderEffects(now) {
  effects.clear();
  for (let i = grappleFx.length - 1; i >= 0; i -= 1) {
    const e = grappleFx[i];
    if (now - e.start > 1400) { grappleFx.splice(i, 1); continue; }
    const a = state?.ships[e.from];
    const b = state?.ships[e.to];
    if (!a || !b) continue;
    const material = new THREE.LineBasicMaterial({ color: 0xd8c29e, transparent: true, opacity: Math.max(0, 1 - (now - e.start) / 1400) });
    effects.add(new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(a.x, 5, a.z), new THREE.Vector3(b.x, 5, b.z)]),
      material
    ));
  }
}

function updateAtmosphere(now) {
  oceanMaterial.uniforms.uTime.value = now / 1000;
  for (const cloud of clouds.children) {
    cloud.position.x += cloud.userData.speed * 0.012;
    if (cloud.position.x > 260) cloud.position.x = -260;
  }
}

setInterval(() => {
  if (!spawned || !state?.players?.[localId] || state.phase !== "playing") return;
  const input = inputSnapshot();
  if (network.isHost) inputs.set(localId, input);
  else network.send({ type: "input", input });
}, 50);

function adjustLook(dx, dy, scale = 0.0022) {
  viewYaw = normalizeAngle(viewYaw - dx * scale);
  viewPitch = THREE.MathUtils.clamp(viewPitch - dy * scale * 0.82, -1.18, 1.05);
}

function touchDistance() {
  const points = [...lookTouches.values()];
  if (points.length < 2) return 0;
  return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
}

renderer.domElement.addEventListener("click", () => {
  if (!spawned || state?.phase !== "playing" || settingsOpen() || matchMedia("(hover: none), (pointer: coarse)").matches) return;
  if (document.pointerLockElement !== renderer.domElement) renderer.domElement.requestPointerLock?.();
});

document.addEventListener("mousemove", (e) => {
  if (document.pointerLockElement === renderer.domElement && spawned && state?.phase === "playing" && !settingsOpen()) {
    adjustLook(e.movementX, e.movementY);
  }
});

renderer.domElement.addEventListener("wheel", (e) => {
  if (!spawned || cameraMode !== "third" || settingsOpen()) return;
  e.preventDefault();
  setThirdDistance(thirdPersonDistance + Math.sign(e.deltaY) * 0.8);
}, { passive: false });

renderer.domElement.addEventListener("pointerdown", (e) => {
  if (!spawned || state?.phase !== "playing" || settingsOpen() || e.pointerType === "mouse") return;
  e.preventDefault();
  lookTouches.set(e.pointerId, { x: e.clientX, y: e.clientY });
  renderer.domElement.setPointerCapture?.(e.pointerId);
  if (lookTouches.size === 1) {
    lookPointer = e.pointerId;
    lookLastX = e.clientX;
    lookLastY = e.clientY;
  } else if (lookTouches.size === 2 && cameraMode === "third") {
    pinchStartDistance = touchDistance();
    pinchStartZoom = thirdPersonDistance;
    lookPointer = null;
  }
});

renderer.domElement.addEventListener("pointermove", (e) => {
  if (!lookTouches.has(e.pointerId) || settingsOpen()) return;
  e.preventDefault();
  lookTouches.set(e.pointerId, { x: e.clientX, y: e.clientY });

  if (lookTouches.size >= 2 && cameraMode === "third") {
    const current = touchDistance();
    if (pinchStartDistance > 8 && current > 8) {
      setThirdDistance(pinchStartZoom * (pinchStartDistance / current));
    }
    return;
  }

  if (e.pointerId === lookPointer) {
    const dx = e.clientX - lookLastX;
    const dy = e.clientY - lookLastY;
    lookLastX = e.clientX;
    lookLastY = e.clientY;
    adjustLook(dx, dy, 0.0042);
  }
});

function stopLook(e) {
  if (e && lookTouches.has(e.pointerId)) lookTouches.delete(e.pointerId);
  if (!e || e.pointerId === lookPointer) lookPointer = null;
  if (lookTouches.size === 1) {
    const [id, point] = lookTouches.entries().next().value;
    lookPointer = id;
    lookLastX = point.x;
    lookLastY = point.y;
  }
  if (lookTouches.size < 2) pinchStartDistance = 0;
}
renderer.domElement.addEventListener("pointerup", stopLook);
renderer.domElement.addEventListener("pointercancel", stopLook);

window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && settingsOpen()) { e.preventDefault(); closeSettings(); return; }
  if (!spawned || state?.phase !== "playing" || settingsOpen() || ["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName)) return;
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

ui.touchInteract.onpointerdown = (e) => { e.preventDefault(); if (state?.phase === "playing") seqInteract += 1; };
ui.touchGrapple.onpointerdown = (e) => { e.preventDefault(); if (state?.phase === "playing") seqGrapple += 1; };
ui.touchRigging.onpointerdown = (e) => { e.preventDefault(); if (state?.phase === "playing") seqRig += 1; };

function joy(e) {
  const r = ui.joystick.getBoundingClientRect();
  const max = r.width / 2 - 24;
  let x = e.clientX - r.left - r.width / 2;
  let y = e.clientY - r.top - r.height / 2;
  const len = Math.hypot(x, y) || 1;
  if (len > max) { x *= max / len; y *= max / len; }
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
ui.joystick.onpointermove = (e) => { if (e.pointerId === touchPointer) joy(e); };
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
ui.create.onclick = createBattle;
ui.showJoin.onclick = () => { ui.lobbyHome.classList.add("hidden"); ui.joinPanel.classList.remove("hidden"); };
ui.back.onclick = () => { ui.joinPanel.classList.add("hidden"); ui.lobbyHome.classList.remove("hidden"); joinCode = []; renderJoinCode(); };
ui.join.onclick = joinBattle;
ui.spawn.onclick = spawnLocal;
ui.settings.onclick = openSettings;
ui.settingsClose.onclick = closeSettings;
ui.firstPerson.onclick = () => setCameraMode("first");
ui.thirdPerson.onclick = () => setCameraMode("third");
ui.settingsPanel.addEventListener("pointerdown", (e) => { if (e.target === ui.settingsPanel) closeSettings(); });
ui.leave.onclick = () => returnToMenu("You left the room.");

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
  if (network.isHost && state) {
    if (state.phase === "playing") {
      for (const [id, p] of Object.entries(state.players)) {
        processPlayer(p, id === localId ? inputSnapshot() : inputs.get(id) || {}, dt);
      }
      simulateShips(dt);
    } else if (state.phase === "cooldown" && Date.now() >= state.resetAt) {
      resetRound();
    }
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
