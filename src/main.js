
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import './style.css';

// GAME UI
document.querySelector('#app').innerHTML = `
  <div class="hud">
    <div class="brand">CORE RUNNER</div>
    <div class="stats">
      <div>CRYSTALS <span id="score">0 / 5</span></div>
      <div>TIME <span id="timer">60</span></div>
    </div>
  </div>
  <div id="game"></div>
  <div class="message" id="message">
    <h1>CORE RUNNER</h1>
    <p>Collect 5 energy crystals and reach the portal!</p>
    <p class="controls">W A S D or Arrow Keys to Move</p>
    <button id="start">START GAME</button>
  </div>
  <div class="help">MOVE: WASD / ARROW KEYS</div>
`;

// SCENE
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050b18);
scene.fog = new THREE.Fog(0x050b18, 20, 48);

// CAMERA
const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  100
);
camera.position.set(0, 19, 23);
camera.lookAt(0, 0, 0);

// RENDERER
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.3;
document.querySelector('#game').appendChild(renderer.domElement);

// LIGHTS
scene.add(new THREE.AmbientLight(0x8abfff, 1.5));

const mainLight = new THREE.DirectionalLight(0xffffff, 3);
mainLight.position.set(8, 15, 8);
mainLight.castShadow = true;
scene.add(mainLight);

const blueLight = new THREE.PointLight(0x0088ff, 35, 20);
blueLight.position.set(0, 4, 0);
scene.add(blueLight);

// FLOOR
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(26, 26),
  new THREE.MeshStandardMaterial({
    color: 0x101d33,
    metalness: 0.6,
    roughness: 0.5
  })
);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

// GRID
const grid = new THREE.GridHelper(26, 26, 0x087dcb, 0x183454);
grid.position.y = 0.02;
scene.add(grid);

// ARENA WALLS
const wallMaterial = new THREE.MeshStandardMaterial({
  color: 0x152d4b,
  metalness: 0.7,
  roughness: 0.3
});

function addWall(x, z, width, depth) {
  const wall = new THREE.Mesh(
    new THREE.BoxGeometry(width, 2, depth),
    wallMaterial
  );
  wall.position.set(x, 1, z);
  wall.castShadow = true;
  wall.receiveShadow = true;
  scene.add(wall);
}

addWall(0, -13, 26, 0.5);
addWall(0, 13, 26, 0.5);
addWall(-13, 0, 0.5, 26);
addWall(13, 0, 0.5, 26);


 // PLAYER - Vi3W ROBOT
const player = new THREE.Group();

player.position.set(-10, 0, 10);
scene.add(player);

// Load the generated 3D robot
const robotLoader = new GLTFLoader();

robotLoader.load(
  '/models/robot.glb',
  (gltf) => {
    const robot = gltf.scene;

    console.log('Robot animations:', gltf.animations);

    // Measure the original model
    const box = new THREE.Box3().setFromObject(robot);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    // Set a suitable character height
    const targetHeight = 2.5;
 
    if (size.y > 0) {
      robot.scale.setScalar(targetHeight / size.y);
    }

    // Align the robot with the ground and player position
    robot.position.set(
      -center.x * robot.scale.x,
      -box.min.y * robot.scale.y,
      -center.z * robot.scale.z
    );

    // Enable shadows
    robot.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    player.add(robot);

    console.log('Vi3W robot loaded successfully!');
  },
  undefined,
  (error) => {
    console.error('Robot loading failed:', error);
  }
);

// OBSTACLES
const obstacles = [];

function addObstacle(x, z) {
  const obstacle = new THREE.Mesh(
    new THREE.BoxGeometry(2, 1.5, 2),
    new THREE.MeshStandardMaterial({
      color: 0x263c55,
      metalness: 0.8,
      roughness: 0.35
    })
  );

  obstacle.position.set(x, 0.75, z);
  obstacle.castShadow = true;
  obstacle.receiveShadow = true;
  scene.add(obstacle);
  obstacles.push(obstacle);
}

addObstacle(-4, 4);
addObstacle(3, 5);
addObstacle(5, -3);
addObstacle(-4, -4);

// EXIT PORTAL
const portal = new THREE.Mesh(
  new THREE.TorusGeometry(1.3, 0.12, 16, 64),
  new THREE.MeshStandardMaterial({
    color: 0x00eaff,
    emissive: 0x0088ff,
    emissiveIntensity: 3
  })
);
portal.position.set(10, 1.5, -10);
scene.add(portal);

