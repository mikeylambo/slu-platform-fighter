import * as THREE from 'three';
import { fixed, type Fixed } from '../../packages/deterministic-math/src/fixed.js';
import { K1_MOVEMENT, type MovementRules } from '../../packages/sim/src/movement.js';
import { createWorld, stepWorld } from '../../packages/sim/src/world.js';
import type { SimInputFrame, WorldState } from '../../packages/sim/src/types.js';

const SIM_HZ = 60;
const STEP_MS = 1000 / SIM_HZ;
const MAX_STEPS_PER_RENDER = 8;
const LAB_SEED = 0x51_4c_55;

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
floor.position.set(0, -0.25, 0); floor.receiveShadow = true; scene.add(floor);
const platform = new THREE.Mesh(new THREE.BoxGeometry(8, 0.28, 4), platformMaterial);
platform.position.set(0, 3.86, 0); platform.receiveShadow = true; scene.add(platform);

const fighterRoot = new THREE.Group();
scene.add(fighterRoot);
const bodyMat = new THREE.MeshStandardMaterial({ color: 0xe7edf8, roughness: 0.45, metalness: 0.15 });
const accentMat = new THREE.MeshStandardMaterial({ color: 0x7ea7ff, roughness: 0.4, metalness: 0.25 });
function box(width: number, height: number, depth: number, material: THREE.Material) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  mesh.castShadow = true;
  return mesh;
}
const torso = box(0.95, 1.5, 0.65, bodyMat); torso.position.y = 1.65; fighterRoot.add(torso);
const head = box(0.72, 0.72, 0.72, accentMat); head.position.y = 2.78; fighterRoot.add(head);
const leftArm = box(0.28, 1.15, 0.28, bodyMat); leftArm.position.set(-0.72, 1.68, 0); fighterRoot.add(leftArm);
const rightArm = box(0.28, 1.15, 0.28, bodyMat); rightArm.position.set(0.72, 1.68, 0); fighterRoot.add(rightArm);
const leftLeg = box(0.34, 1.15, 0.36, bodyMat); leftLeg.position.set(-0.25, 0.58, 0); fighterRoot.add(leftLeg);
const rightLeg = box(0.34, 1.15, 0.36, bodyMat); rightLeg.position.set(0.25, 0.58, 0); fighterRoot.add(rightLeg);

const debugGrid = new THREE.GridHelper(40, 40, 0x31405c, 0x1e2533);
debugGrid.rotation.x = Math.PI / 2; debugGrid.position.z = -3.01; scene.add(debugGrid);
const ecb = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.2, 3.25, 0.12)), new THREE.LineBasicMaterial({ color: 0x7fffd4 }));
ecb.position.y = 1.62; fighterRoot.add(ecb);
const hurtbox = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.55, 3.1, 0.9)), new THREE.LineBasicMaterial({ color: 0xff7f9c }));
hurtbox.position.y = 1.58; fighterRoot.add(hurtbox);
const ledgeDebug = new THREE.Group();
scene.add(ledgeDebug);

const hudElement = document.querySelector<HTMLDivElement>('#hud');
const controlsElement = document.querySelector<HTMLDivElement>('#controls');
const defaultsButton = document.querySelector<HTMLButtonElement>('#defaults');
const copyButton = document.querySelector<HTMLButtonElement>('#copy-rules');
if (!hudElement || !controlsElement || !defaultsButton || !copyButton) throw new Error('Movement Lab UI missing');
const hud = hudElement;
const controls = controlsElement;

let movementRules: MovementRules = { ...K1_MOVEMENT };
let world = createWorld(LAB_SEED);
let previousWorld = structuredClone(world);
let accumulator = 0;
let lastTime = performance.now();
let paused = false;
let stepRequested = false;
let jumpPressedLatch = false;
let dodgePressedLatch = false;
let priorPadJump = false;
let priorPadDodge = false;
const keys = new Set<string>();

function decimalFixed(value: number): Fixed { return fixed.fromRatio(Math.round(value * 1000), 1000); }
function resetWorld() {
  world = createWorld(LAB_SEED);
  previousWorld = structuredClone(world);
  accumulator = 0;
  jumpPressedLatch = false;
  dodgePressedLatch = false;
  rebuildLedgeDebug();
}
function rebuildLedgeDebug() {
  ledgeDebug.clear();
  for (const ledge of world.ledges) {
    const marker = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffd166 }));
    marker.position.set(fixed.toNumber(ledge.x), fixed.toNumber(ledge.y), 0.8);
    ledgeDebug.add(marker);
    const grab = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(fixed.toNumber(movementRules.ledgeGrabXRadius) * 2, fixed.toNumber(movementRules.ledgeGrabAbove) + fixed.toNumber(movementRules.ledgeGrabBelow), 0.1)),
      new THREE.LineBasicMaterial({ color: 0xffd166 }),
    );
    grab.position.set(fixed.toNumber(ledge.x), fixed.toNumber(ledge.y) + (fixed.toNumber(movementRules.ledgeGrabAbove) - fixed.toNumber(movementRules.ledgeGrabBelow)) / 2, 0.7);
    ledgeDebug.add(grab);
  }
}
rebuildLedgeDebug();

