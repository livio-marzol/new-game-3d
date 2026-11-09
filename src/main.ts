import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// --- CONFIG & STATE ---
const CONFIG = {
  walkSpeed: 3.8,
  runSpeed: 6.8,
  acceleration: 14.0,
  deceleration: 12.0,
  turnSpeed: 10.0,
  playerHeight: 1.8,
};

// Camera modes: 0 = Over-the-shoulder (Resident Evil action), 1 = Center, 2 = Wide
let cameraMode = 0;
const CAMERA_PRESETS = [
  { name: 'Ombro (Resident Evil)', distance: 3.0, height: 1.85, shoulderOffset: 0.65, lookHeight: 1.45 },
  { name: 'Centralizada', distance: 4.2, height: 2.2, shoulderOffset: 0.0, lookHeight: 1.3 },
  { name: 'Panorâmica', distance: 6.5, height: 3.5, shoulderOffset: 0.0, lookHeight: 1.2 }
];

// --- THREE.JS INITIALIZATION ---
const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance'
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0e111a);
scene.fog = new THREE.FogExp2(0x0e111a, 0.015);

const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  200
);

// --- LIGHTING ---
// 1. Soft HemisphereLight (Sky / Ground bounce)
const hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x111827, 1.2);
hemiLight.position.set(0, 50, 0);
scene.add(hemiLight);

// 2. Main DirectionalLight with shadows
const dirLight = new THREE.DirectionalLight(0xffffff, 2.5);
dirLight.position.set(18, 30, 18);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 2048;
dirLight.shadow.mapSize.height = 2048;
dirLight.shadow.camera.near = 0.5;
dirLight.shadow.camera.far = 70;
const d = 16;
dirLight.shadow.camera.left = -d;
dirLight.shadow.camera.right = d;
dirLight.shadow.camera.top = d;
dirLight.shadow.camera.bottom = -d;
dirLight.shadow.bias = -0.0005;
scene.add(dirLight);

// Subtle warm fill light
const fillLight = new THREE.DirectionalLight(0x93c5fd, 0.6);
fillLight.position.set(-15, 10, -15);
scene.add(fillLight);

