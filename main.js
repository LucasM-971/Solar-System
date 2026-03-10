import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';


const scene = new THREE.Scene();
const sizes = { width: window.innerWidth, height: window.innerHeight };
const canvas = document.getElementById('webgl');

const IS_TOUCH_DEVICE = window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
const IS_LOW_MEMORY_DEVICE = typeof navigator.deviceMemory === 'number' && navigator.deviceMemory <= 4;

const camera = new THREE.PerspectiveCamera(60, sizes.width / sizes.height, 0.01, 200000);
camera.position.set(0, 160, 550);
scene.add(camera);

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: !IS_TOUCH_DEVICE,
  logarithmicDepthBuffer: !IS_TOUCH_DEVICE,
  powerPreference: IS_TOUCH_DEVICE ? 'low-power' : 'high-performance',
});
renderer.setSize(sizes.width, sizes.height);
const LOW_QUALITY = IS_TOUCH_DEVICE || IS_LOW_MEMORY_DEVICE || renderer.capabilities.maxTextureSize <= 4096;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, LOW_QUALITY ? 1.25 : 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.maxDistance = 80000;
controls.target.set(0, 0, 0);
controls.update();

const TL = new THREE.TextureLoader();
const MAX_ANISOTROPY = LOW_QUALITY ? Math.min(2, renderer.capabilities.getMaxAnisotropy()) : renderer.capabilities.getMaxAnisotropy();

