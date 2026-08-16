# Kill das James 2

**Version 0.9.2**

A browser-based 3D multiplayer naval game by Newhouse.

## 0.9.2 startup repair

Version 0.9.2 repairs the 0.9.1 startup regression without changing the intended 0.9.1 gameplay tuning.

- 0.9.1 contained an unescaped template literal inside its generated patch bundle. That produced a JavaScript `SyntaxError` before the game could attach the Create/Join handlers.
- 0.9.2 removes the broken cosmetic captain-hint source patch before loading the 0.9.1 gameplay changes.
- The actual generated game module is now verified in GitHub Actions rather than only syntax-checking the small launcher file.
- The verifier recursively materializes every runtime loader stage and runs `node --check` against the final generated game source.
- The repaired generated module retains the 0.9.1 steering changes, speed HUD, 8-second cannon cooldown, health/swords, five-second flag capture, sails, compass, and persistent-room battle flow.

## 0.9.1 handling and speed HUD retained

- Helm steering uses host-authoritative A/D input and scales smoothly with current boat speed.
- W/S incrementally changes the ship's current speed rather than commanding an immediate target throttle.
- Ships retain momentum after the captain leaves the helm and gradually lose speed from passive drag.
- A floating **speed indicator** sits directly below the personal HP bar and shows the current speed of the local player's own ship. Reverse movement is marked `REV`.
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
