import * as THREE from 'three';
import { fixed } from '../../packages/deterministic-math/src/fixed.js';
import { createWorld, stepWorld } from '../../packages/sim/src/world.js';
import type { SimInputFrame, WorldState } from '../../packages/sim/src/types.js';

const SIM_HZ = 60;
const STEP_MS = 1000 / SIM_HZ;
const MAX_STEPS_PER_RENDER = 8;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x090b10);
scene.fog = new THREE.Fog(0x090b10, 30, 80);

const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(0, 7, 22);
camera.lookAt(0, 3, 0);

scene.add(new THREE.HemisphereLight(0xffffff, 0x303040, 2.1));
const keyLight = new THREE.DirectionalLight(0xffffff, 2.4);
keyLight.position.set(-8, 14, 10);
keyLight.castShadow = true;
scene.add(keyLight);

const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x2a3140, roughness: 0.8, metalness: 0.1 });
const platformMaterial = new THREE.MeshStandardMaterial({ color: 0x59677f, roughness: 0.65, metalness: 0.15 });

const floor = new THREE.Mesh(new THREE.BoxGeometry(40, 0.5, 6), floorMaterial);
floor.position.set(0, -0.25, 0);
floor.receiveShadow = true;
scene.add(floor);

const platform = new THREE.Mesh(new THREE.BoxGeometry(8, 0.28, 4), platformMaterial);
platform.position.set(0, 3.86, 0);
platform.receiveShadow = true;
scene.add(platform);

const fighterRoot = new THREE.Group();
scene.add(fighterRoot);

const bodyMat = new THREE.MeshStandardMaterial({ color: 0xe7edf8, roughness: 0.45, metalness: 0.15 });
const accentMat = new THREE.MeshStandardMaterial({ color: 0x7ea7ff, roughness: 0.4, metalness: 0.25 });

function box(width: number, height: number, depth: number, material: THREE.Material) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  mesh.castShadow = true;
  return mesh;
}

const torso = box(0.95, 1.5, 0.65, bodyMat);
torso.position.y = 1.65;
fighterRoot.add(torso);

const head = box(0.72, 0.72, 0.72, accentMat);
head.position.y = 2.78;
fighterRoot.add(head);

const leftArm = box(0.28, 1.15, 0.28, bodyMat);
leftArm.position.set(-0.72, 1.68, 0);
fighterRoot.add(leftArm);

const rightArm = box(0.28, 1.15, 0.28, bodyMat);
rightArm.position.set(0.72, 1.68, 0);
fighterRoot.add(rightArm);

const leftLeg = box(0.34, 1.15, 0.36, bodyMat);
leftLeg.position.set(-0.25, 0.58, 0);
fighterRoot.add(leftLeg);

const rightLeg = box(0.34, 1.15, 0.36, bodyMat);
rightLeg.position.set(0.25, 0.58, 0);
fighterRoot.add(rightLeg);

const debugGrid = new THREE.GridHelper(40, 40, 0x31405c, 0x1e2533);
debugGrid.rotation.x = Math.PI / 2;
debugGrid.position.z = -3.01;
scene.add(debugGrid);

const hudElement = document.querySelector<HTMLDivElement>('#hud');
if (!hudElement) throw new Error('Movement Lab HUD missing');
const hud: HTMLDivElement = hudElement;

let world = createWorld(0x51_4c_55);
let previousWorld = structuredClone(world);
let accumulator = 0;
let lastTime = performance.now();
let paused = false;
let stepRequested = false;
let jumpPressedLatch = false;
let priorPadJump = false;

const keys = new Set<string>();

window.addEventListener('keydown', (event) => {
  if (!event.repeat && (event.code === 'Space' || event.code === 'KeyJ')) jumpPressedLatch = true;
  if (!event.repeat && event.code === 'KeyP') paused = !paused;
  if (!event.repeat && event.code === 'Period') stepRequested = true;
  if (!event.repeat && event.code === 'KeyR') resetWorld();
  keys.add(event.code);
});

window.addEventListener('keyup', (event) => {
  keys.delete(event.code);
});

function resetWorld() {
  world = createWorld(0x51_4c_55);
  previousWorld = structuredClone(world);
  accumulator = 0;
  jumpPressedLatch = false;
}

function keyboardAxis(negative: string[], positive: string[]): number {
  const neg = negative.some((code) => keys.has(code));
  const pos = positive.some((code) => keys.has(code));
  return (pos ? 1 : 0) - (neg ? 1 : 0);
}

function quantizeAxis(value: number): number {
  const deadzoned = Math.abs(value) < 0.12 ? 0 : value;
  return Math.max(-1000, Math.min(1000, Math.round(deadzoned * 1000)));
}

