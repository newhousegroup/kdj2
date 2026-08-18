export function patchGameSource(source) {
  const search = `    const turn = (input.cannonRight ? 1 : 0) - (input.cannonLeft ? 1 : 0);
    cannon.aim = THREE.MathUtils.clamp((cannon.aim || 0) + turn * 0.62 * dt, -0.49, 0.49);`;
  const replacement = `    // A/D should be left/right from the gunner's outward-facing view.
    // Facing out the port broadside mirrors screen-left/right relative to the
    // ship-local aim axis, so port (-1) must invert the traverse sign while
    // starboard (+1) keeps the existing direction.
    const broadsideSign = cannon.side === -1 ? -1 : 1;
    const turn = ((input.cannonRight ? 1 : 0) - (input.cannonLeft ? 1 : 0)) * broadsideSign;
    cannon.aim = THREE.MathUtils.clamp((cannon.aim || 0) + turn * 0.62 * dt, -0.49, 0.49);`;

  if (!source.includes(search)) {
    throw new Error("0.19.8 patch failed: cannon traverse marker missing");
  }
  return source.replace(search, replacement);
}
