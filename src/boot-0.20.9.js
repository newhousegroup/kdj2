(() => {
  if (window.__KDJ_0209_BOOT_BRAND__) return;
  window.__KDJ_0209_BOOT_BRAND__ = true;

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

  function installObserver() {
    const status = document.querySelector("#lobbyStatus");
    if (!status) return;
    normalizeLobbyBootError();
    new MutationObserver(normalizeLobbyBootError).observe(status, {
      childList: true,
      characterData: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class"]
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", installObserver, { once: true });
  } else {
    installObserver();
  }
})();