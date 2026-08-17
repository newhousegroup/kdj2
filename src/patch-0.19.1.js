export function patchGameSource(source) {
  function replaceRequired(search, replacement, label) {
    if (!source.includes(search)) throw new Error(`0.19.1 patch failed: ${label}`);
    source = source.replace(search, replacement);
  }

  // Tone down sky/sun reflection so the ocean reads as water first, reflection second.
  replaceRequired(
    '      float fresnel = 0.025 + 0.76 * f2 * f2 * f;',
    '      float fresnel = 0.018 + 0.34 * f2 * f2 * f;',
    'fresnel strength'
  );

  replaceRequired(
    '      vec3 horizonSky = vec3(0.34, 0.58, 0.67);\n      vec3 upperSky = vec3(0.16, 0.39, 0.56);',
    '      vec3 horizonSky = vec3(0.23, 0.43, 0.50);\n      vec3 upperSky = vec3(0.08, 0.23, 0.34);',
    'reflection brightness'
  );

  replaceRequired(
    '      color += vec3(1.0, 0.88, 0.66) * spec * 1.65;',
    '      color += vec3(1.0, 0.88, 0.66) * spec * 0.42;',
    'sun glint intensity'
  );

  // Strengthen the actual body of the water so boats do not appear to float on sky.
  replaceRequired(
    '      vec3 deepWater = vec3(0.012, 0.085, 0.125);\n      vec3 faceWater = vec3(0.025, 0.205, 0.275);\n      vec3 base = mix(deepWater, faceWater, 0.42 + crest * 0.32 - trough * 0.12);',
    '      vec3 deepWater = vec3(0.006, 0.070, 0.105);\n      vec3 faceWater = vec3(0.018, 0.175, 0.245);\n      float waterFace = clamp(0.34 + crest * 0.46 - trough * 0.16, 0.0, 1.0);\n      vec3 base = mix(deepWater, faceWater, waterFace);',
    'water body contrast'
  );

  // Keep wave height unchanged, but add cheap fine-scale normal variation so the
  // surface shape reads more clearly without extra geometry, textures, or draw calls.
  replaceRequired(
    '    varying vec3 vWorld;\n    varying vec3 vNormalWorld;\n    varying float vWave;\n\n    void main() {\n      vec3 N = normalize(vNormalWorld);',
    '    uniform float uTime;\n    varying vec3 vWorld;\n    varying vec3 vNormalWorld;\n    varying float vWave;\n\n    void main() {\n      vec3 N = normalize(vNormalWorld);\n      float rippleA = sin(vWorld.x * 0.52 + vWorld.z * 0.31 + uTime * 1.35);\n      float rippleB = sin(vWorld.x * -0.38 + vWorld.z * 0.61 - uTime * 1.08);\n      N = normalize(N + vec3(rippleA * 0.035, 0.0, rippleB * 0.035));',
    'fine surface normals'
  );

  replaceRequired(
    '      color = mix(color, vec3(0.72, 0.84, 0.84), foam * 0.30);',
    '      color = mix(color, vec3(0.64, 0.78, 0.79), foam * 0.36);',
    'crest definition'
  );

  replaceRequired(
    '      color = mix(color, horizonSky, haze * 0.74);',
    '      color = mix(color, horizonSky, haze * 0.55);',
    'distance haze strength'
  );

  return source;
}
