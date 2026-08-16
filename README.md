# Kill das James 2

**Version 0.2.0**

A browser-based 3D multiplayer naval game by Newhouse.

## 0.2.0 camera and graphics update

Version 0.2.0 keeps the 0.1.0 multiplayer/gameplay foundation and substantially changes presentation and player control:

- First-person is now the default player camera.
- Desktop players click the game world to enter mouse-look; touch players drag open screen space to look around.
- A Settings panel allows switching between **First person** and **Third person** at any time.
- Camera preference is stored locally and persists between sessions.
- Normal walking is relative to the player's look direction, while captain/helm controls remain ship controls.
- The local sailor model is hidden in first-person and visible again in third-person.
- The ocean now uses animated procedural waves and distance haze.
- The world has a procedural gradient sky, sun glow, moving clouds, atmospheric fog, improved lighting, tone mapping, and soft shadows.
- Ships now have shaped bow/stern sections, colored hull stripes, textured plank decks, railings, multiple masts and sails, rigging lines, flags, helm detail, rope/rigging props, portholes, lanterns, and richer lower decks.
- Crew models now include legs, coats, heads, and sailor hats instead of the original simple cylinder-and-sphere figures.

## Core game loop

- Two ships: British **HMS Resolute** and French **Fleur Royale**.
- Up to six players in one color-code room.
- Players are automatically assigned to the less-populated team and cannot switch during the battle.
- Joining leads to an assigned-crew deployment screen and a **Spawn on ship** button.
- Each ship has a helm. A player must take the captain role for that ship to move; without a captain the ship returns to a stop.
- A second crew member can take the rigging station and trim sails for a short speed boost.
- Players can board the other ship when the ships are close enough.
- Each ship has an upper deck, hatch, and lower deck.
- Each team's flag is below deck. Players cannot capture their own flag; capturing the opposing flag wins the battle.

## Controls

- **WASD** — walk relative to view direction, or steer/throttle while serving as captain.
- **Mouse** — look around after clicking the game world on desktop.
- **Touch drag** — look around on mobile/tablet.
- **E** — interact with helm, rigging, hatch, or flag; also leave a station.
- **G** — board the other ship when it is close enough.
- **Space** — trim sails while serving as sailmaster.
- **Settings** — switch between first-person and third-person camera.

## Multiplayer model

Kill das James 2 uses:

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
