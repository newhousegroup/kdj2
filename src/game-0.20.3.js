// 0.20.3 keeps the 0.20.2 gameplay/state changes and updates only the
// single-player lobby/status presentation.
try {
  await import("./game-0.20.2.js?v=0.20.2");
} catch (error) {
  document.querySelector("#loadingScreen")?.remove();
  console.error("KDJ2 0.20.3 boot failed", error);
  const status = document.querySelector("#lobbyStatus");
  if (status) {
    status.textContent = `Game failed to load: ${error?.message || error}`;
    status.classList.add("error");
  }
}
