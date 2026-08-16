# Kill das James 2

**Version 0.5.2**

A browser-based 3D multiplayer naval game by Newhouse.

## 0.5.2 sail control and battle spacing

Version 0.5.2 expands the sailmaster role and gives each battle a much longer approach phase.

- The two ships now begin 300 world units apart: British at x = -150 and French at x = +150. This is exactly five times the previous 60-unit starting separation.
- Sail control is no longer a temporary "speed boost active" action.
- The sailmaster cycles the ship through three persistent sail states: **Reefed**, **Cruising**, and **Full**.
- Sail state remains selected until a sailmaster changes it again and resets to **Cruising** at the beginning of each new battle.
- Reefed sails provide 55% sail power, Cruising provides 78%, and Full provides 100%.
- The actual sail meshes visually reef/open as the synchronized sail state changes.
- The HUD ship panels show each ship's current sail state.
- While working the rigging, the sailmaster objective and touch SAILS button show the current setting.

## 0.5.1 visual and speed corrections retained

- The hatch-area sail is a compact raised square sail on its own mast/yardarms.
- Sailors use two simple dark eye dots directly on the head.
- Player walking speed is reduced on both upper and lower decks.
- Arm and leg walk animation is slower and less exaggerated.
- Ship top speed and acceleration are reduced so the boats feel heavier and give captains more time to maneuver.

## Foundation retained

- Ship geometry uses aligned shared deck/hull measurements.
- Players have articulated arms and legs.
- Third-person touch controls support pinch zoom; desktop supports mouse-wheel distance changes.
- Deck-edge movement slides along rails instead of locking the player against the boundary.
- One four-color room can host repeated battles, with a 10-second reset after a win while keeping the same room and locked teams.

## Core game loop

- Two ships: British **HMS Resolute** and French **Fleur Royale**.
- Up to six players in one color-code room.
- Players are automatically assigned to the less-populated team and cannot switch teams while they remain in the room.
- Joining leads to an assigned-crew deployment screen and a **Spawn on ship** button.
- Each ship has a helm. A player must take the captain role for that ship to move; without a captain the ship returns to a stop.
- A second crew member can take the rigging station and control the persistent sail setting.
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
- Touch devices show the **SAILS** button only while the player is serving as sailmaster.

## Multiplayer model

Kill das James 2 uses:

- Four-color room codes using Coral, Peach, Yellow, Turquoise, Blue, and Purple.
- PeerJS Cloud for signaling.
- WebRTC DataChannels for realtime game traffic.
- Cloudflare TURN fallback for cross-network reliability.
- Host-authoritative team assignment, ship movement, collision, crew roles, crossing, sail state, flag victory, cooldown, and battle resets.

## Netlify / TURN

Deploy on Netlify and configure:

- `TURNTOKEN` — Cloudflare TURN key secret token.
- `TURNKEYID` — Cloudflare TURN key ID / UID.

The credential broker lives at `netlify/functions/turn-credentials.mjs` and exposes `/api/turn-credentials`.
