export function patchGameSource(source) {
  const search = `    a: keys.a || touch.x < -0.18,\n    d: keys.d || touch.x > 0.18,`;
  const replacement = `    // Desktop keyboard steering/strafe correction: testers reported A/D mirrored.\n    // Swap keyboard A/D only; keep touch joystick left/right semantics unchanged.\n    a: keys.d || touch.x < -0.18,\n    d: keys.a || touch.x > 0.18,`;

  if (!source.includes(search)) {
    throw new Error("0.17.3 patch failed: desktop A/D input marker");
  }

  return source.replace(search, replacement);
}
