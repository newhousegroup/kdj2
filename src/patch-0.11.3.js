export function patchGameSource(source) {
  function replaceRequired(search, replacement, label) {
    if (!source.includes(search)) throw new Error(`0.11.3 patch failed: ${label}`);
    source = source.replace(search, replacement);
  }

  // 0.11.2 made steering use one heading sign at all speeds. Player testing shows
  // reverse motion now feels correct, while forward motion is mirrored. Preserve
  // the confirmed reverse behavior and flip the heading response only for forward
  // motion so A/joystick-left and D/joystick-right follow the expected turn.
  replaceRequired(
    '      ship.heading += steer * 0.42 * mobility * (0.28 + 0.72 * speedScale) * dt;',
    '      const helmDirection = ship.speed >= 0 ? -1 : 1;\n      ship.heading += steer * 0.42 * mobility * (0.28 + 0.72 * speedScale) * dt * helmDirection;',
    'forward-only helm direction correction'
  );

  return source;
}
