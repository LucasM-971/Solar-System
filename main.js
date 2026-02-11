import * as THREE from 'three';
import { Vector3 } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import anime from 'https://cdn.jsdelivr.net/npm/animejs@3.2.1/lib/anime.es.js';
const scene = new THREE.Scene();

const sizes = {
  width: window.innerWidth,
  height: window.innerHeight
};

const canvas = document.getElementById('webgl');

const camera = new THREE.PerspectiveCamera(75, sizes.width / sizes.height);
camera.position.set(0, 10, 35);
scene.add(camera);

const renderer = new THREE.WebGLRenderer({ canvas });
renderer.setSize(sizes.width, sizes.height);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;

controls.target.set(0, 0, 0);
controls.update();

const textureLoader = new THREE.TextureLoader();

const earthDayTexture = textureLoader.load('/texture/earth-texture.jpg');
earthDayTexture.colorSpace = THREE.SRGBColorSpace;
earthDayTexture.anisotropy = 8;

const earthNightTexture = textureLoader.load('/texture/8k_earth_nightmap.jpg');
earthNightTexture.colorSpace = THREE.SRGBColorSpace;
earthNightTexture.anisotropy = 8;

const earthCloudsTexture = textureLoader.load('/texture/8k_earth_clouds.jpg');
earthCloudsTexture.anisotropy = 8;

const mercureTexture = textureLoader.load('/texture/8k_mercury.jpg')
const neptuneTexture = textureLoader.load('/texture/2k_neptune.jpg');
const uranusTexture = textureLoader.load('/texture/2k_uranus.jpg');
const venusTexture = textureLoader.load('/texture/4k_venus_atmosphere.jpg');
const jupiterTexture = textureLoader.load('/texture/8k_jupiter.jpg');
const marsTexture = textureLoader.load('/texture/8k_mars.jpg');
const soleilTexture = textureLoader.load('/texture/8k_sun.jpg');
const galaxyTexture = textureLoader.load('/texture/8k_stars.jpg');
const moonTexture = textureLoader.load('/texture/8k_moon.jpg');


const infoPanel = document.querySelector('#planet-info');
const title = infoPanel.querySelector('h2');
const lines = infoPanel.querySelectorAll('.line');


const sphereGeometry = new THREE.SphereGeometry(60, 80, 80); 
const sphereMateriale = new THREE.MeshBasicMaterial({
  map: galaxyTexture,
  side: THREE.BackSide 
});
const spheree = new THREE.Mesh(sphereGeometry, sphereMateriale);
scene.add(spheree);

const sphereMaterial = new THREE.MeshPhongMaterial({
  map: soleilTexture,
  shininess: 200,
  emissive: 0xffffaa,  
  emissiveIntensity: 0.5
});


const sphereMercure = new THREE.MeshPhongMaterial({
  map: mercureTexture, shininess: 80
});

const sphereVenus = new THREE.MeshPhongMaterial({
  map: venusTexture, shininess: 100
});

const earthVertexShader = `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vPosition;
  
  void main() {
    vUv = uv;
    
    // Normal en espace monde
    vec4 modelPosition = modelMatrix * vec4(position, 1.0);
    vPosition = modelPosition.xyz;
    vNormal = normalize(mat3(modelMatrix) * normal);
    
    gl_Position = projectionMatrix * viewMatrix * modelPosition;
  }
`;

const earthFragmentShader = `
  uniform sampler2D dayTexture;
  uniform sampler2D nightTexture;
  uniform sampler2D cloudsTexture;
  uniform vec3 sunDirection;
  
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vPosition;
  
  void main() {
    vec3 normal = normalize(vNormal);
    vec3 sunDir = normalize(sunDirection);
    
    // Intensité du soleil
    float sunOrientation = dot(normal, sunDir);
    
    // Charger les textures
    vec3 dayColor = texture2D(dayTexture, vUv).rgb;
    vec3 nightColor = texture2D(nightTexture, vUv).rgb;
    float clouds = texture2D(cloudsTexture, vUv).r;
    
    // Mélanger le jour avec les nuages
    vec3 dayWithClouds = mix(dayColor, vec3(1.0), clouds * 0.4);
    
    // Transition jour/nuit
    float dayStrength = smoothstep(-0.25, 0.5, sunOrientation);
    
    // Mélange final
    vec3 finalColor = mix(nightColor, dayWithClouds, dayStrength);
    
    gl_FragColor = vec4(finalColor, 1.0);
  }
`;

