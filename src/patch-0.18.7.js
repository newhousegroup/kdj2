export function patchGameSource(source) {
  const search = "    if (facing < 0.35 || distance >= targetDistance) continue;";
  const replacement = "    if (facing < Math.SQRT1_2 || distance >= targetDistance) continue;";

  if (!source.includes(search)) {
    throw new Error("0.18.7 patch failed: sword hit-cone marker");
  }

  return source.replace(search, replacement);
}
