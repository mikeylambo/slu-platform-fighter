import { fixed } from '../../deterministic-math/src/fixed.js';
import { withDamageAttribution } from '../../sim/src/damageAttribution.js';
import type { KoEvent } from '../../sim/src/lifecycle.js';
import { createTwoFighterMatch, stepMatchWorld } from '../../sim/src/match.js';
import { serializeWorldState } from '../../sim/src/serialize.js';
import type { AttackDefinition } from '../../sim/src/combat.js';
import type { MatchInputFrame, MatchEvent } from '../../sim/src/match.js';
import type { SimInputFrame, WorldState } from '../../sim/src/types.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`K17 attribution certification failure: ${message}`);
}
function neutral(frame: number, patch: Partial<Omit<SimInputFrame, 'frame'>> = {}): SimInputFrame {
  return { frame, moveX: 0, moveY: 0, jumpPressed: false, jumpHeld: false, attackPressed: false, specialPressed: false, grabPressed: false, smashX: 0, smashY: 0, dodgePressed: false, shieldHeld: false, ...patch };
}
function isKoFor(fighterId: string) {
  return (event: MatchEvent): event is KoEvent => event.type === 'ko' && event.fighterId === fighterId;
}
const jab: AttackDefinition = {
  id: 'greybox:jab', totalFrames: 4,
  hitboxes: [{ startFrame: 0, endFrame: 0, hitbox: {
    id: 'credit-hit', offsetX: fixed.fromRatio(9, 10), offsetY: fixed.fromRatio(3, 2), radius: fixed.fromInt(1),
    damageTenths: 60, baseKnockback: fixed.fromRatio(1, 4), growthPer100Percent: fixed.fromRatio(1, 4),
    directionX: 1000, directionY: 300, hitlagFrames: 1, hitstunFrames: 8,
  }}],
};
const attacks = new Map([[jab.id, jab]]);
const rawStep = (state: WorldState, input: MatchInputFrame) => stepMatchWorld(state, input, attacks, jab.id);
const step = withDamageAttribution(rawStep, { creditWindowFrames: 10 });

let world = createTwoFighterMatch(0x4b_17_0001);
world.fighters[0]!.x = fixed.zero;
world.fighters[1]!.x = fixed.fromRatio(4, 5);
let result = step(world, { frame: 0, byFighterId: { 'fighter-a': neutral(0, { attackPressed: true }), 'fighter-b': neutral(0) } });
world = result.state;
const targetAfterHit = world.fighters.find((fighter) => fighter.id === 'fighter-b');
assert(targetAfterHit?.lastHitById === 'fighter-a' && targetAfterHit.lastHitFrame === 0, 'damaging contact must persist attacker/frame ownership in authoritative fighter state');
const binaryWithCredit = serializeWorldState(world);
const withoutCredit = structuredClone(world);
withoutCredit.fighters.find((fighter) => fighter.id === 'fighter-b')!.lastHitById = null;
withoutCredit.fighters.find((fighter) => fighter.id === 'fighter-b')!.lastHitFrame = -1;
assert(Buffer.compare(Buffer.from(binaryWithCredit), Buffer.from(serializeWorldState(withoutCredit))) !== 0, 'binary world snapshot must encode KO attribution state');

// The launch may travel for several frames before the target crosses a blast zone.
world.fighters.find((fighter) => fighter.id === 'fighter-b')!.x = fixed.fromInt(30);
result = step(world, { frame: 1, byFighterId: { 'fighter-a': neutral(1), 'fighter-b': neutral(1) } });
const creditedKo = result.events.find(isKoFor('fighter-b'));
assert(creditedKo?.creditedAttackerId === 'fighter-a' && creditedKo.selfDestruct === false, 'KO after launch travel must credit the retained attacker');
assert(result.state.fighters.find((fighter) => fighter.id === 'fighter-b')?.lastHitById === null, 'stock loss must clear attribution before the next stock');

// Credit expires deterministically; a much later fall is classified as a self-destruct.
world = createTwoFighterMatch(0x4b_17_0002);
world.fighters.find((fighter) => fighter.id === 'fighter-b')!.lastHitById = 'fighter-a';
world.fighters.find((fighter) => fighter.id === 'fighter-b')!.lastHitFrame = 0;
world.frame = 20;
world.fighters.find((fighter) => fighter.id === 'fighter-b')!.x = fixed.fromInt(30);
result = step(world, { frame: 20, byFighterId: { 'fighter-a': neutral(20), 'fighter-b': neutral(20) } });
const expiredKo = result.events.find(isKoFor('fighter-b'));
assert(expiredKo?.creditedAttackerId === null && expiredKo.selfDestruct === true, 'expired contact ownership must not receive KO credit');

console.log('K17 ATTRIBUTION PASS — damaging contact ownership is rollback-serialized, survives launch travel, credits KOs and expires into deterministic self-destruct classification.');