function sampleInput(frame: number): SimInputFrame {
  let moveX = keyboardAxis(['KeyA', 'ArrowLeft'], ['KeyD', 'ArrowRight']) * 1000;
  let moveY = keyboardAxis(['KeyS', 'ArrowDown'], ['KeyW', 'ArrowUp']) * 1000;
  let jumpHeld = keys.has('Space') || keys.has('KeyJ');

  const pad = navigator.getGamepads?.()[0] ?? null;
  if (pad) {
    if (Math.abs(pad.axes[0] ?? 0) > 0.12) moveX = quantizeAxis(pad.axes[0] ?? 0);
    if (Math.abs(pad.axes[1] ?? 0) > 0.12) moveY = quantizeAxis(-(pad.axes[1] ?? 0));
    const padJump = Boolean(pad.buttons[0]?.pressed);
    if (padJump && !priorPadJump) jumpPressedLatch = true;
    priorPadJump = padJump;
    jumpHeld ||= padJump;
  }

  const result: SimInputFrame = {
    frame,
    moveX,
    moveY,
    jumpPressed: jumpPressedLatch,
    jumpHeld,
  };
  jumpPressedLatch = false;
  return result;
}

function stepSimulation() {
  previousWorld = world;
  world = stepWorld(world, sampleInput(world.frame));
}

function animateFighter(alpha: number) {
  const current = world.fighters[0];
  const previous = previousWorld.fighters[0] ?? current;
  if (!current || !previous) return;

  const x = THREE.MathUtils.lerp(fixed.toNumber(previous.x), fixed.toNumber(current.x), alpha);
  const y = THREE.MathUtils.lerp(fixed.toNumber(previous.y), fixed.toNumber(current.y), alpha);
  fighterRoot.position.set(x, y, 0);
  fighterRoot.scale.x = current.facing;

  const phase = current.locomotionFrame * 0.55;
  const moving = current.locomotion === 'walk' || current.locomotion === 'dash' || current.locomotion === 'run';
  const swing = moving ? Math.sin(phase) * (current.locomotion === 'run' ? 0.75 : 0.45) : 0;
  leftArm.rotation.z = swing;
  rightArm.rotation.z = -swing;
  leftLeg.rotation.z = -swing * 0.55;
  rightLeg.rotation.z = swing * 0.55;

  torso.rotation.z = current.locomotion === 'dash' ? -current.facing * 0.12 : 0;
  torso.position.y = 1.65 + (current.locomotion === 'crouch' ? -0.38 : moving ? Math.abs(Math.sin(phase)) * 0.06 : 0);
  head.position.y = 2.78 + (current.locomotion === 'crouch' ? -0.38 : 0);

  const cameraTargetX = x;
  camera.position.x = THREE.MathUtils.lerp(camera.position.x, cameraTargetX, 0.08);
  camera.lookAt(camera.position.x, 3.0, 0);

  hud.textContent = [
    'SLU PLATFORM FIGHTER — K1 MOVEMENT LAB',
    `frame        ${world.frame}`,
    `state        ${current.locomotion} [${current.locomotionFrame}]`,
    `position     ${fixed.toNumber(current.x).toFixed(3)}, ${fixed.toNumber(current.y).toFixed(3)}`,
    `velocity     ${fixed.toNumber(current.vx).toFixed(3)}, ${fixed.toNumber(current.vy).toFixed(3)}`,
    `grounded     ${current.grounded} (${current.groundSurfaceId ?? 'none'})`,
    `facing       ${current.facing > 0 ? 'right' : 'left'}`,
    `air jump     ${current.jumpsRemaining}`,
    `fastfall     ${current.fastFalling}`,
    `jump buffer  ${current.jumpBufferFrames}`,
    `drop window  ${current.dropThroughFrames}`,
    `input hist   ${current.inputHistory.length}`,
    `sim          ${paused ? 'PAUSED' : 'RUNNING'} @ ${SIM_HZ} Hz`,
  ].join('\n');
}

function frame(now: number) {
  const delta = Math.min(100, now - lastTime);
  lastTime = now;

  if (!paused) accumulator += delta;
  if (paused && stepRequested) {
    stepSimulation();
    stepRequested = false;
  }

  let steps = 0;
  while (!paused && accumulator >= STEP_MS && steps < MAX_STEPS_PER_RENDER) {
    stepSimulation();
    accumulator -= STEP_MS;
    steps += 1;
  }
  if (steps === MAX_STEPS_PER_RENDER) accumulator = 0;

  const alpha = paused ? 1 : accumulator / STEP_MS;
  animateFighter(alpha);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

requestAnimationFrame(frame);