window.addEventListener('keydown', (event) => {
  if (!event.repeat && (event.code === 'Space' || event.code === 'KeyJ')) jumpPressedLatch = true;
  if (!event.repeat && event.code === 'KeyK') dodgePressedLatch = true;
  if (!event.repeat && event.code === 'KeyP') paused = !paused;
  if (!event.repeat && event.code === 'Period') stepRequested = true;
  if (!event.repeat && event.code === 'KeyR') resetWorld();
  keys.add(event.code);
});
window.addEventListener('keyup', (event) => keys.delete(event.code));

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
  let shieldHeld = keys.has('KeyL');
  const pad = navigator.getGamepads?.()[0] ?? null;
  if (pad) {
    if (Math.abs(pad.axes[0] ?? 0) > 0.12) moveX = quantizeAxis(pad.axes[0] ?? 0);
    if (Math.abs(pad.axes[1] ?? 0) > 0.12) moveY = quantizeAxis(-(pad.axes[1] ?? 0));
    const padJump = Boolean(pad.buttons[0]?.pressed);
    const padDodge = Boolean(pad.buttons[1]?.pressed);
    if (padJump && !priorPadJump) jumpPressedLatch = true;
    if (padDodge && !priorPadDodge) dodgePressedLatch = true;
    priorPadJump = padJump;
    priorPadDodge = padDodge;
    jumpHeld ||= padJump;
    shieldHeld ||= Boolean(pad.buttons[5]?.pressed);
  }
  const result: SimInputFrame = {
    frame, moveX, moveY,
    jumpPressed: jumpPressedLatch,
    jumpHeld,
    dodgePressed: dodgePressedLatch,
    shieldHeld,
  };
  jumpPressedLatch = false;
  dodgePressedLatch = false;
  return result;
}
function stepSimulation() {
  previousWorld = world;
  world = stepWorld(world, sampleInput(world.frame), movementRules);
}

