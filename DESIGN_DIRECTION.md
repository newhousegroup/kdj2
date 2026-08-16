# Kill das James 2 — Design Direction

The target is a premium-feeling, cinematic browser naval game rather than a visible prototype.

## North star

Make every scene feel intentional, grounded, readable, and memorable. Within the limits of a lightweight browser game, aim for the most convincing and exciting experience possible.

## Visual rules

- Prefer believable proportions and structural relationships over disconnected decorative geometry.
- Layer details: hull trim, rigging, fittings, deck furniture, lanterns, rope, rail hardware, masts, spars, weathering cues, and silhouettes should work together.
- Crew stations must look physically usable. A player taking a station should stand in a sensible place and pose/orient consistently with that station.
- Avoid objects clipping through players, sails, masts, rails, decks, or each other.
- Materials should read distinctly as timber, rope, cloth, metal, skin, water, and painted surfaces.
- Use atmospheric depth, lighting, fog, sky, moving water, and distant silhouettes to make the world feel larger than the playable area.
- Never reveal the technical edge of the world, empty black space, or obvious rendering boundaries during normal play.
- Motion matters: walking, sailing, sails, water, camera behavior, and ship momentum should feel deliberate rather than twitchy.
- Details should support gameplay readability rather than clutter it.

## Performance rules

- Preserve smooth play on tablets and phones.
- Prefer procedural/simple geometry, shared materials, and restrained polygon counts over expensive assets when the visual result is comparable.
- Multiplayer simulation remains host-authoritative and should not be compromised for visual effects.

## Gameplay tone

Combat remains stylized and non-graphic. Realism should primarily improve movement, atmosphere, readability, scale, and physical plausibility rather than reproduce real-world weapon operation.
