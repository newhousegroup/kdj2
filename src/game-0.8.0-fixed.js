const sourceUrl = new URL("./game-0.8.0.js?v=0.8.0", import.meta.url).href;
const game070Url = new URL("./game-0.7.0.js?v=0.7.0", import.meta.url).href;
const base050Url = new URL("./game-0.5.js?v=0.5.0", import.meta.url).href;

function showBootError(error) {
  console.error("KDJ2 0.8.0 corrected boot failed", error);
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
  const block = source.slice(start, end).replaceAll('\\\\n', '\\n');
  source = prefix + block + source.slice(end);

  const moduleUrl = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
  try {
    await import(moduleUrl);
  } finally {
    URL.revokeObjectURL(moduleUrl);
  }
}

boot().catch(showBootError);