function solidTexture(hex) {
  const c = new THREE.Color(hex);
  const data = new Uint8Array([
    Math.round(c.r * 255),
    Math.round(c.g * 255),
    Math.round(c.b * 255),
    255,
  ]);
  const t = new THREE.DataTexture(data, 1, 1, THREE.RGBAFormat);
  t.needsUpdate = true;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const BLACK_TEX = solidTexture(0x000000);
const SUN_FALLBACK_TEX = solidTexture(0xffa63a);

function loadTex(path, srgb = false) {
  const t = TL.load(path);
  t.anisotropy = MAX_ANISOTROPY;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const earthDayTex    = loadTex('/texture/earth-texture.jpg', true);
const earthNightTex  = LOW_QUALITY ? BLACK_TEX : loadTex('/texture/8k_earth_nightmap.jpg', true);
const earthCloudsTex = LOW_QUALITY ? null : loadTex('/texture/8k_earth_clouds.jpg', false);
if (earthCloudsTex) earthCloudsTex.wrapS = THREE.RepeatWrapping;

const tex = {
  mercure : LOW_QUALITY ? null : loadTex('/texture/8k_mercury.jpg', true),
  venus   : loadTex('/texture/4k_venus_atmosphere.jpg', true),
  mars    : LOW_QUALITY ? null : loadTex('/texture/8k_mars.jpg', true),
  jupiter : LOW_QUALITY ? null : loadTex('/texture/8k_jupiter.jpg', true),
  saturn  : loadTex('/texture/saturn.jpg',       true),
  ring    : loadTex('/texture/saturn-ring.png',  false),
  uranus  : loadTex('/texture/2k_uranus.jpg',    true),
  neptune : loadTex('/texture/2k_neptune.jpg',   true),
  sun     : LOW_QUALITY ? SUN_FALLBACK_TEX : loadTex('/texture/8k_sun.jpg', true),
  moon    : LOW_QUALITY ? null : loadTex('/texture/8k_moon.jpg', true),
  stars   : LOW_QUALITY ? null : loadTex('/texture/8k_stars.jpg', true),
};

if (tex.stars) {
  scene.add(new THREE.Mesh(
    new THREE.SphereGeometry(90000, LOW_QUALITY ? 24 : 64, LOW_QUALITY ? 24 : 64),
    new THREE.MeshBasicMaterial({ map: tex.stars, side: THREE.BackSide })
  ));
}

// ─────────────────────────────────────────────────────────────
// FIX #1 — Earth ShaderMaterial
// Problème : vNormalWorld utilisait normalMatrix (view space) mais
// sunDir est en world space → dot product incohérent → éclairage faux.
// Fix : on calcule la normale en world space via modelMatrix directement,
// ET on expose le sunDir en world space depuis le JS.
// ─────────────────────────────────────────────────────────────
const earthMat = new THREE.ShaderMaterial({
  uniforms: {
    dayMap   : { value: earthDayTex   },
    nightMap : { value: earthNightTex },
    // sunDir est maintenant en WORLD space (mis à jour chaque frame ci-dessous)
    sunDir   : { value: new THREE.Vector3(1, 0, 0) },
  },
  vertexShader: `
    varying vec2 vUv;
    varying vec3 vNormalWorld;
    void main() {
      vUv = uv;
      // Normale en world space : on utilise modelMatrix (pas normalMatrix qui est en view)
      vNormalWorld = normalize(mat3(modelMatrix) * normal);
      gl_Position  = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D dayMap;
    uniform sampler2D nightMap;
    uniform vec3      sunDir;      // world space, normalisé côté JS
    varying vec2  vUv;
    varying vec3  vNormalWorld;

    void main() {
      float diff  = dot(vNormalWorld, sunDir);          // tous deux en world space ✓
      float blend = smoothstep(-0.15, 0.25, diff);

      vec3 day    = texture2D(dayMap,   vUv).rgb;
      vec3 night  = texture2D(nightMap, vUv).rgb;

      // Légère lueur atmosphérique sur le terminator
      float atmo  = smoothstep(-0.4, 0.1, diff) * (1.0 - smoothstep(0.0, 0.4, diff));
      vec3 rim    = vec3(0.15, 0.35, 0.9) * atmo * 0.55;

      vec3 col    = mix(night, day, blend) + rim;
      gl_FragColor = vec4(col, 1.0);
    }
  `,
});

const cloudMat = earthCloudsTex ? new THREE.MeshStandardMaterial({
  map:         earthCloudsTex,
  transparent: true,
  opacity:     0.4,
  depthWrite:  false,
  roughness:   1.0,
}) : null;

const atmMat = new THREE.MeshStandardMaterial({
  color:       0x1166ff,
  transparent: true,
  opacity:     0.055,
  side:        THREE.BackSide,
  depthWrite:  false,
  roughness:   1.0,
});

function scaleDist(ua) {
  if (ua <= 1.6) return ua * 220.0;
  return 450.0 + (ua - 1.6) * 90.0;
}
function scaleRadius(km) {
  return (km / 6371) * 2.0;
}

const J2000   = 2451545.0;
const nowDate = new Date();
const JD_now  = (nowDate.getTime() / 86400000) + 2440587.5;
const T       = JD_now - J2000;

function initialAngle(M0_deg, period_days) {
  const M = (M0_deg + (360.0 / period_days) * T) % 360;
  return THREE.MathUtils.degToRad(((M % 360) + 360) % 360);
}

const PLANETS_DATA = [
  { name:'Mercure', sma:0.387,  ecc:0.2056, period:0.2408,  rKm:2439,  color:0xb0b0b0, texKey:'mercure', tilt:0.03,  M0:174.796, rotPeriod: 58.646  },
  { name:'Vénus',   sma:0.723,  ecc:0.0067, period:0.6152,  rKm:6051,  color:0xe8cda0, texKey:'venus',   tilt:177.4, M0:50.416,  rotPeriod:-243.025 },
  { name:'Terre',   sma:1.000,  ecc:0.0167, period:1.000,   rKm:6371,  color:0x4fc3f7, texKey:null,      tilt:23.4,  M0:357.517, rotPeriod: 0.9973  },
  { name:'Mars',    sma:1.524,  ecc:0.0934, period:1.8809,  rKm:3389,  color:0xef5350, texKey:'mars',    tilt:25.2,  M0:19.373,  rotPeriod: 1.026   },
  { name:'Jupiter', sma:5.203,  ecc:0.0489, period:11.862,  rKm:69911, color:0xffa726, texKey:'jupiter', tilt:3.1,   M0:20.020,  rotPeriod: 0.4135  },
  { name:'Saturne', sma:9.537,  ecc:0.0565, period:29.457,  rKm:58232, color:0xf5deb3, texKey:'saturn',  tilt:26.7,  M0:317.020, rotPeriod: 0.4440, ring:true },
  { name:'Uranus',  sma:19.19,  ecc:0.0463, period:84.011,  rKm:25362, color:0x80deea, texKey:'uranus',  tilt:97.8,  M0:142.238, rotPeriod:-0.7183  },
  { name:'Neptune', sma:30.07,  ecc:0.0097, period:164.798, rKm:24622, color:0x5c6bc0, texKey:'neptune', tilt:28.3,  M0:256.228, rotPeriod: 0.6713  },
];

const SUN_R = 15;

const sunSurfaceMat = new THREE.ShaderMaterial({
  uniforms: {
    sunTex : { value: tex.sun  },
    time   : { value: 0.0     },
  },
  vertexShader: `
    varying vec2 vUv;
    varying vec3 vNormal;
    void main() {
      vUv    = uv;
      vNormal = normalize(normalMatrix * normal);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D sunTex;
    uniform float time;
    varying vec2  vUv;
    varying vec3  vNormal;

    float hash(vec2 p) {
      p = fract(p * vec2(127.1, 311.7));
      p += dot(p, p + 17.5);
      return fract(p.x * p.y);
    }
    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(
        mix(hash(i),           hash(i + vec2(1,0)), f.x),
        mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x),
        f.y
      );
    }
    float fbm(vec2 p) {
      float v = 0.0, a = 0.5;
      for (int i = 0; i < 5; i++) {
        v += a * noise(p);
        p *= 2.1;
        a *= 0.5;
      }
      return v;
    }

    void main() {
      vec3 texCol = texture2D(sunTex, vUv).rgb;
      float gran = fbm(vUv * 18.0 + vec2(time * 0.012, time * 0.008));
      vec3 hot  = vec3(1.0,  0.82, 0.30);
      vec3 cool = vec3(0.85, 0.35, 0.05);
      vec3 granCol = mix(cool, hot, gran);
      vec3 surface = texCol * (0.72 + gran * 0.28);
      surface = mix(surface, granCol, 0.18);
      float limb = max(0.0, vNormal.z);
      float ld   = 1.0 - 0.55 * (1.0 - limb);
      surface *= ld;
      surface *= 1.25;
      gl_FragColor = vec4(surface, 1.0);
    }
  `,
  toneMapped: false,
});

const sunMesh = new THREE.Mesh(
  new THREE.SphereGeometry(SUN_R, LOW_QUALITY ? 48 : 128, LOW_QUALITY ? 48 : 128),
  sunSurfaceMat
);
sunMesh.name = 'soleil';
scene.add(sunMesh);

function makeCoronaCanvas(size, innerColor, outerColor) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const cx  = size / 2;
  const grad = ctx.createRadialGradient(cx, cx, 0, cx, cx, cx);
  grad.addColorStop(0.0,  innerColor);
  grad.addColorStop(0.25, innerColor);
  grad.addColorStop(0.55, outerColor);
  grad.addColorStop(1.0,  'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(c);
}

const coronaTex  = makeCoronaCanvas(512, 'rgba(255,200,60,0.85)', 'rgba(255,100,10,0)');
const coronaMat  = new THREE.SpriteMaterial({
  map:        coronaTex,
  blending:   THREE.AdditiveBlending,
  depthWrite: false,
  toneMapped: false,
  transparent: true,
  opacity:    0.85,
});
const coronaSprite = new THREE.Sprite(coronaMat);
coronaSprite.scale.set(SUN_R * 3.2, SUN_R * 3.2, 1);
scene.add(coronaSprite);

const haloTex = makeCoronaCanvas(512, 'rgba(255,160,30,0.25)', 'rgba(255,80,0,0)');
const haloMat = new THREE.SpriteMaterial({
  map:        haloTex,
  blending:   THREE.AdditiveBlending,
  depthWrite: false,
  toneMapped: false,
  transparent: true,
  opacity:    0.45,
});
const haloSprite = new THREE.Sprite(haloMat);
haloSprite.scale.set(SUN_R * 9.0, SUN_R * 9.0, 1);
scene.add(haloSprite);

const sunLight = new THREE.PointLight(0xfff4e0, 2500, 0, 1);
sunLight.castShadow = !LOW_QUALITY;
sunLight.shadow.mapSize.set(LOW_QUALITY ? 512 : 2048, LOW_QUALITY ? 512 : 2048);
sunLight.shadow.camera.near   = 1;
sunLight.shadow.camera.far    = 100000;
sunLight.shadow.bias          = -0.0003;
sunLight.shadow.normalBias    = 0.05;
sunLight.position.set(0, 0, 0);
scene.add(sunLight);

scene.add(new THREE.AmbientLight(0x08111e, 0.18));

function hexToRGB(hex) {
  return {
    r: ((hex >> 16) & 255) / 255,
    g: ((hex >>  8) & 255) / 255,
    b: ((hex      ) & 255) / 255,
  };
}
function hexToCSS(hex) { return '#' + hex.toString(16).padStart(6, '0'); }

function buildEllipse(a, e, N = LOW_QUALITY ? 192 : 512) {
  const pts = [];
  for (let i = 0; i <= N; i++) {
    const θ = (i / N) * Math.PI * 2;
    const r = (a * (1 - e * e)) / (1 + e * Math.cos(θ));
    pts.push(new THREE.Vector3(r * Math.cos(θ), 0, r * Math.sin(θ)));
  }
  const cumLen = [0];
  for (let i = 1; i < pts.length; i++)
    cumLen.push(cumLen[i-1] + pts[i].distanceTo(pts[i-1]));
  const total = cumLen[cumLen.length - 1];
  return { pts, norm: cumLen.map(l => l / total) };
}

function sampleEllipse(pts, norm, t) {
  t = ((t % 1) + 1) % 1;
  let lo = 0, hi = norm.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (norm[mid] < t) lo = mid; else hi = mid;
  }
  const f = (t - norm[lo]) / (norm[hi] - norm[lo] + 1e-10);
  return new THREE.Vector3().lerpVectors(pts[lo], pts[hi], f);
}

function keplerPos(a, c, e, angle) {
  const r = (a * (1 - e * e)) / (1 + e * Math.cos(angle));
  return new THREE.Vector3(r * Math.cos(angle) - c, 0, r * Math.sin(angle));
}

const planetObjects = [];

PLANETS_DATA.forEach(pd => {
  const a    = scaleDist(pd.sma);
  const c    = a * pd.ecc;
  const e    = pd.ecc;
  const r    = scaleRadius(pd.rKm);

  const { pts, norm } = buildEllipse(a, e);
  pts.forEach(p => { p.x -= c; });

  const orbitGeo = new THREE.BufferGeometry().setFromPoints(pts);
  const lineBase = new THREE.Line(orbitGeo,
    new THREE.LineBasicMaterial({ color: pd.color, transparent: true, opacity: 0.18 })
  );
  scene.add(lineBase);

  const lineGlow = new THREE.Line(orbitGeo.clone(),
    new THREE.LineBasicMaterial({ color: pd.color, transparent: true, opacity: 0.0 })
  );
  scene.add(lineGlow);

  const TRAIL_LEN    = 120;
  const TRAIL_SPREAD = 0.10;
  const trailPos   = new Float32Array(TRAIL_LEN * 3);
  const trailCols  = new Float32Array(TRAIL_LEN * 3);
  const trailGeo   = new THREE.BufferGeometry();
  trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos,  3));
  trailGeo.setAttribute('color',    new THREE.BufferAttribute(trailCols, 3));
  const trailLine = new THREE.Line(trailGeo, new THREE.LineBasicMaterial({
    vertexColors: true, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  scene.add(trailLine);

  const { r: cr, g: cg, b: cb } = hexToRGB(pd.color);
  const headMesh = new THREE.Mesh(
    new THREE.SphereGeometry(r * 0.1, LOW_QUALITY ? 8 : 12, LOW_QUALITY ? 8 : 12),
    new THREE.MeshBasicMaterial({
      color: pd.color, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false,
    })
  );
  scene.add(headMesh);

  const orbitPivot = new THREE.Group();
  scene.add(orbitPivot);

  const posGroup = new THREE.Group();
  orbitPivot.add(posGroup);

  let mat;
  if (pd.name === 'Terre') {
    mat = earthMat;
  } else {
    mat = new THREE.MeshStandardMaterial({
      map:       tex[pd.texKey],
      roughness: 0.8,
      metalness: 0.0,
    });
  }

  const geoSegments = pd.name === 'Terre' ? (LOW_QUALITY ? 48 : 128) : (LOW_QUALITY ? 32 : 64);
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, geoSegments, geoSegments), mat);

  if (pd.name === 'Terre') {
    mesh.castShadow    = false;
    mesh.receiveShadow = false;
  } else {
    mesh.castShadow    = true;
    mesh.receiveShadow = true;
  }

  mesh.name = pd.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  mesh.rotation.z = THREE.MathUtils.degToRad(pd.tilt);
  posGroup.add(mesh);

  let earthCloudMesh = null;
  if (pd.name === 'Terre') {
    if (cloudMat) {
      earthCloudMesh = new THREE.Mesh(
        new THREE.SphereGeometry(r * 1.007, LOW_QUALITY ? 32 : 128, LOW_QUALITY ? 32 : 128),
        cloudMat
      );
      earthCloudMesh.castShadow    = false;
      earthCloudMesh.receiveShadow = false;
      earthCloudMesh.rotation.z   = THREE.MathUtils.degToRad(pd.tilt);
      posGroup.add(earthCloudMesh);
    }

    const atmMesh = new THREE.Mesh(
      new THREE.SphereGeometry(r * 1.025, LOW_QUALITY ? 24 : 64, LOW_QUALITY ? 24 : 64),
      atmMat
    );
    atmMesh.castShadow    = false;
    atmMesh.receiveShadow = false;
    posGroup.add(atmMesh);
  }

  if (pd.ring) {
    const innerR  = r * 1.2;
    const outerR  = r * 2.3;
    const ringGeo = new THREE.RingGeometry(innerR, outerR, LOW_QUALITY ? 64 : 128);
    const rpos = ringGeo.attributes.position;
    const ruv  = ringGeo.attributes.uv;
    for (let i = 0; i < rpos.count; i++) {
      const x = rpos.getX(i), y = rpos.getY(i);
      const d = Math.sqrt(x*x + y*y);
      ruv.setXY(i, (d - innerR) / (outerR - innerR), 0.5);
    }
    const ringMesh = new THREE.Mesh(ringGeo, new THREE.MeshStandardMaterial({
      map: tex.ring,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.90,
      depthWrite: false,
      roughness: 1.0,
    }));
    ringMesh.rotation.x    = -Math.PI / 2;
    ringMesh.castShadow    = true;
    ringMesh.receiveShadow = true;
    mesh.add(ringMesh);
  }

  const startAngle = initialAngle(pd.M0, pd.period * 365.25);
  const initPos    = keplerPos(a, c, e, startAngle);
  posGroup.position.copy(initPos);

  planetObjects.push({
    name: pd.name,
    mesh,
    earthCloudMesh: pd.name === 'Terre' ? earthCloudMesh : null,
    posGroup,
    orbitPivot,
    data: pd,
    a, c, e, r,
    pts, norm,
    lineBase, lineGlow,
    trailLine, trailGeo, trailPos, trailCols,
    headMesh,
    TRAIL_LEN, TRAIL_SPREAD,
    cr, cg, cb,
    angle:    startAngle,
    rotAngle: (T / Math.abs(pd.rotPeriod)) * Math.PI * 2,
    trailT:   startAngle / (Math.PI * 2),
    hovered:  false,
    hoverT:   0,
    history:  [],
  });
});

