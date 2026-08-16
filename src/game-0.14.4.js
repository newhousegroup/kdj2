// 0.14.4 is intentionally layout-only.
// Keep the exact stable 0.14.3 / 0.12.1 gameplay, render, input, and camera path.
try {
  await import("./game-0.14.3.js?v=0.14.3");
} catch (error) {
  console.error("KDJ2 0.14.4 boot failed", error);
  const status = document.querySelector("#lobbyStatus");
  if (status) {
    status.textContent = `Game failed to load: ${error?.message || error}`;
    status.classList.add("error");
  }
}
