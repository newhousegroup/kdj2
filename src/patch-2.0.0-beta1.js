export function patchGameSource(source) {
  const minSearch = "const CANNON_DAMAGE_MIN = 4;";
  const maxSearch = "const CANNON_DAMAGE_MAX = 9;";

  if (!source.includes(minSearch)) {
    throw new Error("2.0.0-beta1 patch failed: cannon minimum damage marker");
  }
  if (!source.includes(maxSearch)) {
    throw new Error("2.0.0-beta1 patch failed: cannon maximum damage marker");
  }

  return source
    .replace(minSearch, "const CANNON_DAMAGE_MIN = 12;")
    .replace(maxSearch, "const CANNON_DAMAGE_MAX = 20;");
}