const moonR    = scaleRadius(1737);
const moonMesh = new THREE.Mesh(
  new THREE.SphereGeometry(moonR, LOW_QUALITY ? 24 : 64, LOW_QUALITY ? 24 : 64),
  new THREE.MeshStandardMaterial({
    map:       tex.moon,
    roughness: 1.0,
    metalness: 0.0,
  })
);
moonMesh.castShadow    = true;
moonMesh.receiveShadow = true;
moonMesh.name = 'lune';
scene.add(moonMesh);

let moonAngle = initialAngle(134.963, 27.32);
const MOON_DIST = scaleRadius(6371) * 8;

// ─────────────────────────────────────────────────────────────
// FIX #2 — Labels overlay
// - Ne plus cacher les labels quand un focus est actif
// - Faire disparaître subtilement TOUS les labels sauf celui de
//   la planète focalisée (fade out via opacity CSS)
// - Corriger le calcul de position Y pour suivre précisément les meshes
// ─────────────────────────────────────────────────────────────
const style = document.createElement('style');
style.textContent = `
  @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&display=swap');
  @keyframes neonPulse {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.6; }
  }
  .planet-label {
    position: absolute;
    font-family: 'Space Mono', 'Courier New', monospace;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    padding: 3px 9px;
    border-radius: 3px;
    white-space: nowrap;
    /* translateX(-50%) centre le label sur l'axe X du point projeté */
    transform: translateX(-50%) scale(1);
    transform-origin: center bottom;
    cursor: pointer;
    transition:
      transform    0.28s cubic-bezier(0.34, 1.56, 0.64, 1),
      text-shadow  0.25s ease,
      box-shadow   0.25s ease,
      border-color 0.25s ease,
      background   0.25s ease,
      color        0.2s  ease,
      opacity      0.4s  ease;
  }
  .planet-label.hidden  { opacity: 0 !important; pointer-events: none !important; }
  .planet-label.faded   { opacity: 0.12 !important; pointer-events: none !important; }
  .planet-label:hover {
    transform: translateX(-50%) scale(1.4) !important;
    animation: neonPulse 1.5s ease-in-out infinite;
  }
`;
document.head.appendChild(style);