const earthMaterial = new THREE.ShaderMaterial({
  uniforms: {
    dayTexture: { value: earthDayTexture },
    nightTexture: { value: earthNightTexture },
    cloudsTexture: { value: earthCloudsTexture },
    sunDirection: { value: new THREE.Vector3(1, 0, 0) }
  },
  vertexShader: earthVertexShader,
  fragmentShader: earthFragmentShader
});

const terre = new THREE.Mesh(
  new THREE.SphereGeometry(0.65, 64, 64),
  earthMaterial
);
terre.name = 'terre';

const sphereTerreLune = new THREE.MeshPhongMaterial({
  map: moonTexture, shininess: 30
});

const sphereMars = new THREE.MeshPhongMaterial({
  map: marsTexture, shininess: 90
});

const sphereJupiter = new THREE.MeshPhongMaterial({
  map: jupiterTexture, shininess: 70
});

const sphereUranus = new THREE.MeshPhongMaterial({
  map: uranusTexture, shininess: 60
});

const sphereNeptune = new THREE.MeshPhongMaterial({
  map: neptuneTexture, shininess: 60
});

const sphere = new THREE.Mesh(
  new THREE.SphereGeometry(3, 32, 32),
  sphereMaterial
);
sphere.name = 'soleil'; // AJOUTÉ
scene.add(sphere);

const mercure = new THREE.Mesh(
  new THREE.SphereGeometry(0.3, 32, 32),
  sphereMercure);
mercure.name = 'mercure'; // AJOUTÉ

const venus = new THREE.Mesh(
  new THREE.SphereGeometry(0.6, 32, 32),
  sphereVenus);
venus.name = 'venus'; // AJOUTÉ

const lune = new THREE.Mesh(
  new THREE.SphereGeometry(0.15, 16, 16),
  sphereTerreLune);
lune.name = 'lune'; // AJOUTÉ

const mars = new THREE.Mesh(
  new THREE.SphereGeometry(0.5, 32, 32),
  sphereMars);
mars.name = 'mars'; // AJOUTÉ

const jupiter = new THREE.Mesh(
  new THREE.SphereGeometry(1.5, 32, 32),
  sphereJupiter);
jupiter.name = 'jupiter'; // AJOUTÉ

const uranus = new THREE.Mesh(
  new THREE.SphereGeometry(1, 32, 32),
  sphereUranus);
uranus.name = 'uranus'; // AJOUTÉ
  
const neptune = new THREE.Mesh(
  new THREE.SphereGeometry(1, 32, 32),
  sphereNeptune);
neptune.name = 'neptune'; // AJOUTÉ

const mercureOrbit = new THREE.Object3D();
const venusOrbit = new THREE.Object3D();
const terreOrbit = new THREE.Object3D();
const marsOrbit = new THREE.Object3D();
const jupiterOrbit = new THREE.Object3D();
const uranusOrbit = new THREE.Object3D();
const neptuneOrbit = new THREE.Object3D();

scene.add(
  mercureOrbit,
  venusOrbit,
  terreOrbit,
  marsOrbit,
  jupiterOrbit,
  uranusOrbit,
  neptuneOrbit
);

mercure.position.x = 5;
venus.position.x = 8;
terre.position.x = 11;
mars.position.x = 14;
jupiter.position.x = 18;
uranus.position.x = 23;
neptune.position.x = 28;

jupiter.rotation.y = Math.PI * 0.25;

mercureOrbit.add(mercure);
venusOrbit.add(venus);
terreOrbit.add(terre);
marsOrbit.add(mars);
jupiterOrbit.add(jupiter);
uranusOrbit.add(uranus);
neptuneOrbit.add(neptune);

const luneOrbit = new THREE.Object3D();
terre.add(luneOrbit);
lune.position.x = 0.9;
luneOrbit.add(lune);

