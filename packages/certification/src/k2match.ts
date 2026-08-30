import { createHash } from 'node:crypto';
import { fixed } from '../../deterministic-math/src/fixed.js';
import { compileFighterGrabActions } from '../../content/src/compileGrabActions.js';
import { compileFighterAttacks } from '../../content/src/compileMoves.js';
import { ALL_FIGHTER_PACKS } from '../../content/src/generated/fighterRegistry.js';
import { K2_DEFENSE } from '../../sim/src/combat.js';
import { createTwoFighterMatch, GRAB_MAX_HOLD_FRAMES, stepMatchWorld, type MatchInputFrame } from '../../sim/src/match.js';
import { K1_MOVEMENT } from '../../sim/src/movement.js';
import { serializeWorldState } from '../../sim/src/serialize.js';
import { restoreWorld, snapshotWorld } from '../../sim/src/world.js';
import type { SimInputFrame, WorldState } from '../../sim/src/types.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`K2 match certification failure: ${message}`);
}

const pack = ALL_FIGHTER_PACKS.find((candidate) => candidate.id === 'greybox');
assert(pack !== undefined, 'greybox pack must exist');
const attacks = compileFighterAttacks(pack);
const grabActions = compileFighterGrabActions(pack);
const jabId = 'greybox:jab';
assert(attacks.has(jabId), 'greybox jab must compile');
for (const action of ['pummel','forward-throw','back-throw','up-throw','down-throw'] as const) {
  assert(grabActions.has(action), `greybox ${action} must compile from fighter pack`);
}

function fighterInput(frame: number, overrides: Partial<Omit<SimInputFrame, 'frame'>> = {}): SimInputFrame {
  return { frame, moveX: 0, moveY: 0, jumpPressed: false, jumpHeld: false, attackPressed: false, grabPressed: false, dodgePressed: false, shieldHeld: false, ...overrides };
}

function step(state: WorldState, input: MatchInputFrame) {
  return stepMatchWorld(state, input, attacks, jabId, K1_MOVEMENT, grabActions);
}

function inputForFrame(frame: number): MatchInputFrame {
  return {
    frame,
    byFighterId: {
      'fighter-a': fighterInput(frame, {
        moveX: frame >= 40 && frame < 75 ? 650 : 0,
        jumpPressed: frame === 90,
        jumpHeld: frame >= 90 && frame < 95,
        attackPressed: frame === 0 || frame === 130,
        shieldHeld: frame >= 200 && frame < 220,
      }),
      'fighter-b': fighterInput(frame, {
        moveX: frame >= 50 && frame < 80 ? -450 : 0,
        dodgePressed: frame === 120,
        attackPressed: frame === 170 || frame === 202,
      }),
    },
  };
}

function hash(state: WorldState): string { return createHash('sha256').update(serializeWorldState(state)).digest('hex'); }
function closeForGrab(state: WorldState) {
  state.fighters[0]!.x = fixed.fromRatio(-3, 5);
  state.fighters[1]!.x = fixed.fromRatio(3, 5);
}
function grabAtFrameZero(state: WorldState): WorldState {
  closeForGrab(state);
  return step(state, { frame: state.frame, byFighterId: { 'fighter-a': fighterInput(state.frame, { grabPressed: true }), 'fighter-b': fighterInput(state.frame, { shieldHeld: true }) } }).state;
}

let state = createTwoFighterMatch(0x4b_32);
let hitObserved = false;
for (let frame = 0; frame < 20; frame += 1) {
  const result = step(state, inputForFrame(frame)); state = result.state;
  if (result.events.some((event) => event.type === 'hit')) hitObserved = true;
}
assert(hitObserved, 'authored jab must create a hit event in unified match world');
const target = state.fighters.find((fighter) => fighter.id === 'fighter-b');
assert(target?.percentTenths === 35, 'combat damage must persist in authoritative FighterState');

state = createTwoFighterMatch(0x53_48_4c_44);
let blockObserved = false;
for (let frame = 0; frame < 12; frame += 1) {
  const result = step(state, { frame, byFighterId: { 'fighter-a': fighterInput(frame, { attackPressed: frame === 0 }), 'fighter-b': fighterInput(frame, { shieldHeld: true }) } });
  state = result.state; if (result.events.some((event) => event.type === 'block')) blockObserved = true;
}
const shieldTarget = state.fighters.find((fighter) => fighter.id === 'fighter-b');
assert(blockObserved && shieldTarget?.percentTenths === 0, 'shield must block authored jab without percent damage');
assert((shieldTarget?.shieldHealth ?? K2_DEFENSE.shieldMaxHealth) < K2_DEFENSE.shieldMaxHealth, 'block must consume shield health');

state = grabAtFrameZero(createTwoFighterMatch(0x47_52_41_42));
let held = state.fighters.find((fighter) => fighter.id === 'fighter-b')!;
let holder = state.fighters.find((fighter) => fighter.id === 'fighter-a')!;
assert(holder.grabTargetId === held.id && held.grabbedById === holder.id, 'grab relationship must be symmetric');
assert(!held.shielding && held.locomotion === 'grabbed', 'grab must bypass and cancel shield');

