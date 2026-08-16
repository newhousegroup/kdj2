# Kill das James 2

**Version 0.11.3**

A browser-based 3D multiplayer naval game by Newhouse.

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
