import { createHash } from 'node:crypto';
import { compileFighterAttacks } from '../../content/src/compileMoves.js';
import { ALL_FIGHTER_PACKS } from '../../content/src/generated/fighterRegistry.js';
import { createTwoFighterMatch, stepMatchWorld, type MatchInputFrame } from '../../sim/src/match.js';
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
      }),
      'fighter-b': fighterInput(frame, {
        moveX: frame >= 50 && frame < 80 ? -450 : 0,
        dodgePressed: frame === 120,
        attackPressed: frame === 170,
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
  if (result.events.length > 0) hitObserved = true;
}
assert(hitObserved, 'authored jab must create a hit event in unified match world');
const target = state.fighters.find((fighter) => fighter.id === 'fighter-b');
assert(target !== undefined && target.percentTenths === 35, 'combat damage must persist in authoritative FighterState');
assert(state.fighters.some((fighter) => fighter.attack !== null || fighter.percentTenths > 0), 'combat fields must inhabit authoritative world state');

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
  assert(hash(replay) === hashes[frame], `movement+combat resimulation diverged at frame ${frame + 1}`);
}

console.log(`K2 MATCH PASS — authored fighter-pack attack runs inside authoritative world; ${TOTAL}-frame movement+combat snapshot/resim identical from frame ${SNAPSHOT}.`);
console.log(`Final unified state hash: ${hash(state)}`);