const overlay = document.createElement('div');
overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:10;';
document.body.appendChild(overlay);

function createLabel(displayName, colorHex, planetObj) {
  const css = hexToCSS(colorHex);
  const el  = document.createElement('div');
  el.className    = 'planet-label';
  el.textContent  = displayName;
  el.style.color         = css;
  el.style.background    = 'rgba(0,0,0,0.45)';
  el.style.border        = `1px solid ${css}44`;
  el.style.textShadow    = `0 0 6px ${css}77`;
  el.style.pointerEvents = 'auto';

  el.addEventListener('mouseenter', () => {
    if (planetObj) planetObj.hovered = true;
    el.style.background  = 'rgba(0,0,0,0.85)';
    el.style.borderColor = css;
    el.style.color       = '#fff';
    el.style.textShadow  = `0 0 8px ${css}, 0 0 20px ${css}, 0 0 40px ${css}`;
    el.style.boxShadow   = `0 0 10px ${css}88, 0 0 24px ${css}44, inset 0 0 10px ${css}22`;
  });
  el.addEventListener('mouseleave', () => {
    if (planetObj) planetObj.hovered = false;
    el.style.background  = 'rgba(0,0,0,0.45)';
    el.style.borderColor = `${css}44`;
    el.style.color       = css;
    el.style.textShadow  = `0 0 6px ${css}77`;
    el.style.boxShadow   = 'none';
  });
  el.addEventListener('click', ev => {
    ev.stopPropagation();
    if (planetObj) focusOnPlanet(planetObj.mesh);
    else if (displayName === 'Soleil') focusOnPlanet(sunMesh);
    else if (displayName === 'Lune')   focusOnPlanet(moonMesh);
  });

  overlay.appendChild(el);
  return el;
}

