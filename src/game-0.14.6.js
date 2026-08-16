// 0.14.6 emergency rollback.
// Run the exact released 0.12.1 gameplay/render/input/camera build unchanged.
try {
  await import("./game-0.12.1.js?v=0.12.1");
} catch (error) {
  console.error("KDJ2 0.14.6 boot failed", error);
  const status = document.querySelector("#lobbyStatus");
  if (status) {
    status.textContent = `Game failed to load: ${error?.message || error}`;
    status.classList.add("error");
  }
}
