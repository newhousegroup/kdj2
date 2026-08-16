const previousUrl = new URL("./game-0.7.0.js?v=0.7.0", import.meta.url);
const base050Url = new URL("./game-0.5.js?v=0.5.0", import.meta.url).href;

function showBootError(error) {
  console.error("KDJ2 0.7.1 boot failed", error);
  const status = document.querySelector("#lobbyStatus");
  if (status) {
    status.textContent = `Game failed to load: ${error?.message || error}`;
    status.classList.add("error");
  }
}

async function boot() {
  const response = await fetch(previousUrl, { cache: "no-store" });
  if (!response.ok) throw new Error(`Could not load KDj2 0.7.0 source (${response.status})`);

  let source = await response.text();

  function replaceRequired(pattern, replacement, label) {
    const next = source.replace(pattern, () => replacement);
    if (next === source) throw new Error(`0.7.1 patch failed: ${label}`);
    source = next;
  }

  replaceRequired(
    'const BASE_URL = new URL("./game-0.5.js?v=0.5.0", import.meta.url);',
    `const BASE_URL = new URL(${JSON.stringify(base050Url)});`,
    "base game URL"
  );

  replaceRequired(
    "const CANNON_COOLDOWN_MS = 2800;",
    "const CANNON_COOLDOWN_MS = 10000;",
    "10-second cannon cooldown"
  );

  replaceRequired(
    "const CANNON_DAMAGE = 12;",
    "const CANNON_DAMAGE_MIN = 4;\nconst CANNON_DAMAGE_MAX = 9;",
    "random cannon damage constants"
  );

  replaceRequired(
    "    target.mobility = Math.max(25, target.mobility - CANNON_DAMAGE);",
    "    const damage = Math.floor(Math.random() * (CANNON_DAMAGE_MAX - CANNON_DAMAGE_MIN + 1)) + CANNON_DAMAGE_MIN;\n    target.mobility = Math.max(25, target.mobility - damage);",
    "random mobility damage"
  );

  source = source.replaceAll("KDJ2 0.7.0 boot failed", "KDJ2 0.7.1 boot failed");
  source = source.replaceAll("0.7.0 patch failed", "0.7.1 patch failed");

  const moduleUrl = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
  try {
    await import(moduleUrl);
  } finally {
    URL.revokeObjectURL(moduleUrl);
  }
}

boot().catch(showBootError);
