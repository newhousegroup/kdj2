try {
  await import("./game-0.20.9.js?v=0.20.9");
  window.KDJLoadingProgress?.complete("game-module");
} catch (error) {
  document.querySelector("#loadingScreen")?.remove();
  console.error("KdJ2 boot failed", error);
  const status = document.querySelector("#lobbyStatus");
  if (status) {
    status.textContent = "KdJ2 boot failed";
    status.classList.add("error");
  }
}
