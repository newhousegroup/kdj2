const previousUrl = new URL("./game-0.6.0.js?v=0.6.0", import.meta.url);
const patch052Url = new URL("./game-0.5.2.js?v=0.5.2", import.meta.url).href;
const base050Url = new URL("./game-0.5.js?v=0.5.0", import.meta.url).href;

const response = await fetch(previousUrl, { cache: "no-store" });
if (!response.ok) throw new Error(`Could not load KDj2 0.6.0 source (${response.status}).`);

let source = await response.text();

function replaceRequired(pattern, replacement, label) {
  const next = source.replace(pattern, replacement);
  if (next === source) throw new Error(`KDJ 0.6.1 repair failed: ${label}`);
  source = next;
}

// 0.6.0 is executed from a Blob below, so its relative source URLs must first
// be converted to the real repository URLs.
replaceRequired(
  'const patchUrl = new URL("./game-0.5.2.js?v=0.5.2", import.meta.url);',
  `const patchUrl = new URL(${JSON.stringify(patch052Url)});`,
  "0.5.2 source URL"
);
replaceRequired(
  'const baseGameUrl = new URL("./game-0.5.js?v=0.5.0", import.meta.url).href;',
  `const baseGameUrl = ${JSON.stringify(base050Url)};`,
  "0.5.0 source URL"
);

// 0.6.0 generated a second layer of JavaScript for HUD/compass patches.
// Its newline escapes were one layer too deep, so the generated patch looked
// for literal "\\n" text instead of real line breaks and threw during startup.
const blockStart = source.indexOf("const extraPatches = String.raw`");
const blockEnd = source.indexOf("`;\n\npatchOnce(", blockStart);
if (blockStart < 0 || blockEnd < 0) {
  throw new Error("KDJ 0.6.1 repair failed: could not locate 0.6.0 generated patch block");
}

const prefix = source.slice(0, blockStart);
let patchBlock = source.slice(blockStart, blockEnd);
const suffix = source.slice(blockEnd);

const doubledNewlineEscape = "\\\\n";
const singleNewlineEscape = "\\n";
const beforeCount = patchBlock.split(doubledNewlineEscape).length - 1;
if (beforeCount < 1) {
  throw new Error("KDJ 0.6.1 repair failed: expected nested newline escapes");
}
patchBlock = patchBlock.replaceAll(doubledNewlineEscape, singleNewlineEscape);
source = prefix + patchBlock + suffix;
source = source.replaceAll("KDJ 0.6.0 patch failed", "KDJ 0.6.1 patch failed");

const moduleUrl = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
try {
  await import(moduleUrl);
} finally {
  URL.revokeObjectURL(moduleUrl);
}
