export function patchGameSource(source) {
  function replaceRequired(search, replacement, label) {
    if (!source.includes(search)) throw new Error(`0.12.0 patch failed: ${label}`);
    source = source.replace(search, replacement);
  }

  // Procedural national flags keep the game lightweight while giving both ships
  // recognizable country flags instead of a plain team-colour rectangle.
  replaceRequired(
    'function makeShip(team) {',
    `function countryFlagTexture(team) {
  const canvas = document.createElement("canvas");
  canvas.width = 384;
  canvas.height = 192;
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;

  if (team === "french") {
    ctx.fillStyle = "#153f8f";
    ctx.fillRect(0, 0, w / 3, h);
    ctx.fillStyle = "#f6f3e9";
    ctx.fillRect(w / 3, 0, w / 3, h);
    ctx.fillStyle = "#d72b3f";
    ctx.fillRect((w * 2) / 3, 0, w / 3, h);
  } else {
    ctx.fillStyle = "#183a78";
    ctx.fillRect(0, 0, w, h);

    const drawDiagonal = (stroke, width, offset = 0) => {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = width;
      ctx.lineCap = "butt";
      ctx.beginPath();
      ctx.moveTo(-18 + offset, -10);
      ctx.lineTo(w + 18 + offset, h + 10);
      ctx.moveTo(w + 18 - offset, -10);
      ctx.lineTo(-18 - offset, h + 10);
      ctx.stroke();
    };

    drawDiagonal("#f6f3e9", 42);
    drawDiagonal("#c9253b", 18, 7);

    ctx.fillStyle = "#f6f3e9";
    ctx.fillRect(w * 0.405, 0, w * 0.19, h);
    ctx.fillRect(0, h * 0.33, w, h * 0.34);
    ctx.fillStyle = "#c9253b";
    ctx.fillRect(w * 0.455, 0, w * 0.09, h);
    ctx.fillRect(0, h * 0.405, w, h * 0.19);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function makeShip(team) {`,
    'national flag texture helper'
  );

  replaceRequired(
    `  const flag = new THREE.Mesh(
    new THREE.PlaneGeometry(2.6, 1.25),
    new THREE.MeshStandardMaterial({ color: TEAM[team].color, side: THREE.DoubleSide, roughness: 0.75 })
  );`,
    `  const flag = new THREE.Mesh(
    billowGeometry(2.6, 1.25, 0.13),
    new THREE.MeshStandardMaterial({ map: countryFlagTexture(team), color: 0xffffff, side: THREE.DoubleSide, roughness: 0.76 })
  );`,
    'stern national flag'
  );

  replaceRequired(
    `  const lowerFlag = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 1),
    new THREE.MeshStandardMaterial({ color: TEAM[team].color, side: THREE.DoubleSide })
  );`,
    `  const lowerFlag = new THREE.Mesh(
    billowGeometry(2, 1, 0.08),
    new THREE.MeshStandardMaterial({ map: countryFlagTexture(team), color: 0xffffff, side: THREE.DoubleSide, roughness: 0.8 })
  );`,
    'lower-deck national flag'
  );

  // Layer period-inspired uniform details over the lightweight sailor model. The
  // British reference reads as a red-coated shako uniform; the French reference
  // reads as a dark naval-blue uniform with pale cross-belts and gold details.
  replaceRequired(
    '  group.add(hat);\n\n  group.userData = {',
    `  group.add(hat);

  const uniformGold = new THREE.MeshStandardMaterial({ color: 0xd7b56d, metalness: 0.12, roughness: 0.58 });
  const uniformIvory = new THREE.MeshStandardMaterial({ color: 0xe8e0ce, roughness: 0.86 });
  const uniformRed = new THREE.MeshStandardMaterial({ color: 0xb92f35, roughness: 0.8 });
  const uniformBlue = new THREE.MeshStandardMaterial({ color: 0x173c72, roughness: 0.8 });
  const uniformBlack = new THREE.MeshStandardMaterial({ color: 0x15191d, roughness: 0.72 });
  const trouserMat = p.team === "british" ? uniformIvory : uniformBlue;
  const trimMat = p.team === "british" ? uniformGold : uniformIvory;

  // Breeches/trousers above the existing black boots.
  for (const x of [-0.22, 0.22]) {
    addBox(group, [0.32, 0.46, 0.34], trouserMat, [x, 0.61, 0.01]);
    addBox(group, [0.34, 0.07, 0.36], uniformBlack, [x, 0.35, 0.01]);
  }

  // High collar, waist seam and coat tails.
  addBox(group, [0.50, 0.11, 0.08], uniformBlack, [0, 1.74, 0.36]);
  addBox(group, [0.72, 0.055, 0.07], trimMat, [0, 0.96, 0.38]);
  for (const x of [-0.22, 0.22]) addBox(group, [0.28, 0.42, 0.09], coat, [x, 0.81, -0.34], [0.10, 0, x < 0 ? -0.08 : 0.08]);

  // Cuffs and shoulder epaulettes.
  const cuffMat = p.team === "british" ? uniformBlack : uniformRed;
  addBox(leftArm, [0.27, 0.15, 0.29], cuffMat, [0, -0.68, 0]);
  addBox(rightArm, [0.27, 0.15, 0.29], cuffMat, [0, -0.68, 0]);
  for (const x of [-0.52, 0.52]) {
    addBox(group, [0.32, 0.075, 0.34], uniformGold, [x, 1.68, 0]);
    for (let i = -1; i <= 1; i += 1) addBox(group, [0.035, 0.13, 0.22], uniformGold, [x + i * 0.07, 1.59, 0.03]);
  }

  if (p.team === "british") {
    // Horizontal lace/braid rows and a central line of brass buttons.
    for (let i = 0; i < 6; i += 1) {
      const y = 1.10 + i * 0.105;
      addBox(group, [0.52, 0.028, 0.045], uniformIvory, [0, y, 0.455]);
      const button = new THREE.Mesh(new THREE.SphereGeometry(0.035, 7, 5), uniformGold);
      button.position.set(0, y, 0.482);
      group.add(button);
    }
  } else {
    // French naval styling: pale cross-belts over blue coat and brass buttons.
    const leftBelt = addBox(group, [0.11, 0.90, 0.055], uniformIvory, [-0.16, 1.37, 0.445]);
    leftBelt.rotation.z = -0.48;
    const rightBelt = addBox(group, [0.11, 0.90, 0.055], uniformIvory, [0.16, 1.37, 0.445]);
    rightBelt.rotation.z = 0.48;
    addBox(group, [0.68, 0.08, 0.055], uniformIvory, [0, 1.02, 0.445]);
    for (let i = 0; i < 5; i += 1) {
      const button = new THREE.Mesh(new THREE.SphereGeometry(0.034, 7, 5), uniformGold);
      button.position.set(0, 1.13 + i * 0.13, 0.485);
      group.add(button);
    }
  }

  // Taller shako silhouette, band, front plate/cockade and plume.
  hat.scale.y = 1.35;
  hat.position.y = 2.40;
  const hatBand = new THREE.Mesh(new THREE.CylinderGeometry(0.355, 0.365, 0.055, 14), p.team === "british" ? uniformIvory : uniformGold);
  hatBand.position.y = 2.34;
  group.add(hatBand);
  const hatPlate = addBox(group, [0.16, 0.13, 0.045], uniformGold, [0, 2.46, 0.34]);
  hatPlate.rotation.x = -0.06;

  if (p.team === "british") {
    const plumeRed = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.075, 0.18, 7), uniformRed);
    plumeRed.position.set(0.10, 2.72, 0);
    group.add(plumeRed);
    const plumeWhite = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 0.18, 7), uniformIvory);
    plumeWhite.position.set(0.10, 2.89, 0);
    group.add(plumeWhite);
  } else {
    const plume = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.075, 0.25, 7), uniformRed);
    plume.position.set(0.10, 2.78, 0);
    group.add(plume);
    for (const [x, mat] of [[-0.07, uniformBlue], [0, uniformIvory], [0.07, uniformRed]]) {
      const cockade = new THREE.Mesh(new THREE.SphereGeometry(0.045, 7, 5), mat);
      cockade.position.set(x, 2.54, 0.365);
      group.add(cockade);
    }
  }

  group.userData = {`,
    'period uniform detail pass'
  );

  // Extra shoreline geology and vegetation make the single reference island read as
  // an actual place while retaining one island and the existing collision boundary.
  replaceRequired(
    'setShadows(referenceIsland);\nworld.add(referenceIsland);',
    `const islandBoulderMat = new THREE.MeshStandardMaterial({ color: 0x756b5b, roughness: 1 });
const islandBushMat = new THREE.MeshStandardMaterial({ color: 0x3f7042, roughness: 0.98 });
const islandDryGrassMat = new THREE.MeshStandardMaterial({ color: 0x788346, roughness: 1 });

for (const [x, z, s, rot] of [
  [-35, -8, 2.7, 0.1], [-30, 22, 2.0, 0.6], [-12, 37, 2.5, 0.3],
  [13, 38, 1.9, 0.9], [34, 19, 2.9, 0.2], [39, -7, 2.2, 0.7],
  [25, -31, 2.4, 0.4], [-3, -39, 1.8, 1.0], [-25, -29, 2.5, 0.5]
]) {
  const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), islandBoulderMat);
  rock.position.set(x, 3.6 + s * 0.22, z);
  rock.rotation.set(rot * 0.5, rot, rot * 0.25);
  rock.scale.y = 0.62;
  referenceIsland.add(rock);
}

for (const [x, z, s] of [
  [-20, 7, 1.1], [-15, 17, 0.85], [5, 18, 1.0], [17, 11, 0.8],
  [20, -8, 0.95], [9, -21, 0.82], [-11, -20, 0.92], [-24, -9, 0.78]
]) {
  const bush = new THREE.Mesh(new THREE.IcosahedronGeometry(2.15 * s, 1), islandBushMat);
  bush.position.set(x, 6.1 + s, z);
  bush.scale.set(1.25, 0.72, 1.0);
  referenceIsland.add(bush);
}

// Two small beach palms and dry-grass clumps add a second vegetation silhouette.
for (const [x, z, lean] of [[-27, 6, -0.12], [25, 7, 0.10]]) {
  const palm = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.42, 7.0, 8), islandTrunkMat);
  trunk.position.y = 3.5;
  trunk.rotation.z = lean;
  palm.add(trunk);
  for (let i = 0; i < 6; i += 1) {
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.62, 5.2, 5), islandLeafMat);
    leaf.position.y = 7.0;
    leaf.rotation.z = Math.PI / 2.5;
    leaf.rotation.y = (i / 6) * Math.PI * 2;
    leaf.position.x = Math.cos((i / 6) * Math.PI * 2) * 1.05;
    leaf.position.z = Math.sin((i / 6) * Math.PI * 2) * 1.05;
    palm.add(leaf);
  }
  palm.position.set(x, 4.6, z);
  referenceIsland.add(palm);
}

for (const [x, z, r] of [[-8, 25, 0.2], [14, 27, -0.3], [29, -17, 0.7], [-31, -16, -0.6]]) {
  const drift = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.18, 4.0, 7), islandTrunkMat);
  drift.rotation.set(Math.PI / 2, r, Math.PI / 2 + r * 0.2);
  drift.position.set(x, 4.0, z);
  referenceIsland.add(drift);
}

for (const [x, z, s] of [[-8, 4, 1], [8, 8, 0.8], [-3, -10, 0.9], [15, -3, 0.7], [-18, -3, 0.75]]) {
  const grass = new THREE.Mesh(new THREE.ConeGeometry(1.5 * s, 2.2 * s, 7), islandDryGrassMat);
  grass.position.set(x, 6.2, z);
  referenceIsland.add(grass);
}

setShadows(referenceIsland);
world.add(referenceIsland);`,
    'island detail pass'
  );

  return source;
}
