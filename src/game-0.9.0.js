const sourceUrl = new URL("./game-0.8.0.js?v=0.8.0", import.meta.url).href;
const game070Url = new URL("./game-0.7.0.js?v=0.7.0", import.meta.url).href;
const base050Url = new URL("./game-0.5.js?v=0.5.0", import.meta.url).href;

function showBootError(error) {
  console.error("KDJ2 0.9.0 boot failed", error);
  const status = document.querySelector("#lobbyStatus");
  if (status) {
    status.textContent = `Game failed to load: ${error?.message || error}`;
    status.classList.add("error");
  }
}

async function boot() {
  const response = await fetch(sourceUrl, { cache: "no-store" });
  if (!response.ok) throw new Error(`Could not load 0.8.0 combat source (${response.status})`);
  let source = await response.text();

  source = source.replace(
    'const previousUrl = new URL("./game-0.7.0.js?v=0.7.0", import.meta.url);',
    `const previousUrl = new URL(${JSON.stringify(game070Url)});`
  );
  source = source.replace(
    'const base050Url = new URL("./game-0.5.js?v=0.5.0", import.meta.url).href;',
    `const base050Url = ${JSON.stringify(base050Url)};`
  );

  const start = source.indexOf('const extraPatches = String.raw`');
  const end = source.indexOf('`;\n\n  replaceRequired(', start);
  if (start < 0 || end < 0) throw new Error("Could not locate 0.8.0 combat patch block");

  const prefix = source.slice(0, start);
  let block = source.slice(start, end).replaceAll('\\\\n', '\\n');

  const extra09 = String.raw`

  // 0.9.0: five-second hold-to-capture.
  patch(
    "const keys = { w: false, a: false, s: false, d: false };",
    "const keys = { w: false, a: false, s: false, d: false, e: false };",
    "held interact key state"
  );
  patch(
    "let seqSword = 0;",
    "let seqSword = 0;\nlet touchInteractHeld = false;",
    "touch interact hold state"
  );
  patch(
    "swordSwingAt: 0, lastSwordAt: 0, spawned: false",
    "swordSwingAt: 0, lastSwordAt: 0, captureStartedAt: 0, spawned: false",
    "capture timer player state"
  );
  patch(
    "  p.lastSwordAt = 0;\n  p.spawned = spawn;",
    "  p.lastSwordAt = 0;\n  p.captureStartedAt = 0;\n  p.spawned = spawn;",
    "capture timer round reset"
  );
  patch(
    "    swordSeq: seqSword\n  };",
    "    swordSeq: seqSword,\n    interactHeld: keys.e || touchInteractHeld\n  };",
    "held interact input"
  );
  patch(
    "ui.touchInteract.onpointerdown = (e) => { e.preventDefault(); if (state?.phase === \"playing\") seqInteract += 1; };",
    "ui.touchInteract.onpointerdown = (e) => { e.preventDefault(); touchInteractHeld = true; ui.touchInteract.setPointerCapture?.(e.pointerId); if (state?.phase === \"playing\") seqInteract += 1; };\nui.touchInteract.onpointerup = (e) => { e.preventDefault(); touchInteractHeld = false; };\nui.touchInteract.onpointercancel = () => { touchInteractHeld = false; };",
    "touch hold interaction"
  );
  patch(
    "  if (action.type === \"capture\") finishBattle(p.team, p.ship);",
    "  if (action.type === \"capture\") p.captureStartedAt ||= Date.now();",
    "remove instant flag capture"
  );
  patch(
    "function handleInteract(p) {",
    "const FLAG_CAPTURE_HOLD_MS = 5000;\n\nfunction processFlagCapture(p, input) {\n  if (!p?.spawned || p.alive === false || state.phase !== \"playing\") {\n    if (p) p.captureStartedAt = 0;\n    return;\n  }\n  const action = interaction(p);\n  if (!input.interactHeld || action?.type !== \"capture\") {\n    p.captureStartedAt = 0;\n    return;\n  }\n  if (!p.captureStartedAt) p.captureStartedAt = Date.now();\n  if (Date.now() - p.captureStartedAt >= FLAG_CAPTURE_HOLD_MS) {\n    p.captureStartedAt = 0;\n    finishBattle(p.team, p.ship);\n  }\n}\n\nfunction handleInteract(p) {",
    "flag capture hold logic"
  );
  patch(
    "  processed.set(p.id, seq);\n\n  if (Number.isFinite(input.yaw)) p.yaw = normalizeAngle(input.yaw);",
    "  processed.set(p.id, seq);\n  processFlagCapture(p, input);\n\n  if (Number.isFinite(input.yaw)) p.yaw = normalizeAngle(input.yaw);",
    "process held flag capture"
  );
  patch(
    "    ui.prompt.classList.remove(\"hidden\");\n  } else {",
    "    if (action.type === \"capture\") {\n      const elapsed = p.captureStartedAt ? Math.min(FLAG_CAPTURE_HOLD_MS, Date.now() - p.captureStartedAt) : 0;\n      const remaining = Math.max(0, (FLAG_CAPTURE_HOLD_MS - elapsed) / 1000);\n      ui.prompt.textContent = elapsed > 0 ? \"Hold E · Capturing · \" + remaining.toFixed(1) + \"s\" : \"Hold E · \" + action.label;\n    }\n    ui.prompt.classList.remove(\"hidden\");\n  } else {",
    "flag capture progress prompt"
  );

  // 0.9.0: sword hits nearest enemy in a narrow forward cone.
  patch(
    "const SWORD_RANGE = 2.25;",
    "const SWORD_RANGE = 2.5;",
    "sword reach"
  );
  patch(
    "    if (facing < 0.35 || distance >= targetDistance) continue;",
    "    if (facing < 0.8660254 || distance >= targetDistance) continue;",
    "30-degree sword cone"
  );

  // 0.9.0: helm uses speed accumulation, lower steering sensitivity, and momentum.
  patch(
    "    const throttle = captain ? (input.w ? 1 : 0) + (input.s ? -0.5 : 0) : 0;",
    "    const speedControl = captain ? (input.w ? 1 : 0) - (input.s ? 1 : 0) : 0;",
    "incremental helm speed control"
  );
  patch(
    "    const desired = throttle * 6.03 * sailPower * mobility;\n    ship.speed += THREE.MathUtils.clamp(desired - ship.speed, -4.32 * dt, 2.43 * dt);",
    "    const maxForward = 6.03 * sailPower * mobility;\n    const maxReverse = -2.35 * sailPower * mobility;\n    if (captain && speedControl > 0 && ship.speed < maxForward) {\n      ship.speed = Math.min(maxForward, ship.speed + 1.72 * sailPower * mobility * dt);\n    } else if (captain && speedControl < 0 && ship.speed > maxReverse) {\n      ship.speed = Math.max(maxReverse, ship.speed - 1.95 * sailPower * mobility * dt);\n    }\n    const drag = captain ? 0.075 : 0.18;\n    if (Math.abs(ship.speed) > 0) {\n      ship.speed -= Math.sign(ship.speed) * Math.min(Math.abs(ship.speed), drag * dt);\n    }",
    "ship momentum and speed accumulation"
  );
  patch(
    "ship.heading += steer * 0.62 * mobility * dt * Math.sign(ship.speed);",
    "ship.heading += steer * 0.34 * mobility * dt * Math.sign(ship.speed);",
    "lower helm steering sensitivity"
  );
  patch(
    " · WASD to steer · E to leave helm",
    " · W/S speed · A/D steer · E to leave helm",
    "captain control hint"
  );
`;

  block += extra09;
  source = prefix + block + source.slice(end);
  source = source.replaceAll("KDJ2 0.8.0 boot failed", "KDJ2 0.9.0 boot failed");
  source = source.replaceAll("0.8.0 patch failed", "0.9.0 patch failed");

  const moduleUrl = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
  try {
    await import(moduleUrl);
  } finally {
    URL.revokeObjectURL(moduleUrl);
  }
}

boot().catch(showBootError);
