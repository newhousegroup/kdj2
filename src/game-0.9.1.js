const source070Url = new URL("./game-0.7.0.js?v=0.7.0", import.meta.url);
const base050Url = new URL("./game-0.5.js?v=0.5.0", import.meta.url).href;

function showBootError(error) {
  console.error("KDJ2 0.9.1 boot failed", error);
  const status = document.querySelector("#lobbyStatus");
  if (status) {
    status.textContent = `Game failed to load: ${error?.message || error}`;
    status.classList.add("error");
  }
}

async function boot() {
  const response = await fetch(source070Url, { cache: "no-store" });
  if (!response.ok) throw new Error(`Could not load KDj2 0.7.0 source (${response.status})`);
  let source = await response.text();

  function replaceRequired(pattern, replacement, label) {
    const next = source.replace(pattern, () => replacement);
    if (next === source) throw new Error(`0.9.1 patch failed: ${label}`);
    source = next;
  }

  replaceRequired(
    'const BASE_URL = new URL("./game-0.5.js?v=0.5.0", import.meta.url);',
    `const BASE_URL = new URL(${JSON.stringify(base050Url)});`,
    "base game URL"
  );

  replaceRequired(
    "const CANNON_COOLDOWN_MS = 2800;",
    "const CANNON_COOLDOWN_MS = 8000;",
    "8-second cannon cooldown"
  );
  replaceRequired(
    "const CANNON_DAMAGE = 12;",
    "const CANNON_DAMAGE_MIN = 4;\nconst CANNON_DAMAGE_MAX = 9;",
    "random cannon damage constants"
  );
  replaceRequired(
    "    target.mobility = Math.max(25, target.mobility - CANNON_DAMAGE);",
    "    const damage = Math.floor(Math.random() * (CANNON_DAMAGE_MAX - CANNON_DAMAGE_MIN + 1)) + CANNON_DAMAGE_MIN;\n    target.mobility = Math.max(25, target.mobility - damage);",
    "random cannon damage"
  );

  const extraPatches = String.raw`
  patch(
    '  touchGrapple: $("#touchGrapple"), touchRigging: $("#touchRigging"), touchFire: $("#touchFire")',
    '  touchGrapple: $("#touchGrapple"), touchRigging: $("#touchRigging"), touchFire: $("#touchFire"), touchSword: $("#touchSword"),\n  healthFill: $("#healthFill"), healthText: $("#healthText"), healthHud: $("#healthHud"), speedText: $("#speedText"), deathNotice: $("#deathNotice")',
    "combat and speed HUD bindings"
  );
  patch(
    "let seqFire = 0;",
    "let seqFire = 0;\nlet seqSword = 0;\nlet touchInteractHeld = false;",
    "combat input state"
  );
  patch(
    "const keys = { w: false, a: false, s: false, d: false };",
    "const keys = { w: false, a: false, s: false, d: false, e: false };",
    "held interact key state"
  );

  patch(
    'function playerRecord(id, name, team) {\n  return { id, name, team, ship: team, deck: "upper", x: 0, z: 10, yaw: 0, role: null, cannonIndex: null, spawned: false };\n}',
    'function playerRecord(id, name, team) {\n  return { id, name, team, ship: team, deck: "upper", x: 0, z: 10, yaw: 0, role: null, cannonIndex: null, health: 100, alive: true, swordSwingAt: 0, lastSwordAt: 0, captureStartedAt: 0, spawned: false };\n}',
    "player health and capture state"
  );
  patch(
    '  p.role = null;\n  p.cannonIndex = null;\n  p.spawned = spawn;',
    '  p.role = null;\n  p.cannonIndex = null;\n  p.health = 100;\n  p.alive = true;\n  p.swordSwingAt = 0;\n  p.lastSwordAt = 0;\n  p.captureStartedAt = 0;\n  p.spawned = spawn;',
    "round player reset"
  );
  patch(
    'function spawnPlayer(id) {\n  const p = state.players[id];\n  if (!p) return;',
    'function spawnPlayer(id) {\n  const p = state.players[id];\n  if (!p || p.alive === false) return;',
    "prevent mid-round respawn"
  );

  patch(
    '  const rightArm = makeLimb(coat, 0.22, 0.78, 0.25);\n  leftArm.position.set(-0.52, 1.62, 0);\n  rightArm.position.set(0.52, 1.62, 0);\n  group.add(leftArm, rightArm);',
    '  const rightArm = makeLimb(coat, 0.22, 0.78, 0.25);\n  leftArm.position.set(-0.52, 1.62, 0);\n  rightArm.position.set(0.52, 1.62, 0);\n  group.add(leftArm, rightArm);\n  const swordMetal = new THREE.MeshStandardMaterial({ color: 0xc9d0d2, metalness: 0.82, roughness: 0.24 });\n  const swordGrip = new THREE.MeshStandardMaterial({ color: 0x3a2a20, roughness: 0.92 });\n  addBox(rightArm, [0.09, 1.05, 0.11], swordMetal, [0, -1.17, 0]);\n  addBox(rightArm, [0.48, 0.07, 0.12], swordGrip, [0, -0.67, 0]);',
    "third-person sword model"
  );
  patch(
    'const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.06, 1000);',
    'const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.06, 1000);\nconst fpSword = new THREE.Group();\nconst fpBladeMat = new THREE.MeshStandardMaterial({ color: 0xd4dadd, metalness: 0.86, roughness: 0.2 });\nconst fpGripMat = new THREE.MeshStandardMaterial({ color: 0x3a2b22, roughness: 0.9 });\nconst fpBlade = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.88, 0.075), fpBladeMat);\nfpBlade.position.y = 0.38;\nfpSword.add(fpBlade);\nconst fpGuard = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.055, 0.09), fpGripMat);\nfpGuard.position.y = -0.08;\nfpSword.add(fpGuard);\nconst fpGrip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.32, 0.09), fpGripMat);\nfpGrip.position.y = -0.25;\nfpSword.add(fpGrip);\nfpSword.position.set(0.52, -0.48, -0.88);\nfpSword.rotation.set(-0.48, 0.12, -0.28);\ncamera.add(fpSword);\nscene.add(camera);',
    "first-person sword"
  );
  patch(
    '  } else {\n    data.leftLeg.rotation.x *= 0.72;\n    data.rightLeg.rotation.x *= 0.72;\n    data.leftArm.rotation.x *= 0.72;\n    data.rightArm.rotation.x *= 0.72;\n  }\n}',
    '  } else {\n    data.leftLeg.rotation.x *= 0.72;\n    data.rightLeg.rotation.x *= 0.72;\n    data.leftArm.rotation.x *= 0.72;\n    data.rightArm.rotation.x *= 0.72;\n  }\n  const swordAge = Date.now() - (p.swordSwingAt || 0);\n  if (swordAge >= 0 && swordAge < 360) {\n    const arc = Math.sin((swordAge / 360) * Math.PI);\n    data.rightArm.rotation.z = -arc * 1.05;\n    data.rightArm.rotation.x -= arc * 0.42;\n  } else {\n    data.rightArm.rotation.z *= 0.55;\n  }\n}',
    "sword swing animation"
  );

  patch(
    '    if (!p.spawned) continue;',
    '    if (!p.spawned || p.alive === false) continue;',
    "hide eliminated players"
  );
  patch(
    '  const local = state.players[localId];\n  for (const team of ["british", "french"]) {',
    '  const local = state.players[localId];\n  updateHealthHud(local);\n  for (const team of ["british", "french"]) {',
    "player HUD update"
  );
  patch(
    'function interaction(p) {',
    'function updateHealthHud(p) {\n  const health = Math.max(0, Math.min(100, Number(p?.health ?? 100)));\n  if (ui.healthFill) ui.healthFill.style.width = health + "%";\n  if (ui.healthText) ui.healthText.textContent = Math.round(health) + " HP";\n  if (ui.healthHud) ui.healthHud.setAttribute("aria-label", "Health " + Math.round(health) + " of 100");\n  const speed = Number(state?.ships?.[p?.team]?.speed || 0);\n  if (ui.speedText) ui.speedText.textContent = Math.abs(speed) < 0.05 ? "Speed 0.0" : (speed < 0 ? "Speed " + Math.abs(speed).toFixed(1) + " REV" : "Speed " + speed.toFixed(1));\n}\n\nfunction interaction(p) {',
    "health and speed HUD function"
  );
  patch(
    '  if (!p?.spawned || state.phase !== "playing") return null;',
    '  if (!p?.spawned || p.alive === false || state.phase !== "playing") return null;',
    "dead players cannot interact"
  );

  patch(
    '  if (!p?.spawned) {\n    ui.touchRigging?.classList.add("hidden");\n    ui.touchFire?.classList.add("hidden");\n    return;\n  }',
    '  if (!p?.spawned) {\n    ui.touchRigging?.classList.add("hidden");\n    ui.touchFire?.classList.add("hidden");\n    ui.touchSword?.classList.add("hidden");\n    ui.deathNotice?.classList.add("hidden");\n    return;\n  }\n  if (p.alive === false) {\n    ui.objective.textContent = "You are out for this battle · wait for the next round.";\n    ui.prompt.classList.add("hidden");\n    ui.touchRigging?.classList.add("hidden");\n    ui.touchFire?.classList.add("hidden");\n    ui.touchSword?.classList.add("hidden");\n    ui.deathNotice?.classList.remove("hidden");\n    return;\n  }\n  ui.deathNotice?.classList.add("hidden");',
    "dead-player HUD"
  );
  patch(
    '    ui.prompt.classList.add("hidden");\n    ui.touchRigging?.classList.add("hidden");\n    ui.touchFire?.classList.add("hidden");\n    return;',
    '    ui.prompt.classList.add("hidden");\n    ui.touchRigging?.classList.add("hidden");\n    ui.touchFire?.classList.add("hidden");\n    ui.touchSword?.classList.add("hidden");\n    return;',
    "hide sword in cooldown"
  );
  patch(
    '  ui.touchFire?.classList.toggle("hidden", p.role !== "gunner");',
    '  ui.touchFire?.classList.toggle("hidden", p.role !== "gunner");\n  ui.touchSword?.classList.toggle("hidden", Boolean(p.role) || p.alive === false);',
    "touch sword visibility"
  );

  patch(
    'function processPlayer(p, input, dt) {\n  if (!p.spawned || state.phase !== "playing") return;',
    'function processPlayer(p, input, dt) {\n  if (!p.spawned || p.alive === false || state.phase !== "playing") return;',
    "dead player movement lock"
  );
  patch(
    '  const seq = processed.get(p.id) || { interact: 0, grapple: 0, rig: 0, fire: 0 };\n  if ((input.interactSeq || 0) > seq.interact) { seq.interact = input.interactSeq; handleInteract(p); }\n  if ((input.grappleSeq || 0) > seq.grapple) { seq.grapple = input.grappleSeq; handleGrapple(p); }\n  if ((input.rigSeq || 0) > seq.rig) { seq.rig = input.rigSeq; handleRigging(p); }\n  if ((input.fireSeq || 0) > seq.fire) { seq.fire = input.fireSeq; handleCannonFire(p); }\n  processed.set(p.id, seq);',
    '  const seq = processed.get(p.id) || { interact: 0, grapple: 0, rig: 0, fire: 0, sword: 0 };\n  if ((input.interactSeq || 0) > seq.interact) { seq.interact = input.interactSeq; handleInteract(p); }\n  if ((input.grappleSeq || 0) > seq.grapple) { seq.grapple = input.grappleSeq; handleGrapple(p); }\n  if ((input.rigSeq || 0) > seq.rig) { seq.rig = input.rigSeq; handleRigging(p); }\n  if ((input.fireSeq || 0) > seq.fire) { seq.fire = input.fireSeq; handleCannonFire(p); }\n  if ((input.swordSeq || 0) > seq.sword) { seq.sword = input.swordSeq; handleSword(p); }\n  processed.set(p.id, seq);\n  processFlagCapture(p, input);',
    "sword and flag input processing"
  );

  patch(
    'function handleGrapple(p) {',
    'const SWORD_DAMAGE = 25;\nconst SWORD_COOLDOWN_MS = 850;\nconst SWORD_RANGE = 2.5;\n\nfunction knockOutPlayer(target, attacker) {\n  if (!target || target.alive === false) return;\n  releaseRole(target.id);\n  target.health = 0;\n  target.alive = false;\n  target.swordSwingAt = 0;\n  target.captureStartedAt = 0;\n  personal(target.id, "You are out until the next battle.");\n  if (attacker) personal(attacker.id, "Opponent out.");\n}\n\nfunction handleSword(p) {\n  if (!p?.spawned || p.alive === false || p.role || state.phase !== "playing") return;\n  const now = Date.now();\n  if (now - (p.lastSwordAt || 0) < SWORD_COOLDOWN_MS) return;\n  p.lastSwordAt = now;\n  p.swordSwingAt = now;\n  const yaw = p.yaw || 0;\n  const forwardX = -Math.sin(yaw);\n  const forwardZ = -Math.cos(yaw);\n  let target = null;\n  let targetDistance = Infinity;\n  for (const candidate of Object.values(state.players)) {\n    if (!candidate || candidate.id === p.id || candidate.team === p.team) continue;\n    if (!candidate.spawned || candidate.alive === false || candidate.ship !== p.ship || candidate.deck !== p.deck) continue;\n    const dx = candidate.x - p.x;\n    const dz = candidate.z - p.z;\n    const distance = Math.hypot(dx, dz);\n    if (distance < 0.001 || distance > SWORD_RANGE) continue;\n    const facing = (dx * forwardX + dz * forwardZ) / distance;\n    if (facing < 0.8660254 || distance >= targetDistance) continue;\n    target = candidate;\n    targetDistance = distance;\n  }\n  if (!target) return;\n  target.health = Math.max(0, (target.health ?? 100) - SWORD_DAMAGE);\n  if (target.health <= 0) knockOutPlayer(target, p);\n  else personal(p.id, "Sword hit · " + Math.round(target.health) + " HP remaining.");\n}\n\nfunction handleGrapple(p) {',
    "sword combat"
  );

  patch(
    '    rigSeq: seqRig,\n    fireSeq: seqFire',
    '    rigSeq: seqRig,\n    fireSeq: seqFire,\n    swordSeq: seqSword,\n    interactHeld: keys.e || touchInteractHeld',
    "combat input snapshot"
  );
  patch(
    '  if (k === " " && !e.repeat) {\n    if (state?.players?.[localId]?.role === "gunner") seqFire += 1;\n    else seqRig += 1;\n  }',
    '  if (k === " " && !e.repeat) {\n    const role = state?.players?.[localId]?.role;\n    if (role === "gunner") seqFire += 1;\n    else if (role === "sailmaster") seqRig += 1;\n    else seqSword += 1;\n  }',
    "keyboard sword attack"
  );
  patch(
    'ui.touchInteract.onpointerdown = (e) => { e.preventDefault(); if (state?.phase === "playing") seqInteract += 1; };',
    'ui.touchInteract.onpointerdown = (e) => { e.preventDefault(); touchInteractHeld = true; ui.touchInteract.setPointerCapture?.(e.pointerId); if (state?.phase === "playing") seqInteract += 1; };\nui.touchInteract.onpointerup = (e) => { e.preventDefault(); touchInteractHeld = false; };\nui.touchInteract.onpointercancel = () => { touchInteractHeld = false; };',
    "touch hold interaction"
  );
  patch(
    'if (ui.touchFire) ui.touchFire.onpointerdown = (e) => { e.preventDefault(); if (state?.phase === "playing") seqFire += 1; };',
    'if (ui.touchFire) ui.touchFire.onpointerdown = (e) => { e.preventDefault(); if (state?.phase === "playing") seqFire += 1; };\nif (ui.touchSword) ui.touchSword.onpointerdown = (e) => { e.preventDefault(); if (state?.phase === "playing") seqSword += 1; };',
    "touch sword attack"
  );
  patch(
    '    processed.set(p.id, { interact: input.interactSeq || 0, grapple: input.grappleSeq || 0, rig: input.rigSeq || 0, fire: input.fireSeq || 0 });',
    '    processed.set(p.id, { interact: input.interactSeq || 0, grapple: input.grappleSeq || 0, rig: input.rigSeq || 0, fire: input.fireSeq || 0, sword: input.swordSeq || 0 });',
    "round sword input reset"
  );

  patch(
    '  if (action.type === "capture") finishBattle(p.team, p.ship);',
    '  if (action.type === "capture") p.captureStartedAt ||= Date.now();',
    "remove instant flag capture"
  );
  patch(
    'function handleInteract(p) {',
    'const FLAG_CAPTURE_HOLD_MS = 5000;\n\nfunction processFlagCapture(p, input) {\n  if (!p?.spawned || p.alive === false || state.phase !== "playing") {\n    if (p) p.captureStartedAt = 0;\n    return;\n  }\n  const action = interaction(p);\n  if (!input.interactHeld || action?.type !== "capture") {\n    p.captureStartedAt = 0;\n    return;\n  }\n  if (!p.captureStartedAt) p.captureStartedAt = Date.now();\n  if (Date.now() - p.captureStartedAt >= FLAG_CAPTURE_HOLD_MS) {\n    p.captureStartedAt = 0;\n    finishBattle(p.team, p.ship);\n  }\n}\n\nfunction handleInteract(p) {',
    "flag capture hold logic"
  );
  patch(
    '    ui.prompt.classList.remove("hidden");\n  } else {',
    '    if (action.type === "capture") {\n      const elapsed = p.captureStartedAt ? Math.min(FLAG_CAPTURE_HOLD_MS, Date.now() - p.captureStartedAt) : 0;\n      const remaining = Math.max(0, (FLAG_CAPTURE_HOLD_MS - elapsed) / 1000);\n      ui.prompt.textContent = elapsed > 0 ? "Hold E · Capturing · " + remaining.toFixed(1) + "s" : "Hold E · " + action.label;\n    }\n    ui.prompt.classList.remove("hidden");\n  } else {',
    "flag capture progress prompt"
  );

  patch(
    '    const throttle = captain ? (input.w ? 1 : 0) + (input.s ? -0.5 : 0) : 0;\n    const steer = captain ? (input.a ? 1 : 0) - (input.d ? 1 : 0) : 0;\n    if ((ship.sailTrim ?? 1) > 0 && Date.now() >= (ship.sailDecayAt || 0)) {\n      ship.sailTrim = Math.max(0, (ship.sailTrim ?? 1) - 1);\n      ship.sailDecayAt = ship.sailTrim > 0 ? Date.now() + 20000 : 0;\n    }\n    const sailTrim = ship.sailTrim ?? 1;\n    const sailPower = [0.55, 0.78, 1.0][sailTrim] ?? 0.78;\n    const mobility = THREE.MathUtils.clamp(ship.mobility / 100, 0.22, 1);\n    const desired = throttle * 6.03 * sailPower * mobility;\n    ship.speed += THREE.MathUtils.clamp(desired - ship.speed, -4.32 * dt, 2.43 * dt);\n    if (Math.abs(ship.speed) < 0.04) ship.speed = 0;\n    if (captain && Math.abs(ship.speed) > 0.2) ship.heading += steer * 0.62 * mobility * dt * Math.sign(ship.speed);',
    '    const speedControl = captain ? (input.w ? 1 : 0) - (input.s ? 1 : 0) : 0;\n    const steer = captain ? (input.a ? 1 : 0) - (input.d ? 1 : 0) : 0;\n    if ((ship.sailTrim ?? 1) > 0 && Date.now() >= (ship.sailDecayAt || 0)) {\n      ship.sailTrim = Math.max(0, (ship.sailTrim ?? 1) - 1);\n      ship.sailDecayAt = ship.sailTrim > 0 ? Date.now() + 20000 : 0;\n    }\n    const sailTrim = ship.sailTrim ?? 1;\n    const sailPower = [0.55, 0.78, 1.0][sailTrim] ?? 0.78;\n    const mobility = THREE.MathUtils.clamp(ship.mobility / 100, 0.22, 1);\n    const maxForward = 6.03 * sailPower * mobility;\n    const maxReverse = -2.35 * sailPower * mobility;\n    if (captain && speedControl > 0) ship.speed = Math.min(maxForward, ship.speed + 1.72 * sailPower * mobility * dt);\n    else if (captain && speedControl < 0) ship.speed = Math.max(maxReverse, ship.speed - 1.95 * sailPower * mobility * dt);\n    const drag = captain ? 0.06 : 0.12;\n    if (Math.abs(ship.speed) > 0) ship.speed -= Math.sign(ship.speed) * Math.min(Math.abs(ship.speed), drag * dt);\n    if (Math.abs(ship.speed) < 0.025) ship.speed = 0;\n    const speedScale = THREE.MathUtils.clamp(Math.abs(ship.speed) / Math.max(0.6, maxForward), 0, 1);\n    if (captain && steer && Math.abs(ship.speed) > 0.04) {\n      const direction = ship.speed >= 0 ? 1 : -1;\n      ship.heading += steer * 0.42 * mobility * (0.28 + 0.72 * speedScale) * dt * direction;\n    }',
    "reliable helm steering and momentum"
  );
  patch(
    'if (p.role === "captain") ui.objective.textContent = `Captain of ${TEAM[p.ship].ship} · WASD to steer · E to leave helm`;',
    'if (p.role === "captain") ui.objective.textContent = `Captain of ${TEAM[p.ship].ship} · W/S speed · A/D steer · E to leave helm`;',
    "captain controls hint"
  );

  patch(
    'function updateCamera(now) {\n  const p = state?.players?.[localId];\n  if (!p?.spawned) {',
    'function updateCamera(now) {\n  const p = state?.players?.[localId];\n  fpSword.visible = Boolean(p?.spawned && p.alive !== false && cameraMode === "first" && !p.role && state?.phase === "playing");\n  if (fpSword.visible) {\n    const swordAge = Date.now() - (p.swordSwingAt || 0);\n    const arc = swordAge >= 0 && swordAge < 360 ? Math.sin((swordAge / 360) * Math.PI) : 0;\n    fpSword.rotation.x = -0.48 - arc * 0.28;\n    fpSword.rotation.z = -0.28 - arc * 1.08;\n  }\n  if (p?.spawned && p.alive === false && state?.ships?.[p.team]) {\n    const ship = state.ships[p.team];\n    const a = now * 0.00016;\n    const desired = new THREE.Vector3(ship.x + Math.cos(a) * 34, 22, ship.z + Math.sin(a) * 34);\n    camera.position.lerp(desired, 0.045);\n    camera.lookAt(ship.x, 4.5, ship.z);\n    return;\n  }\n  if (!p?.spawned) {',
    "dead-player spectator camera"
  );
`;

  replaceRequired(
    '  const moduleUrl = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));',
    extraPatches + '\n  const moduleUrl = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));',
    "0.9.1 gameplay patch injection"
  );

  source = source.replaceAll("KDJ2 0.7.0 boot failed", "KDJ2 0.9.1 boot failed");
  source = source.replaceAll("0.7.0 patch failed", "0.9.1 patch failed");

  const moduleUrl = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
  try {
    await import(moduleUrl);
  } finally {
    URL.revokeObjectURL(moduleUrl);
  }
}

boot().catch(showBootError);
