import { readFile, writeFile } from "node:fs/promises";

let html = await readFile("index.html", "utf8");
html = html.replaceAll("0.11.0", "0.11.1");
await writeFile("index.html", html, "utf8");

await writeFile("version.js", 'window.KDJ_VERSION = "0.11.1";\n', "utf8");

let readme = await readFile("README.md", "utf8");
readme = readme.replace("**Version 0.11.0**", "**Version 0.11.1**");
const marker = "A browser-based 3D multiplayer naval game by Newhouse.\n";
const notes = `\n## 0.11.1 navigation correction\n\n- Corrected the ship coordinate convention so positive speed now travels toward the physical bow and the captain's forward view, rather than opposite the visible ship direction.\n- Corrected helm turn input so **A turns left/port** and **D turns right/starboard** while moving forward; reverse steering remains naturally reversed.\n- Starting headings were rotated 180 degrees so the two ships still begin facing each other after the forward-direction correction.\n- The captain compass now reports the physical bow heading, keeping compass marks and the enemy-bearing indicator aligned with actual travel.\n- Reefed sails now use an explicit **50% propulsion factor**, so an undamaged Reefed ship tops out at half Full-sail speed instead of behaving like a stopped state.\n- All 0.11.0 world, island, sun, lower-deck, combat, cannon, and multiplayer features are retained.\n`;
if (!readme.includes("## 0.11.1 navigation correction")) readme = readme.replace(marker, marker + notes);
await writeFile("README.md", readme, "utf8");
