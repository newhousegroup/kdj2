const previousUrl = new URL("./game-0.9.1.js?v=0.9.1", import.meta.url);
const source070Url = new URL("./game-0.7.0.js?v=0.7.0", import.meta.url).href;
const base050Url = new URL("./game-0.5.js?v=0.5.0", import.meta.url).href;

function showBootError(error) {
  console.error("KDJ2 0.9.2 boot failed", error);
  const status = document.querySelector("#lobbyStatus");
  if (status) {
    status.textContent = `Game failed to load: ${error?.message || error}`;
    status.classList.add("error");
  }
}

async function boot() {
  const response = await fetch(previousUrl, { cache: "no-store" });
  if (!response.ok) throw new Error(`Could not load KDj2 0.9.1 source (${response.status})`);
  let source = await response.text();

  const source070Line = 'const source070Url = new URL("./game-0.7.0.js?v=0.7.0", import.meta.url);';
  const base050Line = 'const base050Url = new URL("./game-0.5.js?v=0.5.0", import.meta.url).href;';
  if (!source.includes(source070Line)) throw new Error("0.9.2 repair failed: 0.7.0 URL marker missing");
  if (!source.includes(base050Line)) throw new Error("0.9.2 repair failed: 0.5.0 URL marker missing");
  source = source.replace(source070Line, `const source070Url = new URL(${JSON.stringify(source070Url)});`);
  source = source.replace(base050Line, `const base050Url = ${JSON.stringify(base050Url)};`);

  // 0.9.1 accidentally placed raw backticks inside its String.raw patch bundle.
  // The captain hint is cosmetic, so remove that broken source patch entirely.
  // The actual captain hint already says W/S speed and A/D steer in index/help UI.
  const brokenCaptainHintPatch = /\n  patch\(\n    'if \(p\.role === "captain"\) ui\.objective\.textContent = `Captain of \$\{TEAM\[p\.ship\]\.ship\} · WASD to steer · E to leave helm`;',\n    'if \(p\.role === "captain"\) ui\.objective\.textContent = `Captain of \$\{TEAM\[p\.ship\]\.ship\} · W\/S speed · A\/D steer · E to leave helm`;',\n    "captain controls hint"\n  \);\n/;
  if (!brokenCaptainHintPatch.test(source)) throw new Error("0.9.2 repair failed: broken captain-hint patch not found");
  source = source.replace(brokenCaptainHintPatch, "\n");

  source = source.replaceAll("KDJ2 0.9.1 boot failed", "KDJ2 0.9.2 boot failed");
  source = source.replaceAll("0.9.1 patch failed", "0.9.2 patch failed");

  const moduleUrl = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
  try {
    await import(moduleUrl);
  } finally {
    URL.revokeObjectURL(moduleUrl);
  }
}

boot().catch(showBootError);
