# Kill das James 2

**Version 0.5.1**

A browser-based 3D multiplayer naval game by Newhouse.

## 0.5.1 visual and speed corrections

Version 0.5.1 is a patch release over 0.5.0 focused on the issues found during playtesting.

- The hatch-area sail has been rebuilt as a compact raised square sail on its own mast/yardarms. It remains just forward of the lower-deck hatch but no longer produces the malformed/intersecting triangular shape seen in 0.5.0.
- Sailors now use two simple dark eye dots directly on the head instead of white eyeballs, pupils, and a nose.
- Player walking speed has been reduced on both upper and lower decks.
- Arm and leg walk animation has been slowed and reduced in amplitude so it matches the new walking pace.
- Ship top speed and acceleration have both been reduced so the boats feel heavier and give captains more time to maneuver.

## 0.5.0 foundation retained

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
- A second crew member can take the rigging station and trim sails for a short speed boost.
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
- **Space** — trim sails while serving as sailmaster.
- Touch devices show the **SAILS** button only while the player is serving as sailmaster.

## Multiplayer model

Kill das James 2 uses:

- Four-color room codes using Coral, Peach, Yellow, Turquoise, Blue, and Purple.
- PeerJS Cloud for signaling.
- WebRTC DataChannels for realtime game traffic.
- Cloudflare TURN fallback for cross-network reliability.
- Host-authoritative team assignment, ship movement, collision, crew roles, crossing, flag victory, cooldown, and battle resets.

## Netlify / TURN

Deploy on Netlify and configure:

- `TURNTOKEN` — Cloudflare TURN key secret token.
- `TURNKEYID` — Cloudflare TURN key ID / UID.

The credential broker lives at `netlify/functions/turn-credentials.mjs` and exposes `/api/turn-credentials`.
