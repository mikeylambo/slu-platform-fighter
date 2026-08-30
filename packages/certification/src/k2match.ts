import { createHash } from 'node:crypto';
import { fixed } from '../../deterministic-math/src/fixed.js';
import { compileFighterAttacks } from '../../content/src/compileMoves.js';
import { ALL_FIGHTER_PACKS } from '../../content/src/generated/fighterRegistry.js';
import { K2_DEFENSE } from '../../sim/src/combat.js';
import { createTwoFighterMatch, GRAB_MAX_HOLD_FRAMES, stepMatchWorld, type MatchInputFrame } from '../../sim/src/match.js';
import { serializeWorldState } from '../../sim/src/serialize.js';
import { restoreWorld, snapshotWorld } from '../../sim/src/world.js';
import type { SimInputFrame, WorldState } from '../../sim/src/types.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`K2 match certification failure: ${message}`);
}

const pack = ALL_FIGHTER_PACKS.find((candidate) => candidate.id === 'greybox');
assert(pack !== undefined, 'greybox pack must exist');
const attacks = compileFighterAttacks(pack);
const jabId = 'greybox:jab';
assert(attacks.has(jabId), 'greybox jab must compile');

function fighterInput(frame: number, overrides: Partial<Omit<SimInputFrame, 'frame'>> = {}): SimInputFrame {
  return {
    frame,
    moveX: 0,
    moveY: 0,
    jumpPressed: false,
    jumpHeld: false,
    attackPressed: false,
    grabPressed: false,
    dodgePressed: false,
    shieldHeld: false,
    ...overrides,
  };
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

function hash(state: WorldState): string {
  return createHash('sha256').update(serializeWorldState(state)).digest('hex');
}

let state = createTwoFighterMatch(0x4b_32);
let hitObserved = false;
for (let frame = 0; frame < 20; frame += 1) {
  const result = stepMatchWorld(state, inputForFrame(frame), attacks, jabId);
  state = result.state;
  if (result.events.some((event) => event.type === 'hit')) hitObserved = true;
}
assert(hitObserved, 'authored jab must create a hit event in unified match world');
const target = state.fighters.find((fighter) => fighter.id === 'fighter-b');
assert(target !== undefined && target.percentTenths === 35, 'combat damage must persist in authoritative FighterState');
assert(state.fighters.some((fighter) => fighter.attack !== null || fighter.percentTenths > 0), 'combat fields must inhabit authoritative world state');

// Dedicated match-level shield path: input -> authoritative shielding -> block event -> no percent damage.
state = createTwoFighterMatch(0x53_48_4c_44);
let blockObserved = false;
for (let frame = 0; frame < 12; frame += 1) {
  const result = stepMatchWorld(state, {
    frame,
    byFighterId: {
      'fighter-a': fighterInput(frame, { attackPressed: frame === 0 }),
      'fighter-b': fighterInput(frame, { shieldHeld: true }),
    },
  }, attacks, jabId);
  state = result.state;
  if (result.events.some((event) => event.type === 'block')) blockObserved = true;
}
const shieldTarget = state.fighters.find((fighter) => fighter.id === 'fighter-b');
assert(blockObserved, 'holding shield in match input must produce a block event against authored jab');
assert(shieldTarget !== undefined, 'shield target must remain in authoritative world');
assert(shieldTarget.percentTenths === 0, 'shield block must prevent percent damage');
assert(shieldTarget.shieldHealth < K2_DEFENSE.shieldMaxHealth, 'block must reduce authoritative shield health');
assert(shieldTarget.shieldRegenDelayFrames > 0, 'block must start shield regeneration delay');

// Grab beats shield, but not invulnerability.
state = createTwoFighterMatch(0x47_52_41_42);
const grabber = state.fighters.find((fighter) => fighter.id === 'fighter-a')!;
const grabTarget = state.fighters.find((fighter) => fighter.id === 'fighter-b')!;
grabber.x = fixed.fromRatio(-3, 5);
grabTarget.x = fixed.fromRatio(3, 5);
let result = stepMatchWorld(state, {
  frame: 0,
  byFighterId: {
    'fighter-a': fighterInput(0, { grabPressed: true }),
    'fighter-b': fighterInput(0, { shieldHeld: true }),
  },
}, attacks, jabId);
state = result.state;
assert(result.events.some((event) => event.type === 'grab'), 'grab input in range must create grab event');
const held = state.fighters.find((fighter) => fighter.id === 'fighter-b')!;
const holder = state.fighters.find((fighter) => fighter.id === 'fighter-a')!;
assert(holder.grabTargetId === held.id && held.grabbedById === holder.id, 'grab relationship must be symmetric in authoritative state');
assert(!held.shielding && held.locomotion === 'grabbed', 'grab must bypass and cancel shield');

state = createTwoFighterMatch(0x49_46_52_41);
const invulnGrabber = state.fighters.find((fighter) => fighter.id === 'fighter-a')!;
const invulnTarget = state.fighters.find((fighter) => fighter.id === 'fighter-b')!;
invulnGrabber.x = fixed.fromRatio(-3, 5);
invulnTarget.x = fixed.fromRatio(3, 5);
invulnTarget.invulnerableFrames = 5;
result = stepMatchWorld(state, {
  frame: 0,
  byFighterId: {
    'fighter-a': fighterInput(0, { grabPressed: true }),
    'fighter-b': fighterInput(0),
  },
}, attacks, jabId);
assert(!result.events.some((event) => event.type === 'grab'), 'grab must fail against active invulnerability');
assert(result.state.fighters.every((fighter) => fighter.grabTargetId === null && fighter.grabbedById === null), 'failed grab must not create partial relationship state');

// Snapshot while a grab is active, then prove hold/release evolution is identical after restore.
state = createTwoFighterMatch(0x47_52_52_42);
state.fighters[0]!.x = fixed.fromRatio(-3, 5);
state.fighters[1]!.x = fixed.fromRatio(3, 5);
state = stepMatchWorld(state, {
  frame: 0,
  byFighterId: {
    'fighter-a': fighterInput(0, { grabPressed: true }),
    'fighter-b': fighterInput(0, { shieldHeld: true }),
  },
}, attacks, jabId).state;
const grabCheckpoint = snapshotWorld(state);
const grabHashes: string[] = [];
for (let i = 1; i <= GRAB_MAX_HOLD_FRAMES + 2; i += 1) {
  state = stepMatchWorld(state, {
    frame: state.frame,
    byFighterId: {
      'fighter-a': fighterInput(state.frame),
      'fighter-b': fighterInput(state.frame),
    },
  }, attacks, jabId).state;
  grabHashes.push(hash(state));
}
let grabReplay = restoreWorld(grabCheckpoint);
for (let i = 0; i < grabHashes.length; i += 1) {
  grabReplay = stepMatchWorld(grabReplay, {
    frame: grabReplay.frame,
    byFighterId: {
      'fighter-a': fighterInput(grabReplay.frame),
      'fighter-b': fighterInput(grabReplay.frame),
    },
  }, attacks, jabId).state;
  assert(hash(grabReplay) === grabHashes[i], `grab resimulation diverged at sample ${i}`);
}
assert(grabReplay.fighters.every((fighter) => fighter.grabTargetId === null && fighter.grabbedById === null), 'grab must auto-release at deterministic hold limit');

const TOTAL = 300;
const SNAPSHOT = 110;
state = createTwoFighterMatch(0x4b_32);
const hashes: string[] = [];
let checkpoint = snapshotWorld(state);
for (let frame = 0; frame < TOTAL; frame += 1) {
  if (frame === SNAPSHOT) checkpoint = snapshotWorld(state);
  state = stepMatchWorld(state, inputForFrame(frame), attacks, jabId).state;
  hashes.push(hash(state));
}
let replay = restoreWorld(checkpoint);
for (let frame = SNAPSHOT; frame < TOTAL; frame += 1) {
  replay = stepMatchWorld(replay, inputForFrame(frame), attacks, jabId).state;
  assert(hash(replay) === hashes[frame], `movement+combat+defense resimulation diverged at frame ${frame + 1}`);
}

console.log(`K2 MATCH PASS — attacks, dodge/shield defense, grab relationships, and ${TOTAL}-frame snapshot/resim certified.`);
console.log(`Final unified state hash: ${hash(state)}`);
