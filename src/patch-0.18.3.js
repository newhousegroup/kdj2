export function patchGameSource(source) {
  function replaceRequired(search, replacement, label) {
    if (!source.includes(search)) throw new Error(`0.18.3 patch failed: ${label}`);
    source = source.replace(search, replacement);
  }

  // 0.17.3 swaps desktop A/D for the movement/helm path, while leaving touch
  // semantics alone. Cannon aiming should follow the player's physical left/right
  // control instead of inheriting that movement-specific swap.
  replaceRequired(
    `    a: keys.d || touch.x < -0.18,\n    d: keys.a || touch.x > 0.18,\n    yaw: viewYaw,`,
    `    a: keys.d || touch.x < -0.18,\n    d: keys.a || touch.x > 0.18,\n    cannonLeft: keys.a || touch.x < -0.18,\n    cannonRight: keys.d || touch.x > 0.18,\n    yaw: viewYaw,`,
    "dedicated cannon direction input"
  );

  replaceRequired(
    `    const turn = (input.d ? 1 : 0) - (input.a ? 1 : 0);\n    cannon.aim = THREE.MathUtils.clamp((cannon.aim || 0) + turn * 0.62 * dt, -0.49, 0.49);`,
    `    const turn = (input.cannonRight ? 1 : 0) - (input.cannonLeft ? 1 : 0);\n    cannon.aim = THREE.MathUtils.clamp((cannon.aim || 0) + turn * 0.62 * dt, -0.49, 0.49);`,
    "cannon left-right control"
  );

  return source;
}