// --- SCENERY ---
function createEnvironment() {
  // Ground plane with subtle grid pattern
  const groundSize = 120;
  const groundGeo = new THREE.PlaneGeometry(groundSize, groundSize);
  
  // Custom procedural grid canvas texture
  const gridCanvas = document.createElement('canvas');
  gridCanvas.width = 512;
  gridCanvas.height = 512;
  const ctx = gridCanvas.getContext('2d')!;
  ctx.fillStyle = '#111420';
  ctx.fillRect(0, 0, 512, 512);

  // Subtle tile grid lines
  ctx.strokeStyle = '#1e2438';
  ctx.lineWidth = 4;
  const step = 64;
  for (let x = 0; x <= 512; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 512);
    ctx.stroke();
  }
  for (let y = 0; y <= 512; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(512, y);
    ctx.stroke();
  }

  // Cross accents
  ctx.fillStyle = '#2563eb';
  for (let x = 0; x <= 512; x += step) {
    for (let y = 0; y <= 512; y += step) {
      ctx.fillRect(x - 2, y - 2, 4, 4);
    }
  }

  const groundTexture = new THREE.CanvasTexture(gridCanvas);
  groundTexture.wrapS = THREE.RepeatWrapping;
  groundTexture.wrapT = THREE.RepeatWrapping;
  groundTexture.repeat.set(groundSize / 4, groundSize / 4);

  const groundMat = new THREE.MeshStandardMaterial({
    map: groundTexture,
    roughness: 0.85,
    metalness: 0.15
  });

  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Center spawn podium
  const platformGeo = new THREE.CylinderGeometry(4, 4.3, 0.1, 48);
  const platformMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.5,
    metalness: 0.5
  });
  const platform = new THREE.Mesh(platformGeo, platformMat);
  platform.position.y = 0.05;
  platform.receiveShadow = true;
  scene.add(platform);

  // Decorative ring
  const ringGeo = new THREE.RingGeometry(3.7, 3.9, 48);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.11;
  scene.add(ring);

  // Sci-fi architectural columns and obstacles for shadows
  const columnMat = new THREE.MeshStandardMaterial({
    color: 0x242b3d,
    roughness: 0.4,
    metalness: 0.6
  });

  const crateMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.7,
    metalness: 0.2
  });

  const obstacles = [
    { type: 'col', x: 8, z: 8, r: 0.8, h: 6 },
    { type: 'col', x: -8, z: 8, r: 0.8, h: 6 },
    { type: 'col', x: 8, z: -8, r: 0.8, h: 6 },
    { type: 'col', x: -8, z: -8, r: 0.8, h: 6 },
    { type: 'crate', x: 4, z: -5, w: 1.6, h: 1.4, d: 1.6, rot: 0.3 },
    { type: 'crate', x: -5, z: 4, w: 2.0, h: 1.0, d: 2.0, rot: -0.4 },
    { type: 'crate', x: -7, z: -6, w: 1.8, h: 2.2, d: 1.8, rot: 0.6 },
    { type: 'col', x: 16, z: 0, r: 1.2, h: 8 },
    { type: 'col', x: -16, z: 0, r: 1.2, h: 8 },
    { type: 'col', x: 0, z: 18, r: 1.2, h: 8 },
    { type: 'col', x: 0, z: -18, r: 1.2, h: 8 },
  ];

  obstacles.forEach((obs) => {
    if (obs.type === 'col') {
      const geo = new THREE.CylinderGeometry(obs.r, obs.r, obs.h, 24);
      const mesh = new THREE.Mesh(geo, columnMat);
      mesh.position.set(obs.x, obs.h / 2, obs.z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);

      // Light ring on column top
      const topRingGeo = new THREE.CylinderGeometry(obs.r * 1.05, obs.r * 1.05, 0.2, 24);
      const topRingMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
      const topRing = new THREE.Mesh(topRingGeo, topRingMat);
      topRing.position.set(obs.x, obs.h - 0.5, obs.z);
      scene.add(topRing);
    } else {
      const geo = new THREE.BoxGeometry(obs.w, obs.h, obs.d);
      const mesh = new THREE.Mesh(geo, crateMat);
      mesh.position.set(obs.x, obs.h / 2, obs.z);
      mesh.rotation.y = obs.rot || 0;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
    }
  });
}

createEnvironment();

// --- PLAYER CONTROLLER CLASS ---
class PlayerController {
  public group = new THREE.Group();
  public model: THREE.Object3D | null = null;
  public mixer: THREE.AnimationMixer | null = null;

  public idleAction: THREE.AnimationAction | null = null;
  public walkAction: THREE.AnimationAction | null = null;
  public currentAction: THREE.AnimationAction | null = null;

  public velocity = new THREE.Vector3();
  public currentSpeed = 0;
  public targetRotation = 0;
  public isMoving = false;

  private loader = new GLTFLoader();

  constructor() {
    scene.add(this.group);
  }