const sunLight = new THREE.PointLight(0xffffff, 600, 100000000); 
sunLight.position.set(0, 0, 0); 
scene.add(sunLight);

let focusedPlanet = null;
let isAnimating = false;
let cameraOffset = new THREE.Vector3(); 

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

const clickablePlanets = [sphere, mercure, venus, terre, lune, mars, jupiter, uranus, neptune];

// Données des planètes
const planetData = {
  soleil: {
    name: 'Soleil',
    type: 'Étoile',
    diameter: '1,392,700 km',
    distance: '0 km (centre du système)',
    period: 'N/A',
    description: 'Le Soleil est l\'étoile au centre de notre système solaire. Il contient 99,86% de la masse du système solaire.'
  },
  mercure: {
    name: 'Mercure',
    type: 'Planète tellurique',
    diameter: '4,879 km',
    distance: '57,9 millions km',
    period: '88 jours',
    description: 'La plus petite planète du système solaire et la plus proche du Soleil. Sa surface est criblée de cratères.'
  },
  venus: {
    name: 'Vénus',
    type: 'Planète tellurique',
    diameter: '12,104 km',
    distance: '108,2 millions km',
    period: '225 jours',
    description: 'Souvent appelée l\'étoile du berger, Vénus est la planète la plus chaude du système solaire avec une atmosphère épaisse de CO2.'
  },
  terre: {
    name: 'Terre',
    type: 'Planète tellurique',
    diameter: '12,742 km',
    distance: '149,6 millions km',
    period: '365,25 jours',
    description: 'Notre planète bleue, la seule connue à abriter la vie. Elle possède une atmosphère riche en oxygène et 71% de sa surface est recouverte d\'eau.'
  },
  lune: {
    name: 'Lune',
    type: 'Satellite naturel',
    diameter: '3,474 km',
    distance: '384,400 km (de la Terre)',
    period: '27,3 jours',
    description: 'Le seul satellite naturel de la Terre. Elle influence les marées et stabilise l\'axe de rotation terrestre.'
  },
  mars: {
    name: 'Mars',
    type: 'Planète tellurique',
    diameter: '6,779 km',
    distance: '227,9 millions km',
    period: '687 jours',
    description: 'La planète rouge doit sa couleur à l\'oxyde de fer. Elle possède les plus grands volcans du système solaire.'
  },
  jupiter: {
    name: 'Jupiter',
    type: 'Géante gazeuse',
    diameter: '139,820 km',
    distance: '778,5 millions km',
    period: '11,9 ans',
    description: 'La plus grande planète du système solaire. Sa Grande Tache Rouge est une tempête qui dure depuis au moins 400 ans.'
  },
  uranus: {
    name: 'Uranus',
    type: 'Géante de glace',
    diameter: '50,724 km',
    distance: '2,871 milliards km',
    period: '84 ans',
    description: 'Cette géante de glace a la particularité de tourner sur le côté, son axe de rotation étant incliné à 98 degrés.'
  },
  neptune: {
    name: 'Neptune',
    type: 'Géante de glace',
    diameter: '49,244 km',
    distance: '4,495 milliards km',
    period: '165 ans',
    description: 'La planète la plus éloignée du Soleil. Ses vents sont les plus rapides du système solaire, atteignant 2,100 km/h.'
  }
};

// Fonction pour afficher les infos d'une planète
function showPlanetInfo(planetName) {
  const info = planetData[planetName];
  if (!info) return;
  
  document.getElementById('planet-name').textContent = info.name;
  document.getElementById('planet-type').textContent = info.type;
  document.getElementById('planet-diameter').textContent = info.diameter;
  document.getElementById('planet-distance').textContent = info.distance;
  document.getElementById('planet-period').textContent = info.period;
  document.getElementById('planet-description').textContent = info.description;
  
  document.getElementById('planet-info').classList.add('visible');
}

// Fonction pour masquer les infos
function hidePlanetInfo() {
  document.getElementById('planet-info').classList.remove('visible');
}

