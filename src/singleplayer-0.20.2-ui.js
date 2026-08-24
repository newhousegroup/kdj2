(() => {
  const DIFFICULTY = "medium";

  function closeMenu() {
    const overlay = document.querySelector("#botSetupOverlay");
    if (!overlay) return;
    overlay.classList.add("hidden");
    overlay.setAttribute("aria-hidden", "true");
  }

  function openMenu() {
    const overlay = document.querySelector("#botSetupOverlay");
    if (!overlay) return;
    overlay.classList.remove("hidden");
    overlay.setAttribute("aria-hidden", "false");
    document.querySelector("#botStartBtn")?.focus();
  }

  function buildMenu() {
    if (document.querySelector("#botSetupOverlay")) return;

    const overlay = document.createElement("section");
    overlay.id = "botSetupOverlay";
    overlay.className = "bot-setup-overlay hidden";
    overlay.setAttribute("aria-hidden", "true");
    overlay.innerHTML = `
      <div class="bot-setup-card" role="dialog" aria-modal="true" aria-labelledby="botSetupTitle">
        <div class="bot-setup-heading">
          <div>
            <p class="bot-setup-eyebrow">Single player</p>
            <h2 id="botSetupTitle">Play vs bot</h2>
          </div>
          <button id="botSetupClose" class="bot-setup-close" type="button" aria-label="Close">×</button>
        </div>
        <div class="bot-setup-section">
          <span class="bot-setup-label">Difficulty</span>
          <button class="difficulty-option selected" type="button" data-difficulty="medium" aria-pressed="true">
            <span class="difficulty-name">Medium</span>
            <span class="difficulty-description">Balanced sailing, cannon combat, boarding and sword fighting.</span>
          </button>
        </div>
        <div class="bot-setup-actions">
          <button id="botSetupCancel" class="secondary" type="button">Cancel</button>
          <button id="botStartBtn" class="primary" type="button">Start battle</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    document.querySelector("#botSetupClose")?.addEventListener("click", closeMenu);
    document.querySelector("#botSetupCancel")?.addEventListener("click", closeMenu);
    overlay.addEventListener("pointerdown", (event) => {
      if (event.target === overlay) closeMenu();
    });

    document.querySelector("#botStartBtn")?.addEventListener("click", () => {
      window.__KDJ_BOT_DIFFICULTY__ = DIFFICULTY;
      window.__KDJ_SINGLEPLAYER_NEXT__ = true;
      closeMenu();
      document.querySelector("#createRoomBtn")?.click();
    });
  }

  function wire() {
    buildMenu();
    document.querySelector("#singlePlayerSetupBtn")?.addEventListener("click", openMenu);
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !document.querySelector("#botSetupOverlay")?.classList.contains("hidden")) closeMenu();
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", wire, { once: true });
  else wire();
})();
