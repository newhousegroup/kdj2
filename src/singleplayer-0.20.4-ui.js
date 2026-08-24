(() => {
  let difficulty = "medium";

  function showHome() {
    document.querySelector("#botPanel")?.classList.add("hidden");
    document.querySelector("#lobbyHome")?.classList.remove("hidden");
  }

  function showBotPanel() {
    document.querySelector("#lobbyHome")?.classList.add("hidden");
    document.querySelector("#joinPanel")?.classList.add("hidden");
    document.querySelector("#botPanel")?.classList.remove("hidden");
    document.querySelector(`.difficulty-option[data-difficulty="${difficulty}"]`)?.focus();
  }

  function selectDifficulty(value) {
    if (value !== "easy" && value !== "medium") return;
    difficulty = value;
    for (const button of document.querySelectorAll("#botPanel .difficulty-option")) {
      const selected = button.dataset.difficulty === difficulty;
      button.classList.toggle("selected", selected);
      button.setAttribute("aria-pressed", selected ? "true" : "false");
    }
  }

  function startBotBattle() {
    window.__KDJ_BOT_DIFFICULTY__ = difficulty;
    window.__KDJ_SINGLEPLAYER_NEXT__ = true;
    document.querySelector("#createRoomBtn")?.click();
  }

  function wire() {
    document.querySelector("#singlePlayerSetupBtn")?.addEventListener("click", showBotPanel);
    document.querySelector("#botBackBtn")?.addEventListener("click", showHome);
    document.querySelector("#botStartBtn")?.addEventListener("click", startBotBattle);
    for (const button of document.querySelectorAll("#botPanel .difficulty-option")) {
      button.addEventListener("click", () => selectDifficulty(button.dataset.difficulty));
    }
    selectDifficulty("medium");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", wire, { once: true });
  else wire();
})();