const labels = planetObjects.map(obj => ({
  el:   createLabel(obj.data.name, obj.data.color, obj),
  mesh: obj.mesh,
  pObj: obj,
}));
const moonLabel = { el: createLabel('Lune',   0xcccccc, null), mesh: moonMesh };
const sunLabel  = { el: createLabel('Soleil', 0xffee88, null), mesh: sunMesh  };

const allLabels = [
  ...labels,
  moonLabel,
  sunLabel,
];

// ─────────────────────────────────────────────────────────────
// FIX #3 — projectToScreen + updateLabel robustes
// On projette la position world du mesh et on décale Y vers le haut
// d'un offset en pixels (approximation simple mais stable).
// ─────────────────────────────────────────────────────────────
const _projVec = new THREE.Vector3();

function projectToScreen(mesh) {
  mesh.getWorldPosition(_projVec);
  _projVec.project(camera);
  return {
    x: (_projVec.x *  0.5 + 0.5) * sizes.width,
    y: (-_projVec.y * 0.5 + 0.5) * sizes.height,
    z: _projVec.z,
  };
}

function updateLabel(el, mesh, pxOffset = 20) {
  const { x, y, z } = projectToScreen(mesh);

  // Derrière la caméra → caché
  if (z > 1) {
    el.classList.add('hidden');
    return;
  }
  el.classList.remove('hidden');

  // Centrage horizontal géré par translateX(-50%) en CSS
  el.style.left = `${x}px`;
  el.style.top  = `${y - pxOffset}px`;
}

// Met à jour la visibilité (faded/normal) selon l'état focus
function refreshLabelFocus() {
  allLabels.forEach(({ el, mesh }) => {
    if (!focusedMesh) {
      el.classList.remove('faded');
    } else {
      if (mesh === focusedMesh) {
        el.classList.remove('faded');
      } else {
        el.classList.add('faded');
      }
    }
  });
}

