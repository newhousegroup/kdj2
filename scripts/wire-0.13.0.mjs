import { readFile, writeFile } from "node:fs/promises";

let html = await readFile("index.html", "utf8");
html = html.replaceAll("0.12.1", "0.13.0");
if (!html.includes('features-0.13.0.css')) {
  html = html.replace(
    '<link rel="stylesheet" href="polish-0.12.1.css?v=0.13.0">',
    '<link rel="stylesheet" href="polish-0.12.1.css?v=0.13.0">\n  <link rel="stylesheet" href="features-0.13.0.css?v=0.13.0">'
  );
}
if (!html.includes('id="membersBtn"')) {
  html = html.replace(
    '<span id="peopleCount">1 / 6</span>',
    '<span id="peopleCount">1 / 6</span>\n          <button id="membersBtn" class="hud-button" type="button" aria-controls="membersPanel">Players 1</button>'
  );
}
if (!html.includes('id="membersPanel"')) {
  html = html.replace(
    '      </header>\n\n      <div id="captainCompass"',
    '      </header>\n\n      <div id="membersPanel" class="members-panel hidden" aria-label="Online players">\n        <div class="members-heading"><span>Online players</span><span>Live</span></div>\n        <div id="membersList" class="members-list"></div>\n      </div>\n\n      <div id="captainCompass"'
  );
}
await writeFile("index.html", html, "utf8");
await writeFile("version.js", 'window.KDJ_VERSION = "0.13.0";\n', "utf8");

let readme = await readFile("README.md", "utf8");
readme = readme.replace("**Version 0.12.1**", "**Version 0.13.0**");
const marker = "A browser-based 3D multiplayer naval game by Newhouse.\n";
const notes = `\n## 0.13.0 battle HUD, online players and grappling risk\n\n- The normal **Battle N · take opponent flag to win** objective is now a five-second round-intro banner. It fades away during ordinary play and reappears automatically at the beginning of every new battle; contextual captain, sailmaster, gunner, enemy-ship, capture and overboard guidance remains available when relevant.\n- The British/French badge in the top HUD is refreshed from the authoritative local-player state every render, fixing hosts/clients that could retain the placeholder team label.\n- The local ship information panel has moved to the upper-right status stack directly below HP and speed.\n- A **Players** button opens a live online-members panel showing every connected sailor, team color, current ship/deck or station, overboard state, and whether they are out for the battle.\n- Normal ship-to-ship grappling has a host-authoritative **20% failure chance**. A failure drops the sailor into a world-space water state rather than teleporting them across.\n- While overboard, normal walking, deck interactions and sword attacks are disabled. Press **G** to grapple back aboard: attempts have a **40% success chance** with a **1.0 second cooldown** between tries. A successful recovery pulls the sailor onto the nearest ship.\n- All 0.12.1 visual/detail work, national flags, premium sun, island collision, combat, sailing and multiplayer behavior are retained.\n`;
if (!readme.includes("## 0.13.0 battle HUD, online players and grappling risk")) readme = readme.replace(marker, marker + notes);
await writeFile("README.md", readme, "utf8");
