# Kill das James 2

**Version 0.6.1**

A browser-based 3D multiplayer naval game by Newhouse.

## 0.6.1 startup repair

Version 0.6.1 fixes a JavaScript startup regression introduced by 0.6.0.

- 0.6.0 generated an additional layer of JavaScript for the HUD/compass changes.
- Newline escapes inside that generated patch were escaped one level too deeply, so patch targets looked for literal `\n` text instead of real line breaks.
- The generated module therefore threw during startup before the lobby button handlers were attached, making both **Create battle** and **Join battle** appear unresponsive.
- 0.6.1 repairs the generated patch before execution and preserves the 0.6.0 gameplay/HUD changes.

## 0.6.0 HUD and handling refinement retained

- The ship-status HUD displays only the local player's own team/ship.
- Player movement is 120% of the 0.5.3 pace: upper deck speed is 4.98 and lower-deck speed is 4.02 world units per second.
- Ship movement is 90% of the 0.5.3 tuning: full-sail target speed is 6.03, with acceleration/deceleration scaled down proportionally.
- Battle restart cooldown is 6 seconds while keeping the same persistent room and locked teams.
- Captains receive a top-center heading compass while occupying the helm.
- The compass follows the ship's actual heading rather than camera/look direction.
- The ribbon contains N, NE, E, SE, S, SW, W, and NW marks with intermediate ticks, a fixed center index, and faded outer edges.
- The compass displays ±62.5° around the current course.

## Sail management retained

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
- **E** — interact with helm, rigging, hatch, or flag; also leave a station.
- **G** — cross to the other ship when it is close enough.
- **Space / SAILS** — cycle Reefed → Cruising → Full while serving as sailmaster.

## Multiplayer model

Kill das James 2 uses:

- Four-color room codes using Coral, Peach, Yellow, Turquoise, Blue, and Purple.
- PeerJS Cloud for signaling.
- WebRTC DataChannels for realtime game traffic.
- Cloudflare TURN fallback for cross-network reliability.
- Host-authoritative team assignment, ship movement, collision, crew roles, crossing, sail state/decay, flag victory, cooldown, and battle resets.

## Netlify / TURN

Deploy on Netlify and configure:

- `TURNTOKEN` — Cloudflare TURN key secret token.
- `TURNKEYID` — Cloudflare TURN key ID / UID.

The credential broker lives at `netlify/functions/turn-credentials.mjs` and exposes `/api/turn-credentials`.
