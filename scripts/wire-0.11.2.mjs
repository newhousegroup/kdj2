import { readFile, writeFile } from "node:fs/promises";

let html = await readFile("index.html", "utf8");
html = html.replaceAll("0.11.1", "0.11.2");
await writeFile("index.html", html, "utf8");

await writeFile("version.js", 'window.KDJ_VERSION = "0.11.2";\n', "utf8");

let readme = await readFile("README.md", "utf8");
readme = readme.replace("**Version 0.11.1**", "**Version 0.11.2**");
const marker = "A browser-based 3D multiplayer naval game by Newhouse.\n";
const notes = `\n## 0.11.2 island collision and helm consistency\n\n- The single reference island is now a host-authoritative physical obstacle for ships.\n- Island collision uses the ship's oriented hull footprint against the island shoreline instead of a crude oversized centre-point radius.\n- A ship that reaches the island is stopped at the shoreline and cannot sail through the terrain.\n- Helm left/right no longer reverses when ship speed becomes negative. Joystick-left and A always command the same bow-turn direction; joystick-right and D always command the opposite direction, regardless of forward/reverse momentum.\n- Reefed sail power remains 50%, and all 0.11.1 navigation-coordinate corrections are retained.\n`;
if (!readme.includes("## 0.11.2 island collision and helm consistency")) readme = readme.replace(marker, marker + notes);
await writeFile("README.md", readme, "utf8");
