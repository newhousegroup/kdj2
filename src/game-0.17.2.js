// 0.17.2 is a UI-shell-only release. Keep the complete 0.17.1 gameplay,
// networking, render, input, camera, and performance path unchanged.
try {
  await import("./game-0.17.1.js?v=0.17.1");
} catch (error) {
  console.error("KDJ2 0.17.2 boot failed", error);
  const status = document.querySelector("#lobbyStatus");
  if (status) {
    status.textContent = `Game failed to load: ${error?.message || error}`;
    status.classList.add("error");
  }
}
