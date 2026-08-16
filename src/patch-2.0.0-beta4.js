export function patchGameSource(source) {
  const search = `  target.health = Math.max(0, (target.health ?? 100) - SWORD_DAMAGE);\n  if (target.health <= 0) knockOutPlayer(target, p);`;
  const replacement = `  target.health = Math.max(0, (target.health ?? 100) - SWORD_DAMAGE);\n  // A successful sword hit against an active flag capturer adds 1 second\n  // to that player's current capture requirement. Shifting captureStartedAt\n  // forward preserves the existing hold/reset behavior and allows penalties\n  // to stack naturally across repeated hits.\n  if (target.captureStartedAt) target.captureStartedAt += 1000;\n  if (target.health <= 0) knockOutPlayer(target, p);`;

  if (!source.includes(search)) {
    throw new Error("2.0.0-beta4 patch failed: sword-hit flag delay marker");
  }

  return source.replace(search, replacement);
}
