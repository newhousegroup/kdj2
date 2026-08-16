# Kill das James 2

**Version 0.14.0**

A browser-based 3D multiplayer naval game by Newhouse.

## 0.14.0 emergency camera recovery

- Emergency rollback to the last known-good **0.12.1 gameplay/render chain** after the 0.13.x camera became nonfunctional in live testing.
- The entire 0.13.x **grappling fall-in-water system is removed** from the active build: no 20% boarding failure, no swimming state, no water recovery rolls, and no water-specific camera branch.
- Grappling is restored to the reliable behavior: when the ships are within grappling range, **G transfers the sailor directly to the other ship**.
- The normal first-person/third-person camera and touch/mouse look paths are restored to their pre-0.13 implementation.
- The 0.13.x online-player panel, round-objective fade, and related render-loop changes are temporarily excluded from the active build so camera reliability takes priority. They can be reintroduced individually after isolated testing.
- All 0.12.1 visual work remains: detailed uniforms and flags, island and island collision, premium sun, lower-deck detail, compass enemy bearing, integer 0–35 speed display, combat, cannons, sailing, and multiplayer.

## 0.13.1 runtime performance repair

- Fixes the 0.13.0 in-world freeze regression caused by rebuilding the complete online-player DOM roster on every render frame, including while the roster panel was closed.
- The Players button count remains live, but the detailed roster now does no DOM rebuilding while closed.
- While the Players panel is open, roster rendering is capped at four refreshes per second and only rebuilds when player/status data actually changes.
- Team-badge synchronization remains authoritative but avoids unnecessary DOM writes when the displayed team is already correct.
- The roster now tolerates transient/deploying player state safely instead of assuming every member already has a fully resolved ship/status.
- All 0.13.0 round-objective, team indicator, ship HUD, online-player, grappling/water, combat, sailing and visual features are retained.

## 0.13.0 battle HUD, online players and grappling risk

- The normal **Battle N · take opponent flag to win** objective is now a five-second round-intro banner. It fades away during ordinary play and reappears automatically at the beginning of every new battle; contextual captain, sailmaster, gunner, enemy-ship, capture and overboard guidance remains available when relevant.
- The British/French badge in the top HUD is refreshed from the authoritative local-player state every render, fixing hosts/clients that could retain the placeholder team label.
- The local ship information panel has moved to the upper-right status stack directly below HP and speed.
- A **Players** button opens a live online-members panel showing every connected sailor, team color, current ship/deck or station, overboard state, and whether they are out for the battle.
- Normal ship-to-ship grappling has a host-authoritative **20% failure chance**. A failure drops the sailor into a world-space water state rather than teleporting them across.
- While overboard, normal walking, deck interactions and sword attacks are disabled. Press **G** to grapple back aboard: attempts have a **40% success chance** with a **1.0 second cooldown** between tries. A successful recovery pulls the sailor onto the nearest ship.
- All 0.12.1 visual/detail work, national flags, premium sun, island collision, combat, sailing and multiplayer behavior are retained.

## 0.12.1 polish update

- Network setup copy now reads **Connecting...** instead of **Connecting**.
- The mobile/touch look hint was removed from the in-game HUD so it no longer overlaps gameplay on smaller screens. It now appears only on the join panel before entering a battle.
- The visible sun now has a layered premium treatment: bright core, additive corona, broad haze, radial starburst rays, and soft glare aligned with the same world-space direction as the existing sunlight.
- All 0.12.0 uniform, island, national-flag, steering, collision, combat, cannon, compass, and multiplayer behavior is retained.

## 0.12.0 details update

- Player-facing network setup copy now says **Connecting** instead of **Preparing relay** while TURN/WebRTC setup is happening.
- British sailor uniforms now read much more clearly as red-coated period uniforms: cream breeches, black boots and cuffs, horizontal front lace, brass buttons, epaulettes, coat tails, a taller black shako, pale hat band, front plate, and red/white plume.
- French sailors now use a darker naval-blue uniform treatment with dark boots, red cuffs, pale cross-belts and waist belt, brass buttons/epaulettes, a taller shako, gold band, tricolour cockade, and red plume.
- The single reference island has a denser shoreline and vegetation pass with scattered boulders, bushes, two small beach palms, driftwood, and dry-grass clumps while retaining the existing island collision boundary.
- Ship and lower-deck flag meshes now use procedurally drawn national flags: the **Union Jack** for the British crew and the **French tricolour** for the French crew, with a small billowed cloth profile instead of flat team-colour rectangles.
- All 0.11.3 steering fixes, island collision, 50% Reefed sail power, combat, cannon, compass, momentum, and multiplayer behavior are retained.

## 0.11.3 forward helm correction

- Corrected the remaining helm sign mismatch reported in 0.11.2.
- While moving forward, A / joystick-left now turns the bow left and D / joystick-right turns the bow right.
- Reverse steering keeps the 0.11.2 behavior that was confirmed correct by player testing.
- Island collision, 50% Reefed sail power, compass direction, momentum, combat, and all other 0.11.2 systems are unchanged.

## 0.11.2 island collision and helm consistency

- The single reference island is now a host-authoritative physical obstacle for ships.
- Island collision uses the ship's oriented hull footprint against the island shoreline instead of a crude oversized centre-point radius.
- A ship that reaches the island is stopped at the shoreline and cannot sail through the terrain.
- Helm left/right no longer reverses when ship speed becomes negative. Joystick-left and A always command the same bow-turn direction; joystick-right and D always command the opposite direction, regardless of forward/reverse momentum.
- Reefed sail power remains 50%, and all 0.11.1 navigation-coordinate corrections are retained.

## 0.11.1 navigation correction

