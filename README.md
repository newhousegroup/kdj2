# Kill das James 2

A browser-based 3D multiplayer boating / naval game by Newhouse.

## Direction

Kill das James 2 will use the multiplayer architecture proven in Newhouse CoOp as a reference:

- short room codes
- PeerJS signaling
- WebRTC DataChannels for realtime game traffic
- TURN fallback for cross-network reliability
- small multiplayer rooms
- host-authoritative game state

The first playable milestone will focus on a simple 3D ocean, controllable boats, a third-person camera, and synchronized multiplayer movement before combat systems are added.
