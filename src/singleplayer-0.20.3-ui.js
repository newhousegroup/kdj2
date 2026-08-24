(() => {
  const DIFFICULTY = "medium";

  function showHome() {
    document.querySelector("#botPanel")?.classList.add("hidden");
    document.querySelector("#lobbyHome")?.classList.remove("hidden");
  }

  function showBotPanel() {
    document.querySelector("#lobbyHome")?.classList.add("hidden");
    document.querySelector("#joinPanel")?.classList.add("hidden");
    document.querySelector("#botPanel")?.classList.remove("hidden");
    document.querySelector("#botStartBtn")?.focus();
  }

  function startBotBattle() {
    window.__KDJ_BOT_DIFFICULTY__ = DIFFICULTY;
    window.__KDJ_SINGLEPLAYER_NEXT__ = true;
    document.querySelector("#createRoomBtn")?.click();
  }

  function wire() {
    document.querySelector("#singlePlayerSetupBtn")?.addEventListener("click", showBotPanel);
    document.querySelector("#botBackBtn")?.addEventListener("click", showHome);
    document.querySelector("#botStartBtn")?.addEventListener("click", startBotBattle);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", wire, { once: true });
  else wire();
})();
