import { fixed } from '../../deterministic-math/src/fixed.js';
import { compileFighterGrabActions } from '../../content/src/compileGrabActions.js';
import { compileFighterAttacks } from '../../content/src/compileMoves.js';
import { ALL_FIGHTER_PACKS } from '../../content/src/generated/fighterRegistry.js';
import { applyDirectionalInfluence, stepHitlagSDI } from '../../sim/src/knockback.js';
import { createTwoFighterMatch, stepMatchWorld } from '../../sim/src/match.js';
import { K1_MOVEMENT } from '../../sim/src/movement.js';
import type { SimInputFrame, WorldState } from '../../sim/src/types.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`K3 knockback certification failure: ${message}`);
}

function input(frame: number, moveX = 0, moveY = 0, attackPressed = false): SimInputFrame {
  return { frame, moveX, moveY, jumpPressed: false, jumpHeld: false, attackPressed, grabPressed: false, dodgePressed: false, shieldHeld: false };
}

const baseX = fixed.fromRatio(4, 10);
const baseY = fixed.fromRatio(2, 10);
const neutral = applyDirectionalInfluence(baseX, baseY, input(0));
const upward = applyDirectionalInfluence(baseX, baseY, input(0, 0, 1000));
assert(neutral.vx === baseX && neutral.vy === baseY, 'neutral stick must not alter authored launch vector');
assert(upward.vx < baseX && upward.vy > baseY, 'upward DI must rotate a forward-up launch toward vertical without replacing it');

const pack = ALL_FIGHTER_PACKS.find((candidate) => candidate.id === 'greybox');
assert(pack !== undefined, 'greybox pack must exist');
const attacks = compileFighterAttacks(pack);
const grabs = compileFighterGrabActions(pack);
const jabId = 'greybox:jab';

function step(state: WorldState, targetX = 0, targetY = 0) {
  return stepMatchWorld(state, {
    frame: state.frame,
    byFighterId: {
      'fighter-a': input(state.frame, 0, 0, state.frame === 0),
      'fighter-b': input(state.frame, targetX, targetY),
    },
  }, attacks, jabId, K1_MOVEMENT, grabs);
}

let neutralState = createTwoFighterMatch(0x44_49_30);
let diState = createTwoFighterMatch(0x44_49_31);
let neutralLaunch: { vx: number; vy: number } | null = null;
let diLaunch: { vx: number; vy: number } | null = null;
for (let frame = 0; frame < 8; frame += 1) {
  const neutralResult = step(neutralState);
  neutralState = neutralResult.state;
  if (neutralResult.events.some((event) => event.type === 'hit')) {
    const fighter = neutralState.fighters.find((candidate) => candidate.id === 'fighter-b')!;
    neutralLaunch = { vx: fighter.vx, vy: fighter.vy };
  }

  const diResult = step(diState, 0, 1000);
  diState = diResult.state;
  if (diResult.events.some((event) => event.type === 'hit')) {
    const fighter = diState.fighters.find((candidate) => candidate.id === 'fighter-b')!;
    diLaunch = { vx: fighter.vx, vy: fighter.vy };
  }
}
assert(neutralLaunch !== null && diLaunch !== null, 'authored jab must produce comparable neutral and DI launches');
assert(diLaunch.vx < neutralLaunch.vx && diLaunch.vy > neutralLaunch.vy, 'match integration must apply defender DI exactly when the hit creates launch');

let sdiState = createTwoFighterMatch(0x53_44_49);
for (let frame = 0; frame < 8; frame += 1) {
  const result = step(sdiState);
  sdiState = result.state;
  if (result.events.some((event) => event.type === 'hit')) break;
}
const sdiTarget = sdiState.fighters.find((candidate) => candidate.id === 'fighter-b')!;
assert(sdiTarget.hitlagFrames > 0 && sdiTarget.hitstunFrames > 0, 'SDI scenario must begin during defender hitlag');
const beforeX = sdiTarget.x;
const beforeVx = sdiTarget.vx;
const flicked = stepHitlagSDI(sdiTarget, input(sdiState.frame, 1000, 0), K1_MOVEMENT);
assert(flicked.x > beforeX, 'qualifying SDI flick must displace defender during hitlag');
assert(flicked.vx === beforeVx, 'SDI must not rewrite stored launch velocity');

console.log('K3 KNOCKBACK PASS — one-time DI, hitlag SDI displacement, and match launch integration certified.');