const planetData = {
  soleil:  { name:'Soleil',   type:'Étoile',             diameter:'1 392 700 km', distance:'Centre du système',  period:'N/A',       description:'Le Soleil contient 99,86 % de la masse totale du système solaire.' },
  mercure: { name:'Mercure',  type:'Planète tellurique', diameter:'4 879 km',     distance:'57,9 M km',          period:'88 j',      description:'La plus petite, criblée de cratères, sans atmosphère significative.' },
  venus:   { name:'Vénus',    type:'Planète tellurique', diameter:'12 104 km',    distance:'108,2 M km',         period:'225 j',     description:'Planète la plus chaude (465°C). Atmosphère dense de CO₂.' },
  terre:   { name:'Terre',    type:'Planète tellurique', diameter:'12 742 km',    distance:'149,6 M km',         period:'365,25 j',  description:'La seule planète connue abritant la vie. 71 % de surface aqueuse.' },
  lune:    { name:'Lune',     type:'Satellite naturel',  diameter:'3 474 km',     distance:'384 400 km (Terre)', period:'27,3 j',    description:'Unique satellite naturel de la Terre. Gouverne les marées.' },
  mars:    { name:'Mars',     type:'Planète tellurique', diameter:'6 779 km',     distance:'227,9 M km',         period:'687 j',     description:'La planète rouge abrite Olympus Mons, plus grand volcan du système.' },
  jupiter: { name:'Jupiter',  type:'Géante gazeuse',     diameter:'139 820 km',   distance:'778,5 M km',         period:'11,9 ans',  description:'La plus grande planète. Sa Grande Tache Rouge dure depuis 400 ans.' },
  saturne: { name:'Saturne',  type:'Géante gazeuse',     diameter:'116 460 km',   distance:'1,43 Md km',         period:'29,5 ans',  description:'Ses anneaux de glace et de roche la rendent unique.' },
  uranus:  { name:'Uranus',   type:'Géante de glace',    diameter:'50 724 km',    distance:'2,87 Md km',         period:'84 ans',    description:'Inclinée à 98° — elle tourne littéralement sur le côté.' },
  neptune: { name:'Neptune',  type:'Géante de glace',    diameter:'49 244 km',    distance:'4,50 Md km',         period:'165 ans',   description:'Vents à 2 100 km/h. Planète la plus éloignée du Soleil.' },
};

function showInfo(key) {
  const d = planetData[key]; if (!d) return;
  document.getElementById('planet-name').textContent        = d.name;
  document.getElementById('planet-type').textContent        = d.type;
  document.getElementById('planet-diameter').textContent    = d.diameter;
  document.getElementById('planet-distance').textContent    = d.distance;
  document.getElementById('planet-period').textContent      = d.period;
  document.getElementById('planet-description').textContent = d.description;
  document.getElementById('planet-info').classList.add('visible');
}
function hideInfo() { document.getElementById('planet-info').classList.remove('visible'); }

const backBtn = document.createElement('button');
backBtn.textContent = '← Retour';
backBtn.style.cssText = `
  position:fixed; top:24px; left:24px; z-index:100;
  font-family:'Space Mono','Courier New',monospace; font-size:11px; font-weight:700;
  letter-spacing:0.18em; text-transform:uppercase;
  color:#fff; background:rgba(0,0,0,0.6);
  border:1px solid rgba(255,255,255,0.25); border-radius:4px;
  padding:8px 16px; cursor:pointer;
  opacity:0; pointer-events:none; transform:translateY(-6px);
  transition:opacity .3s,transform .3s,background .2s,border-color .2s,box-shadow .2s;
`;
backBtn.addEventListener('mouseenter', () => {
  backBtn.style.background  = 'rgba(255,255,255,0.12)';
  backBtn.style.borderColor = 'rgba(255,255,255,0.7)';
  backBtn.style.boxShadow   = '0 0 12px rgba(255,255,255,0.2)';
});
backBtn.addEventListener('mouseleave', () => {
  backBtn.style.background  = 'rgba(0,0,0,0.6)';
  backBtn.style.borderColor = 'rgba(255,255,255,0.25)';
  backBtn.style.boxShadow   = 'none';
});
backBtn.addEventListener('click', resetView);
document.body.appendChild(backBtn);

function showBackBtn() {
  backBtn.style.opacity = '1'; backBtn.style.pointerEvents = 'auto'; backBtn.style.transform = 'translateY(0)';
}
function hideBackBtn() {
  backBtn.style.opacity = '0'; backBtn.style.pointerEvents = 'none'; backBtn.style.transform = 'translateY(-6px)';
}

// ─────────────────────────────────────────────────────────────
// FIX #4 — Animation de focus
// Problème original : la cible de l'animation est calculée UNE SEULE
// FOIS au moment du clic, mais la planète continue à se déplacer
// → camera arrive au mauvais endroit puis "saute".
// Fix : pendant l'animation d'approche, on ré-échantillonne la
// position world de la planète à chaque frame pour ajuster dst et
// controls.target dynamiquement.
// ─────────────────────────────────────────────────────────────
let focusedMesh    = null;
let isAnimating    = false;
let lockedDistance = 0;

