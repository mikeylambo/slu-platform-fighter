import * as THREE from 'three';
import { fixed } from '../../packages/deterministic-math/src/fixed.js';
import { compileFighterGrabActions } from '../../packages/content/src/compileGrabActions.js';
import { compileFighterAttacks } from '../../packages/content/src/compileMoves.js';
import { ALL_FIGHTER_PACKS } from '../../packages/content/src/generated/fighterRegistry.js';
import { createTwoFighterMatch, stepMatchWorld, type MatchEvent } from '../../packages/sim/src/match.js';
import { K1_MOVEMENT } from '../../packages/sim/src/movement.js';
import type { AttackDefinition } from '../../packages/sim/src/combat.js';
import type { FighterState, SimInputFrame } from '../../packages/sim/src/types.js';

const SIM_HZ = 60;
const STEP_MS = 1000 / SIM_HZ;
const MAX_STEPS = 8;
const SEED = 0x43_4f_4d_42;

const greybox = ALL_FIGHTER_PACKS.find((pack) => pack.id === 'greybox');
if (!greybox) throw new Error('Combat Lab requires generated greybox pack');
const attacks = compileFighterAttacks(greybox);
const grabActions = compileFighterGrabActions(greybox);
const JAB_ID = 'greybox:jab';
if (!attacks.has(JAB_ID)) throw new Error('Combat Lab requires greybox:jab');

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setSize(innerWidth, innerHeight); renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x090b10); scene.fog = new THREE.Fog(0x090b10, 25, 75);
const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.1, 150); camera.position.set(0, 6.5, 20); camera.lookAt(0, 2.5, 0);
scene.add(new THREE.HemisphereLight(0xffffff, 0x273149, 2.2));
const sun = new THREE.DirectionalLight(0xffffff, 2.8); sun.position.set(-8, 14, 10); sun.castShadow = true; scene.add(sun);
const floor = new THREE.Mesh(new THREE.BoxGeometry(34, 0.5, 6), new THREE.MeshStandardMaterial({ color: 0x293141, roughness: 0.8 })); floor.position.y = -0.25; floor.receiveShadow = true; scene.add(floor);
const centerPlatform = new THREE.Mesh(new THREE.BoxGeometry(8, 0.28, 4), new THREE.MeshStandardMaterial({ color: 0x566780, roughness: 0.7 })); centerPlatform.position.y = 3.86; centerPlatform.receiveShadow = true; scene.add(centerPlatform);
const grid = new THREE.GridHelper(34, 34, 0x31405c, 0x1e2533); grid.rotation.x = Math.PI / 2; grid.position.z = -3.01; scene.add(grid);

interface FighterVisual { root: THREE.Group; body: THREE.Mesh; hurtbox: THREE.Mesh; hitboxes: THREE.Group; shield: THREE.Mesh; }
function createFighterVisual(bodyColor: number, accentColor: number): FighterVisual {
  const root = new THREE.Group(); scene.add(root);
  const bodyMaterial = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.45, metalness: 0.12 });
  const accentMaterial = new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.38, metalness: 0.2 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.95, 2.5, 0.7), bodyMaterial); body.position.y = 1.3; body.castShadow = true; root.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), accentMaterial); head.position.y = 2.9; head.castShadow = true; root.add(head);
  const hurtbox = new THREE.Mesh(new THREE.SphereGeometry(0.75, 20, 14), new THREE.MeshBasicMaterial({ color: 0xff7f9c, wireframe: true, transparent: true, opacity: 0.55 })); hurtbox.position.y = 1.5; root.add(hurtbox);
  const shield = new THREE.Mesh(new THREE.SphereGeometry(1.45, 24, 16), new THREE.MeshBasicMaterial({ color: accentColor, wireframe: true, transparent: true, opacity: 0.75 })); shield.position.y = 1.5; shield.visible = false; root.add(shield);
  const hitboxes = new THREE.Group(); root.add(hitboxes);
  return { root, body, hurtbox, hitboxes, shield };
}
const visuals = new Map<string, FighterVisual>([['fighter-a', createFighterVisual(0xe8edf7, 0x77a6ff)], ['fighter-b', createFighterVisual(0x40495a, 0xffb65c)]]);

