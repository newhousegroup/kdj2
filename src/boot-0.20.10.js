(() => {
  if (window.__KDJ_02010_BOOT__) return;
  window.__KDJ_02010_BOOT__ = true;

  const TASKS = new Set([
    "bootstrap",
    "css-styles",
    "css-hud",
    "css-combat",
    "css-polish",
    "css-loading",
    "css-typography",
    "css-singleplayer-base",
    "css-singleplayer-menu",
    "fonts",
    "script-peerjs",
    "script-version",
    "script-network",
    "script-network-patch",
    "script-singleplayer",
    "script-status",
    "script-easy",
    "script-ui",
    "game-module",
    "first-frame"
  ]);

  const RESOURCE_TASKS = [
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
    ["/src/singleplayer-0.20.9-ui.js", "script-ui"]
  ];

  const completed = new Set(["bootstrap"]);
  const nativeRemove = Element.prototype.remove;
  let readyScreen = null;
  let restoredRemove = false;

  function progressPercent() {
    return Math.round((completed.size / TASKS.size) * 100);
  }

  function render() {
    const percent = progressPercent();
    const text = document.querySelector("#loadingProgressText");
    if (text) text.textContent = `Loading... (${percent}%)`;
    const screen = document.querySelector("#loadingScreen");
    if (screen) screen.setAttribute("aria-label", `Loading game ${percent} percent`);
  }

  function finishReadyScreen() {
    if (!readyScreen || completed.size !== TASKS.size) return;
    render();
    const screen = readyScreen;
    readyScreen = null;
    requestAnimationFrame(() => {
      if (!restoredRemove) {
        Element.prototype.remove = nativeRemove;
        restoredRemove = true;
      }
      nativeRemove.call(screen);
    });
  }

  function complete(task) {
    if (!TASKS.has(task) || completed.has(task)) return;
    completed.add(task);
    render();
    finishReadyScreen();
  }

  function taskForUrl(value) {
    if (!value) return null;
    try {
      const pathname = new URL(value, location.href).pathname;
      for (const [suffix, task] of RESOURCE_TASKS) {
        if (pathname.endsWith(suffix)) return task;
      }
    } catch (_) {}
    return null;
  }

  function scanResources(entries) {
    for (const entry of entries || []) {
      const task = taskForUrl(entry?.name);
      if (task) complete(task);
    }
  }

  // ResourceTiming is the fallback for cached/already-loaded resources. Load/error
  // capture below records later resources at completion as well.
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
    // The resource attempt has completed even if it failed; the normal boot/error
    // path decides whether KdJ2 can continue. This prevents a misleading frozen %.
    if (task) complete(task);
  }, true);

  if (document.fonts?.ready) {
    document.fonts.ready.then(() => complete("fonts"), () => complete("fonts"));
  } else {
    complete("fonts");
  }

  // 0.17.6 marks the loading screen ready immediately after the first successful
  // renderer frame and then calls .remove(). Intercept only that successful path.
  // Boot-error removals do not set data-ready and therefore remain immediate.
  Element.prototype.remove = function remove02010() {
    if (this?.id === "loadingScreen" && this.dataset?.ready === "true") {
      readyScreen = this;
      complete("first-frame");
      finishReadyScreen();
      return;
    }
    return nativeRemove.call(this);
  };

  window.KDJLoadingProgress = Object.freeze({
    complete,
    render,
    percent: progressPercent
  });

  // Preserve the 0.20.9 KdJ boot-error branding.
  const nativeConsoleError = console.error.bind(console);
  console.error = (...args) => {
    if (
      typeof args[0] === "string" &&
      /^(?:KDJ2|KdJ2)(?:\s+[^\s]+)?\s+boot failed$/i.test(args[0].trim())
    ) {
      args[0] = "KdJ2 boot failed";
    }
    nativeConsoleError(...args);
  };

  function normalizeLobbyBootError() {
    const status = document.querySelector("#lobbyStatus");
    if (!status) return;
    const text = String(status.textContent || "").trim();
    if (/^Game failed to load:/i.test(text) || /^(?:KDJ2|KdJ2).*boot failed/i.test(text)) {
      status.textContent = "KdJ2 boot failed";
    }
  }

  const status = document.querySelector("#lobbyStatus");
  if (status) {
    normalizeLobbyBootError();
    new MutationObserver(normalizeLobbyBootError).observe(status, {
      childList: true,
      characterData: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class"]
    });
  }

  render();
})();
