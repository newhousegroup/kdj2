export function patchGameSource(source) {
  const captureSearch = "const FLAG_CAPTURE_HOLD_MS = 5000;";
  const swordSearch = "const SWORD_DAMAGE = 25;";

  if (!source.includes(captureSearch)) {
    throw new Error("0.17.0 patch failed: flag capture duration marker");
  }
  if (!source.includes(swordSearch)) {
    throw new Error("0.17.0 patch failed: sword damage marker");
  }

  return source
    .replace(captureSearch, "const FLAG_CAPTURE_HOLD_MS = 10000;")
    .replace(swordSearch, "const SWORD_DAMAGE = 50;");
}
