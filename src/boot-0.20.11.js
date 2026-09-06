(() => {
  if (window.__KDJ_02011_BOOT__) return;
  window.__KDJ_02011_BOOT__ = true;

  const weights = new Map();
  const completed = new Set();
  const resourceTasks = new Map();

  function addTask(name, weight = 1) {
    weights.set(name, weight);
  }

  // Page/bootstrap work. These are intentionally lighter than the nested game
  // build, because the latter is where most real startup time is spent.
  addTask("bootstrap", 2);
  for (const name of [
    "css-styles", "css-hud", "css-combat", "css-polish", "css-loading",
    "css-typography", "css-singleplayer-base", "css-singleplayer-menu"
  ]) addTask(name, 0.75);
  addTask("fonts", 2);
  addTask("script-peerjs", 2);
  addTask("script-version", 0.75);
  addTask("script-network", 1.5);
  addTask("script-network-patch", 1.25);
  addTask("script-singleplayer", 1.25);
  addTask("script-status", 0.75);
  addTask("script-easy", 1.25);
  addTask("script-ui", 1);
  addTask("game-entry", 1.5);

  const staticResources = [
    ["/styles.css", "css-styles"],
    ["/hud-0.6.css", "css-hud"],
    ["/combat-0.9.1.css", "css-combat"],
    ["/polish-0.12.1.css", "css-polish"],
    ["/loading-0.17.6.css", "css-loading"],
    ["/typography-0.18.6.css", "css-typography"],
    ["/singleplayer-0.20.0-beta.css", "css-singleplayer-base"],
    ["/singleplayer-0.20.4.css", "css-singleplayer-menu"],
    ["/peerjs.min.js", "script-peerjs"],
    ["/version.js", "script-version"],
    ["/src/network.js", "script-network"],
    ["/src/network-0.19.9.js", "script-network-patch"],
    ["/src/singleplayer-0.20.1.js", "script-singleplayer"],
    ["/src/singleplayer-0.20.3-status.js", "script-status"],
    ["/src/singleplayer-0.20.9-easy.js", "script-easy"],
    ["/src/singleplayer-0.20.9-ui.js", "script-ui"],
    ["/src/game-0.20.11.js", "game-entry"]
  ];

  for (const [suffix, task] of staticResources) resourceTasks.set(suffix, task);

  // The previous 0.20.10 meter treated all of this as one "game module". Each
  // resource below is an actual dependency in the active source-materialization
  // chain. Giving each a small weight lets the final percentage reflect real
  // progress through that chain rather than sitting at 90/95%.
  const gameResources = [
    "game-0.20.9.js", "patch-0.20.9.js",
    "game-0.20.6.js", "patch-0.20.6.js",
    "game-0.20.5.js", "game-0.20.4.js", "game-0.20.3.js",
    "game-0.20.2.js", "patch-0.20.2.js",
    "game-0.20.1.js", "singleplayer-0.20.1-controller.js", "singleplayer-0.20.1-inputfix.js",
    "game-0.19.9.js", "patch-0.19.9.js",
    "game-0.19.8.js",
    "patch-0.14.3.js",
    "patch-2.0.0-beta1.js", "patch-2.0.0-beta2.js", "patch-2.0.0-beta3.js", "patch-2.0.0-beta4.js",
    "patch-0.17.0.js", "patch-0.17.1.js", "patch-0.17.3.js", "patch-0.17.4.js",
    "patch-0.17.5.js", "patch-0.17.6.js",
    "patch-0.18.0.js", "patch-0.18.1.js", "patch-0.18.3.js",
    "patch-0.19.0.js", "patch-0.19.1.js", "patch-0.19.2.js", "patch-0.19.4.js",
    "patch-0.19.5.js", "patch-0.19.8.js",
    "game-0.12.1.js",
    "patch-0.10.0.js", "patch-0.11.0.js", "patch-0.11.1.js", "patch-0.11.2.js",
    "patch-0.11.3.js", "patch-0.12.0.js", "patch-0.12.1.js",
    "game-0.9.3.js", "game-0.9.2.js", "game-0.9.1.js", "game-0.7.0.js", "game-0.5.js",
    "three.module.js"
  ];

  const chainTasks = [];
  for (const filename of gameResources) {
    const task = `chain:${filename}`;
    chainTasks.push(task);
    addTask(task, 1);
    resourceTasks.set(`/${filename}`, task);
    if (!filename.startsWith("three.")) resourceTasks.set(`/src/${filename}`, task);
  }

  // These are real synchronous initialization checkpoints injected into the final
  // generated game source. They split the old 90–95% black box into observable
  // renderer/scene/world/control/loop subprocesses without changing gameplay.
  const runtimeTasks = [
    "runtime-renderer",
    "runtime-scene",
    "runtime-ships",
    "runtime-controls",
    "runtime-loop"
  ];
  addTask("generated-source", 4);
  addTask("runtime-renderer", 2);
  addTask("runtime-scene", 2);
  addTask("runtime-ships", 3);
  addTask("runtime-controls", 2);
  addTask("runtime-loop", 1);
  addTask("game-evaluated", 3);
  addTask("first-frame", 3);

  completed.add("bootstrap");

  const totalWeight = () => [...weights.values()].reduce((a, b) => a + b, 0);
  const doneWeight = () => [...completed].reduce((sum, key) => sum + (weights.get(key) || 0), 0);

  let displayedPercent = 0;
  let readyScreen = null;
  let removeRestored = false;
  const nativeRemove = Element.prototype.remove;
  const NativeBlob = globalThis.Blob;

  function rawPercent() {
    return Math.min(100, Math.round((doneWeight() / totalWeight()) * 100));
  }

  function render() {
    // Never move backwards if two resource notifications arrive out of order.
    displayedPercent = Math.max(displayedPercent, rawPercent());
    const text = document.querySelector("#loadingProgressText");
    if (text) text.textContent = `Loading... (${displayedPercent}%)`;
    const screen = document.querySelector("#loadingScreen");
    if (screen) screen.setAttribute("aria-label", `Loading game ${displayedPercent} percent`);
  }

  function finishScreenIfReady() {
    if (!readyScreen || !completed.has("game-evaluated") || !completed.has("first-frame")) return;
    // A successful evaluated module implies every dependency that mattered was
    // resolved even if a browser omitted a cached resource from ResourceTiming.
    for (const task of chainTasks) completed.add(task);
    for (const task of runtimeTasks) completed.add(task);
    completed.add("generated-source");
    for (const task of weights.keys()) {
      if (task.startsWith("css-") || task.startsWith("script-") || task === "fonts" || task === "game-entry") completed.add(task);
    }
    displayedPercent = 100;
    render();
    const screen = readyScreen;
    readyScreen = null;
    requestAnimationFrame(() => {
      if (!removeRestored) {
        Element.prototype.remove = nativeRemove;
        removeRestored = true;
      }
      nativeRemove.call(screen);
    });
  }

  function complete(task) {
    if (!weights.has(task) || completed.has(task)) return;
    completed.add(task);
    render();
    finishScreenIfReady();
  }

  function taskForUrl(value) {
    if (!value) return null;
    try {
      const pathname = new URL(value, location.href).pathname;
      let best = null;
      for (const [suffix, task] of resourceTasks) {
        if (pathname.endsWith(suffix) && (!best || suffix.length > best[0].length)) best = [suffix, task];
      }
      return best?.[1] || null;
    } catch (_) {
      return null;
    }
  }

  function scanResources(entries) {
    for (const entry of entries || []) {
      const task = taskForUrl(entry?.name);
      if (task) complete(task);
    }
  }

  scanResources(performance.getEntriesByType?.("resource") || []);
  try {
    const observer = new PerformanceObserver((list) => scanResources(list.getEntries()));
    observer.observe({ type: "resource", buffered: true });
  } catch (_) {}

  document.addEventListener("load", (event) => {
    const target = event.target;
    const task = taskForUrl(target?.src || target?.href);
    if (task) complete(task);
  }, true);

  document.addEventListener("error", (event) => {
    const target = event.target;
    const task = taskForUrl(target?.src || target?.href);
    if (task) complete(task);
  }, true);

  if (document.fonts?.ready) document.fonts.ready.then(() => complete("fonts"), () => complete("fonts"));
  else complete("fonts");

  function injectAfter(source, marker, task) {
    if (!source.includes(marker)) return source;
    return source.replace(marker, `${marker}\nwindow.KDJLoadingProgress?.complete(${JSON.stringify(task)});`);
  }

  // Every historical Blob patcher ultimately calls through this base class. At
  // that point the source has already received all gameplay patches, so we can add
  // non-fatal progress checkpoints to the final program without participating in
  // the fragile historical patch-matching chain.
  class KDJProgressBlob extends NativeBlob {
    constructor(parts = [], options = {}) {
      let nextParts = parts;
      const isGameSource =
        options?.type === "text/javascript" &&
        parts.length === 1 &&
        typeof parts[0] === "string" &&
        parts[0].includes("function simulateShips(dt)") &&
        parts[0].includes("function processPlayer(p, input, dt)");

      if (isGameSource) {
        let source = parts[0];
        source = injectAfter(
          source,
          'const renderer = new THREE.WebGLRenderer({ canvas: $("#gameCanvas"), antialias: true, powerPreference: "high-performance" });',
          "runtime-renderer"
        );
        source = injectAfter(source, "scene.add(ocean);", "runtime-scene");
        source = injectAfter(source, 'shipMeshes.french = makeShip("french");', "runtime-ships");
        source = injectAfter(source, 'ui.leave.onclick = () => returnToMenu("You left the room.");', "runtime-controls");

        const tailMarker = "\nrequestAnimationFrame(frame);";
        const tailIndex = source.lastIndexOf(tailMarker);
        if (tailIndex >= 0) {
          source = `${source.slice(0, tailIndex)}\nwindow.KDJLoadingProgress?.complete("runtime-loop");${source.slice(tailIndex)}`;
        }
        nextParts = [source];
      }

      super(nextParts, options);
      if (isGameSource) complete("generated-source");
    }
  }
  globalThis.Blob = KDJProgressBlob;

  // 0.17.6 removes the loader after the first rendered frame. Hold that removal
  // until the 0.20.11 module has also confirmed evaluation completed.
  Element.prototype.remove = function remove02011() {
    if (this?.id === "loadingScreen" && this.dataset?.ready === "true") {
      readyScreen = this;
      complete("first-frame");
      finishScreenIfReady();
      return;
    }
    return nativeRemove.call(this);
  };

  window.KDJLoadingProgress = Object.freeze({
    complete,
    render,
    percent: () => displayedPercent,
    finishGameEvaluation() {
      // Import success is the strongest signal that all required source/resource
      // work really finished. Fill only browser-hidden timing gaps at this point.
      for (const task of chainTasks) completed.add(task);
      for (const task of runtimeTasks) completed.add(task);
      completed.add("generated-source");
      complete("game-evaluated");
    }
  });

  // Preserve the KdJ boot-error spelling from 0.20.9.
  const nativeConsoleError = console.error.bind(console);
  console.error = (...args) => {
    if (typeof args[0] === "string" && /^(?:KDJ2|KdJ2)(?:\s+[^\s]+)?\s+boot failed$/i.test(args[0].trim())) args[0] = "KdJ2 boot failed";
    nativeConsoleError(...args);
  };

  function normalizeLobbyBootError() {
    const status = document.querySelector("#lobbyStatus");
    if (!status) return;
    const text = String(status.textContent || "").trim();
    if (/^Game failed to load:/i.test(text) || /^(?:KDJ2|KdJ2).*boot failed/i.test(text)) status.textContent = "KdJ2 boot failed";
  }

  const status = document.querySelector("#lobbyStatus");
  if (status) {
    normalizeLobbyBootError();
    new MutationObserver(normalizeLobbyBootError).observe(status, {
      childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ["class"]
    });
  }

  render();
})();
