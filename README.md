# Kill das James 2

**Version 0.4.0**

A browser-based 3D multiplayer naval game by Newhouse.

## 0.4.0 persistent-room battle flow

Version 0.4.0 turns a room into a persistent session that can run multiple battles without changing the four-color code or reconnecting players.

- Hull collision remains host-authoritative, but collision is now deliberately silent: ships stop on contact without showing a collision popup/toast.
- The sail plan around the stern has been rearranged so the helm has a clear forward sightline. Cloth is placed forward of the captain and above eye level rather than sitting in the helm view.
- One room/code can now host repeated battles.
- Capturing the opposing flag ends only the current battle, not the room.
- A 10-second cooldown begins after a win and is shown to everyone in the room.
- When the countdown reaches zero, the host resets the authoritative battle state while keeping the existing PeerJS/WebRTC room alive.
- Ships return to their starting positions with zero speed, full mobility, no occupied crew stations, and no active sail boost.
- Every connected player keeps the same locked British/French team and is automatically returned to their own ship for the next battle.
- Round numbers increase within the same room.

## Core game loop

- Two ships: British **HMS Resolute** and French **Fleur Royale**.
- Up to six players in one color-code room.
- Players are automatically assigned to the less-populated team and cannot switch teams while they remain in the room.
- Joining leads to an assigned-crew deployment screen and a **Spawn on ship** button.
- Each ship has a helm. A player must take the captain role for that ship to move; without a captain the ship returns to a stop.
- A second crew member can take the rigging station and trim sails for a short speed boost.
- Players can board the other ship when the ships are close enough.
- Each ship has an upper deck, hatch, and enclosed lower deck.
- Each team's flag is below deck. Players cannot capture their own flag; capturing the opposing flag wins the current battle.

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
- Host-authoritative team assignment, ship movement, collision, crew roles, boarding, flag victory, cooldown, and battle resets.

## Netlify / TURN

Deploy on Netlify and configure:

- `TURNTOKEN` — Cloudflare TURN key secret token.
- `TURNKEYID` — Cloudflare TURN key ID / UID.

The credential broker lives at `netlify/functions/turn-credentials.mjs` and exposes `/api/turn-credentials`.
