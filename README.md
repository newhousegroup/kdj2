# Kill das James 2

**Version 0.1.0**

A browser-based 3D multiplayer naval game by Newhouse.

## 0.1.0 vertical slice

The first playable build focuses on the team/ship/boarding/objective loop with deliberately simple Three.js geometry:

- Two ships: British **HMS Resolute** and French **Fleur Royale**.
- Up to six players in one color-code room.
- Players are automatically assigned to the less-populated team and cannot switch during the battle.
- Joining leads to an assigned-crew deployment screen and a **Spawn on ship** button.
- Each ship has a helm. A player must take the captain role for that ship to move; without a captain the ship returns to a stop.
- A second crew member can take the rigging station and trim sails for a short speed boost, giving each ship a cooperative two-person operating loop.
- Players can board the other ship when the ships are close enough, with a temporary line shown between the ships.
- Each ship has an upper deck, a hatch, and a simple lower-deck area.
- Each team's flag is below deck. Interacting with your own flag does not count; capturing the opposing flag wins the battle.
- Keyboard and touch controls are included.

Weapon-operation mechanics are not included in this build.

## Controls

- **WASD** — walk, or steer while serving as captain.
- **E** — interact with helm, rigging, hatch, or flag; also leave a station.
- **G** — board the other ship when it is close enough.
- **Space** — trim sails while serving as sailmaster.
- Touch devices receive a joystick plus interact, boarding, and sails buttons.

## Multiplayer model

Kill das James 2 reuses the multiplayer architecture proven in Newhouse CoOp:

- Four-color room codes using Coral, Peach, Yellow, Turquoise, Blue, and Purple.
- PeerJS Cloud for signaling.
- WebRTC DataChannels for realtime game traffic.
- Cloudflare TURN fallback for cross-network reliability.
- Host-authoritative team assignment, ship movement, crew roles, boarding, and flag victory.

## Netlify / TURN

Deploy on Netlify and configure:

- `TURNTOKEN` — Cloudflare TURN key secret token.
- `TURNKEYID` — Cloudflare TURN key ID / UID.

The credential broker lives at `netlify/functions/turn-credentials.mjs` and exposes `/api/turn-credentials`.

## Rendering

The 0.1.0 ships, crew, ocean, stations, lower decks, flags, and boarding-line effect are generated from Three.js primitives. The goal of this version is to validate the multiplayer game loop before adding detailed art assets.