const hudElement = document.querySelector<HTMLDivElement>('#hud'); const eventsElement = document.querySelector<HTMLDivElement>('#events');
if (!hudElement || !eventsElement) throw new Error('Combat Lab UI missing');
const hud: HTMLDivElement = hudElement; const eventsHud: HTMLDivElement = eventsElement;

let world = createTwoFighterMatch(SEED); let previous = structuredClone(world); let accumulator = 0; let lastTime = performance.now();
let paused = false; let stepRequested = false; const keys = new Set<string>();
let jumpLatch = false; let attackLatch = false; let grabLatch = false; let dodgeLatch = false;
let priorPadJump = false; let priorPadAttack = false; let priorPadGrab = false; let priorPadDodge = false;
let lastEvent: MatchEvent | null = null; let flashFrames = 0; let dummyShield = false; let dummyAttackLatch = false; let dummyGrabLatch = false;

function reset() {
  world = createTwoFighterMatch(SEED); previous = structuredClone(world); accumulator = 0;
  jumpLatch = attackLatch = grabLatch = dodgeLatch = dummyAttackLatch = dummyGrabLatch = false;
  lastEvent = null; flashFrames = 0; eventsHud.textContent = 'NO MATCH EVENTS YET';
}

addEventListener('keydown', (event) => {
  if (!event.repeat && event.code === 'Space') jumpLatch = true;
  if (!event.repeat && event.code === 'KeyF') attackLatch = true;
  if (!event.repeat && event.code === 'KeyE') grabLatch = true;
  if (!event.repeat && event.code === 'KeyK') dodgeLatch = true;
  if (!event.repeat && event.code === 'KeyH') dummyShield = !dummyShield;
  if (!event.repeat && event.code === 'KeyG') dummyAttackLatch = true;
  if (!event.repeat && event.code === 'KeyT') dummyGrabLatch = true;
  if (!event.repeat && event.code === 'KeyR') reset();
  if (!event.repeat && event.code === 'KeyP') paused = !paused;
  if (!event.repeat && event.code === 'Period') stepRequested = true;
  keys.add(event.code);
});
addEventListener('keyup', (event) => keys.delete(event.code));

function axis(neg: string, pos: string): number { return (keys.has(pos) ? 1000 : 0) - (keys.has(neg) ? 1000 : 0); }
function quantize(value: number): number { return Math.abs(value) < 0.12 ? 0 : Math.round(Math.max(-1, Math.min(1, value)) * 1000); }

function playerInput(frame: number): SimInputFrame {
  let moveX = axis('KeyA', 'KeyD'); let moveY = axis('KeyS', 'KeyW'); let jumpHeld = keys.has('Space'); let shieldHeld = keys.has('KeyL');
  const pad = navigator.getGamepads?.()[0] ?? null;
  if (pad) {
    if (Math.abs(pad.axes[0] ?? 0) >= 0.12) moveX = quantize(pad.axes[0] ?? 0);
    if (Math.abs(pad.axes[1] ?? 0) >= 0.12) moveY = quantize(-(pad.axes[1] ?? 0));
    const padJump = Boolean(pad.buttons[0]?.pressed); const padAttack = Boolean(pad.buttons[2]?.pressed); const padGrab = Boolean(pad.buttons[3]?.pressed); const padDodge = Boolean(pad.buttons[1]?.pressed);
    if (padJump && !priorPadJump) jumpLatch = true; if (padAttack && !priorPadAttack) attackLatch = true; if (padGrab && !priorPadGrab) grabLatch = true; if (padDodge && !priorPadDodge) dodgeLatch = true;
    priorPadJump = padJump; priorPadAttack = padAttack; priorPadGrab = padGrab; priorPadDodge = padDodge; jumpHeld ||= padJump; shieldHeld ||= Boolean(pad.buttons[5]?.pressed);
  }
  const input: SimInputFrame = { frame, moveX, moveY, jumpPressed: jumpLatch, jumpHeld, attackPressed: attackLatch, grabPressed: grabLatch, dodgePressed: dodgeLatch, shieldHeld };
  jumpLatch = attackLatch = grabLatch = dodgeLatch = false; return input;
}

