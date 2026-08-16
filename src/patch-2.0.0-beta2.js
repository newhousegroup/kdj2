export function patchGameSource(source) {
  function replaceRequired(search, replacement, label) {
    if (!source.includes(search)) throw new Error(`2.0.0-beta2 patch failed: ${label}`);
    source = source.replace(search, replacement);
  }

  replaceRequired(
    'function makePlayer(p) {',
    `function makePlayerNameTag(name, team) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  const safeName = String(name || "Sailor").slice(0, 20);

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "700 46px 'Alan Sans', system-ui, sans-serif";
  ctx.lineJoin = "round";
  ctx.lineWidth = 10;
  ctx.strokeStyle = "rgba(3, 8, 12, 0.88)";
  ctx.strokeText(safeName, canvas.width / 2, 54);
  ctx.fillStyle = "#f7f4ec";
  ctx.fillText(safeName, canvas.width / 2, 54);

  ctx.strokeStyle = team === "british" ? "#d36a6a" : "#7092de";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(194, 99);
  ctx.lineTo(318, 99);
  ctx.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;

  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    toneMapped: false
  });
  const sprite = new THREE.Sprite(material);
  sprite.position.set(0, 3.48, 0);
  sprite.scale.set(4.0, 1.0, 1);
  sprite.renderOrder = 12;
  sprite.userData.playerNameTag = true;
  return sprite;
}

function makePlayer(p) {`,
    'player name-tag helper'
  );

  replaceRequired(
    `  group.userData = {
    leftLeg, rightLeg, leftArm, rightArm,`,
    `  const nameTag = makePlayerNameTag(p.name, p.team);
  group.add(nameTag);

  group.userData = {
    leftLeg, rightLeg, leftArm, rightArm,`,
    'attach player name tag'
  );

  return source;
}
