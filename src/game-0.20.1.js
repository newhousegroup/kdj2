// 0.20.1 keeps the stable 0.19.9 gameplay build. The single-player beta shim is
// loaded by index.html; these controllers replace its think-loop with corrected
// bow-heading, physical rigging, and final helm-input behavior before gameplay boots.
try {
  await import("./singleplayer-0.20.1-controller.js?v=0.20.1");
  await import("./singleplayer-0.20.1-inputfix.js?v=0.20.1");
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