state = createTwoFighterMatch(0x49_46_52_41); closeForGrab(state); state.fighters[1]!.invulnerableFrames = 5;
let result = step(state, { frame: 0, byFighterId: { 'fighter-a': fighterInput(0, { grabPressed: true }), 'fighter-b': fighterInput(0) } });
assert(!result.events.some((event) => event.type === 'grab'), 'grab must fail against active invulnerability');

state = grabAtFrameZero(createTwoFighterMatch(0x50_55_4d_4d));
result = step(state, { frame: state.frame, byFighterId: { 'fighter-a': fighterInput(state.frame, { attackPressed: true }), 'fighter-b': fighterInput(state.frame) } });
state = result.state;
assert(String(state.fighters[0]?.grabAction?.actionId ?? '') === 'greybox:pummel', 'neutral held attack must start authored pummel');
let pummelObserved = false;
for (let i = 0; i < 12; i += 1) {
  result = step(state, { frame: state.frame, byFighterId: { 'fighter-a': fighterInput(state.frame), 'fighter-b': fighterInput(state.frame) } });
  state = result.state; if (result.events.some((event) => event.type === 'pummel')) pummelObserved = true;
}
held = state.fighters[1]!; holder = state.fighters[0]!;
assert(pummelObserved && held.percentTenths === 15, 'authored pummel must apply fighter-pack damage exactly once');
assert(holder.grabTargetId === held.id && held.grabbedById === holder.id, 'pummel must preserve grab relationship');

state = grabAtFrameZero(createTwoFighterMatch(0x54_48_52_57));
result = step(state, { frame: state.frame, byFighterId: { 'fighter-a': fighterInput(state.frame, { attackPressed: true, moveX: 1000 }), 'fighter-b': fighterInput(state.frame) } });
state = result.state;
assert(String(state.fighters[0]?.grabAction?.actionId ?? '') === 'greybox:forward-throw', 'forward held attack must select authored forward throw');
let throwObserved = false;
let throwCheckpoint = snapshotWorld(state);
const throwHashes: string[] = [];
for (let i = 0; i < 30; i += 1) {
  if (i === 6) throwCheckpoint = snapshotWorld(state);
  result = step(state, { frame: state.frame, byFighterId: { 'fighter-a': fighterInput(state.frame), 'fighter-b': fighterInput(state.frame) } });
  state = result.state; throwHashes.push(hash(state));
  if (result.events.some((event) => event.type === 'throw')) throwObserved = true;
}
held = state.fighters[1]!; holder = state.fighters[0]!;
assert(throwObserved, 'authored forward throw must emit throw event at release frame');
assert(holder.grabTargetId === null && held.grabbedById === null, 'throw release must clear grab relationship');
assert(held.percentTenths === 55 && held.vx > fixed.zero && held.vy > fixed.zero, 'forward throw must apply authored damage and launch');

let throwReplay = restoreWorld(throwCheckpoint);
for (let i = 7; i < throwHashes.length; i += 1) {
  throwReplay = step(throwReplay, { frame: throwReplay.frame, byFighterId: { 'fighter-a': fighterInput(throwReplay.frame), 'fighter-b': fighterInput(throwReplay.frame) } }).state;
  assert(hash(throwReplay) === throwHashes[i], `mid-throw resimulation diverged at sample ${i}`);
}

state = grabAtFrameZero(createTwoFighterMatch(0x47_52_52_42));
const grabCheckpoint = snapshotWorld(state); const grabHashes: string[] = [];
for (let i = 1; i <= GRAB_MAX_HOLD_FRAMES + 2; i += 1) {
  state = step(state, { frame: state.frame, byFighterId: { 'fighter-a': fighterInput(state.frame), 'fighter-b': fighterInput(state.frame) } }).state;
  grabHashes.push(hash(state));
}
let grabReplay = restoreWorld(grabCheckpoint);
for (let i = 0; i < grabHashes.length; i += 1) {
  grabReplay = step(grabReplay, { frame: grabReplay.frame, byFighterId: { 'fighter-a': fighterInput(grabReplay.frame), 'fighter-b': fighterInput(grabReplay.frame) } }).state;
  assert(hash(grabReplay) === grabHashes[i], `grab resimulation diverged at sample ${i}`);
}
assert(grabReplay.fighters.every((fighter) => fighter.grabTargetId === null && fighter.grabbedById === null), 'grab must auto-release at deterministic hold limit');

const TOTAL = 300; const SNAPSHOT = 110;
state = createTwoFighterMatch(0x4b_32); const hashes: string[] = []; let checkpoint = snapshotWorld(state);
for (let frame = 0; frame < TOTAL; frame += 1) {
  if (frame === SNAPSHOT) checkpoint = snapshotWorld(state);
  state = step(state, inputForFrame(frame)).state; hashes.push(hash(state));
}
let replay = restoreWorld(checkpoint);
for (let frame = SNAPSHOT; frame < TOTAL; frame += 1) {
  replay = step(replay, inputForFrame(frame)).state;
  assert(hash(replay) === hashes[frame], `movement+combat+defense resimulation diverged at frame ${frame + 1}`);
}

console.log(`K2 MATCH PASS — attacks, defense, grabs, authored pummels/throws, and ${TOTAL}-frame snapshot/resim certified.`);
console.log(`Final unified state hash: ${hash(state)}`);
