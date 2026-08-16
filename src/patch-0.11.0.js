export function patchGameSource011(source) {
  function replaceRequired(search, replacement, label) {
    if (!source.includes(search)) throw new Error(`0.11.0 patch failed: ${label}`);
    source = source.replace(search, replacement);
  }

  // Task 1: the public speed scale remains 0-35, but only whole numbers are displayed.
  replaceRequired(
    '  const displaySpeed = THREE.MathUtils.clamp((Math.abs(safeSpeed) / 6.03) * 35, 0, 35);\n  if (ui.speedText) ui.speedText.textContent = displaySpeed < 0.1 ? "Speed 0.0" : (safeSpeed < 0 ? "Speed " + displaySpeed.toFixed(1) + " REV" : "Speed " + displaySpeed.toFixed(1));',
    '  const displaySpeed = THREE.MathUtils.clamp((Math.abs(safeSpeed) / 6.03) * 35, 0, 35);\n  const displaySpeedInt = Math.round(displaySpeed);\n  if (ui.speedText) ui.speedText.textContent = displaySpeedInt <= 0 ? "Speed 0" : (safeSpeed < 0 ? "Speed " + displaySpeedInt + " REV" : "Speed " + displaySpeedInt);',
    'integer speed display'
  );

  // Task 2: one fixed world-space island. It deliberately does NOT follow the camera,
  // so it works as a visual reference for heading and apparent movement.
  replaceRequired(
    'scene.add(world, effects);',
    `scene.add(world, effects);

const referenceIsland = new THREE.Group();
referenceIsland.position.set(28, 0, 185);
referenceIsland.rotation.y = 0.24;
const islandRockMat = new THREE.MeshStandardMaterial({ color: 0x5c5446, roughness: 0.98 });
const islandSandMat = new THREE.MeshStandardMaterial({ color: 0xc8ad72, roughness: 1 });
const islandGreenMat = new THREE.MeshStandardMaterial({ color: 0x496b3d, roughness: 0.96 });
const islandTrunkMat = new THREE.MeshStandardMaterial({ color: 0x59402b, roughness: 1 });
const islandLeafMat = new THREE.MeshStandardMaterial({ color: 0x355d37, roughness: 0.94 });

const islandRock = new THREE.Mesh(new THREE.CylinderGeometry(42, 50, 7, 20), islandRockMat);
islandRock.position.y = -1.0;
referenceIsland.add(islandRock);
const islandShore = new THREE.Mesh(new THREE.CylinderGeometry(35, 43, 3.4, 20), islandSandMat);
islandShore.position.y = 2.0;
referenceIsland.add(islandShore);
const islandCrown = new THREE.Mesh(new THREE.CylinderGeometry(25, 33, 3.8, 18), islandGreenMat);
islandCrown.position.y = 4.25;
referenceIsland.add(islandCrown);
const islandHill = new THREE.Mesh(new THREE.ConeGeometry(19, 14, 16), islandRockMat);
islandHill.position.set(-4, 11.1, 4);
referenceIsland.add(islandHill);
const hillCap = new THREE.Mesh(new THREE.ConeGeometry(15.5, 8.0, 16), islandGreenMat);
hillCap.position.set(-4, 14.6, 4);
referenceIsland.add(hillCap);

for (const [x, z, scale] of [[-13, -4, 1], [10, 3, 0.9], [3, -12, 0.75], [-1, 12, 0.8]]) {
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.55 * scale, 0.78 * scale, 8 * scale, 8), islandTrunkMat);
  trunk.position.set(x, 9.2 * scale, z);
  trunk.rotation.z = (x % 3) * 0.025;
  referenceIsland.add(trunk);
  const leavesLow = new THREE.Mesh(new THREE.ConeGeometry(4.3 * scale, 6.0 * scale, 9), islandLeafMat);
  leavesLow.position.set(x, 14.0 * scale, z);
  referenceIsland.add(leavesLow);
  const leavesHigh = new THREE.Mesh(new THREE.ConeGeometry(3.3 * scale, 5.0 * scale, 9), islandLeafMat);
  leavesHigh.position.set(x, 17.0 * scale, z);
  referenceIsland.add(leavesHigh);
}
setShadows(referenceIsland);
world.add(referenceIsland);`,
    'single reference island'
  );

  // Task 5: a physical sun disc/halo aligned with the existing directional light and sky glow.
  replaceRequired(
    'scene.add(sun);',
    `scene.add(sun);

const visualSunDirection = new THREE.Vector3(0.45, 0.65, 0.3).normalize();
const visualSun = new THREE.Group();
const sunDisc = new THREE.Mesh(
  new THREE.SphereGeometry(11.5, 18, 12),
  new THREE.MeshBasicMaterial({ color: 0xfff1b8, fog: false })
);
visualSun.add(sunDisc);
const sunHalo = new THREE.Mesh(
  new THREE.SphereGeometry(18.5, 18, 12),
  new THREE.MeshBasicMaterial({ color: 0xffd77a, transparent: true, opacity: 0.16, depthWrite: false, fog: false })
);
visualSun.add(sunHalo);
scene.add(visualSun);`,
    'visible sun'
  );

  replaceRequired(
    '  clouds.position.set(camera.position.x, 0, camera.position.z);',
    '  clouds.position.set(camera.position.x, 0, camera.position.z);\n  visualSun.position.copy(camera.position).addScaledVector(visualSunDirection, 520);',
    'sun atmosphere tracking'
  );

  // Task 3: enemy bearing line in the opponent team colour. Off-ribbon bearings pin
  // to the correct faded edge instead of disappearing, so it remains useful at all headings.
  replaceRequired(
    '  const halfView = 62.5;\n  for (const mark of compass.querySelectorAll("[data-bearing]")) {',
    `  const halfView = 62.5;
  const enemyTeam = p.team === "british" ? "french" : "british";
  const enemyShip = state.ships[enemyTeam];
  let enemyLine = compass.querySelector(".enemy-bearing-line");
  if (!enemyLine) {
    enemyLine = document.createElement("span");
    enemyLine.className = "enemy-bearing-line";
    enemyLine.setAttribute("aria-label", "Enemy bearing");
    Object.assign(enemyLine.style, {
      position: "absolute",
      top: "5px",
      bottom: "5px",
      width: "3px",
      borderRadius: "999px",
      transform: "translateX(-50%)",
      zIndex: "6",
      pointerEvents: "none"
    });
    compass.appendChild(enemyLine);
  }
  if (enemyShip) {
    const enemyBearing = ((THREE.MathUtils.radToDeg(Math.atan2(enemyShip.x - ship.x, enemyShip.z - ship.z)) % 360) + 360) % 360;
    const enemyDiff = ((enemyBearing - heading + 540) % 360) - 180;
    const pinnedDiff = THREE.MathUtils.clamp(enemyDiff, -halfView, halfView);
    const enemyColor = "#" + TEAM[enemyTeam].color.toString(16).padStart(6, "0");
    enemyLine.style.left = (50 + (pinnedDiff / halfView) * 48) + "%";
    enemyLine.style.background = enemyColor;
    enemyLine.style.boxShadow = "0 0 8px " + enemyColor;
    enemyLine.style.opacity = Math.abs(enemyDiff) <= halfView ? "0.96" : "0.34";
    enemyLine.title = TEAM[enemyTeam].label + " ship bearing";
  }
  for (const mark of compass.querySelectorAll("[data-bearing]")) {`,
    'enemy compass bearing'
  );

  // Task 4: use the plank texture below deck, then layer in structural beams, bunks,
  // shelving, crates, a ladder, rope and fittings while keeping the centre walkway readable.
  replaceRequired(
    '  const lowerFloor = addBox(lower, [8.2, 0.22, 25], interiorWood, [0, LOWER_FLOOR_Y, 0]);',
    '  const lowerFloor = addBox(lower, [8.2, 0.22, 25], deckMat, [0, LOWER_FLOOR_Y, 0]);',
    'lower-deck plank floor'
  );

  replaceRequired(
    '  lower.visible = false;',
    `  // 0.11.0 lower-deck detail pass.
  const lowerCloth = new THREE.MeshStandardMaterial({ color: team === "british" ? 0x7d3f3f : 0x3e5688, roughness: 1 });
  const crateMat = new THREE.MeshStandardMaterial({ color: 0x755038, roughness: 0.98 });
  const ropeMat = new THREE.MeshStandardMaterial({ color: 0x987651, roughness: 1 });

  for (const z of [-10, -5, 0, 5, 10]) {
    addBox(lower, [7.75, 0.16, 0.22], darkWood, [0, lowerCeilingY - 0.28, z]);
    for (const side of [-1, 1]) addCylinder(lower, 0.09, wallHeight - 0.2, darkWood, [side * 3.58, wallCenter, z]);
  }

  for (const side of [-1, 1]) {
    // Side-wall planking/rub rails.
    for (const y of [1.3, 2.1, 2.9]) addBox(lower, [0.10, 0.10, 23.2], darkWood, [side * 3.88, y, 0]);

    // Two stacked bunks per side, kept close to the wall so the central route stays open.
    for (const z of [-5.0, 6.0]) {
      for (const y of [1.15, 2.25]) {
        addBox(lower, [1.05, 0.12, 3.05], darkWood, [side * 3.22, y, z]);
        addBox(lower, [0.92, 0.10, 2.72], lowerCloth, [side * 3.20, y + 0.11, z]);
      }
      addCylinder(lower, 0.055, 2.35, darkWood, [side * 2.73, 1.75, z - 1.35]);
      addCylinder(lower, 0.055, 2.35, darkWood, [side * 2.73, 1.75, z + 1.35]);
    }

    // Storage shelving and small crates.
    for (const z of [-9.2, 0.3, 9.4]) {
      addBox(lower, [0.34, 0.10, 2.8], darkWood, [side * 3.64, 1.45, z]);
      addBox(lower, [0.34, 0.10, 2.8], darkWood, [side * 3.64, 2.55, z]);
      const crate = addBox(lower, [0.92, 0.72, 0.92], crateMat, [side * 3.08, 1.08, z]);
      crate.rotation.y = z * 0.025;
    }

    const wallCoil = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.07, 8, 22), ropeMat);
    wallCoil.rotation.y = Math.PI / 2;
    wallCoil.position.set(side * 3.73, 2.35, -1.8);
    lower.add(wallCoil);
  }

  // Ladder directly beneath the hatch area.
  for (const x of [-0.48, 0.48]) addCylinder(lower, 0.055, 2.75, darkWood, [x, 2.15, 3.28]);
  for (let y = 1.0; y <= 3.2; y += 0.42) addCylinder(lower, 0.045, 0.98, darkWood, [0, y, 3.28], [0, 0, Math.PI / 2]);

  // Small side benches and metal braces give the space more structure without blocking combat routes.
  for (const side of [-1, 1]) {
    addBox(lower, [1.15, 0.16, 2.5], interiorWood, [side * 2.95, 1.02, -10.2]);
    for (const z of [-11.0, -9.4]) addCylinder(lower, 0.05, 0.75, metal, [side * 2.95, 0.72, z]);
  }

  lower.visible = false;`,
    'lower-deck furnishing pass'
  );

  return source;
}
