export function patchGameSource(source) {
  function replaceRequired(search, replacement, label) {
    if (!source.includes(search)) throw new Error(`0.19.2 patch failed: ${label}`);
    source = source.replace(search, replacement);
  }

  // Remove the fine fragment-normal ripple pass from 0.19.1. It created a
  // repeating alternating-shade pattern that read more like a texture than water.
  replaceRequired(
    '      float rippleA = sin(vWorld.x * 0.52 + vWorld.z * 0.31 + uTime * 1.35);\n      float rippleB = sin(vWorld.x * -0.38 + vWorld.z * 0.61 - uTime * 1.08);\n      N = normalize(N + vec3(rippleA * 0.035, 0.0, rippleB * 0.035));',
    '',
    'fine normal ripple removal'
  );

  // Use one stable water-body colour. Wave shape, lighting, Fresnel, glint and
  // sparse crest foam now provide the variation instead of alternating bands.
  replaceRequired(
    '      vec3 deepWater = vec3(0.006, 0.070, 0.105);\n      vec3 faceWater = vec3(0.018, 0.175, 0.245);\n      float waterFace = clamp(0.34 + crest * 0.46 - trough * 0.16, 0.0, 1.0);\n      vec3 base = mix(deepWater, faceWater, waterFace);',
    '      vec3 base = vec3(0.010, 0.105, 0.150);',
    'flat water body colour'
  );

  // Make the existing low-cost geometric waves a little easier to read without
  // increasing mesh subdivisions or adding any new draw calls.
  replaceRequired(
    '      p.z += h;',
    '      p.z += h * 1.12;',
    'wave height emphasis'
  );

  replaceRequired(
    '      vec3 localNormal = normalize(vec3(-slope.x, -slope.y, 1.0));',
    '      vec3 localNormal = normalize(vec3(-slope.x * 1.12, -slope.y * 1.12, 1.0));',
    'wave normal emphasis'
  );

  // Keep crest foam subtle so it supports the wave shape rather than turning
  // into another repeating colour band.
  replaceRequired(
    '      color = mix(color, vec3(0.64, 0.78, 0.79), foam * 0.36);',
    '      color = mix(color, vec3(0.64, 0.78, 0.79), foam * 0.18);',
    'crest foam restraint'
  );

  return source;
}