  public async loadModel(url: string, onProgress?: (pct: number) => void): Promise<void> {
    return new Promise((resolve, reject) => {
      this.loader.load(
        url,
        (gltf) => {
          this.model = gltf.scene;

          // 1. Enable Cast and Receive Shadows
          this.model.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              const mesh = child as THREE.Mesh;
              mesh.castShadow = true;
              mesh.receiveShadow = true;
              if (mesh.material) {
                // Ensure double-side or realistic shadows
                const mat = mesh.material as THREE.MeshStandardMaterial;
                mat.roughness = Math.min(mat.roughness ?? 0.7, 0.9);
              }
            }
          });

          // 2. Realistic Scale (approx 1.8m height) & align feet to y = 0
          this.model.updateMatrixWorld(true);
          const initialBox = new THREE.Box3().setFromObject(this.model);
          const size = new THREE.Vector3();
          initialBox.getSize(size);

          const modelHeight = size.y > 0.05 ? size.y : 1.0;
          const scaleFactor = CONFIG.playerHeight / modelHeight;
          this.model.scale.setScalar(scaleFactor);

          // Re-calculate bounding box after scaling
          this.model.updateMatrixWorld(true);
          const scaledBox = new THREE.Box3().setFromObject(this.model);

          // Place feet exactly on the floor (y = 0)
          this.model.position.y = -scaledBox.min.y;

          this.group.add(this.model);

          // 3. Setup Animation Mixer & Actions
          this.mixer = new THREE.AnimationMixer(this.model);

          if (gltf.animations.length > 0) {
            console.log('Animações encontradas:', gltf.animations.map(a => `${a.name} (${a.duration.toFixed(2)}s)`));

            let idleClip = gltf.animations.find(a => /idle/i.test(a.name));
            let walkClip = gltf.animations.find(a => /walk|run/i.test(a.name));

            // Mixamo default clip detection: longest clip is idle (~7.7s), shorter clip is walk (~1s)
            if (!idleClip) {
              const sorted = [...gltf.animations].sort((a, b) => b.duration - a.duration);
              idleClip = sorted[0];
              walkClip = sorted[1] || sorted[0];
            } else if (!walkClip) {
              walkClip = gltf.animations.find(a => a !== idleClip) || idleClip;
            }

            this.idleAction = this.mixer.clipAction(idleClip);
            this.walkAction = this.mixer.clipAction(walkClip);

            this.idleAction.setLoop(THREE.LoopRepeat, Infinity);
            this.walkAction.setLoop(THREE.LoopRepeat, Infinity);

            // Start with Idle animation
            this.idleAction.play();
            this.currentAction = this.idleAction;
          }

          resolve();
        },
        (xhr) => {
          if (xhr.total > 0 && onProgress) {
            onProgress((xhr.loaded / xhr.total) * 100);
          }
        },
        (err) => {
          reject(err);
        }
      );
    });
  }

  public switchAction(toAction: THREE.AnimationAction | null, duration = 0.25) {
    if (!toAction || this.currentAction === toAction) return;

    toAction.reset();
    toAction.enabled = true;
    toAction.setEffectiveTimeScale(1);
    toAction.setEffectiveWeight(1);

    if (this.currentAction) {
      toAction.crossFadeFrom(this.currentAction, duration, true);
    }
    toAction.play();
    this.currentAction = toAction;
  }

  public update(delta: number, inputDirection: THREE.Vector3, isRunning: boolean, cameraAzimuth: number) {
    if (this.mixer) {
      this.mixer.update(delta);
    }

    const hasInput = inputDirection.lengthSq() > 0.001;
    const targetMaxSpeed = isRunning ? CONFIG.runSpeed : CONFIG.walkSpeed;

    // Movement relative to camera azimuth
    if (hasInput) {
      // Rotate input direction by camera horizontal angle
      const moveAngle = Math.atan2(inputDirection.x, inputDirection.z) + cameraAzimuth;
      const moveVector = new THREE.Vector3(Math.sin(moveAngle), 0, Math.cos(moveAngle));

      // Accelerate towards target velocity
      const targetVel = moveVector.multiplyScalar(targetMaxSpeed);
      this.velocity.lerp(targetVel, Math.min(1, CONFIG.acceleration * delta));

      // Target character rotation to face movement direction
      this.targetRotation = moveAngle;
    } else {
      // Decelerate smoothly to stop
      this.velocity.lerp(new THREE.Vector3(0, 0, 0), Math.min(1, CONFIG.deceleration * delta));
    }

    // Apply movement to position
    this.group.position.addScaledVector(this.velocity, delta);

    // Smooth character rotation towards targetRotation
    const currentRot = this.group.rotation.y;
    let diff = this.targetRotation - currentRot;
    // Normalize angle difference to [-PI, PI]
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;
    this.group.rotation.y += diff * Math.min(1, CONFIG.turnSpeed * delta);

    // Current horizontal speed
    this.currentSpeed = this.velocity.length();
    this.isMoving = this.currentSpeed > 0.15;

    // Transition animations based on speed
    if (this.isMoving) {
      if (this.currentAction !== this.walkAction) {
        this.switchAction(this.walkAction, 0.22);
      }
      // Scale walk animation playback with actual speed
      if (this.walkAction) {
        const baseSpeed = CONFIG.walkSpeed;
        this.walkAction.timeScale = THREE.MathUtils.clamp(this.currentSpeed / baseSpeed, 0.6, 2.0);
      }
    } else {
      if (this.currentAction !== this.idleAction) {
        this.switchAction(this.idleAction, 0.28);
      }
    }
  }
}

