export function patchGameSource(source) {
  const search = "    if (facing < 0.8660254 || distance >= targetDistance) continue;";
  const replacement = "    if (facing < 0.7071067811865476 || distance >= targetDistance) continue;";

  if (!source.includes(search)) {
    throw new Error("0.18.9 patch failed: current sword facing threshold marker");
  }

  return source.replace(search, replacement);
}
