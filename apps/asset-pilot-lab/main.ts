import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { fixed } from '../../packages/deterministic-math/src/fixed.js';
import { createInitialWorld, stepWorld } from '../../packages/sim/src/world.js';
import type { SimInputFrame } from '../../packages/sim/src/types.js';

const ASSET_URL = 'https://raw.githubusercontent.com/mikeylambo/witch-hunter-x/main/public/assets/riven-rigged.glb';
const SIM_HZ = 60;
const STEP_MS = 1000 / SIM_HZ;
const hud = document.querySelector<HTMLDivElement>('#hud');
if (!hud) throw new Error('asset pilot HUD missing');

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x090b10);
scene.add(new THREE.HemisphereLight(0xffffff, 0x1b2436, 2.4));
const sun = new THREE.DirectionalLight(0xffffff, 3); sun.position.set(-6, 12, 10); sun.castShadow = true; scene.add(sun);
const camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.1, 120); camera.position.set(0, 5.2, 15); camera.lookAt(0, 2.5, 0);
const floor = new THREE.Mesh(new THREE.BoxGeometry(28, 0.4, 6), new THREE.MeshStandardMaterial({ color: 0x273143, roughness: 0.85 })); floor.position.y = -0.2; floor.receiveShadow = true; scene.add(floor);
const platform = new THREE.Mesh(new THREE.BoxGeometry(7, 0.25, 4), new THREE.MeshStandardMaterial({ color: 0x5b6c86, roughness: 0.7 })); platform.position.y = 3.9; scene.add(platform);

let world = createInitialWorld(0x52_49_56_45);
let previous = structuredClone(world);
const keys = new Set<string>();
let jumpLatch = false;
let accumulator = 0;
let last = performance.now();
let loaded = false;
let modelRoot: THREE.Object3D | null = null;
let sourceClipNames: string[] = [];
let sourceMaterials: string[] = [];

function normalizeModel(root: THREE.Object3D) {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3(); box.getSize(size);
  if (size.y > 0) root.scale.multiplyScalar(1.85 / size.y);
  root.updateMatrixWorld(true);
  const box2 = new THREE.Box3().setFromObject(root);
  const center = new THREE.Vector3(); box2.getCenter(center);
  root.position.x -= center.x; root.position.z -= center.z; root.position.y -= box2.min.y;
  root.updateMatrixWorld(true);
}

new GLTFLoader().loadAsync(ASSET_URL).then((gltf) => {
  modelRoot = gltf.scene;
  normalizeModel(modelRoot);
  modelRoot.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (mesh.isMesh) { mesh.castShadow = true; mesh.frustumCulled = false; }
  });
  sourceClipNames = gltf.animations.map((clip) => clip.name);
  const materials = new Set<string>();
  modelRoot.traverse((object) => {
    const mesh = object as THREE.Mesh;
    const mat = mesh.material;
    if (Array.isArray(mat)) for (const entry of mat) materials.add(entry.name || '(unnamed)');
    else if (mat) materials.add(mat.name || '(unnamed)');
  });
  sourceMaterials = [...materials];
  scene.add(modelRoot);
  loaded = true;
}).catch((error) => { hud.textContent = `REAL ASSET LOAD FAILED\n${String(error)}`; });

addEventListener('keydown', (event) => {
  if (!event.repeat && event.code === 'Space') jumpLatch = true;
  if (!event.repeat && event.code === 'KeyR') { world = createInitialWorld(0x52_49_56_45); previous = structuredClone(world); accumulator = 0; }
  keys.add(event.code);
});
addEventListener('keyup', (event) => keys.delete(event.code));

function input(frame: number): SimInputFrame {
  const moveX = (keys.has('KeyD') ? 1000 : 0) - (keys.has('KeyA') ? 1000 : 0);
  const moveY = keys.has('KeyS') ? -1000 : 0;
  const result: SimInputFrame = { frame, moveX, moveY, jumpPressed: jumpLatch, jumpHeld: keys.has('Space'), attackPressed: false, grabPressed: false, dodgePressed: false, shieldHeld: false };
  jumpLatch = false;
  return result;
}
function simStep() {
  previous = world;
  world = stepWorld(world, input(world.frame));
}
function draw(alpha: number) {
  const current = world.fighters[0];
  const old = previous.fighters[0] ?? current;
  if (loaded && modelRoot && current && old) {
    modelRoot.position.x = THREE.MathUtils.lerp(fixed.toNumber(old.x), fixed.toNumber(current.x), alpha);
    modelRoot.position.y = THREE.MathUtils.lerp(fixed.toNumber(old.y), fixed.toNumber(current.y), alpha);
    modelRoot.scale.x = Math.abs(modelRoot.scale.x) * current.facing;
  }
  hud.textContent = [
    'SLU PLATFORM FIGHTER — REAL ASSET PILOT',
    'asset      Riven (NON-CANON CERTIFICATION PILOT)',
    `physical   ${loaded ? 'GLB LOADED / SKINNED' : 'loading…'}`,
    `frame      ${world.frame}`,
    current ? `state      ${current.locomotion}` : 'state      n/a',
    current ? `position   ${fixed.toNumber(current.x).toFixed(2)}, ${fixed.toNumber(current.y).toFixed(2)}` : '',
    `clips      ${sourceClipNames.length ? sourceClipNames.join(', ') : '(none yet)'}`,
    `materials  ${sourceMaterials.length ? sourceMaterials.join(', ') : '(none yet)'}`,
    '',
    'Rig/model proof is live. The 85-role animation contract is intentionally NOT faked:',
    'this source GLB currently supplies only one generic Mixamo clip; authored animations are the next production input.'
  ].join('\n');
}
function frame(now: number) {
  const delta = Math.min(100, now - last); last = now; accumulator += delta;
  let steps = 0; while (accumulator >= STEP_MS && steps < 8) { simStep(); accumulator -= STEP_MS; steps += 1; }
  if (steps === 8) accumulator = 0;
  draw(accumulator / STEP_MS); renderer.render(scene, camera); requestAnimationFrame(frame);
}
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
requestAnimationFrame(frame);
