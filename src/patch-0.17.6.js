export function patchGameSource(source) {
  const search = "  renderer.render(scene, camera);";
  const replacement = `  renderer.render(scene, camera);\n  const loadingScreen = document.querySelector("#loadingScreen");\n  if (loadingScreen && loadingScreen.dataset.ready !== "true") {\n    loadingScreen.dataset.ready = "true";\n    loadingScreen.remove();\n  }`;

  if (!source.includes(search)) {
    throw new Error("0.17.6 patch failed: first rendered frame marker");
  }

  return source.replace(search, replacement);
}