// CRYSTAL MODEL
const loader = new GLTFLoader();
const crystalPositions = [
  [-8, 0, -6],
  [-2, 0, -9],
  [7, 0, -6],
  [8, 0, 4],
  [0, 0, 9]
];

const crystals = [];
let crystalTemplate = null;
let score = 0;
let timeLeft = 60;
let playing = false;
let gameOver = false;

const scoreText = document.querySelector('#score');
const timerText = document.querySelector('#timer');
const message = document.querySelector('#message');

function createFallbackCrystal() {
  return new THREE.Mesh(
    new THREE.OctahedronGeometry(0.7),
    new THREE.MeshStandardMaterial({
      color: 0x00ccff,
      emissive: 0x0088ff,
      emissiveIntensity: 2,
      metalness: 0.5,
      roughness: 0.2
    })
  );
}

function addCrystals() {
  crystalPositions.forEach((position) => {
    let crystal;

    if (crystalTemplate) {
      crystal = crystalTemplate.clone(true);
    } else {
      crystal = createFallbackCrystal();
    }

    crystal.position.set(...position);
    crystal.position.y = 1.1;
    crystal.scale.multiplyScalar(1);
    scene.add(crystal);
    crystals.push(crystal);
  });
}

loader.load(
  '/models/energy-crystal.glb',
  (gltf) => {
    crystalTemplate = gltf.scene;

    const box = new THREE.Box3().setFromObject(crystalTemplate);
    const size = box.getSize(new THREE.Vector3());
    const maxSize = Math.max(size.x, size.y, size.z);

    if (maxSize > 0) {
      crystalTemplate.scale.setScalar(1.4 / maxSize);
    }

    addCrystals();
    console.log('Vi3W energy crystal loaded successfully!');
  },
  undefined,
  (error) => {
    console.error('Crystal loading failed:', error);
    addCrystals();
  }
);

// KEYBOARD CONTROLS
const keys = {};

window.addEventListener('keydown', (event) => {
  keys[event.key.toLowerCase()] = true;
});

window.addEventListener('keyup', (event) => {
  keys[event.key.toLowerCase()] = false;
});

function isBlocked(x, z) {
  return obstacles.some((obstacle) => {
    const halfSize = 1.5;

    return (
      Math.abs(x - obstacle.position.x) < halfSize &&
      Math.abs(z - obstacle.position.z) < halfSize
    );
  });
}

function movePlayer() {
  if (!playing) return;

  const speed = 0.13;
  let dx = 0;
  let dz = 0;

  if (keys['w'] || keys['arrowup']) dz -= speed;
  if (keys['s'] || keys['arrowdown']) dz += speed;
  if (keys['a'] || keys['arrowleft']) dx -= speed;
  if (keys['d'] || keys['arrowright']) dx += speed;

  const nextX = player.position.x + dx;
  const nextZ = player.position.z + dz;

  // ARENA BOUNDARY
if (Math.abs(nextX) < 11.5 && !isBlocked(nextX, player.position.z)) {
  player.position.x = nextX;
}

if (Math.abs(nextZ) < 11.5 && !isBlocked(player.position.x, nextZ)) {
  player.position.z = nextZ;
}

  // ROBOT ROTATION
  if (dx !== 0 || dz !== 0) {
    player.rotation.y = Math.atan2(dx, dz);
  }
}


const particles = [];

function createCollectionEffect(position) {
  const particleGeometry = new THREE.SphereGeometry(0.07, 8, 8);

  for (let i = 0; i < 12; i++) {
    const material = new THREE.MeshBasicMaterial({
      color: 0x00ddff
    });

    const particle = new THREE.Mesh(particleGeometry, material);

    particle.position.copy(position);

    particle.userData.velocity = new THREE.Vector3(
      (Math.random() - 0.5) * 0.18,
      Math.random() * 0.16,
      (Math.random() - 0.5) * 0.18
    );

    particle.userData.life = 1;

    scene.add(particle);
    particles.push(particle);
  }
}

function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const particle = particles[i];

    particle.position.add(particle.userData.velocity);
    particle.userData.life -= 0.025;
    particle.scale.multiplyScalar(0.97);

    if (particle.userData.life <= 0) {
      scene.remove(particle);
      particle.geometry.dispose();
      particle.material.dispose();
      particles.splice(i, 1);
    }
  }
}

// SOUND EFFECTS
const collectSound = new Audio('/sounds/collect.mp3');
collectSound.volume = 0.5;