function dummyInput(frame: number): SimInputFrame {
  const input: SimInputFrame = { frame, moveX: 0, moveY: 0, jumpPressed: false, jumpHeld: false, attackPressed: dummyAttackLatch, grabPressed: dummyGrabLatch, dodgePressed: false, shieldHeld: dummyShield };
  dummyAttackLatch = false; dummyGrabLatch = false; return input;
}

function step() {
  previous = world;
  const result = stepMatchWorld(world, { frame: world.frame, byFighterId: { 'fighter-a': playerInput(world.frame), 'fighter-b': dummyInput(world.frame) } }, attacks, JAB_ID, K1_MOVEMENT, grabActions);
  world = result.state; if (result.events.length > 0) { lastEvent = result.events[result.events.length - 1] ?? null; flashFrames = 8; }
  if (flashFrames > 0) flashFrames -= 1;
}

function drawHitboxes(fighter: FighterState, visual: FighterVisual) {
  visual.hitboxes.clear(); if (!fighter.attack) return;
  const attack: AttackDefinition | undefined = attacks.get(fighter.attack.attackId); if (!attack) return;
  const attackFrame = fighter.attack.frame;
  for (const window of attack.hitboxes.filter((entry) => attackFrame >= entry.startFrame && attackFrame <= entry.endFrame)) {
    const hitbox = window.hitbox;
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(fixed.toNumber(hitbox.radius), 20, 14), new THREE.MeshBasicMaterial({ color: 0xff4d67, wireframe: true }));
    mesh.position.set(fixed.toNumber(hitbox.offsetX), fixed.toNumber(hitbox.offsetY), 0); visual.hitboxes.add(mesh);
  }
}

function interpolateFighter(id: string, alpha: number) {
  const current = world.fighters.find((entry) => entry.id === id); if (!current) return;
  const old = previous.fighters.find((entry) => entry.id === id) ?? current; const visual = visuals.get(id); if (!visual) return;
  visual.root.visible = !current.eliminated;
  visual.root.position.set(THREE.MathUtils.lerp(fixed.toNumber(old.x), fixed.toNumber(current.x), alpha), THREE.MathUtils.lerp(fixed.toNumber(old.y), fixed.toNumber(current.y), alpha), 0);
  visual.root.scale.x = current.facing; visual.hurtbox.visible = current.invulnerableFrames === 0 || world.frame % 4 < 2; visual.shield.visible = current.shielding;
  visual.shield.scale.setScalar(0.65 + (current.shieldHealth / 600) * 0.35);
  const actionLean = current.grabAction ? 0.23 * Math.sin((current.grabAction.frame / 8) * Math.PI) : current.grabTargetId ? 0.16 : 0;
  visual.body.rotation.z = current.attack ? -current.facing * 0.13 * Math.sin((current.attack.frame / 18) * Math.PI) : -current.facing * actionLean;
  drawHitboxes(current, visual);
}

function fighterHud(label: string, fighter: FighterState): string[] {
  const grab = fighter.grabTargetId ? `holding ${fighter.grabTargetId} [${fighter.grabFrames}]` : fighter.grabbedById ? `grabbed by ${fighter.grabbedById} [${fighter.grabFrames}]` : 'none';
  return [
    `${label} ${(fighter.percentTenths / 10).toFixed(1).padStart(5)}%  ${fighter.locomotion}`,
    `   stocks   ${fighter.stocks}  ${fighter.eliminated ? 'ELIMINATED' : fighter.respawnFrames > 0 ? `respawn ${fighter.respawnFrames}` : 'active'}`,
    `   attack   ${fighter.attack ? `${fighter.attack.attackId} [${fighter.attack.frame}]` : 'none'}`,
    `   grab     ${grab}`,
    `   action   ${fighter.grabAction ? `${fighter.grabAction.actionId} [${fighter.grabAction.frame}]` : 'none'}`,
    `   hitlag   ${fighter.hitlagFrames}  hitstun ${fighter.hitstunFrames}`,
    `   shield   ${fighter.shielding ? 'ON ' : 'off'} ${String(fighter.shieldHealth).padStart(3)}  stun ${fighter.shieldStunFrames}  regen ${fighter.shieldRegenDelayFrames}`,
  ];
}

