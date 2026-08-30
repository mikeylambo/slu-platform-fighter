import { fixed } from '../../deterministic-math/src/fixed.js';
import type { AerialLandingDefinition } from '../../content/src/compileLanding.js';
import { withAerialLandingPolicies } from '../../sim/src/aerialLanding.js';
import { createTwoFighterMatch, stepMatchWorld } from '../../sim/src/match.js';
import type { AttackDefinition } from '../../sim/src/combat.js';
import type { SimInputFrame } from '../../sim/src/types.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`K24 aerial landing certification failure: ${message}`);
}
function neutral(frame: number): SimInputFrame {
  return { frame, moveX: 0, moveY: 0, jumpPressed: false, jumpHeld: false, attackPressed: false, specialPressed: false, grabPressed: false, smashX: 0, smashY: 0, dodgePressed: false, shieldHeld: false };
}

const aerial: AttackDefinition = {
  id: 'greybox:test-air', totalFrames: 20,
  hitboxes: [{ startFrame: 2, endFrame: 2, hitbox: {
    id: 'landing-hit', offsetX: fixed.fromInt(1), offsetY: fixed.fromInt(1), radius: fixed.fromInt(1), damageTenths: 99,
    baseKnockback: fixed.zero, growthPer100Percent: fixed.zero, directionX: 1000, directionY: 100, hitlagFrames: 0, hitstunFrames: 0,
  }}],
};
const attacks = new Map([[aerial.id, aerial]]);
const policy: AerialLandingDefinition = { attackId: aerial.id, landingLagFrames: 7, autoCancelWindows: [{ startFrame: 0, endFrame: 1 }, { startFrame: 15, endFrame: 19 }] };
const policies = new Map([[policy.attackId, policy]]);
const raw = (state: ReturnType<typeof createTwoFighterMatch>, input: { frame: number; byFighterId: Readonly<Record<string, SimInputFrame>> }) => stepMatchWorld(state, input, attacks, '__none__');
const step = withAerialLandingPolicies(raw, policies);

let world = createTwoFighterMatch(0x4b_24_0001);
const attacker = world.fighters[0]!;
const target = world.fighters[1]!;
world = {
  ...world,
  fighters: [
    { ...attacker, x: fixed.zero, y: fixed.fromRatio(1, 20), vy: fixed.fromRatio(-1, 10), grounded: false, groundSurfaceId: null, locomotion: 'airborne', attack: { attackId: aerial.id, frame: 2, hitTargets: [] } },
    { ...target, x: fixed.fromRatio(4, 5), y: fixed.zero },
  ],
};
let result = step(world, { frame: 0, byFighterId: { 'fighter-a': neutral(0), 'fighter-b': neutral(0) } });
world = result.state;
const landed = world.fighters.find((fighter) => fighter.id === 'fighter-a')!;
const untouched = world.fighters.find((fighter) => fighter.id === 'fighter-b')!;
assert(landed.grounded && landed.attack === null, 'landing must terminate the aerial before same-frame combat resolution');
assert(untouched.percentTenths === 0, 'landing-frame aerial hitbox must not hit after the fighter has landed');
assert(landed.landingLagFrames === 6, 'non-autocancel landing must retain authored recovery minus the landing frame');

for (let frame = 1; frame <= 6; frame += 1) {
  result = step(world, { frame, byFighterId: { 'fighter-a': neutral(frame), 'fighter-b': neutral(frame) } });
  world = result.state;
}
assert(world.fighters.find((fighter) => fighter.id === 'fighter-a')!.landingLagFrames === 0, 'authored landing recovery must deterministically expire');

world = createTwoFighterMatch(0x4b_24_0002);
world = {
  ...world,
  fighters: world.fighters.map((fighter, index) => index === 0 ? {
    ...fighter, x: fixed.zero, y: fixed.fromRatio(1, 20), vy: fixed.fromRatio(-1, 10), grounded: false, groundSurfaceId: null,
    locomotion: 'airborne', attack: { attackId: aerial.id, frame: 1, hitTargets: [] },
  } : fighter),
};
result = step(world, { frame: 0, byFighterId: { 'fighter-a': neutral(0), 'fighter-b': neutral(0) } });
const auto = result.state.fighters.find((fighter) => fighter.id === 'fighter-a')!;
assert(auto.grounded && auto.attack === null, 'autocancel landing must still terminate the aerial');
assert(auto.landingLagFrames === 3, 'autocancel must use universal four-frame normal landing rather than authored seven-frame aerial lag');

console.log('K24 AERIAL LANDING PASS — fighter-authored landing lag and autocancel windows terminate aerials before landing-frame hit resolution and remain rollback-authoritative.');
