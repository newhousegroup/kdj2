export function patchGameSource(source) {
  function replaceRequired(search, replacement, label) {
    if (!source.includes(search)) throw new Error(`0.19.3 patch failed: ${label}`);
    source = source.replace(search, replacement);
  }

  // Restore a strong, unmistakable solar disc. Keep the existing lightweight
  // corona, but suppress the long rays so the sun reads as a glowing circle.
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

  replaceRequired('  opacity: 0.95,\n  depthWrite: false,\n  blending: THREE.AdditiveBlending,', '  opacity: 0.66,\n  depthWrite: false,\n  blending: THREE.AdditiveBlending,', 'sun corona opacity');
  replaceRequired('sunCorona.scale.set(112, 112, 1);', 'sunCorona.scale.set(92, 92, 1);', 'sun corona scale');
  replaceRequired('  opacity: 0.74,\n  depthWrite: false,\n  blending: THREE.AdditiveBlending,', '  opacity: 0.10,\n  depthWrite: false,\n  blending: THREE.AdditiveBlending,', 'sun ray opacity');
  replaceRequired('  opacity: 0.24,\n  depthWrite: false,\n  blending: THREE.AdditiveBlending,', '  opacity: 0.10,\n  depthWrite: false,\n  blending: THREE.AdditiveBlending,', 'sun haze opacity');

  // A low-poly lofted hull replaces the prototype box + cone silhouette. This is
  // visual only: gameplay collision and deck movement bounds remain unchanged.
  replaceRequired(
    'function makeShip(team) {',
    `function makePeriodHullGeometry() {
  const stations = [
    { z: -16.45, w: 0.18, top: 4.58, keel: 1.05 },
    { z: -14.65, w: 2.65, top: 4.38, keel: 0.42 },
    { z: -11.35, w: 4.48, top: 4.12, keel: 0.12 },
    { z: -5.20,  w: 4.82, top: 4.02, keel: 0.03 },
    { z:  4.80,  w: 4.88, top: 4.02, keel: 0.03 },
    { z: 11.50,  w: 4.68, top: 4.18, keel: 0.16 },
    { z: 15.25,  w: 4.42, top: 4.52, keel: 0.62 }
  ];
  const positions = [];
  const indices = [];
  const ringSize = 7;

  for (const s of stations) {
    const midY = 2.72 + Math.max(0, s.top - 4.02) * 0.20;
    const lowerY = 1.30 + s.keel * 0.12;
    const ring = [
      [-s.w, s.top],
      [-s.w * 0.985, midY],
      [-s.w * 0.76, lowerY],
      [0, s.keel],
      [s.w * 0.76, lowerY],
      [s.w * 0.985, midY],
      [s.w, s.top]
    ];
    for (const [x, y] of ring) positions.push(x, y, s.z);
  }

  for (let i = 0; i < stations.length - 1; i += 1) {
    for (let j = 0; j < ringSize - 1; j += 1) {
      const a = i * ringSize + j;
      const b = a + 1;
      const c = (i + 1) * ringSize + j + 1;
      const d = (i + 1) * ringSize + j;
      indices.push(a, b, d, b, c, d);
    }
  }

  // Close the stern with a simple transom while leaving the top open for the deck.
  const sternBase = (stations.length - 1) * ringSize;
  const sternCenter = positions.length / 3;
  positions.push(0, 2.40, stations[stations.length - 1].z + 0.01);
  for (let j = 0; j < ringSize - 1; j += 1) {
    indices.push(sternBase + j, sternBase + j + 1, sternCenter);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function makePeriodDeckGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(-4.42, 14.95);
  shape.lineTo(-4.70, 10.5);
  shape.lineTo(-4.76, -7.5);
  shape.lineTo(-4.42, -12.7);
  shape.lineTo(0, -16.20);
  shape.lineTo(4.42, -12.7);
  shape.lineTo(4.76, -7.5);
  shape.lineTo(4.70, 10.5);
  shape.lineTo(4.42, 14.95);
  shape.closePath();
  const geometry = new THREE.ShapeGeometry(shape);
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

function makeShip(team) {`,
    'period hull helpers'
  );

  replaceRequired(
    `  const hull = addBox(exterior, [9.6, 3.8, 24], wood, [0, 2.1, 1.8]);
  const bow = new THREE.Mesh(new THREE.ConeGeometry(5.05, 9, 4, 1), wood);
  bow.rotation.set(-Math.PI / 2, Math.PI / 4, 0);
  bow.position.set(0, 2.1, -14.5);
  exterior.add(bow);
  addBox(exterior, [8.7, 4.1, 6], wood, [0, 2.25, 13.4]);
  addBox(exterior, [9.72, 0.52, 19], stripeMat, [0, 2.45, 2.5]);
  addBox(exterior, [1.1, 1.2, 30], darkWood, [0, 0.35, 0]);
  const deck = addBox(exterior, [9.15, 0.45, 29.5], deckMat, [0, 4.15, 0.4]);`,
    `  const hull = new THREE.Mesh(makePeriodHullGeometry(), wood);
  exterior.add(hull);

  // Slim side bands replace the old solid colour box running through the hull.
  for (const side of [-1, 1]) {
    addBox(exterior, [0.16, 0.46, 19.0], stripeMat, [side * 4.76, 2.48, 2.1]);
    addBox(exterior, [0.20, 0.20, 22.6], darkWood, [side * 4.78, 3.82, 0.2]);
  }
  addBox(exterior, [8.72, 0.46, 0.16], stripeMat, [0, 2.52, 15.18]);
  addBox(exterior, [0.72, 0.80, 29.3], darkWood, [0, 0.48, -0.25]);

  const deck = new THREE.Mesh(makePeriodDeckGeometry(), deckMat);
  deck.position.y = 4.16;
  exterior.add(deck);`,
    'realistic hull shell'
  );

  return source;
}
