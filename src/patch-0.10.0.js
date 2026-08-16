export function patchGameSource(source) {
  function replaceRequired(search, replacement, label) {
    if (!source.includes(search)) throw new Error(`0.10.0 patch failed: ${label}`);
    source = source.replace(search, replacement);
  }

  replaceRequired(
    '    p.x = 0;\n    p.z = 9;',
    '    p.x = 0;\n    p.z = 10.65;\n    p.yaw = 0;',
    'helm standing position'
  );

  replaceRequired(
    '    mesh.rotation.y = state.ships[p.ship].heading + (p.yaw || 0) + Math.PI;',
    '    mesh.rotation.y = state.ships[p.ship].heading + (p.role === "captain" ? 0 : (p.yaw || 0)) + Math.PI;',
    'captain body orientation lock'
  );

  replaceRequired(
    '  addCylinder(exterior, 0.12, 1.5, metal, [0, 4.82, 9]);',
    `  addCylinder(exterior, 0.12, 1.5, metal, [0, 4.82, 9]);

  // 0.10.0 detail pass: make the deck read as a working ship instead of a prototype blockout.
  addBox(exterior, [1.72, 0.34, 1.18], darkWood, [0, 4.42, 9.72]);
  addBox(exterior, [1.28, 0.10, 0.82], metal, [0, 4.63, 9.72]);
  addCylinder(exterior, 0.10, 1.35, darkWood, [-0.72, 4.92, 9.72]);
  addCylinder(exterior, 0.10, 1.35, darkWood, [0.72, 4.92, 9.72]);

  // Bowsprit and standing rigging give the bow a proper silhouette.
  addCylinder(exterior, 0.14, 8.4, darkWood, [0, 5.55, -18.15], [Math.PI / 2, 0, 0], 14);
  addRope(exterior, [[0, 5.62, -21.9], [-4.1, 5.05, -12.0]], 0x403328);
  addRope(exterior, [[0, 5.62, -21.9], [4.1, 5.05, -12.0]], 0x403328);
  addRope(exterior, [[0, 5.62, -21.9], [0, 20.45, -9.2]], 0x403328);

  const crowNest = new THREE.Mesh(new THREE.CylinderGeometry(0.84, 0.92, 0.22, 16), darkWood);
  crowNest.position.set(0, 18.45, -9.2);
  exterior.add(crowNest);
  addCylinder(exterior, 0.045, 1.0, metal, [0, 18.92, -9.2]);

  // Hull fittings and gunport-style metal rings.
  for (const side of [-1, 1]) {
    for (const z of [-7.2, -1.4, 4.4, 10.2]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.20, 0.045, 7, 14), metal);
      ring.rotation.y = Math.PI / 2;
      ring.position.set(side * 4.86, 2.95, z);
      exterior.add(ring);
    }

    // Mooring cleats.
    for (const z of [-10.8, 11.8]) {
      addBox(exterior, [0.72, 0.12, 0.18], metal, [side * 3.62, 4.48, z]);
      addCylinder(exterior, 0.07, 0.34, metal, [side * 3.35, 4.61, z]);
      addCylinder(exterior, 0.07, 0.34, metal, [side * 3.89, 4.61, z]);
    }

    const ropeCoil = new THREE.Mesh(
      new THREE.TorusGeometry(0.48, 0.075, 8, 24),
      new THREE.MeshStandardMaterial({ color: 0x8e6b47, roughness: 1 })
    );
    ropeCoil.rotation.x = Math.PI / 2;
    ropeCoil.position.set(side * 3.45, 4.47, 11.0);
    exterior.add(ropeCoil);
  }

  // Stern trim, lanterns and deck grating.
  addBox(exterior, [8.25, 0.18, 0.18], metal, [0, 3.72, 14.58]);
  addBox(exterior, [7.55, 0.13, 0.16], stripeMat, [0, 3.28, 14.61]);
  const lanternMat = new THREE.MeshStandardMaterial({ color: 0xffd98b, emissive: 0xff8f32, emissiveIntensity: 2.1, roughness: 0.5 });
  for (const x of [-3.55, 3.55]) {
    const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.15, 9, 7), lanternMat);
    lantern.position.set(x, 5.52, 14.25);
    exterior.add(lantern);
    addCylinder(exterior, 0.035, 0.62, metal, [x, 5.20, 14.25]);
  }
  for (let x = -1.08; x <= 1.08; x += 0.36) {
    addBox(exterior, [0.055, 0.07, 2.16], darkWood, [x, 4.58, 3.30]);
  }
  for (let z = 2.42; z <= 4.18; z += 0.44) {
    addBox(exterior, [2.22, 0.075, 0.055], darkWood, [0, 4.59, z]);
  }`,
    'ship detail pass'
  );

  replaceRequired(
    'function updateAtmosphere(now) {\n  oceanMaterial.uniforms.uTime.value = now / 1000;',
    'function updateAtmosphere(now) {\n  oceanMaterial.uniforms.uTime.value = now / 1000;\n  // Keep the atmospheric shell centered on the player so the world never reveals a hard edge.\n  ocean.position.x = camera.position.x;\n  ocean.position.z = camera.position.z;\n  sky.position.set(camera.position.x, 0, camera.position.z);\n  clouds.position.set(camera.position.x, 0, camera.position.z);',
    'infinite-world atmosphere tracking'
  );

  return source;
}
