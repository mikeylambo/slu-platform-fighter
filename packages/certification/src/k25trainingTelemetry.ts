import { fixed } from '../../deterministic-math/src/fixed.js';
import type { AttackDefinition } from '../../sim/src/combat.js';
import { createTwoFighterMatch } from '../../sim/src/match.js';
import { actionabilityGap, fighterActionability } from '../../training/src/telemetry.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`K25 training telemetry certification failure: ${message}`);
}

const attack: AttackDefinition = {
  id: 'greybox:telemetry-test', totalFrames: 20,
  hitboxes: [{ startFrame: 4, endFrame: 5, hitbox: {
    id: 'telemetry', offsetX: fixed.zero, offsetY: fixed.zero, radius: fixed.fromInt(1), damageTenths: 10,
    baseKnockback: fixed.zero, growthPer100Percent: fixed.zero, directionX: 1000, directionY: 0, hitlagFrames: 0, hitstunFrames: 0,
  }}],
};
const attacks = new Map([[attack.id, attack]]);
const world = createTwoFighterMatch(0x4b_25_0001);
world.fighters[0] = { ...world.fighters[0]!, attack: { attackId: attack.id, frame: 7, hitTargets: [] }, landingLagFrames: 0 };
world.fighters[1] = { ...world.fighters[1]!, hitstunFrames: 17, landingLagFrames: 0 };

const first = fighterActionability(world.fighters[0]!, attacks);
assert(first.attackRemainingFrames === 12 && first.actionLockFrames === 12, 'attack recovery must derive from authored total frames and current attack frame');
const gap = actionabilityGap(world, 'fighter-a', 'fighter-b', attacks);
assert(gap.firstAdvantageFrames === 5, 'actionability gap must report defender lock minus attacker lock');

world.fighters[0] = { ...world.fighters[0]!, attack: null, landingLagFrames: 9 };
world.fighters[1] = { ...world.fighters[1]!, hitstunFrames: 0, shieldStunFrames: 13 };
const landingGap = actionabilityGap(world, 'fighter-a', 'fighter-b', attacks);
assert(landingGap.first.actionLockFrames === 9 && landingGap.second.actionLockFrames === 13 && landingGap.firstAdvantageFrames === 4, 'landing lag and shieldstun must participate in conservative actionability telemetry');

console.log('K25 TRAINING TELEMETRY PASS — authored attack recovery and live landing/hit/shield locks produce deterministic actionability diagnostics without becoming gameplay policy.');
