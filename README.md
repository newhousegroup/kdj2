# Kill das James 2

**Version 0.10.0**

A browser-based 3D multiplayer naval game by Newhouse.

## 0.10.0 immersion and ship-detail pass

- Helm occupation now places the sailor behind the wheel with physical spacing instead of clipping the character into the helm.
- A captain's body remains aligned with the helm/ship while camera look stays free, so the player can look around without rotating the entire sailor model.
- Ships receive a substantial procedural detail pass: helm pedestal, bowsprit and standing rigging, crow's nest, hull fittings, metal rings, mooring cleats, rope coils, stern trim, lanterns, and deck grating.
- Ocean, sky, and cloud shells follow the camera horizontally so normal sailing can no longer expose a black rendering void at the technical edge of the scene.
- The project now includes DESIGN_DIRECTION.md as the visual north star for future work: grounded proportions, layered construction, believable materials, atmospheric depth, cinematic motion, and strong browser/mobile performance.
- All 0.9.3 gameplay systems are retained.

## 0.9.3 speed stability

Version 0.9.3 fixes a speed-control edge case and changes the HUD speed readout to a normalized 0–35 scale.

- W no longer snaps the ship downward when sail decay or cannon damage lowers the current allowed maximum speed while the ship is still coasting faster than that new cap.
- W accelerates only while the ship is below its current forward cap; excess momentum now bleeds away naturally through drag.
- S similarly reduces speed without forcing invalid jumps around the reverse-speed cap.
- The host repairs any non-finite ship-speed state back to zero as an additional safety guard.
- The HUD no longer exposes raw world-units-per-second values. Full undamaged Full-sail speed maps to **35** on the displayed scale, with intermediate physical speeds scaled proportionally from 0 to 35.
- Reverse movement continues to be marked `REV`.
- The generated-game CI verifier is retained and validates all nested loader stages plus the final generated module.

## 0.9.2 startup repair retained

- The 0.9.1 generated-loader syntax regression remains repaired.
- The actual generated game module is verified in GitHub Actions rather than only syntax-checking the small launcher file.
- The verifier recursively materializes every runtime loader stage and runs `node --check` against the final generated game source.

## Handling and HUD

- Helm steering uses host-authoritative A/D input and scales smoothly with current boat speed.
- W/S incrementally changes the ship's current speed rather than commanding an immediate target throttle.
- Ships retain momentum after the captain leaves the helm and gradually lose speed from passive drag.
- A floating **speed indicator** sits directly below the personal HP bar and uses the 0–35 display scale.
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
- Captains receive a top-center heading compass while at the helm.
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
