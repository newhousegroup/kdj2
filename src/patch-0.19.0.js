export function patchGameSource(source) {
  const startMarker = "const oceanMaterial = new THREE.ShaderMaterial({";
  const endMarker = "scene.add(ocean);";
  const start = source.indexOf(startMarker);
  const endStart = start >= 0 ? source.indexOf(endMarker, start) : -1;

  if (start < 0 || endStart < 0) {
    throw new Error("0.19.0 patch failed: ocean material block missing");
  }

  const end = endStart + endMarker.length;
  const currentOcean = source.slice(start, end);
  if (!currentOcean.includes("new THREE.PlaneGeometry(1400, 1400, 86, 86)")) {
    throw new Error("0.19.0 patch failed: unexpected ocean geometry");
  }

  const realisticOcean = `const oceanMaterial = new THREE.ShaderMaterial({
  uniforms: { uTime: { value: 0 } },
  vertexShader: \`
    uniform float uTime;
    varying vec3 vWorld;
    varying vec3 vNormalWorld;
    varying float vWave;

    void main() {
      vec3 p = position;
      vec2 q = p.xy;
      float t = uTime;
      float h = 0.0;
      vec2 slope = vec2(0.0);

      vec2 d1 = normalize(vec2(1.0, 0.24));
      vec2 d2 = normalize(vec2(-0.31, 1.0));
      vec2 d3 = normalize(vec2(0.72, -1.0));
      vec2 d4 = normalize(vec2(-1.0, -0.58));
      vec2 d5 = normalize(vec2(0.18, 1.0));

      float ph1 = dot(q, d1) * 0.032 + t * 0.68;
      float ph2 = dot(q, d2) * 0.049 + t * 0.91;
      float ph3 = dot(q, d3) * 0.078 + t * 1.19;
      float ph4 = dot(q, d4) * 0.118 + t * 1.47;
      float ph5 = dot(q, d5) * 0.173 + t * 1.82;

      h += sin(ph1) * 0.34;
      h += sin(ph2) * 0.23;
      h += sin(ph3) * 0.14;
      h += sin(ph4) * 0.075;
      h += sin(ph5) * 0.035;

      slope += cos(ph1) * 0.34 * 0.032 * d1;
      slope += cos(ph2) * 0.23 * 0.049 * d2;
      slope += cos(ph3) * 0.14 * 0.078 * d3;
      slope += cos(ph4) * 0.075 * 0.118 * d4;
      slope += cos(ph5) * 0.035 * 0.173 * d5;

      // A tiny amount of horizontal chop keeps silhouettes from reading as a
      // perfectly regular height field, without adding geometry or a texture.
      p.xy += d1 * cos(ph1) * 0.055 + d2 * cos(ph2) * 0.035;
      p.z += h;

      vec3 localNormal = normalize(vec3(-slope.x, -slope.y, 1.0));
      vNormalWorld = normalize(mat3(modelMatrix) * localNormal);
      vec4 world = modelMatrix * vec4(p, 1.0);
      vWorld = world.xyz;
      vWave = h;
      gl_Position = projectionMatrix * viewMatrix * world;
    }
  \`,
  fragmentShader: \`
    varying vec3 vWorld;
    varying vec3 vNormalWorld;
    varying float vWave;

    void main() {
      vec3 N = normalize(vNormalWorld);
      vec3 V = normalize(cameraPosition - vWorld);
      vec3 L = normalize(vec3(0.52, 0.78, 0.36));

      float ndv = clamp(dot(N, V), 0.0, 1.0);
      float f = 1.0 - ndv;
      float f2 = f * f;
      float fresnel = 0.025 + 0.76 * f2 * f2 * f;

      vec3 reflected = reflect(-V, N);
      float skyAmount = smoothstep(-0.15, 0.82, reflected.y);
      vec3 horizonSky = vec3(0.34, 0.58, 0.67);
      vec3 upperSky = vec3(0.16, 0.39, 0.56);
      vec3 skyReflection = mix(horizonSky, upperSky, skyAmount);

      float crest = smoothstep(0.30, 0.70, vWave);
      float trough = smoothstep(-0.72, -0.18, vWave);
      vec3 deepWater = vec3(0.012, 0.085, 0.125);
      vec3 faceWater = vec3(0.025, 0.205, 0.275);
      vec3 base = mix(deepWater, faceWater, 0.42 + crest * 0.32 - trough * 0.12);

      float diffuse = 0.72 + 0.28 * max(dot(N, L), 0.0);
      vec3 color = base * diffuse;
      color = mix(color, skyReflection, fresnel);

      // Sun glint without an expensive reflection pass. Repeated squaring gives
      // a tight highlight while staying cheaper than a high-exponent pow().
      vec3 H = normalize(L + V);
      float spec = max(dot(N, H), 0.0);
      spec *= spec;
      spec *= spec;
      spec *= spec;
      spec *= spec;
      spec *= spec;
      color += vec3(1.0, 0.88, 0.66) * spec * 1.65;

      // Only the highest crests brighten, suggesting thin aerated water rather
      // than drawing obvious repeating white sine-wave stripes.
      float foam = smoothstep(0.62, 0.79, vWave) * (0.35 + 0.65 * (1.0 - ndv));
      color = mix(color, vec3(0.72, 0.84, 0.84), foam * 0.30);

      float distanceToCamera = length(cameraPosition.xz - vWorld.xz);
      float haze = smoothstep(250.0, 590.0, distanceToCamera);
      color = mix(color, horizonSky, haze * 0.74);

      gl_FragColor = vec4(color, 1.0);
    }
  \`
});
const ocean = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400, 86, 86), oceanMaterial);
ocean.rotation.x = -Math.PI / 2;
ocean.receiveShadow = true;
scene.add(ocean);`;

  return source.slice(0, start) + realisticOcean + source.slice(end);
}
