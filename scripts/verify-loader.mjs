import { readFile, writeFile, unlink } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

async function resolveActiveLauncher() {
  if (process.argv[2]) return resolve(root, process.argv[2]);
  const html = await readFile(resolve(root, "index.html"), "utf8");
  const matches = [...html.matchAll(/<script[^>]+type=["']module["'][^>]+src=["']([^"']+)["']/g)];
  if (!matches.length) throw new Error("No module launcher found in index.html");
  const src = matches.at(-1)[1].split("?")[0];
  return resolve(root, src);
}

function captureInsteadOfImport(source, label) {
  const block = /  const moduleUrl = URL\.createObjectURL\(new Blob\(\[source\], \{ type: "text\/javascript" \}\)\);\n  try \{\n    await import\(moduleUrl\);\n  \} finally \{\n    URL\.revokeObjectURL\(moduleUrl\);\n  \}/;
  if (!block.test(source)) throw new Error(`${label}: could not find generated-module import block`);
  source = source.replace(block, "  globalThis.__KDJ_CAPTURED_SOURCE = source;");
  const boot = /boot\(\)\.catch\(showBootError\);\s*$/;
  if (!boot.test(source)) throw new Error(`${label}: could not find boot call`);
  return source.replace(boot, "await boot();\n");
}

async function localFetch(input) {
  const url = input instanceof URL ? new URL(input.href) : new URL(String(input));
  if (url.protocol !== "file:") throw new Error(`Verifier only permits local file fetches, got ${url.href}`);
  url.search = "";
  url.hash = "";
  try {
    const body = await readFile(fileURLToPath(url), "utf8");
    return { ok: true, status: 200, text: async () => body };
  } catch (error) {
    return { ok: false, status: error?.code === "ENOENT" ? 404 : 500, text: async () => "" };
  }
}

globalThis.fetch = localFetch;
globalThis.document = { querySelector: () => null };

async function runCapture(source, sourcePath, stageName) {
  const transformed = captureInsteadOfImport(source, stageName);
  const tempPath = resolve(dirname(sourcePath), `.verify-${stageName}-${Date.now()}-${Math.random().toString(36).slice(2)}.mjs`);
  await writeFile(tempPath, transformed, "utf8");
  globalThis.__KDJ_CAPTURED_SOURCE = undefined;
  try {
    await import(pathToFileURL(tempPath).href + `?verify=${Date.now()}`);
  } finally {
    await unlink(tempPath).catch(() => {});
  }
  if (typeof globalThis.__KDJ_CAPTURED_SOURCE !== "string") {
    throw new Error(`${stageName}: launcher did not produce generated source`);
  }
  return globalThis.__KDJ_CAPTURED_SOURCE;
}

const launcherPath = await resolveActiveLauncher();
const launcherSource = await readFile(launcherPath, "utf8");
console.log(`Verifying active launcher: ${launcherPath.slice(root.length + 1)}`);

// Current KDJs releases use a two-stage loader: release launcher -> cannon launcher -> full game.
const stage2Source = await runCapture(launcherSource, launcherPath, "release-launcher");
const finalSource = await runCapture(stage2Source, resolve(root, "src/game-0.7.0.js"), "cannon-launcher");

for (const required of [
  "ui.create.onclick = createBattle;",
  "ui.join.onclick = joinBattle;",
  "function simulateShips(dt)",
  "function handleCannonFire(p)"
]) {
  if (!finalSource.includes(required)) throw new Error(`Final game source missing required marker: ${required}`);
}

const finalPath = resolve(root, ".verify-generated-game.mjs");
await writeFile(finalPath, finalSource, "utf8");
try {
  const check = spawnSync(process.execPath, ["--check", finalPath], { encoding: "utf8" });
  if (check.status !== 0) {
    process.stderr.write(check.stdout || "");
    process.stderr.write(check.stderr || "");
    throw new Error(`Generated game failed node --check (exit ${check.status})`);
  }
} finally {
  await unlink(finalPath).catch(() => {});
}

console.log(`Generated game syntax OK (${finalSource.length} bytes).`);
