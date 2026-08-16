export function patchGameSource(source) {
  function replaceRequired(search, replacement, label) {
    if (!source.includes(search)) throw new Error(`2.0.0-beta3 patch failed: ${label}`);
    source = source.replace(search, replacement);
  }

  replaceRequired(
    'function frame(now) {',
    `const HEALTH_REGEN_INTERVAL_MS = 800;

function regeneratePlayerHealth(nowMs) {
  for (const p of Object.values(state?.players || {})) {
    if (!p?.spawned || p.alive === false) continue;

    const health = Number(p.health);
    if (!Number.isFinite(health)) {
      p.health = 100;
      p.healthRegenAt = nowMs;
      continue;
    }

    if (health >= 100) {
      p.health = 100;
      p.healthRegenAt = nowMs;
      continue;
    }

    if (!Number.isFinite(p.healthRegenAt)) {
      p.healthRegenAt = nowMs;
      continue;
    }

    const elapsed = nowMs - p.healthRegenAt;
    if (elapsed < HEALTH_REGEN_INTERVAL_MS) continue;

    const ticks = Math.floor(elapsed / HEALTH_REGEN_INTERVAL_MS);
    p.health = Math.min(100, health + ticks);
    p.healthRegenAt += ticks * HEALTH_REGEN_INTERVAL_MS;
  }
}

function frame(now) {`,
    'health regeneration helper'
  );

  replaceRequired(
    '      simulateShips(dt);',
    '      regeneratePlayerHealth(Date.now());\n      simulateShips(dt);',
    'host-authoritative health regeneration tick'
  );

  return source;
}