interface FloatTunable {
  label: string;
  key: keyof Pick<MovementRules, 'walkSpeed' | 'dashSpeed' | 'runSpeed' | 'groundAccel' | 'groundFriction' | 'airAccel' | 'maxAirSpeed' | 'fullHopSpeed' | 'shortHopSpeed' | 'doubleJumpSpeed' | 'gravity' | 'maxFallSpeed' | 'fastFallSpeed' | 'airDodgeSpeed' | 'rollSpeed'>;
  min: number; max: number; step: number;
}
interface IntTunable {
  label: string;
  key: keyof Pick<MovementRules, 'jumpSquatFrames' | 'jumpBufferFrames' | 'dashFrames' | 'turnFrames' | 'landingFrames' | 'airDodgeFrames' | 'spotDodgeFrames' | 'rollFrames'>;
  min: number; max: number; step: number;
}
const floatTunables: FloatTunable[] = [
  { label: 'Walk speed', key: 'walkSpeed', min: 0.04, max: 0.28, step: 0.005 },
  { label: 'Dash speed', key: 'dashSpeed', min: 0.08, max: 0.38, step: 0.005 },
  { label: 'Run speed', key: 'runSpeed', min: 0.08, max: 0.34, step: 0.005 },
  { label: 'Ground accel', key: 'groundAccel', min: 0.005, max: 0.10, step: 0.005 },
  { label: 'Ground friction', key: 'groundFriction', min: 0.005, max: 0.10, step: 0.005 },
  { label: 'Air accel', key: 'airAccel', min: 0.003, max: 0.05, step: 0.002 },
  { label: 'Max air speed', key: 'maxAirSpeed', min: 0.06, max: 0.30, step: 0.005 },
  { label: 'Full hop', key: 'fullHopSpeed', min: 0.25, max: 0.75, step: 0.01 },
  { label: 'Short hop', key: 'shortHopSpeed', min: 0.18, max: 0.60, step: 0.01 },
  { label: 'Double jump', key: 'doubleJumpSpeed', min: 0.20, max: 0.70, step: 0.01 },
  { label: 'Gravity', key: 'gravity', min: 0.008, max: 0.065, step: 0.001 },
  { label: 'Max fall speed', key: 'maxFallSpeed', min: 0.20, max: 0.80, step: 0.01 },
  { label: 'Fastfall speed', key: 'fastFallSpeed', min: 0.25, max: 1.00, step: 0.01 },
  { label: 'Air dodge speed', key: 'airDodgeSpeed', min: 0.05, max: 0.35, step: 0.005 },
  { label: 'Roll speed', key: 'rollSpeed', min: 0.05, max: 0.30, step: 0.005 },
];
const intTunables: IntTunable[] = [
  { label: 'Jump squat', key: 'jumpSquatFrames', min: 1, max: 8, step: 1 },
  { label: 'Jump buffer', key: 'jumpBufferFrames', min: 0, max: 12, step: 1 },
  { label: 'Dash frames', key: 'dashFrames', min: 3, max: 20, step: 1 },
  { label: 'Turn frames', key: 'turnFrames', min: 0, max: 10, step: 1 },
  { label: 'Landing frames', key: 'landingFrames', min: 0, max: 12, step: 1 },
  { label: 'Air dodge frames', key: 'airDodgeFrames', min: 6, max: 40, step: 1 },
  { label: 'Spot dodge frames', key: 'spotDodgeFrames', min: 6, max: 35, step: 1 },
  { label: 'Roll frames', key: 'rollFrames', min: 8, max: 40, step: 1 },
];
function addSlider(label: string, min: number, max: number, step: number, value: number, onChange: (value: number) => void) {
  const row = document.createElement('label'); row.className = 'control';
  const name = document.createElement('span'); name.textContent = label;
  const output = document.createElement('output'); output.textContent = String(value);
  const slider = document.createElement('input');
  slider.type = 'range'; slider.min = String(min); slider.max = String(max); slider.step = String(step); slider.value = String(value);
  slider.addEventListener('input', () => {
    const next = Number(slider.value); output.textContent = slider.value; onChange(next); resetWorld();
  });
  row.append(name, output, slider); controls.append(row);
}
function renderControls() {
  controls.replaceChildren();
  for (const tunable of floatTunables) {
    addSlider(tunable.label, tunable.min, tunable.max, tunable.step, Number(fixed.toNumber(movementRules[tunable.key]).toFixed(3)), (value) => {
      movementRules = { ...movementRules, [tunable.key]: decimalFixed(value) };
    });
  }
  for (const tunable of intTunables) {
    addSlider(tunable.label, tunable.min, tunable.max, tunable.step, movementRules[tunable.key], (value) => {
      movementRules = { ...movementRules, [tunable.key]: Math.round(value) };
    });
  }
}
defaultsButton.addEventListener('click', () => { movementRules = { ...K1_MOVEMENT }; renderControls(); resetWorld(); });
copyButton.addEventListener('click', async () => {
  const fixedKeys = new Set(floatTunables.map((entry) => entry.key));
  const exportable = Object.fromEntries(Object.entries(movementRules).map(([key, value]) => [key, fixedKeys.has(key as FloatTunable['key']) ? fixed.toNumber(value as Fixed) : value]));
  await navigator.clipboard.writeText(JSON.stringify(exportable, null, 2));
  copyButton.textContent = 'Copied'; window.setTimeout(() => { copyButton.textContent = 'Copy JSON'; }, 900);
});
renderControls();

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
  leftArm.rotation.z = swing; rightArm.rotation.z = -swing; leftLeg.rotation.z = -swing * 0.55; rightLeg.rotation.z = swing * 0.55;
  torso.rotation.z = current.locomotion === 'dash' ? -current.facing * 0.12 : current.locomotion === 'ledge-hang' ? current.facing * 0.18 : 0;
  const crouchOffset = current.locomotion === 'crouch' ? -0.38 : 0;
  torso.position.y = 1.65 + crouchOffset + (moving ? Math.abs(Math.sin(phase)) * 0.06 : 0);
  head.position.y = 2.78 + crouchOffset;
  const invulnerable = current.invulnerableFrames > 0;
  ecb.visible = true;
  hurtbox.visible = !invulnerable || world.frame % 4 < 2;
  camera.position.x = THREE.MathUtils.lerp(camera.position.x, x, 0.08);
  camera.lookAt(camera.position.x, 3.0, 0);
  hud.textContent = [
    'SLU PLATFORM FIGHTER — K1b MOVEMENT / DEFENSE LAB',
    `frame        ${world.frame}`,
    `state        ${current.locomotion} [${current.locomotionFrame}]`,
    `position     ${fixed.toNumber(current.x).toFixed(3)}, ${fixed.toNumber(current.y).toFixed(3)}`,
    `velocity     ${fixed.toNumber(current.vx).toFixed(3)}, ${fixed.toNumber(current.vy).toFixed(3)}`,
    `grounded     ${current.grounded} (${current.groundSurfaceId ?? 'none'})`,
    `ledge        ${current.ledgeId ?? 'none'} / lock ${current.ledgeRegrabLockoutFrames}`,
    `invuln       ${current.invulnerableFrames}`,
    `dodge cd     ${current.dodgeCooldownFrames}`,
    `tech buffer  ${current.techBufferFrames}`,
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
  const delta = Math.min(100, now - lastTime); lastTime = now;
  if (!paused) accumulator += delta;
  if (paused && stepRequested) { stepSimulation(); stepRequested = false; }
  let steps = 0;
  while (!paused && accumulator >= STEP_MS && steps < MAX_STEPS_PER_RENDER) { stepSimulation(); accumulator -= STEP_MS; steps += 1; }
  if (steps === MAX_STEPS_PER_RENDER) accumulator = 0;
  animateFighter(paused ? 1 : accumulator / STEP_MS);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
requestAnimationFrame(frame);
