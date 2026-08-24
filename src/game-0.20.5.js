// 0.20.5 keeps 0.20.4 gameplay and changes only Easy bot sail-maintenance behavior.
try {
  await import("./game-0.20.4.js?v=0.20.4");
} catch (error) {
  document.querySelector("#loadingScreen")?.remove();
  console.error("KDJ2 0.20.5 boot failed", error);
  const status = document.querySelector("#lobbyStatus");
  if (status) {
    status.textContent = `Game failed to load: ${error?.message || error}`;
    status.classList.add("error");
  }
}
