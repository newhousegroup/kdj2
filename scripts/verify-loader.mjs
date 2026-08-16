import { readFile, writeFile, unlink } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = resolve(root, "src");
const launcherArg = process.argv[2] || null;
const patchArg = process.argv[3] || null;

async function resolveActiveLauncher() {
  if (launcherArg) return resolve(root, launcherArg);
  const html = await readFile(resolve(root, "index.html"), "utf8");
  const matches = [...html.matchAll(/<script[^>]+type=["']module["'][^>]+src=["']([^"']+)["']/g)];
  if (!matches.length) throw new Error("No module launcher found in index.html");
  return resolve(root, matches.at(-1)[1].split("?")[0]);
}

function isGeneratedLoader(source) {
  return source.includes('URL.createObjectURL(new Blob([source], { type: "text/javascript" }))');
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

async function runCapture(source, stageName) {
  const transformed = captureInsteadOfImport(source, stageName);
  const tempPath = resolve(srcDir, `.verify-${stageName}-${Date.now()}-${Math.random().toString(36).slice(2)}.mjs`);
  await writeFile(tempPath, transformed, "utf8");
  globalThis.__KDJ_CAPTURED_SOURCE = undefined;
  try {
    await import(pathToFileURL(tempPath).href + `?verify=${Date.now()}-${Math.random()}`);
  } finally {
    await unlink(tempPath).catch(() => {});
  }
  if (typeof globalThis.__KDJ_CAPTURED_SOURCE !== "string") throw new Error(`${stageName}: launcher did not produce generated source`);
  return globalThis.__KDJ_CAPTURED_SOURCE;
}

const launcherPath = await resolveActiveLauncher();
let source = await readFile(launcherPath, "utf8");
console.log(`Verifying launcher: ${launcherPath.slice(root.length + 1)}`);

let depth = 0;
while (isGeneratedLoader(source)) {
  depth += 1;
  if (depth > 6) throw new Error("Generated loader nesting exceeded six stages");
  source = await runCapture(source, `stage-${depth}`);
  console.log(`Materialized loader stage ${depth} (${source.length} bytes)`);
}

if (depth === 0) throw new Error("Launcher did not contain a generated loader");

let finalSource = source;
if (patchArg) {
  const patchPath = resolve(root, patchArg);
  const patchModule = await import(pathToFileURL(patchPath).href + `?verify=${Date.now()}`);
  if (typeof patchModule.patchGameSource !== "function") throw new Error(`${patchArg} does not export patchGameSource()`);
  finalSource = patchModule.patchGameSource(finalSource);
  console.log(`Applied final source patch: ${patchArg} (${finalSource.length} bytes)`);
}

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

console.log(`Generated game syntax OK (${finalSource.length} bytes, ${depth} loader stages${patchArg ? ", patched" : ""}).`);
