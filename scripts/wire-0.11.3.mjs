import { readFile, writeFile } from "node:fs/promises";

let html = await readFile("index.html", "utf8");
html = html.replaceAll("0.11.2", "0.11.3");
await writeFile("index.html", html, "utf8");

await writeFile("version.js", 'window.KDJ_VERSION = "0.11.3";\n', "utf8");

let readme = await readFile("README.md", "utf8");
readme = readme.replace("**Version 0.11.2**", "**Version 0.11.3**");
const marker = "A browser-based 3D multiplayer naval game by Newhouse.\n";
const notes = `\n## 0.11.3 forward helm correction\n\n- Corrected the remaining helm sign mismatch reported in 0.11.2.\n- While moving forward, A / joystick-left now turns the bow left and D / joystick-right turns the bow right.\n- Reverse steering keeps the 0.11.2 behavior that was confirmed correct by player testing.\n- Island collision, 50% Reefed sail power, compass direction, momentum, combat, and all other 0.11.2 systems are unchanged.\n`;
if (!readme.includes("## 0.11.3 forward helm correction")) readme = readme.replace(marker, marker + notes);
await writeFile("README.md", readme, "utf8");