// --- INPUT HANDLER ---
const keys = {
  forward: false,
  backward: false,
  left: false,
  right: false,
  run: false
};

window.addEventListener('keydown', (e) => {
  switch (e.code) {
    case 'KeyW':
    case 'ArrowUp':
      keys.forward = true;
      break;
    case 'KeyS':
    case 'ArrowDown':
      keys.backward = true;
      break;
    case 'KeyA':
    case 'ArrowLeft':
      keys.left = true;
      break;
    case 'KeyD':
    case 'ArrowRight':
      keys.right = true;
      break;
    case 'ShiftLeft':
    case 'ShiftRight':
      keys.run = true;
      break;
    case 'KeyC':
      // Cycle camera preset
      cameraMode = (cameraMode + 1) % CAMERA_PRESETS.length;
      break;
  }
});

window.addEventListener('keyup', (e) => {
  switch (e.code) {
    case 'KeyW':
    case 'ArrowUp':
      keys.forward = false;
      break;
    case 'KeyS':
    case 'ArrowDown':
      keys.backward = false;
      break;
    case 'KeyA':
    case 'ArrowLeft':
      keys.left = false;
      break;
    case 'KeyD':
    case 'ArrowRight':
      keys.right = false;
      break;
    case 'ShiftLeft':
    case 'ShiftRight':
      keys.run = false;
      break;
  }
});

// --- MOUSE CAMERA CONTROLS (ORBIT / THIRD PERSON LOOK) ---
let isMouseDown = false;
let mouseX = 0;
let mouseY = 0;
let cameraYaw = 0; // Horizontal orbit angle (radians)
let cameraPitch = 0.15; // Vertical elevation angle (radians)

window.addEventListener('mousedown', (e) => {
  // Drag anywhere on canvas
  if (e.button === 0 || e.button === 2) {
    isMouseDown = true;
    mouseX = e.clientX;
    mouseY = e.clientY;
  }
});

window.addEventListener('mouseup', () => {
  isMouseDown = false;
});

window.addEventListener('mousemove', (e) => {
  if (!isMouseDown) return;
  const deltaX = e.clientX - mouseX;
  const deltaY = e.clientY - mouseY;
  mouseX = e.clientX;
  mouseY = e.clientY;

  cameraYaw -= deltaX * 0.005;
  cameraPitch += deltaY * 0.004;

  // Clamp vertical pitch so camera doesn't flip or go under floor
  cameraPitch = THREE.MathUtils.clamp(cameraPitch, -0.2, 0.85);
});

// Prevent context menu when right clicking
window.addEventListener('contextmenu', (e) => e.preventDefault());

// --- CAMERA CONTROLLER ---
const cameraTargetLookAt = new THREE.Vector3();
const desiredCameraPos = new THREE.Vector3();

