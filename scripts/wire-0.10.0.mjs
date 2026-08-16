import { readFile, writeFile } from "node:fs/promises";

let html = await readFile("index.html", "utf8");
html = html.replaceAll("?v=0.9.3", "?v=0.10.0");
html = html.replace('<span class="version">0.9.3</span>', '<span class="version">0.10.0</span>');
html = html.replace('src="src/game-0.9.3.js?v=0.10.0"', 'src="src/game-0.10.0.js?v=0.10.0"');
await writeFile("index.html", html, "utf8");

await writeFile("version.js", 'window.KDJ_VERSION = "0.10.0";\n', "utf8");

let readme = await readFile("README.md", "utf8");
readme = readme.replace("**Version 0.9.3**", "**Version 0.10.0**");
const marker = "A browser-based 3D multiplayer naval game by Newhouse.\n";
const notes = `\n## 0.10.0 immersion and ship-detail pass\n\n- Helm occupation now places the sailor behind the wheel with physical spacing instead of clipping the character into the helm.\n- A captain's body remains aligned with the helm/ship while camera look stays free, so the player can look around without rotating the entire sailor model.\n- Ships receive a substantial procedural detail pass: helm pedestal, bowsprit and standing rigging, crow's nest, hull fittings, metal rings, mooring cleats, rope coils, stern trim, lanterns, and deck grating.\n- Ocean, sky, and cloud shells follow the camera horizontally so normal sailing can no longer expose a black rendering void at the technical edge of the scene.\n- The project now includes DESIGN_DIRECTION.md as the visual north star for future work: grounded proportions, layered construction, believable materials, atmospheric depth, cinematic motion, and strong browser/mobile performance.\n- All 0.9.3 gameplay systems are retained.\n`;
if (!readme.includes("## 0.10.0 immersion and ship-detail pass")) readme = readme.replace(marker, marker + notes);
await writeFile("README.md", readme, "utf8");
