# Kill das James 2

**Version 0.9.1**

A browser-based 3D multiplayer naval game by Newhouse.

## 0.9.1 helm repair and speed HUD

Version 0.9.1 is a focused stability and handling patch on top of 0.9.0.

- Helm steering is rebuilt as one coherent host-authoritative control block instead of layered piecemeal throttle patches.
- **A / D steering works continuously while a captain is at the helm**, scales smoothly with current boat speed, and preserves reversed rudder behavior while moving backward.
- W/S still incrementally changes the ship's current speed instead of commanding an immediate target throttle.
- Ships continue to retain momentum after the captain leaves the helm and gradually lose speed from passive drag.
- A new floating **speed indicator** sits directly below the personal HP bar and shows the current speed of the local player's own ship. Reverse movement is marked `REV`.
- Cannon cooldown is reduced from 10 seconds to **8 seconds per individual cannon**.
- Cannon mobility damage remains a host-authoritative random **4–9 percentage points** per hit.
- The 0.9.1 game launcher is rebuilt directly from the stable 0.7 cannon launcher, retaining the health, swords, five-second flag capture, sail management, compass, and persistent-room systems without depending on the fragile 0.8/0.9 loader chain.

## 0.9.0 combat and helm refinement retained

- The personal HP bar floats in the upper-right area beneath the top bar.
- Capturing the enemy flag requires holding the interact control continuously for **5 seconds** while remaining in capture range.
- Releasing the control or moving away resets capture progress.
- The capture prompt shows the remaining hold time while a capture is in progress.
- Sword attacks select the **nearest valid enemy** within 2.5 local world units and a **±30° cone** in front of the attacker.
- Friendly fire is disabled.

## Player health and swords

- Every player begins a battle with **100 HP**.
- Sword hits remove 25 HP.
- At 0 HP, a player is out for the rest of that battle, cannot move or interact, and waits in a spectator view.
- The next battle automatically revives all connected players at full health on their own team's ship.

## Cannons

- Each ship has four usable deck cannons, two on each side.
- Cannons are individually occupied and aimed.
- Each cannon has an **8-second cooldown**.
- Successful cannon hits remove a host-authoritative random **4–9 percentage points** of enemy ship mobility.
- Ship mobility cannot fall below 25%.
- Cannon projectiles, hits, occupation, and damage are host-authoritative and synchronized to the room.

## Sailing

- Ships begin 300 world units apart.
- Sail state has three levels: **Reefed**, **Cruising**, and **Full**.
- Full drops to Cruising after about 20 seconds; Cruising drops to Reefed after another 20 seconds.
- Manually changing the sail level restarts that timer.
- Sail meshes visibly open and reef with the selected state.
- Captains receive a top-center heading compass while at the helm.

## Battle flow

- One four-color room can host repeated battles without reconnecting players.
- Capturing the opposing flag ends the current battle.
- The room waits **6 seconds** and then automatically starts the next battle.
- Ships, mobility, stations, projectiles, player health, and positions reset while team assignments and network connections remain.

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

Kill das James 2 uses:

- Up to six players per room.
- Locked British/French team assignment for the lifetime of a room connection.
- Four-color room codes using Coral, Peach, Yellow, Turquoise, Blue, and Purple.
- PeerJS Cloud signaling.
- WebRTC DataChannels for realtime room/game traffic.
- Cloudflare TURN fallback.
- Host-authoritative ship movement, collision, crew stations, sails, cannon combat, sword combat, health, flag capture, cooldowns, and battle resets.

## Netlify / TURN

Deploy on Netlify and configure:

- `TURNTOKEN` — Cloudflare TURN key secret token.
- `TURNKEYID` — Cloudflare TURN key ID / UID.

The credential broker lives at `netlify/functions/turn-credentials.mjs` and exposes `/api/turn-credentials`.
