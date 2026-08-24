// 0.20.1 keeps the stable 0.19.9 gameplay build. The single-player controller
// loaded before this module supplies the revised bot steering and physical rigging
// behavior without changing multiplayer gameplay.
try {
  await import("./game-0.19.9.js?v=0.19.9");
} catch (error) {
  document.querySelector("#loadingScreen")?.remove();
  console.error("KDJ2 0.20.1 boot failed", error);
  const status = document.querySelector("#lobbyStatus");
  if (status) {
    status.textContent = `Game failed to load: ${error?.message || error}`;
    status.classList.add("error");
  }
}
