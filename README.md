# Kill das James 2

**Version 0.8.0**

A browser-based 3D multiplayer naval game by Newhouse.

## 0.8.0 health and swords

Version 0.8.0 adds player health and close-range sword combat for boarding actions.

- Every sailor has **100 HP**.
- The local player's health is shown as a compact health bar in the in-game HUD.
- Sailors visibly carry swords. First-person players also see a simple first-person sword model.
- While not occupying the helm, rigging, or a cannon, **Space** performs a sword attack. Touch devices show a **SWORD** button.
- Sword combat is host-authoritative.
- A sword hit deals **25 HP** and has a short arcade cooldown.
- Hits only register against enemy-team sailors on the same ship and same deck, within close range and generally in front of the attacker.
- Friendly fire is disabled.
- At 0 HP, the sailor is out for the remainder of the current battle. Their active model is removed, movement/interactions stop, and their camera switches to a waiting view around their own ship.
- An eliminated sailor cannot respawn during the same battle.
- The normal next-battle reset revives every connected sailor at **100 HP** and places them back aboard their own team's ship.
- Combat feedback is intentionally non-graphic.

## Cannons

- Each ship has four usable deck cannons: fore/aft positions on both port and starboard sides.
- Walk near a cannon and press **E** to man it. A cannon can only have one gunner at a time.
- While serving as gunner, **A / D** adjusts the cannon within its broadside arc.
- **Space** fires on desktop. Touch devices show a dedicated **FIRE** button while manning a cannon.
- Each individual cannon has a **10-second cooldown**.
- Cannon projectiles and hit detection are host-authoritative and synchronized through the room state.
- Each successful cannon hit reduces enemy ship mobility by a random **4–9 percentage points**, with the existing 25% mobility floor retained.
- Cannon range is shorter than the 300-unit starting separation, requiring ships to close distance before firing becomes useful.

## Sailing and round flow

- Two ships: British **HMS Resolute** and French **Fleur Royale**.
- Up to six players share one four-color room code.
- Players are automatically assigned to the less-populated team and cannot switch teams while in that room.
- A player must occupy the helm for a ship to move.
- A separate sailmaster can control **Reefed**, **Cruising**, and **Full** sails.
- Sail state drops one level after about 20 seconds: Full → Cruising → Reefed.
- Reefed provides 55% sail power, Cruising 78%, and Full 100%.
- Ships begin 300 world units apart.
- Capturing the opposing team's lower-deck flag wins the battle. A player cannot capture their own flag.
- The same room stays connected across repeated battles.
- After a victory, the next battle starts after **6 seconds**, resetting ships, stations, flags, player health, and player positions while preserving teams and connections.

## Controls

- **WASD** — walk relative to view direction; steer/throttle while captain; aim left/right while gunner.
- **Mouse / touch drag** — look around.
- **E** — interact with helm, rigging, cannon, hatch, or flag; leave an occupied station.
- **G** — cross to the other ship when close enough.
- **Space** — sword attack while free, change sails while sailmaster, or fire while gunner.
- **Pinch in third person** / **mouse wheel** — adjust third-person camera distance.

## Camera and HUD

- First person is the default; Settings can switch to third person.
- The ship-status HUD only exposes the local team's ship information.
- Captains receive a top-center heading compass based on the ship's actual heading.
- The compass shows N, NE, E, SE, S, SW, W, and NW with intermediate marks and faded edges.
- Eliminated players see a waiting notice until the next battle.
- Startup failures display a visible `Game failed to load: ...` message in the lobby.

## Multiplayer model

Kill das James 2 uses:

- PeerJS Cloud for signaling.
- WebRTC DataChannels for realtime game traffic.
- Cloudflare TURN fallback for cross-network reliability.
- Host-authoritative team assignment, movement, ship collision, stations, sailing, cannon shots/hits, sword hits/health, boarding, flag victory, cooldown, and battle resets.

## Netlify / TURN

Deploy on Netlify and configure:

- `TURNTOKEN` — Cloudflare TURN key secret token.
- `TURNKEYID` — Cloudflare TURN key ID / UID.

The credential broker lives at `netlify/functions/turn-credentials.mjs` and exposes `/api/turn-credentials`.
