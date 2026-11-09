import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// --- CONFIG & STATE ---
const CONFIG = {
  walkSpeed: 3.8,
  runSpeed: 6.8,
  acceleration: 15.0,
  deceleration: 14.0,
  turnSpeed: 10.0,
  playerHeight: 1.8,
  playerCollisionRadius: 0.4
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

// --- RIGID OBSTACLES & SCENERY ---
export interface ObstacleCollider {
  type: 'col' | 'crate';
  x: number;
  z: number;
  r?: number; // Radius for columns
  h?: number; // Height
  w?: number; // Width for crates
  d?: number; // Depth for crates
  rot?: number; // Rotation in Y (radians)
}

export const OBSTACLES: ObstacleCollider[] = [
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

function createEnvironment() {
  // Ground plane with subtle procedural grid pattern
  const groundSize = 120;
  const groundGeo = new THREE.PlaneGeometry(groundSize, groundSize);
  
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

  // Materials for columns and crates
  const columnMat = new THREE.MeshStandardMaterial({
    color: 0x1e2230,
    roughness: 0.35,
    metalness: 0.7
  });

  const crateMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.7,
    metalness: 0.25
  });

  // Build physical meshes for all obstacles
  OBSTACLES.forEach((obs) => {
    if (obs.type === 'col') {
      const geo = new THREE.CylinderGeometry(obs.r, obs.r, obs.h, 32);
      const mesh = new THREE.Mesh(geo, columnMat);
      mesh.position.set(obs.x, (obs.h || 6) / 2, obs.z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);

      // Light ring on column top
      const topRingGeo = new THREE.CylinderGeometry((obs.r || 0.8) * 1.05, (obs.r || 0.8) * 1.05, 0.2, 32);
      const topRingMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
      const topRing = new THREE.Mesh(topRingGeo, topRingMat);
      topRing.position.set(obs.x, (obs.h || 6) - 0.5, obs.z);
      scene.add(topRing);
    } else {
      const geo = new THREE.BoxGeometry(obs.w, obs.h, obs.d);
      const mesh = new THREE.Mesh(geo, crateMat);
      mesh.position.set(obs.x, (obs.h || 1.4) / 2, obs.z);
      mesh.rotation.y = obs.rot || 0;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
    }
  });
}

createEnvironment();

// --- COLLISION DETECTION & RESOLUTION ---
interface CollisionHit {
  collided: boolean;
  normalX: number;
  normalZ: number;
  penetration: number;
}