// Fonction pour animer le zoom vers une planète
function focusOnPlanet(planet) {
  if (isAnimating) return;
  
  focusedPlanet = planet;
  isAnimating = true;
  
  // Afficher les infos de la planète
  showPlanetInfo(planet.name);
  
  controls.enabled = false;
  
  const worldPosition = new THREE.Vector3();
  planet.getWorldPosition(worldPosition);
  
  const boundingBox = new THREE.Box3().setFromObject(planet);
  const size = boundingBox.getSize(new THREE.Vector3()).length();
  const zoomDistance = size * 0.7;
  
  cameraOffset.set(0, zoomDistance * 0.3, zoomDistance);
  
  const targetCameraPosition = worldPosition.clone().add(cameraOffset);
  
  const startPosition = camera.position.clone();
  const startTarget = controls.target.clone();
  const duration = 1500;
  const startTime = Date.now();
  
  function animate() {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    const eased = progress < 0.5 
      ? 2 * progress * progress 
      : 1 - Math.pow(-2 * progress + 2, 2) / 2;
    
    camera.position.lerpVectors(startPosition, targetCameraPosition, eased);
    controls.target.lerpVectors(startTarget, worldPosition, eased);
    controls.update();
    
    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      isAnimating = false;
      controls.enabled = false;
    }
  }
  
  animate();
}

// Fonction pour réinitialiser la vue
function resetView() {
  if (isAnimating) return;
  
  focusedPlanet = null;
  isAnimating = true;
  
  // Masquer les infos
  hidePlanetInfo();
  
  const targetPosition = new THREE.Vector3(0, 10, 35);
  const targetFocus = new THREE.Vector3(0, 0, 0);
  
  const startPosition = camera.position.clone();
  const startTarget = controls.target.clone();
  const duration = 1500;
  const startTime = Date.now();
  
  function animate() {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    const eased = progress < 0.5 
      ? 2 * progress * progress 
      : 1 - Math.pow(-2 * progress + 2, 2) / 2;
    
    camera.position.lerpVectors(startPosition, targetPosition, eased);
    controls.target.lerpVectors(startTarget, targetFocus, eased);
    controls.update();
    
    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      isAnimating = false;
      controls.enabled = true;
    }
  }
  
  animate();
}



// Gestionnaire de clic
canvas.addEventListener('click', (event) => {
  mouse.x = (event.clientX / sizes.width) * 2 - 1;
  mouse.y = -(event.clientY / sizes.height) * 2 + 1;
  
  raycaster.setFromCamera(mouse, camera);
  
  const intersects = raycaster.intersectObjects(clickablePlanets);
  
  if (intersects.length > 0) {
    const clickedPlanet = intersects[0].object;
    
    if (focusedPlanet === clickedPlanet) {
      resetView();
    } else {
      focusOnPlanet(clickedPlanet);
    }
  } else if (focusedPlanet) {
    resetView();
  }
});

window.addEventListener('resize', () => {
  sizes.width = window.innerWidth;
  sizes.height = window.innerHeight;
  camera.aspect = sizes.width / sizes.height;
  camera.updateProjectionMatrix();
  renderer.setSize(sizes.width, sizes.height);
});

function tick() {
  mercureOrbit.rotation.y += 0.0002;
  mercure.rotation.y += 0.001;

  venusOrbit.rotation.y += 0.00015;
  venus.rotation.y += 0.001;

  terreOrbit.rotation.y += 0.0001;
  terre.rotation.y += 0.001;

  marsOrbit.rotation.y += 0.00008;
  mars.rotation.y += 0.001;

  jupiterOrbit.rotation.y += 0.00004;
  jupiter.rotation.y += 0.001;
  
  uranusOrbit.rotation.y += 0.00002;
  neptuneOrbit.rotation.y += 0.00001;
  luneOrbit.rotation.y += 0.0005;

  const sunDirection = new THREE.Vector3(0, 0, 0).sub(terre.position).normalize();
  earthMaterial.uniforms.sunDirection.value.copy(sunDirection);
  
  if (focusedPlanet && !isAnimating) {
    const worldPosition = new THREE.Vector3();
    focusedPlanet.getWorldPosition(worldPosition);
    
    controls.target.copy(worldPosition);
    camera.position.copy(worldPosition).add(cameraOffset);
  }

  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

tick();