export function patchGameSource(source) {
  // Normalize the generated game's own boot error copy. This is deliberately
  // non-fatal: presentation patches should never brick the loader over wording.
  source = source.replace(/KDJ2\s+[^"\n]+\s+boot failed/g, "KdJ2 boot failed");
  source = source.replace(
    'status.textContent = `Game failed to load: ${error?.message || error}`;',
    'status.textContent = "KdJ2 boot failed";'
  );

  // Returning from gameplay already restores lobbyHome and hides joinPanel. The
  // bot panel was never hidden, which could leave both the main menu and difficulty
  // selector visible at once. Add the missing reset beside the existing join reset.
  if (!source.includes('document.querySelector("#botPanel")?.classList.add("hidden");')) {
    const returnMenuPattern = /(\s+ui\.joinPanel\.classList\.add\("hidden"\);\n)(\s+joinCode = \[\];)/;
    if (returnMenuPattern.test(source)) {
      source = source.replace(
        returnMenuPattern,
        '$1  document.querySelector("#botPanel")?.classList.add("hidden");\n$2'
      );
    }
  }

  return source;
}