const portalSound = new Audio('/sounds/portal.mp3');
const victorySound = new Audio('/sounds/victory.mp3');
const gameOverSound = new Audio('/sounds/gameover.mp3');

portalSound.volume = 0.6;
victorySound.volume = 0.7;
gameOverSound.volume = 0.7;

// COLLECT CRYSTALS
function showFloatingText(position) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  canvas.width = 256;
  canvas.height = 64;

  context.font = 'bold 32px Arial';
  context.textAlign = 'center';
  context.fillStyle = '#00ffff';
  context.shadowColor = '#00ffff';
  context.shadowBlur = 15;
  context.fillText('+1 ENERGY', 128, 42);

  const texture = new THREE.CanvasTexture(canvas);

  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true
  });

  const sprite = new THREE.Sprite(material);
  sprite.position.copy(position);
  sprite.position.y += 1.5;
  sprite.scale.set(2.5, 0.6, 1);

  scene.add(sprite);

  floatingTexts.push({
    sprite: sprite,
    life: 1
  });
}

const floatingTexts = [];

function updateFloatingTexts() {
  for (let i = floatingTexts.length - 1; i >= 0; i--) {
    const item = floatingTexts[i];

    item.sprite.position.y += 0.025;
    item.life -= 0.02;

    item.sprite.material.opacity = item.life;

    if (item.life <= 0) {
      scene.remove(item.sprite);
      item.sprite.material.map.dispose();
      item.sprite.material.dispose();

      floatingTexts.splice(i, 1);
    }
  }
}

function checkCollections() {
  crystals.forEach((crystal) => {
    if (!crystal.visible) return;

    const distance = player.position.distanceTo(crystal.position);

    if (distance < 1.5) {
  createCollectionEffect(crystal.position);

  showFloatingText(crystal.position);

  collectSound.currentTime = 0;
collectSound.play();

  crystal.visible = false;
  score++;
  scoreText.textContent = `${score} / 5`;
}
  });
}

// GAME TIMER
let lastTime = 0;

function updateTimer(delta) {
  if (!playing) return;

  timeLeft -= delta;

  timerText.textContent = Math.max(0, Math.ceil(timeLeft));

  if (timeLeft <= 0) endGame(false);
}

// WIN / LOSE
function endGame(won) {
  if (gameOver) return;

  playing = false;
  gameOver = true;

  message.style.display = 'flex';
  message.querySelector('h1').textContent =
    won ? 'MISSION COMPLETE!' : 'TIME IS UP!';

  message.querySelector('p').textContent =
    won ? 'You saved the reactor!' : `You collected ${score} crystals.`;

  message.querySelector('.controls').textContent =
    'Press the button to play again';

  document.querySelector('#start').textContent = 'PLAY AGAIN';
}

// START / RESTART
function startGame() {
  score = 0;
  timeLeft = 60;
  playing = true;
  gameOver = false;

  

  player.position.set(-10, 0, 10);

  crystals.forEach((crystal) => {
    crystal.visible = true;
  });

  scoreText.textContent = '0 / 5';
  timerText.textContent = '60';

  message.style.display = 'none';
  lastTime = 0;
}

document.querySelector('#start').addEventListener('click', startGame);

// ANIMATION LOOP
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const delta = Math.min(clock.getDelta(), 0.05);

  crystals.forEach((crystal) => {
    if (crystal.visible) {
      crystal.rotation.y += 0.02;
      crystal.position.y = 1.1 + Math.sin(performance.now() * 0.002 + crystal.position.x) * 0.12;
    }
  });

  portal.rotation.z += 0.01;

  portal.scale.setScalar(
  1 + Math.sin(performance.now() * 0.003) * 0.05
  );

  movePlayer();
  updateParticles();
  updateFloatingTexts();

  // SMOOTH CAMERA FOLLOW
const cameraTarget = new THREE.Vector3(
  player.position.x,
  19,
  player.position.z + 23
);

camera.position.lerp(cameraTarget, 0.05);

camera.lookAt(
  player.position.x,
  0,
  player.position.z
);

  if (playing) {
    checkCollections();
    updateTimer(delta);

    const portalDistance = player.position.distanceTo(portal.position);

    if (score === 5 && portalDistance < 2) {
  portalSound.currentTime = 0;
  portalSound.play();

  victorySound.currentTime = 0;
  victorySound.play();

  endGame(true);
}
  }

  renderer.render(scene, camera);
}

animate();

// RESPONSIVE SCREEN
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