function updateCamera(playerPos: THREE.Vector3, playerRotationY: number, delta: number) {
  const preset = CAMERA_PRESETS[cameraMode];

  // Base look position around player chest/head
  const lookPos = new THREE.Vector3(
    playerPos.x,
    playerPos.y + preset.lookHeight,
    playerPos.z
  );

  // Smooth target look position
  cameraTargetLookAt.lerp(lookPos, 1 - Math.exp(-14 * delta));

  // Compute camera position relative to orbit angles (cameraYaw and cameraPitch)
  // Horizontal orbit direction
  const cosPitch = Math.cos(cameraPitch);
  const sinPitch = Math.sin(cameraPitch);
  const sinYaw = Math.sin(cameraYaw);
  const cosYaw = Math.cos(cameraYaw);

  // Backward direction vector
  const backVector = new THREE.Vector3(
    sinYaw * cosPitch,
    sinPitch,
    cosYaw * cosPitch
  ).normalize();

  // Right direction vector for shoulder offset
  const rightVector = new THREE.Vector3(
    Math.cos(cameraYaw),
    0,
    -Math.sin(cameraYaw)
  ).normalize();

  // Position = LookTarget + Back * distance + Right * shoulderOffset + Y * height
  desiredCameraPos.copy(cameraTargetLookAt)
    .addScaledVector(backVector, preset.distance)
    .addScaledVector(rightVector, preset.shoulderOffset);

  // Keep camera above floor
  if (desiredCameraPos.y < 0.4) {
    desiredCameraPos.y = 0.4;
  }

  // Smooth lerp camera position
  camera.position.lerp(desiredCameraPos, 1 - Math.exp(-10 * delta));
  camera.lookAt(cameraTargetLookAt);

  // Directional light follows player position for consistent crisp shadows
  dirLight.position.set(playerPos.x + 18, 30, playerPos.z + 18);
  dirLight.target.position.copy(playerPos);
  dirLight.target.updateMatrixWorld();
}

// --- INITIALIZE & START ---
const player = new PlayerController();

const progressBar = document.getElementById('progress-bar') as HTMLElement;
const loadingText = document.getElementById('loading-text') as HTMLElement;
const loadingOverlay = document.getElementById('loading-overlay') as HTMLElement;
const statState = document.getElementById('stat-state') as HTMLElement;
const statSpeed = document.getElementById('stat-speed') as HTMLElement;
const statFps = document.getElementById('stat-fps') as HTMLElement;

// Try loading models: first check 'player.glb', fallback to './player.glb' or './models/player.glb'
async function start() {
  const modelCandidates = [
    './models/player.glb',
    './player.glb',
    '/player.glb',
    'playerglb.glb',
    'playerwalking.glb'
  ];

  let loaded = false;
  for (const url of modelCandidates) {
    try {
      loadingText.textContent = `Carregando modelo (${url})...`;
      await player.loadModel(url, (pct) => {
        progressBar.style.width = `${pct}%`;
      });
      loaded = true;
      console.log(`Modelo carregado com sucesso a partir de: ${url}`);
      break;
    } catch (err) {
      console.warn(`Falha ao tentar carregar ${url}:`, err);
    }
  }

  if (!loaded) {
    loadingText.textContent = 'Erro ao carregar o modelo player.glb';
    return;
  }

  // Hide loading screen
  loadingOverlay.classList.add('fade-out');

  // Start Animation Loop
  let lastTime = performance.now();
  let frameCount = 0;
  let fpsTimer = performance.now();

  function animate(currentTime: number) {
    requestAnimationFrame(animate);

    const delta = Math.min((currentTime - lastTime) / 1000, 0.1);
    lastTime = currentTime;

    // FPS calculation
    frameCount++;
    if (currentTime - fpsTimer >= 500) {
      const fps = Math.round((frameCount * 1000) / (currentTime - fpsTimer));
      statFps.textContent = fps.toString();
      frameCount = 0;
      fpsTimer = currentTime;
    }

    // Compute input movement direction
    const inputDir = new THREE.Vector3();
    if (keys.forward) inputDir.z += 1;
    if (keys.backward) inputDir.z -= 1;
    if (keys.left) inputDir.x += 1;
    if (keys.right) inputDir.x -= 1;

    if (inputDir.lengthSq() > 0.001) {
      inputDir.normalize();
    }

    // Update Player physics & animations
    player.update(delta, inputDir, keys.run, cameraYaw);

    // Update Third Person Camera
    updateCamera(player.group.position, player.group.rotation.y, delta);

    // Update HUD Stats
    if (statState) {
      statState.textContent = player.isMoving ? (keys.run ? 'Correndo' : 'Caminhando') : 'Idle';
      statState.style.color = player.isMoving ? '#34d399' : '#38bdf8';
    }
    if (statSpeed) {
      statSpeed.textContent = `${player.currentSpeed.toFixed(1)} m/s`;
    }

    renderer.render(scene, camera);
  }

  requestAnimationFrame(animate);
}

// Window resize handler
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

start();