function focusOnPlanet(mesh) {
  if (isAnimating) return;
  focusedMesh  = mesh;
  isAnimating  = true;

  const pObj = planetObjects.find(p => p.mesh === mesh);
  const infoKey = pObj ? mesh.name : (mesh === sunMesh ? 'soleil' : 'lune');
  showInfo(infoKey);
  showBackBtn();

  let vizR = 2;
  if (pObj) vizR = pObj.r;
  else if (mesh === sunMesh)  vizR = 15;
  else if (mesh === moonMesh) vizR = moonR;
  lockedDistance = Math.max(vizR * 3.5, 5);

  const sp = camera.position.clone();
  const st = controls.target.clone();
  const t0 = Date.now();
  controls.enabled = false;

  // Met à jour les labels en mode focus (fader tous sauf la cible)
  refreshLabelFocus();

  (function animIn() {
    const p    = Math.min((Date.now() - t0) / 1400, 1);
    const ease = p < .5 ? 2*p*p : 1 - Math.pow(-2*p+2, 2)/2;

    // On récupère la position COURANTE du mesh (la planète se déplace)
    const wp  = new THREE.Vector3();
    mesh.getWorldPosition(wp);

    // Direction caméra → planète, recalculée chaque frame
    const dir = camera.position.clone().sub(wp).normalize();
    const dst = wp.clone().addScaledVector(dir, lockedDistance);

    camera.position.lerpVectors(sp, dst, ease);
    controls.target.lerpVectors(st, wp, ease);
    controls.update();

    if (p < 1) { requestAnimationFrame(animIn); return; }

    // Fin de l'anim
    controls.enabled    = true;
    controls.enableZoom = false;
    controls.enablePan  = false;
    controls.target.copy(wp);
    controls.update();
    isAnimating = false;
  })();
}

function resetView() {
  if (isAnimating) return;
  focusedMesh = null;
  isAnimating = true;
  hideInfo();
  hideBackBtn();
  controls.enableZoom = true;
  controls.enablePan  = true;
  controls.enabled    = false;

  refreshLabelFocus(); // retire tous les .faded

  const sp = camera.position.clone(), st = controls.target.clone(), t0 = Date.now();
  const tp = new THREE.Vector3(0, 160, 550), tt = new THREE.Vector3();

  (function animOut() {
    const p    = Math.min((Date.now() - t0) / 1400, 1);
    const ease = p < .5 ? 2*p*p : 1 - Math.pow(-2*p+2, 2)/2;
    camera.position.lerpVectors(sp, tp, ease);
    controls.target.lerpVectors(st, tt, ease);
    controls.update();
    if (p < 1) { requestAnimationFrame(animOut); return; }
    controls.enabled = true;
    isAnimating = false;
  })();
}

const raycaster = new THREE.Raycaster();
const mouse     = new THREE.Vector2();
const clickable = [sunMesh, moonMesh, ...planetObjects.map(p => p.mesh)];

canvas.addEventListener('click', ev => {
  if (focusedMesh) return;
  mouse.x =  (ev.clientX / sizes.width)  * 2 - 1;
  mouse.y = -(ev.clientY / sizes.height) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObjects(clickable);
  if (hits.length > 0) focusOnPlanet(hits[0].object);
});

window.addEventListener('resize', () => {
  sizes.width = window.innerWidth; sizes.height = window.innerHeight;
  camera.aspect = sizes.width / sizes.height;
  camera.updateProjectionMatrix();
  renderer.setSize(sizes.width, sizes.height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, LOW_QUALITY ? 1.25 : 2));
});

const SIM_DAYS_PER_SEC    = 0.5;
const EARTH_PERIOD_DAYS   = 365.25;
const HOVER_SPEED         = 0.07;
const TRAIL_SPEED_PER_SEC = 0.18;
const ROT_FACTOR          = 0.02;

let lastTime = performance.now();
let elapsed  = 0;

// vecteur réutilisable pour éviter les allocations dans tick()
const _wpTmp = new THREE.Vector3();

