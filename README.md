# Kill das James 2

**Version 0.3.0**

A browser-based 3D multiplayer naval game by Newhouse.

## 0.3.0 ship physics and space update

Version 0.3.0 builds on the first-person/graphics work in 0.2.0 and focuses on making the ships behave and feel like physical spaces:

- The British and French ships now have host-authoritative collision. Their rotated hull footprints are checked with oriented separating-axis collision tests, so ships can no longer pass through one another.
- When hulls collide, the simulation restores the last non-overlapping transforms and stops the ships rather than letting them overlap.
- The ocean surface no longer visually leaks through the lower deck. The lower deck is now a closed interior and the local ocean surface is hidden while the player is below deck.
- The lower deck has more vertical clearance, a raised dry floor, taller side/end walls, a ceiling, overhead beams, repositioned lights/props, and a higher first-person eye position so the sailor's head no longer clips through the ceiling.
- The sail plan is much fuller: three masts, multiple billowed square sails, additional triangular sails, extra yardarms, and more standing rigging.
- Sails have a subtle visual movement rather than remaining completely rigid.
- The mobile/tablet **SAILS** action is hidden by default and appears only after the player has actually taken the sailmaster/rigging station.

## Core game loop

- Two ships: British **HMS Resolute** and French **Fleur Royale**.
- Up to six players in one color-code room.
- Players are automatically assigned to the less-populated team and cannot switch during the battle.
- Joining leads to an assigned-crew deployment screen and a **Spawn on ship** button.
- Each ship has a helm. A player must take the captain role for that ship to move; without a captain the ship returns to a stop.
- A second crew member can take the rigging station and trim sails for a short speed boost.
- Players can board the other ship when the ships are close enough.
- Each ship has an upper deck, hatch, and enclosed lower deck.
- Each team's flag is below deck. Players cannot capture their own flag; capturing the opposing flag wins the battle.

## Camera and controls

- First-person is the default camera; Settings can switch to third-person.
- **WASD** — walk relative to view direction, or steer/throttle while serving as captain.
- **Mouse** — look around after clicking the game world on desktop.
- **Touch drag** — look around on mobile/tablet.
- **E** — interact with helm, rigging, hatch, or flag; also leave a station.
- **G** — board the other ship when it is close enough.
- **Space** — trim sails while serving as sailmaster.
- Touch devices show the **SAILS** button only while the player is serving as sailmaster.

## Multiplayer model

Kill das James 2 uses:

- Four-color room codes using Coral, Peach, Yellow, Turquoise, Blue, and Purple.
- PeerJS Cloud for signaling.
- WebRTC DataChannels for realtime game traffic.
- Cloudflare TURN fallback for cross-network reliability.
- Host-authoritative team assignment, ship movement, collision, crew roles, boarding, and flag victory.

## Netlify / TURN

Deploy on Netlify and configure:

- `TURNTOKEN` — Cloudflare TURN key secret token.
- `TURNKEYID` — Cloudflare TURN key ID / UID.

The credential broker lives at `netlify/functions/turn-credentials.mjs` and exposes `/api/turn-credentials`.