- Corrected the ship coordinate convention so positive speed now travels toward the physical bow and the captain's forward view, rather than opposite the visible ship direction.
- Corrected helm turn input so **A turns left/port** and **D turns right/starboard** while moving forward; reverse steering remains naturally reversed.
- Starting headings were rotated 180 degrees so the two ships still begin facing each other after the forward-direction correction.
- The captain compass now reports the physical bow heading, keeping compass marks and the enemy-bearing indicator aligned with actual travel.
- Reefed sails now use an explicit **50% propulsion factor**, so an undamaged Reefed ship tops out at half Full-sail speed instead of behaving like a stopped state.
- All 0.11.0 world, island, sun, lower-deck, combat, cannon, and multiplayer features are retained.

## 0.11.0 navigation and world-detail pass

- The 0–35 ship-speed HUD now displays **whole numbers only** so small physical changes do not make the readout flicker rapidly between decimal values.
- The world now contains exactly **one fixed island**. Unlike the camera-following ocean/sky shell, the island stays at a permanent world coordinate and provides a visual reference for heading and movement.
- The captain compass now includes an **enemy-bearing line** rendered in the opposing team's color. Bearings inside the compass range show their true position; off-ribbon enemies pin to the appropriate faded edge until the captain turns toward them.
- The lower deck has a much denser environment: visible plank flooring, structural beams and posts, wall rails, stacked bunks, shelving, crates, rope coils, a hatch ladder, benches, and metal braces while preserving the central movement route.
- A visible sun disc and soft halo now track the camera at the same direction as the existing sunlight/sky glow, so the directional lighting has a clear visual source.
- The 0.10.0 helm spacing, locked captain body orientation, ship-detail pass, endless atmospheric shell, and all existing multiplayer/combat systems are retained.

## 0.10.0 immersion and ship-detail pass

- Helm occupation places the sailor behind the wheel with physical spacing instead of clipping the character into the helm.
- A captain's body remains aligned with the helm/ship while camera look stays free, so the player can look around without rotating the entire sailor model.
- Ships include a procedural detail pass: helm pedestal, bowsprit and standing rigging, crow's nest, hull fittings, metal rings, mooring cleats, rope coils, stern trim, lanterns, and deck grating.
- Ocean, sky, and cloud shells follow the camera horizontally so normal sailing does not expose a black rendering void at the technical edge of the scene.
- `DESIGN_DIRECTION.md` is the visual north star for future work: grounded proportions, layered construction, believable materials, atmospheric depth, cinematic motion, and strong browser/mobile performance.

## 0.9.3 speed stability

- W no longer snaps the ship downward when sail decay or cannon damage lowers the current allowed maximum speed while the ship is still coasting faster than that new cap.
- W accelerates only while the ship is below its current forward cap; excess momentum bleeds away naturally through drag.
- S similarly reduces speed without forcing invalid jumps around the reverse-speed cap.
- The host repairs any non-finite ship-speed state back to zero as an additional safety guard.
- The HUD maps physical speed onto a normalized **0–35** display scale; 0.11.0 renders that scale as integers.
- Reverse movement continues to be marked `REV`.

## Handling and HUD

- Helm steering uses host-authoritative A/D input and scales smoothly with current boat speed.
- W/S incrementally changes the ship's current speed rather than commanding an immediate target throttle.
- Ships retain momentum after the captain leaves the helm and gradually lose speed from passive drag.
- A floating **speed indicator** sits directly below the personal HP bar.
- Captains receive a top-center heading compass with an enemy-bearing indicator.
- Cannon cooldown is **8 seconds per individual cannon**.
- Cannon mobility damage remains a host-authoritative random **4–9 percentage points** per hit.

## Combat and capture

- Every player begins a battle with **100 HP**.
- Sword hits remove 25 HP and target the nearest valid enemy within 2.5 local world units and a **±30° cone** in front of the attacker.
- Friendly fire is disabled.
- At 0 HP, a player is out for the rest of that battle and returns at full health next round.
- Capturing the enemy flag requires holding the interact control continuously for **5 seconds** while remaining in capture range.

## Cannons

- Each ship has four usable deck cannons, two on each side.
- Cannons are individually occupied and aimed.
- Each cannon has an **8-second cooldown**.
- Successful cannon hits remove a host-authoritative random **4–9 percentage points** of enemy ship mobility.
- Ship mobility cannot fall below 25%.

## Sailing and battle flow

- Ships begin 300 world units apart.
- Sail state has three levels: **Reefed**, **Cruising**, and **Full**.
- Full drops to Cruising after about 20 seconds; Cruising drops to Reefed after another 20 seconds.
- One four-color room can host repeated battles without reconnecting players.
- Capturing the opposing flag ends the current battle; the room waits **6 seconds** and automatically starts the next battle.

## Core controls

- **WASD** — walk while on foot.
- **W / S at helm** — increase / decrease current ship speed.
- **A / D at helm** — steer.
- **Mouse / touch drag** — look around.
- **E** — interact; hold for 5 seconds to capture the enemy flag.
- **G** — cross to the other ship when close enough.
- **Space** — sword attack while on foot, sail control while serving as sailmaster, or cannon fire while serving as gunner.
- **A / D at cannon** — aim the cannon.
- Third-person camera supports pinch zoom on touch devices and mouse-wheel zoom on desktop.

## Multiplayer model

Kill das James 2 uses PeerJS Cloud signaling, WebRTC DataChannels, Cloudflare TURN fallback, locked British/French team assignments, and host-authoritative movement/combat/battle state.

## Netlify / TURN

Deploy on Netlify and configure:

- `TURNTOKEN` — Cloudflare TURN key secret token.
- `TURNKEYID` — Cloudflare TURN key ID / UID.

The credential broker lives at `netlify/functions/turn-credentials.mjs` and exposes `/api/turn-credentials`.