function tick() {
  const now_ms = performance.now();
  const dt     = Math.min((now_ms - lastTime) / 1000, 0.1);
  lastTime     = now_ms;
  elapsed     += dt;

  const simDays = SIM_DAYS_PER_SEC * dt;

  // ══ Planètes ══
  planetObjects.forEach(obj => {
    const { data, a, c, e, pts, norm } = obj;

    obj.angle += (Math.PI * 2 / (data.period * EARTH_PERIOD_DAYS)) * simDays;

    const kp = keplerPos(a, c, e, obj.angle);
    obj.posGroup.position.copy(kp);

    const rotSpeed = (Math.PI * 2 / Math.abs(data.rotPeriod)) * simDays * ROT_FACTOR;
    obj.rotAngle  += data.rotPeriod < 0 ? -rotSpeed : rotSpeed;
    obj.mesh.rotation.set(0, obj.rotAngle, THREE.MathUtils.degToRad(data.tilt));

    // ─ Terre : mise à jour sunDir en world space ─
    if (data.name === 'Terre') {
      obj.mesh.getWorldPosition(_wpTmp);
      // Le soleil est en (0,0,0) → direction vers la Terre = position normalisée
      // sunDir = direction du soleil VU depuis la Terre → negate
      earthMat.uniforms.sunDir.value
        .copy(_wpTmp)
        .negate()
        .normalize();

      if (obj.earthCloudMesh) {
        obj.earthCloudMesh.rotation.set(0, obj.rotAngle * 1.015, THREE.MathUtils.degToRad(data.tilt));
        earthCloudsTex.offset.x += 0.00004;
      }
    }

    // ── Hover ──
    const target = obj.hovered ? 1 : 0;
    obj.hoverT  += (target - obj.hoverT) * HOVER_SPEED;
    const ht     = obj.hoverT;

    obj.lineBase.material.opacity = 0.18 - ht * 0.12;
    obj.lineGlow.material.opacity = ht * 0.85;
    const { r: cr, g: cg, b: cb } = hexToRGB(data.color);
    obj.lineGlow.material.color.setRGB(
      cr + (1 - cr) * ht * 0.6,
      cg + (1 - cg) * ht * 0.6,
      cb + (1 - cb) * ht * 0.6
    );

    obj.trailT = (obj.trailT + TRAIL_SPEED_PER_SEC * dt) % 1;
    obj.trailLine.material.opacity = ht;
    obj.headMesh.material.opacity  = ht;

    if (ht > 0.01) {
      const { TRAIL_LEN, TRAIL_SPREAD, trailPos, trailCols } = obj;
      for (let i = 0; i < TRAIL_LEN; i++) {
        const frac = i / (TRAIL_LEN - 1);
        const p = sampleEllipse(pts, norm, obj.trailT - frac * TRAIL_SPREAD);
        trailPos[i*3]   = p.x; trailPos[i*3+1] = p.y; trailPos[i*3+2] = p.z;
        const alpha = Math.pow(1 - frac, 1.8);
        const boost = (1 - frac) * 0.55;
        trailCols[i*3]   = (cr + (1-cr)*boost) * alpha;
        trailCols[i*3+1] = (cg + (1-cg)*boost) * alpha;
        trailCols[i*3+2] = (cb + (1-cb)*boost) * alpha;
      }
      obj.trailGeo.attributes.position.needsUpdate = true;
      obj.trailGeo.attributes.color.needsUpdate    = true;
      const hp = sampleEllipse(pts, norm, obj.trailT);
      obj.headMesh.position.set(hp.x, hp.y, hp.z);
    }
  });

  // ══ Lune ══
  const earthObj = planetObjects.find(p => p.data.name === 'Terre');
  if (earthObj) {
    moonAngle += (Math.PI * 2 / 27.32) * simDays;
    earthObj.mesh.getWorldPosition(_wpTmp);
    moonMesh.position.set(
      _wpTmp.x + MOON_DIST * Math.cos(moonAngle),
      _wpTmp.y,
      _wpTmp.z + MOON_DIST * Math.sin(moonAngle)
    );
    moonMesh.rotation.y += (Math.PI * 2 / 27.32) * simDays * ROT_FACTOR;
  }

  sunMesh.rotation.y += (Math.PI * 2 / 25) * simDays * ROT_FACTOR;
  sunSurfaceMat.uniforms.time.value = elapsed;

  // ══ Suivi planète focalisée (hors anim) ══
  if (focusedMesh && !isAnimating) {
    focusedMesh.getWorldPosition(_wpTmp);
    controls.target.copy(_wpTmp);

    // Maintient la distance lockedDistance
    const dir = camera.position.clone().sub(_wpTmp);
    const len = dir.length();
    if (Math.abs(len - lockedDistance) > 0.01) {
      camera.position.copy(_wpTmp).addScaledVector(dir.divideScalar(len), lockedDistance);
    }
  }

  // ══ Labels : mise à jour position écran chaque frame ══
  // On utilise une estimation de l'offset vertical en pixels
  // basée sur la taille apparente du mesh (évite les sauts).
  labels.forEach(({ el, mesh, pObj }) => {
    const dist = camera.position.distanceTo(mesh.getWorldPosition(_wpTmp));
    // Rayon apparent en pixels
    const fovRad  = THREE.MathUtils.degToRad(60);
    const pixelR  = ((pObj ? pObj.r : SUN_R) / dist) * sizes.height / (2 * Math.tan(fovRad / 2));
    updateLabel(el, mesh, pixelR + 14);
  });

  // Lune
  {
    const dist   = camera.position.distanceTo(moonMesh.getWorldPosition(_wpTmp));
    const fovRad = THREE.MathUtils.degToRad(60);
    const pixelR = (moonR / dist) * sizes.height / (2 * Math.tan(fovRad / 2));
    updateLabel(moonLabel.el, moonMesh, pixelR + 14);
  }

  // Soleil
  {
    const dist   = camera.position.distanceTo(sunMesh.getWorldPosition(_wpTmp));
    const fovRad = THREE.MathUtils.degToRad(60);
    const pixelR = (SUN_R / dist) * sizes.height / (2 * Math.tan(fovRad / 2));
    updateLabel(sunLabel.el, sunMesh, pixelR + 14);
  }

  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

tick();