function renderHud() {
  const a = world.fighters.find((entry) => entry.id === 'fighter-a'); const b = world.fighters.find((entry) => entry.id === 'fighter-b'); if (!a || !b) return;
  hud.textContent = ['SLU PLATFORM FIGHTER — K2 COMBAT / DEFENSE LAB', `frame      ${world.frame}`, `winner     ${world.winnerId ?? 'unresolved'}`, '', ...fighterHud('P1', a), '', ...fighterHud('P2', b), `   dummy shield toggle ${dummyShield ? 'ON' : 'off'}`, '', `sim        ${paused ? 'PAUSED' : 'RUNNING'} @ ${SIM_HZ} Hz`].join('\n');
  if (!lastEvent) return;
  if (lastEvent.type === 'hit') eventsHud.textContent = [flashFrames > 0 ? 'HIT!' : 'LAST HIT', `${lastEvent.attackerId} → ${lastEvent.targetId}`, `${lastEvent.attackId} / ${lastEvent.hitboxId}`, `damage ${(lastEvent.damageTenths / 10).toFixed(1)}%`, `hitlag ${lastEvent.hitlagFrames} / hitstun ${lastEvent.hitstunFrames}`].join('\n');
  else if (lastEvent.type === 'block') eventsHud.textContent = [lastEvent.broken ? 'SHIELD BREAK!' : flashFrames > 0 ? 'BLOCK!' : 'LAST BLOCK', `${lastEvent.attackerId} → ${lastEvent.targetId}`, `${lastEvent.attackId} / ${lastEvent.hitboxId}`, `shield -${lastEvent.shieldDamage} → ${lastEvent.shieldHealthAfter}`, `shieldstun ${lastEvent.shieldStunFrames}`].join('\n');
  else if (lastEvent.type === 'pummel') eventsHud.textContent = [flashFrames > 0 ? 'PUMMEL!' : 'LAST PUMMEL', `${lastEvent.attackerId} → ${lastEvent.targetId}`, lastEvent.actionId, `damage ${(lastEvent.damageTenths / 10).toFixed(1)}%`].join('\n');
  else if (lastEvent.type === 'throw') eventsHud.textContent = [flashFrames > 0 ? 'THROW!' : 'LAST THROW', `${lastEvent.attackerId} → ${lastEvent.targetId}`, lastEvent.actionId, `damage ${(lastEvent.damageTenths / 10).toFixed(1)}%`, `hitstun ${lastEvent.hitstunFrames}`].join('\n');
  else if (lastEvent.type === 'ko') eventsHud.textContent = [lastEvent.eliminated ? 'FINAL KO!' : 'KO!', lastEvent.fighterId, `stocks ${lastEvent.stocksAfter}`, lastEvent.eliminated ? 'ELIMINATED' : 'RESPAWNING'].join('\n');
  else if (lastEvent.type === 'respawn') eventsHud.textContent = ['RESPAWN', lastEvent.fighterId].join('\n');
  else if (lastEvent.type === 'grab' || lastEvent.type === 'grab-release') eventsHud.textContent = [lastEvent.type === 'grab' ? (flashFrames > 0 ? 'GRAB!' : 'LAST GRAB') : 'GRAB RELEASE', `${lastEvent.attackerId} → ${lastEvent.targetId}`].join('\n');
}

function frame(now: number) {
  const delta = Math.min(100, now - lastTime); lastTime = now; if (!paused) accumulator += delta;
  if (paused && stepRequested) { step(); stepRequested = false; }
  let steps = 0; while (!paused && accumulator >= STEP_MS && steps < MAX_STEPS) { step(); accumulator -= STEP_MS; steps += 1; }
  if (steps === MAX_STEPS) accumulator = 0;
  const alpha = paused ? 1 : accumulator / STEP_MS; interpolateFighter('fighter-a', alpha); interpolateFighter('fighter-b', alpha); renderHud(); renderer.render(scene, camera); requestAnimationFrame(frame);
}
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
requestAnimationFrame(frame);
