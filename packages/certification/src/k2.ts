import { fixed } from '../../deterministic-math/src/fixed.js';
import { beginAttack, stepCombatFrame, type AttackDefinition, type CombatantState } from '../../sim/src/combat.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`K2 certification failure: ${message}`);
}

const jab: AttackDefinition = {
  id: 'greybox-jab',
  totalFrames: 18,
  hitboxes: [
    {
      startFrame: 3,
      endFrame: 5,
      hitbox: {
        id: 'jab-main',
        offsetX: fixed.fromRatio(11, 10),
        offsetY: fixed.fromRatio(3, 2),
        radius: fixed.fromRatio(3, 4),
        damageTenths: 35,
        baseKnockback: fixed.fromRatio(9, 50),
        growthPer100Percent: fixed.fromRatio(13, 50),
        directionX: 1000,
        directionY: 420,
        hitlagFrames: 4,
        hitstunFrames: 11,
      },
    },
  ],
};
const attacks = new Map([[jab.id, jab]]);

function body(id: string, x: number, facing: -1 | 1): CombatantState {
  return {
    id,
    x: fixed.fromRatio(x, 10),
    y: fixed.zero,
    vx: fixed.zero,
    vy: fixed.zero,
    facing,
    hurtboxRadius: fixed.fromRatio(3, 4),
    hurtboxOffsetY: fixed.fromRatio(3, 2),
    percentTenths: 0,
    hitlagFrames: 0,
    hitstunFrames: 0,
    attack: null,
  };
}

let attacker = beginAttack(body('a', 0, 1), jab.id);
let target = body('b', 18, -1);
let combatants = [target, attacker];
let eventCount = 0;
let attackFrameAtHit = -1;

for (let frame = 0; frame < 12; frame += 1) {
  const result = stepCombatFrame(combatants, attacks);
  combatants = result.combatants;
  if (result.events.length > 0) {
    eventCount += result.events.length;
    const event = result.events[0];
    assert(event?.attackerId === 'a' && event.targetId === 'b', 'hit event must use stable attacker/target ids');
    assert(event.hitboxId === 'jab-main', 'active hitbox id must survive into event stream');
    assert(event.damageTenths === 35, 'damage must be integer tenths');
    assert(event.knockbackX > fixed.zero && event.knockbackY > fixed.zero, 'forward-up hit must create positive knockback components');
    const currentAttacker = combatants.find((entry) => entry.id === 'a');
    attackFrameAtHit = currentAttacker?.attack?.frame ?? -1;
  }
}

attacker = combatants.find((entry) => entry.id === 'a')!;
target = combatants.find((entry) => entry.id === 'b')!;
assert(eventCount === 1, 'one attack instance must hit a target at most once across multi-frame active window');
assert(target.percentTenths === 35, 'target percent must accumulate deterministic integer damage');
assert(target.hitstunFrames > 0, 'successful hit must leave target in hitstun after hitlag');
assert(attackFrameAtHit >= 3, 'hit must not occur before active frame window');

let low = body('low', 18, -1);
let high = { ...body('high', 18, -1), percentTenths: 1000 };
const sourceLow = { ...beginAttack(body('source', 0, 1), jab.id), attack: { attackId: jab.id, frame: 3, hitTargets: [] } };
const lowResult = stepCombatFrame([sourceLow, low], attacks);
low = lowResult.combatants.find((entry) => entry.id === 'low')!;
const sourceHigh = { ...beginAttack(body('source', 0, 1), jab.id), attack: { attackId: jab.id, frame: 3, hitTargets: [] } };
const highResult = stepCombatFrame([sourceHigh, high], attacks);
high = highResult.combatants.find((entry) => entry.id === 'high')!;
assert(fixed.abs(high.vx) > fixed.abs(low.vx), 'knockback growth must increase horizontal launch at higher percent');
assert(fixed.abs(high.vy) > fixed.abs(low.vy), 'knockback growth must increase vertical launch at higher percent');

const mirroredSource = { ...beginAttack(body('source', 0, -1), jab.id), attack: { attackId: jab.id, frame: 3, hitTargets: [] } };
const mirroredTarget = body('target', -18, 1);
const mirrored = stepCombatFrame([mirroredSource, mirroredTarget], attacks);
const mirrorEvent = mirrored.events[0];
assert(mirrorEvent !== undefined, 'mirrored setup must produce a hit event');
assert(mirrorEvent.knockbackX < fixed.zero, 'fighter facing must mirror authored horizontal launch direction');
assert(mirrorEvent.knockbackY > fixed.zero, 'fighter facing must not mirror vertical launch direction');

console.log('K2 PASS — attack timelines, active hitboxes, stable collision ordering, once-per-attack hits, damage, hitlag/hitstun, percent scaling, and mirrored knockback certified.');
