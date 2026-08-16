# Kill das James 2

**Version 0.5.0**

A browser-based 3D multiplayer naval game by Newhouse.

## 0.5.0 model, character, camera and movement polish

Version 0.5.0 focuses on making the ships and sailors feel more coherent while fixing edge movement and improving third-person camera control.

- The standalone/floating sail has been moved forward to just ahead of the lower-deck hatch and raised well above player/head height. It is now visibly attached to mast/rigging instead of appearing to float around the stern.
- Ship geometry has been realigned around shared deck/hull measurements. Side rails now terminate at the actual stern/fore corners, bow rails converge on the bow point, and metal corner caps/hardware are anchored to those same points.
- Player models now have articulated legs and arms. Walking animates the limbs based on actual player movement.
- Sailors now have visible eyes/pupils and a face oriented with the player's synced look direction, making it easier to tell where another player is looking.
- Third-person touch controls now support pinch zoom. Pinching inward moves the camera farther away; the selected distance is stored locally. Mouse-wheel zoom is also available on desktop while in third person.
- Player movement no longer uses a hard rectangular clamp. The upper deck has a tapered-bow walkable shape and boundary movement slides along rails/edges instead of consuming the movement input, removing the edge/corner dead-zone feeling.
- Lower-deck movement uses the same boundary-safe sliding behavior.

## Persistent room / battle flow

- One four-color room can host repeated battles without reconnecting.
- Capturing the opposing flag ends only the current battle.
- A 10-second cooldown follows a win.
- The host then resets ship positions, stations, movement state, and players for the next battle while keeping the same room connections and locked teams.

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
