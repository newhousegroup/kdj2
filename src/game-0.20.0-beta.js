// 0.20.0-beta keeps the stable 0.19.9 gameplay build and layers the local
// single-player controller before boot. The controller patches KDJNetwork so a
// bot can participate as a local host-side guest without PeerJS/WebRTC.
try {
  await import("./game-0.19.9.js?v=0.19.9");
} catch (error) {
  document.querySelector("#loadingScreen")?.remove();
  console.error("KDJ2 0.20.0-beta boot failed", error);
  const status = document.querySelector("#lobbyStatus");
  if (status) {
    status.textContent = `Game failed to load: ${error?.message || error}`;
    status.classList.add("error");
  }
}
