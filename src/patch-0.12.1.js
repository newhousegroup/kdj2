export function patchGameSource(source) {
  function replaceRequired(search, replacement, label) {
    if (!source.includes(search)) throw new Error(`0.12.1 patch failed: ${label}`);
    source = source.replace(search, replacement);
  }

  // Upgrade the visible sun from a simple disc/halo into a layered atmospheric
  // source with additive bloom and soft radial light rays. This stays lightweight
  // enough for browser/mobile rendering and follows the same sun direction as the
  // existing directional light.
  replaceRequired(
    'visualSun.add(sunHalo);\nscene.add(visualSun);',
    `visualSun.add(sunHalo);

function makeSunCoronaTexture(size = 256) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const c = size / 2;
  const gradient = ctx.createRadialGradient(c, c, 0, c, c, c);
  gradient.addColorStop(0.00, "rgba(255,250,214,1)");
  gradient.addColorStop(0.10, "rgba(255,238,174,0.96)");
  gradient.addColorStop(0.28, "rgba(255,205,112,0.46)");
  gradient.addColorStop(0.58, "rgba(255,181,77,0.12)");
  gradient.addColorStop(1.00, "rgba(255,160,55,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeSunRayTexture(size = 512) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const c = size / 2;
  ctx.translate(c, c);

  const rayCount = 28;
  for (let i = 0; i < rayCount; i += 1) {
    const angle = (i / rayCount) * Math.PI * 2 + Math.sin(i * 7.13) * 0.035;
    const length = size * (0.26 + ((i * 37) % 17) / 95);
    const halfWidth = size * (0.004 + ((i * 19) % 9) / 2300);
    ctx.save();
    ctx.rotate(angle);
    const ray = ctx.createLinearGradient(0, 0, length, 0);
    ray.addColorStop(0, "rgba(255,244,198,0.34)");
    ray.addColorStop(0.18, "rgba(255,224,154,0.20)");
    ray.addColorStop(0.64, "rgba(255,199,111,0.055)");
    ray.addColorStop(1, "rgba(255,186,91,0)");
    ctx.fillStyle = ray;
    ctx.beginPath();
    ctx.moveTo(size * 0.035, -halfWidth);
    ctx.lineTo(length, 0);
    ctx.lineTo(size * 0.035, halfWidth);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // Softer four-point glare gives the sun a cinematic lens-like sparkle without
  // turning the whole scene into a post-processing effect.
  for (const angle of [0, Math.PI / 2]) {
    ctx.save();
    ctx.rotate(angle);
    const glare = ctx.createLinearGradient(-size * 0.44, 0, size * 0.44, 0);
    glare.addColorStop(0, "rgba(255,235,184,0)");
    glare.addColorStop(0.42, "rgba(255,239,193,0.05)");
    glare.addColorStop(0.50, "rgba(255,250,225,0.28)");
    glare.addColorStop(0.58, "rgba(255,239,193,0.05)");
    glare.addColorStop(1, "rgba(255,235,184,0)");
    ctx.fillStyle = glare;
    ctx.fillRect(-size * 0.44, -size * 0.009, size * 0.88, size * 0.018);
    ctx.restore();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const sunCorona = new THREE.Sprite(new THREE.SpriteMaterial({
  map: makeSunCoronaTexture(),
  color: 0xffffff,
  transparent: true,
  opacity: 0.95,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  fog: false
}));
sunCorona.scale.set(112, 112, 1);
sunCorona.renderOrder = 3;
visualSun.add(sunCorona);

const sunRays = new THREE.Sprite(new THREE.SpriteMaterial({
  map: makeSunRayTexture(),
  color: 0xfff0c2,
  transparent: true,
  opacity: 0.74,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  fog: false
}));
sunRays.scale.set(238, 238, 1);
sunRays.renderOrder = 2;
visualSun.add(sunRays);

const sunHaze = new THREE.Sprite(new THREE.SpriteMaterial({
  map: makeSunCoronaTexture(192),
  color: 0xffc978,
  transparent: true,
  opacity: 0.24,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  fog: false
}));
sunHaze.scale.set(205, 205, 1);
sunHaze.renderOrder = 1;
visualSun.add(sunHaze);

scene.add(visualSun);`,
    'premium sun rays'
  );

  return source;
}
