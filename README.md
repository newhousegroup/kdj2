# Kill das James 2

**Version 0.7.1**

A browser-based 3D multiplayer naval game by Newhouse.

## 0.7.1 cannon balance tuning

Version 0.7.1 keeps the 0.7.0 cannon system intact and retunes its pacing/damage.

- Each individual cannon now has a **10-second cooldown** between shots.
- Firing one cannon does not affect the reload timer of the other cannons.
- Each successful hit now removes a host-authoritative random **4–9 percentage points** of enemy mobility instead of a fixed 12 points.
- The 25% mobility floor remains unchanged.
- All other 0.7.0 cannon controls, aiming, projectile synchronization, station occupation, and reset behavior are unchanged.

## 0.7.0 cannons retained

- Each ship has four usable deck cannons: fore/aft positions on both port and starboard sides.
- Walk near a cannon and press **E** to man it. A cannon can only have one gunner at a time.
- While serving as gunner, **A / D** adjusts the cannon within a limited broadside firing arc.
- **Space** fires on desktop. Touch devices show a dedicated **FIRE** button only while the player is manning a cannon.
- Cannon projectiles are visible and synchronized through the existing room state.
- The host authoritatively simulates projectile movement and decides hits.
- Cannon range is intentionally shorter than the 300-unit starting separation, requiring both crews to close distance before firing becomes useful.
- The captain may leave the helm and take a cannon like any other sailor; while nobody is at the helm, the ship naturally slows/stops as before.
- Cannon occupation and projectiles are cleared between battles while the room itself remains connected.

The cannon system is intentionally arcade-like rather than a realistic weapon simulation.

## Retained 0.6.x HUD and handling

- The ship-status HUD displays only the local player's own team/ship.
- Player movement is upper deck 4.98 and lower deck 4.02 world units per second.
- Full-sail ship target speed is 6.03, with mobility and sail state scaling it further.
- Battle restart cooldown is 6 seconds while keeping the same persistent room and locked teams.
- Captains receive a top-center heading compass while occupying the helm.
- The compass follows the ship's actual heading rather than camera/look direction.
- The ribbon contains N, NE, E, SE, S, SW, W, and NW marks with intermediate ticks, a fixed center index, and faded outer edges.
- Startup failures write a visible `Game failed to load: ...` message to the lobby instead of leaving Create/Join silently unresponsive.

## Sail management

- Sail state has three levels: **Reefed**, **Cruising**, and **Full**.
- A ship automatically drops one sail level after about 20 seconds.
- **Full → Cruising** after about 20 seconds, then **Cruising → Reefed** after another about 20 seconds.
- **Reefed** is the minimum and does not decay further.
- Whenever the sailmaster manually changes the sail setting, the 20-second timer restarts from the newly selected level.
- New battles begin at **Cruising**.
- Reefed sails provide 55% sail power, Cruising provides 78%, and Full provides 100%.
- Sail meshes visibly reef/open as the synchronized sail state changes.

## Battle spacing and retained improvements

- The two ships begin 300 world units apart: British at x = -150 and French at x = +150.
- The hatch-area sail is a compact raised square sail on its own mast/yardarms.
- Sailors use two simple dark eye dots directly on the head.
- Players have articulated walking animation.
- Third-person supports pinch zoom on touch and mouse-wheel zoom on desktop.
- Deck-edge movement slides along the boundary instead of locking the player.
- One four-color room can host repeated battles while keeping the same connections and locked teams.

## Core game loop

- Two ships: British **HMS Resolute** and French **Fleur Royale**.
- Up to six players in one color-code room.
- Players are automatically assigned to the less-populated team and cannot switch teams while they remain in the room.
- Joining leads to an assigned-crew deployment screen and a **Spawn on ship** button.
- Each ship has a helm. A player must take the captain role for that ship to move; without a captain the ship returns to a stop.
- A second crew member can take the rigging station and control the sail setting.
- Crew members can man individual cannons and damage enemy mobility.
- Players can cross to the other ship when the ships are close enough.
- Each ship has an upper deck, hatch, and enclosed lower deck.
- Each team's flag is below deck. Players cannot capture their own flag; capturing the opposing flag wins the current battle.

## Camera and controls

- First-person is the default camera; Settings can switch to third-person.
- **WASD** — walk relative to view direction, or steer/throttle while serving as captain.
- **Mouse** — look around after clicking the game world on desktop.
- **Touch drag** — look around on mobile/tablet.
- **Pinch in third person** — change third-person camera distance; pinch inward to zoom out.
- **Mouse wheel in third person** — change camera distance on desktop.
- **E** — interact with helm, rigging, cannon, hatch, or flag; also leave a station.
- **G** — cross to the other ship when it is close enough.
- **Space / SAILS** — change sail setting while serving as sailmaster.
- **A / D + Space / FIRE** — aim and fire while serving as gunner.

## Multiplayer model

Kill das James 2 uses:

- Four-color room codes using Coral, Peach, Yellow, Turquoise, Blue, and Purple.
- PeerJS Cloud for signaling.
- WebRTC DataChannels for realtime game traffic.
- Cloudflare TURN fallback for cross-network reliability.
- Host-authoritative team assignment, ship movement, collision, crew roles, cannon shots/hits, crossing, sail state/decay, flag victory, cooldown, and battle resets.

## Netlify / TURN

Deploy on Netlify and configure:

- `TURNTOKEN` — Cloudflare TURN key secret token.
- `TURNKEYID` — Cloudflare TURN key ID / UID.

The credential broker lives at `netlify/functions/turn-credentials.mjs` and exposes `/api/turn-credentials`.