function checkObstacleCollision(posX: number, posZ: number, radius = CONFIG.playerCollisionRadius): CollisionHit | null {
  for (const obs of OBSTACLES) {
    if (obs.type === 'col') {
      const colRadius = obs.r || 0.8;
      const dx = posX - obs.x;
      const dz = posZ - obs.z;
      const distSq = dx * dx + dz * dz;
      const minDist = colRadius + radius;

      if (distSq < minDist * minDist) {
        const dist = Math.sqrt(distSq);
        const nx = dist > 0.0001 ? dx / dist : 1;
        const nz = dist > 0.0001 ? dz / dist : 0;
        return {
          collided: true,
          normalX: nx,
          normalZ: nz,
          penetration: minDist - dist
        };
      }
    } else if (obs.type === 'crate') {
      const hw = (obs.w || 1.6) / 2;
      const hd = (obs.d || 1.6) / 2;
      const rot = obs.rot || 0;

      // Transform player position to crate's local coordinate space
      const dx = posX - obs.x;
      const dz = posZ - obs.z;
      const cos = Math.cos(-rot);
      const sin = Math.sin(-rot);
      const localX = dx * cos - dz * sin;
      const localZ = dx * sin + dz * cos;

      // Closest point on the AABB in local space
      const closestX = Math.max(-hw, Math.min(hw, localX));
      const closestZ = Math.max(-hd, Math.min(hd, localZ));

      const diffX = localX - closestX;
      const diffZ = localZ - closestZ;
      const distSq = diffX * diffX + diffZ * diffZ;

      if (distSq < radius * radius) {
        const dist = Math.sqrt(distSq);
        let normLocX = 0;
        let normLocZ = 0;
        let pen = 0;

        if (dist > 0.0001) {
          normLocX = diffX / dist;
          normLocZ = diffZ / dist;
          pen = radius - dist;
        } else {
          // Inside crate center - push to nearest face
          const overlapX = hw - Math.abs(localX);
          const overlapZ = hd - Math.abs(localZ);
          if (overlapX < overlapZ) {
            normLocX = Math.sign(localX) || 1;
            pen = overlapX + radius;
          } else {
            normLocZ = Math.sign(localZ) || 1;
            pen = overlapZ + radius;
          }
        }

        // Rotate normal back to world space
        const cosW = Math.cos(rot);
        const sinW = Math.sin(rot);
        const worldNormX = normLocX * cosW - normLocZ * sinW;
        const worldNormZ = normLocX * sinW + normLocZ * cosW;

        return {
          collided: true,
          normalX: worldNormX,
          normalZ: worldNormZ,
          penetration: pen
        };
      }
    }
  }
  return null;
}

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

  public async loadCharacter(onProgress?: (pct: number) => void): Promise<void> {
    // 1. CARREGAR A TEXTURA ORIGINAL DA ROUPA DO LEON EM player.glb
    let characterTexture: THREE.Texture | null = null;
    let characterMaterial: THREE.MeshStandardMaterial | null = null;

    const textureUrls = [
      './player.glb',
      '/player.glb',
      './models/player.glb',
      '/models/player.glb'
    ];

    for (const url of textureUrls) {
      try {
        const texGltf = await new Promise<any>((resolve, reject) => {
          this.loader.load(url, resolve, undefined, reject);
        });

        if (texGltf && texGltf.scene) {
          texGltf.scene.traverse((child: any) => {
            if (child.isMesh && child.material) {
              const mat = Array.isArray(child.material) ? child.material[0] : child.material;
              if (mat.map) {
                characterTexture = mat.map;
                characterTexture.colorSpace = THREE.SRGBColorSpace;
                characterTexture.flipY = false;
                characterTexture.needsUpdate = true;
              }
              characterMaterial = mat;
            }
          });
          if (characterTexture || characterMaterial) {
            console.log(`[Texturas] Textura do Leon carregada com sucesso de ${url}`);
            break;
          }
        }
      } catch (e) {
        // Continue to next candidate
      }
    }

    // 2. CARREGAR O MODELO COM ESQUELETO E ANIMAÇÕES (playerwalking.glb)
    const animUrls = [
      './playerwalking.glb',
      '/playerwalking.glb',
      './models/playerwalking.glb',
      '/models/playerwalking.glb',
      './playerglb.glb',
      '/playerglb.glb'
    ];

    let animGltf: any = null;
    for (const url of animUrls) {
      try {
        animGltf = await new Promise<any>((resolve, reject) => {
          this.loader.load(url, resolve, (xhr) => {
            if (xhr.total > 0 && onProgress) {
              onProgress((xhr.loaded / xhr.total) * 100);
            }
          }, reject);
        });
        if (animGltf && animGltf.scene) {
          console.log(`[Animações] Modelo animado carregado com sucesso de ${url}`);
          break;
        }
      } catch (e) {
        // Continue to next candidate
      }
    }

    if (!animGltf) {
      throw new Error('Falha ao carregar o modelo de esqueleto/animações.');
    }

    this.model = animGltf.scene;

    // 3. APLICAR TEXTURA/MATERIAL PBR NA MALHA (SkinnedMesh)
    this.model.traverse((child: any) => {
      if (child.isMesh || child.isSkinnedMesh) {
        child.castShadow = true;
        child.receiveShadow = true;

        if (child.material) {
          const mat = child.material as THREE.MeshStandardMaterial;
          if (characterTexture) {
            mat.map = characterTexture;
            mat.color.set(0xffffff); // Cor base pura para manter as cores reais da roupa
            mat.roughness = 0.8;
            mat.metalness = 0.1;
            mat.needsUpdate = true;
          } else if (characterMaterial) {
            child.material = characterMaterial;
          }
        }
      }
    });

    // 4. AJUSTE DE ESCALA PARA ALTURA HUMANA REALISTA (~1.8m)
    this.model.updateMatrixWorld(true);
    const initialBox = new THREE.Box3().setFromObject(this.model);
    const size = new THREE.Vector3();
    initialBox.getSize(size);

    const modelHeight = size.y > 0.05 ? size.y : 1.0;
    const scaleFactor = CONFIG.playerHeight / modelHeight;
    this.model.scale.setScalar(scaleFactor);
    this.model.updateMatrixWorld(true);

    this.group.add(this.model);

    // 5. INICIALIZAR MIXER E ANIMAÇÃO IDLE EM LOOP
    this.mixer = new THREE.AnimationMixer(this.model);

    if (animGltf.animations && animGltf.animations.length > 0) {
      let idleClip = animGltf.animations.find((a: any) => /idle/i.test(a.name));
      let walkClip = animGltf.animations.find((a: any) => /walk|run/i.test(a.name));

      // Caso não encontre por nome, o Mixamo define idle como o clipe longo (~7.7s) e walk como o curto (~1s)
      if (!idleClip) {
        const sorted = [...animGltf.animations].sort((a: any, b: any) => b.duration - a.duration);
        idleClip = sorted[0];
        walkClip = sorted[1] || sorted[0];
      } else if (!walkClip) {
        walkClip = animGltf.animations.find((a: any) => a !== idleClip) || idleClip;
      }

      this.idleAction = this.mixer.clipAction(idleClip);
      this.walkAction = this.mixer.clipAction(walkClip);

      this.idleAction.setLoop(THREE.LoopRepeat, Infinity);
      this.walkAction.setLoop(THREE.LoopRepeat, Infinity);

      this.idleAction.play();
      this.currentAction = this.idleAction;

      // Executa o primeiro frame de animação para computar a matriz dos ossos
      this.mixer.update(0.001);
    }

    // 6. AJUSTE DOS PÉS NO CHÃO (ELIMINAR FLUTUAÇÃO COM PRECISÃO MATEMÁTICA)
    this.model.updateMatrixWorld(true);
    const realBox = new THREE.Box3().setFromObject(this.model);
    // Subtrai o valor de realBox.min.y da posição vertical do modelo
    this.model.position.y -= realBox.min.y;
    this.model.updateMatrixWorld(true);

    console.log(`[Pés no Chão] Ajuste vertical aplicado: -${realBox.min.y.toFixed(4)}m (Posição Y final: ${this.model.position.y.toFixed(4)})`);
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

    // Movimentação relativa ao ângulo horizontal da câmera
    if (hasInput) {
      const moveAngle = Math.atan2(inputDirection.x, inputDirection.z) + cameraAzimuth;
      const moveVector = new THREE.Vector3(Math.sin(moveAngle), 0, Math.cos(moveAngle));

      const targetVel = moveVector.multiplyScalar(targetMaxSpeed);
      this.velocity.lerp(targetVel, Math.min(1, CONFIG.acceleration * delta));

      this.targetRotation = moveAngle;
    } else {
      // Desaceleração suave
      this.velocity.lerp(new THREE.Vector3(0, 0, 0), Math.min(1, CONFIG.deceleration * delta));
    }

    // --- SISTEMA DE COLISÃO COM DESLIZAMENTO NAS LATERAIS ---
    const moveStep = this.velocity.clone().multiplyScalar(delta);

    // Teste no eixo X
    if (Math.abs(moveStep.x) > 0.0001) {
      const nextX = this.group.position.x + moveStep.x;
      const colX = checkObstacleCollision(nextX, this.group.position.z, CONFIG.playerCollisionRadius);
      if (!colX) {
        this.group.position.x = nextX;
      } else {
        // Bloqueia avanço em X mas permite deslizar pelo eixo Z
        this.velocity.x = 0;
      }
    }

    // Teste no eixo Z
    if (Math.abs(moveStep.z) > 0.0001) {
      const nextZ = this.group.position.z + moveStep.z;
      const colZ = checkObstacleCollision(this.group.position.x, nextZ, CONFIG.playerCollisionRadius);
      if (!colZ) {
        this.group.position.z = nextZ;
      } else {
        // Bloqueia avanço em Z mas permite deslizar pelo eixo X
        this.velocity.z = 0;
      }
    }

    // Repulsão suave para bordas/quinas (evita prender em vértices)
    for (let pass = 0; pass < 2; pass++) {
      const col = checkObstacleCollision(this.group.position.x, this.group.position.z, CONFIG.playerCollisionRadius);
      if (col && col.penetration > 0.0001) {
        this.group.position.x += col.normalX * col.penetration;
        this.group.position.z += col.normalZ * col.penetration;
      }
    }

    // Limites de borda da arena
    const boundary = 56;
    this.group.position.x = THREE.MathUtils.clamp(this.group.position.x, -boundary, boundary);
    this.group.position.z = THREE.MathUtils.clamp(this.group.position.z, -boundary, boundary);

    // Rotação suave do personagem em direção ao movimento
    const currentRot = this.group.rotation.y;
    let diff = this.targetRotation - currentRot;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;
    this.group.rotation.y += diff * Math.min(1, CONFIG.turnSpeed * delta);

    // Velocidade escalar e controle de animações
    this.currentSpeed = this.velocity.length();
    this.isMoving = this.currentSpeed > 0.15;

    if (this.isMoving) {
      if (this.currentAction !== this.walkAction) {
        this.switchAction(this.walkAction, 0.22);
      }
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

// --- CONTROLES DE TECLADO ---
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

// --- CONTROLE DE CÂMERA PELO MOUSE (ÓRBITA EM TERCEIRA PESSOA) ---
let isMouseDown = false;
let mouseX = 0;
let mouseY = 0;
let cameraYaw = 0;
let cameraPitch = 0.15;

window.addEventListener('mousedown', (e) => {
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

  cameraPitch = THREE.MathUtils.clamp(cameraPitch, -0.2, 0.85);
});

window.addEventListener('contextmenu', (e) => e.preventDefault());

// --- CONTROLE DA CÂMERA (LERP SUAVE) ---
const cameraTargetLookAt = new THREE.Vector3();
const desiredCameraPos = new THREE.Vector3();

function updateCamera(playerPos: THREE.Vector3, delta: number) {
  const preset = CAMERA_PRESETS[cameraMode];

  const lookPos = new THREE.Vector3(
    playerPos.x,
    playerPos.y + preset.lookHeight,
    playerPos.z
  );

  cameraTargetLookAt.lerp(lookPos, 1 - Math.exp(-14 * delta));

  const cosPitch = Math.cos(cameraPitch);
  const sinPitch = Math.sin(cameraPitch);
  const sinYaw = Math.sin(cameraYaw);
  const cosYaw = Math.cos(cameraYaw);

  const backVector = new THREE.Vector3(
    sinYaw * cosPitch,
    sinPitch,
    cosYaw * cosPitch
  ).normalize();

  const rightVector = new THREE.Vector3(
    Math.cos(cameraYaw),
    0,
    -Math.sin(cameraYaw)
  ).normalize();

  desiredCameraPos.copy(cameraTargetLookAt)
    .addScaledVector(backVector, preset.distance)
    .addScaledVector(rightVector, preset.shoulderOffset);

  if (desiredCameraPos.y < 0.35) {
    desiredCameraPos.y = 0.35;
  }

  camera.position.lerp(desiredCameraPos, 1 - Math.exp(-10 * delta));
  camera.lookAt(cameraTargetLookAt);

  // Sombra direcional acompanha o jogador para manter nitidez máxima
  dirLight.position.set(playerPos.x + 18, 30, playerPos.z + 18);
  dirLight.target.position.copy(playerPos);
  dirLight.target.updateMatrixWorld();
}

// --- INICIALIZAÇÃO DO JOGO ---
const player = new PlayerController();

const progressBar = document.getElementById('progress-bar') as HTMLElement;
const loadingText = document.getElementById('loading-text') as HTMLElement;
const loadingOverlay = document.getElementById('loading-overlay') as HTMLElement;
const statState = document.getElementById('stat-state') as HTMLElement;
const statSpeed = document.getElementById('stat-speed') as HTMLElement;
const statFps = document.getElementById('stat-fps') as HTMLElement;

async function start() {
  try {
    loadingText.textContent = 'Carregando texturas e modelo...';
    await player.loadCharacter((pct) => {
      progressBar.style.width = `${pct}%`;
    });
  } catch (err) {
    console.error('Erro ao inicializar personagem:', err);
    loadingText.textContent = 'Erro ao carregar modelo 3D';
    return;
  }

  // Ocultar tela de loading
  loadingOverlay.classList.add('fade-out');

  // Loop de Animação e Renderização
  let lastTime = performance.now();
  let frameCount = 0;
  let fpsTimer = performance.now();

  function animate(currentTime: number) {
    requestAnimationFrame(animate);

    const delta = Math.min((currentTime - lastTime) / 1000, 0.1);
    lastTime = currentTime;

    // Cálculo de FPS
    frameCount++;
    if (currentTime - fpsTimer >= 500) {
      const fps = Math.round((frameCount * 1000) / (currentTime - fpsTimer));
      statFps.textContent = fps.toString();
      frameCount = 0;
      fpsTimer = currentTime;
    }

    // Direção de entrada do teclado
    const inputDir = new THREE.Vector3();
    if (keys.forward) inputDir.z += 1;
    if (keys.backward) inputDir.z -= 1;
    if (keys.left) inputDir.x += 1;
    if (keys.right) inputDir.x -= 1;

    if (inputDir.lengthSq() > 0.001) {
      inputDir.normalize();
    }

    // Atualiza jogador (física, colisões deslizantes e animações)
    player.update(delta, inputDir, keys.run, cameraYaw);

    // Atualiza câmera em terceira pessoa
    updateCamera(player.group.position, delta);

    // Atualiza painel HUD
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

// Redimensionamento de janela responsivo
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

start();
