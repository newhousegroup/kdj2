export function patchGameSource(source) {
  function replaceRequired(search, replacement, label) {
    if (!source.includes(search)) throw new Error(`0.19.4 patch failed: ${label}`);
    source = source.replace(search, replacement);
  }

  // Keep the 0.19.3 bright circular sun while leaving the 0.19.2 ship geometry untouched.
  replaceRequired(
    'new THREE.SphereGeometry(11.5, 18, 12),\n  new THREE.MeshBasicMaterial({ color: 0xfff1b8, fog: false })',
    'new THREE.SphereGeometry(13.2, 20, 14),\n  new THREE.MeshBasicMaterial({ color: 0xffffee, fog: false, toneMapped: false })',
    'sun core'
  );

  replaceRequired(
    'new THREE.SphereGeometry(18.5, 18, 12),\n  new THREE.MeshBasicMaterial({ color: 0xffd77a, transparent: true, opacity: 0.16, depthWrite: false, fog: false })',
    'new THREE.SphereGeometry(24.0, 20, 14),\n  new THREE.MeshBasicMaterial({ color: 0xffd57d, transparent: true, opacity: 0.22, depthWrite: false, fog: false, toneMapped: false })',
    'sun halo'
  );

  replaceRequired(
    '  opacity: 0.95,\n  depthWrite: false,\n  blending: THREE.AdditiveBlending,',
    '  opacity: 0.66,\n  depthWrite: false,\n  blending: THREE.AdditiveBlending,',
    'sun corona opacity'
  );
  replaceRequired('sunCorona.scale.set(112, 112, 1);', 'sunCorona.scale.set(92, 92, 1);', 'sun corona scale');
  replaceRequired(
    '  opacity: 0.74,\n  depthWrite: false,\n  blending: THREE.AdditiveBlending,',
    '  opacity: 0.10,\n  depthWrite: false,\n  blending: THREE.AdditiveBlending,',
    'sun ray opacity'
  );
  replaceRequired(
    '  opacity: 0.24,\n  depthWrite: false,\n  blending: THREE.AdditiveBlending,',
    '  opacity: 0.10,\n  depthWrite: false,\n  blending: THREE.AdditiveBlending,',
    'sun haze opacity'
  );

  return source;
}
