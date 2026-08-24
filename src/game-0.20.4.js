// 0.20.4 keeps the 0.20.3 gameplay/state changes and adds the Easy
// single-player behavior plus lobby difficulty selection.
try {
  await import("./game-0.20.3.js?v=0.20.3");
} catch (error) {
  document.querySelector("#loadingScreen")?.remove();
  console.error("KDJ2 0.20.4 boot failed", error);
  const status = document.querySelector("#lobbyStatus");
  if (status) {
    status.textContent = `Game failed to load: ${error?.message || error}`;
    status.classList.add("error");
  }
}
