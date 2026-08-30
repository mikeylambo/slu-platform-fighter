import { createHash } from 'node:crypto';
import { compileFighterGrabActions } from '../../content/src/compileGrabActions.js';
import { compileFighterMoveRuntime } from '../../content/src/compileMoveRuntime.js';
import { compileFighterAttacks } from '../../content/src/compileMoves.js';
import { ALL_FIGHTER_PACKS } from '../../content/src/generated/fighterRegistry.js';
import { createTwoFighterMatch, stepMatchWorld } from '../../sim/src/match.js';
import { RollbackSession } from '../../sim/src/rollback.js';
import { serializeWorldState } from '../../sim/src/serialize.js';
import type { SimInputFrame, WorldState } from '../../sim/src/types.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`K8 rollback certification failure: ${message}`);
}

function hash(state: WorldState): string {
  return createHash('sha256').update(serializeWorldState(state)).digest('hex');
}

function input(frame: number, participant: 'fighter-a' | 'fighter-b'): SimInputFrame {
  if (participant === 'fighter-a') {
    return {
      frame,
      moveX: frame % 80 < 28 ? 760 : frame % 80 < 45 ? -500 : 0,
      moveY: frame % 47 === 11 ? 850 : 0,
      jumpPressed: frame === 17 || frame === 96,
      jumpHeld: (frame >= 17 && frame < 21) || (frame >= 96 && frame < 100),
      attackPressed: frame === 5 || frame === 38 || frame === 84 || frame === 128,
      specialPressed: frame === 61,
      grabPressed: frame === 112,
      smashX: frame === 145 ? 1000 : 0,
      smashY: 0,
      dodgePressed: frame === 73,
      shieldHeld: frame >= 103 && frame < 109,
    };
  }
  return {
    frame,
    moveX: frame % 67 < 21 ? -700 : frame % 67 < 35 ? 500 : 0,
    moveY: frame % 53 === 19 ? -900 : 0,
    jumpPressed: frame === 29 || frame === 118,
    jumpHeld: (frame >= 29 && frame < 34) || (frame >= 118 && frame < 122),
    attackPressed: frame === 12 || frame === 44 || frame === 79 || frame === 131,
    specialPressed: frame === 90,
    grabPressed: frame === 55,
    smashX: 0,
    smashY: frame === 151 ? 1000 : 0,
    dodgePressed: frame === 67,
    shieldHeld: frame >= 35 && frame < 42,
  };
}

const pack = ALL_FIGHTER_PACKS.find((candidate) => candidate.id === 'greybox');
assert(pack !== undefined, 'greybox fighter pack must exist');
const attacks = compileFighterAttacks(pack);
const grabActions = compileFighterGrabActions(pack);
const moveRuntime = compileFighterMoveRuntime(pack);
const jabId = 'greybox:jab';
assert(attacks.has(jabId), 'greybox jab must compile');

const step = (state: WorldState, frameInput: { frame: number; byFighterId: Readonly<Record<string, SimInputFrame>> }) =>
  stepMatchWorld(state, frameInput, attacks, jabId, undefined, grabActions, undefined, undefined, undefined, moveRuntime);

const SEED = 0x4b_38_52_42;
const SIMULATED_FRAMES = 180;
const REMOTE_DELAY = 6;

// Reference history: every participant input is exact before each frame is simulated.
const reference = new RollbackSession(createTwoFighterMatch(SEED), step, {
  participants: ['fighter-a', 'fighter-b'],
  historyFrames: 32,
});
for (let frame = 0; frame <= SIMULATED_FRAMES; frame += 1) {
  reference.submitInput('fighter-a', input(frame, 'fighter-a'));
  reference.submitInput('fighter-b', input(frame, 'fighter-b'));
  reference.advance();
}

// Delayed history: local input arrives on time; remote input arrives six frames late.
const delayed = new RollbackSession(createTwoFighterMatch(SEED), step, {
  participants: ['fighter-a', 'fighter-b'],
  historyFrames: 32,
});
let rollbackCount = 0;
let resimulatedFrames = 0;
for (let frame = 0; frame < SIMULATED_FRAMES; frame += 1) {
  delayed.submitInput('fighter-a', input(frame, 'fighter-a'));
  const arrivingRemoteFrame = frame - REMOTE_DELAY;
  if (arrivingRemoteFrame >= 0) delayed.submitInput('fighter-b', input(arrivingRemoteFrame, 'fighter-b'));
  const advanced = delayed.advance();
  if (advanced.rolledBackFromFrame !== null) rollbackCount += 1;
  resimulatedFrames += advanced.resimulatedFrames;
}
assert(delayed.currentFrame === SIMULATED_FRAMES, 'delayed session must remain at one deterministic simulation frame per advance');
assert(rollbackCount > 0 && resimulatedFrames > 0, 'late changed remote input must cause actual rollback/resimulation work');

// Deliver the outstanding six remote frames plus the exact next frame. The final
// advance reconciles dirty history and simulates frame 180, matching reference.
for (let frame = SIMULATED_FRAMES - REMOTE_DELAY; frame <= SIMULATED_FRAMES; frame += 1) {
  delayed.submitInput('fighter-b', input(frame, 'fighter-b'));
}
delayed.submitInput('fighter-a', input(SIMULATED_FRAMES, 'fighter-a'));
const reconciliation = delayed.advance();
assert(reconciliation.rolledBackFromFrame !== null, 'final late-input delivery must reconcile dirty predicted history');
assert(reconciliation.resimulatedFrames >= REMOTE_DELAY, 'reconciliation must replay every affected historical frame');
assert(delayed.currentFrame === reference.currentFrame, 'reference and delayed sessions must end on same frame');
assert(hash(delayed.currentState) === hash(reference.currentState), 'late-input prediction/resimulation must converge bit-identically with perfect-input reference');

// Re-submitting an identical already-consumed input must not create a false rollback.
delayed.submitInput('fighter-b', input(SIMULATED_FRAMES, 'fighter-b'));
delayed.submitInput('fighter-a', input(SIMULATED_FRAMES + 1, 'fighter-a'));
delayed.submitInput('fighter-b', input(SIMULATED_FRAMES + 1, 'fighter-b'));
const cleanAdvance = delayed.advance();
assert(cleanAdvance.rolledBackFromFrame === null && cleanAdvance.resimulatedFrames === 0, 'identical late input must not trigger unnecessary rollback');

console.log(`K8 ROLLBACK PASS — ${REMOTE_DELAY}-frame delayed remote prediction converged bit-identically after ${rollbackCount} rollback advances / ${resimulatedFrames} replayed frames.`);
