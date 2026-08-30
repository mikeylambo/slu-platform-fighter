import { fixed } from '../../deterministic-math/src/fixed.js';
import { compileFighterGrabActions } from '../../content/src/compileGrabActions.js';
import { compileFighterAttacks } from '../../content/src/compileMoves.js';
import { ALL_FIGHTER_PACKS } from '../../content/src/generated/fighterRegistry.js';
import { resolveStandardMove, type StandardMoveName } from '../../sim/src/actionResolver.js';
import { createTwoFighterMatch, stepMatchWorld } from '../../sim/src/match.js';
import { K1_MOVEMENT } from '../../sim/src/movement.js';
import type { FighterState, SimInputFrame, WorldState } from '../../sim/src/types.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`K5 action certification failure: ${message}`);
}

const pack = ALL_FIGHTER_PACKS.find((candidate) => candidate.id === 'greybox');
assert(pack !== undefined, 'greybox fighter pack must exist');
const attacks = compileFighterAttacks(pack);
const grabs = compileFighterGrabActions(pack);
const standardMoves: StandardMoveName[] = [
  'jab','dash-attack','forward-tilt','up-tilt','down-tilt','forward-smash','up-smash','down-smash',
  'neutral-air','forward-air','back-air','up-air','down-air',
  'neutral-special','side-special','up-special','down-special',
];
for (const move of standardMoves) assert(attacks.has(`greybox:${move}`), `greybox must author standard move ${move}`);

function input(frame: number, overrides: Partial<Omit<SimInputFrame, 'frame'>> = {}): SimInputFrame {
  return { frame, moveX: 0, moveY: 0, jumpPressed: false, jumpHeld: false, attackPressed: false, specialPressed: false, grabPressed: false, smashX: 0, smashY: 0, dodgePressed: false, shieldHeld: false, ...overrides };
}

const base = createTwoFighterMatch(0x4b_35_41_43).fighters[0]!;
assert(base.id === 'fighter-a' && base.definitionId === 'greybox', 'runtime participant id and fighter definition id must remain distinct');
assert(resolveStandardMove(base, input(0, { attackPressed: true })) === 'jab', 'neutral grounded attack must resolve jab');
assert(resolveStandardMove(base, input(0, { attackPressed: true, moveX: 1000 })) === 'forward-tilt', 'horizontal grounded attack must resolve forward tilt');
assert(resolveStandardMove(base, input(0, { attackPressed: true, moveY: 1000 })) === 'up-tilt', 'up grounded attack must resolve up tilt');
assert(resolveStandardMove(base, input(0, { attackPressed: true, moveY: -1000 })) === 'down-tilt', 'down grounded attack must resolve down tilt');
assert(resolveStandardMove(base, input(0, { smashX: 1000 })) === 'forward-smash', 'smash X must resolve forward smash');
assert(resolveStandardMove(base, input(0, { smashY: 1000 })) === 'up-smash', 'positive smash Y must resolve up smash');
assert(resolveStandardMove(base, input(0, { smashY: -1000 })) === 'down-smash', 'negative smash Y must resolve down smash');

const dashFighter: FighterState = { ...base, locomotion: 'dash' };
assert(resolveStandardMove(dashFighter, input(0, { attackPressed: true })) === 'dash-attack', 'attack during dash/run must resolve dash attack');
const airFighter: FighterState = { ...base, grounded: false, groundSurfaceId: null, locomotion: 'airborne' };
assert(resolveStandardMove(airFighter, input(0, { attackPressed: true })) === 'neutral-air', 'neutral airborne attack must resolve neutral air');
assert(resolveStandardMove(airFighter, input(0, { attackPressed: true, moveX: 1000 })) === 'forward-air', 'forward airborne attack must resolve forward air');
assert(resolveStandardMove(airFighter, input(0, { attackPressed: true, moveX: -1000 })) === 'back-air', 'back airborne attack must resolve back air');
assert(resolveStandardMove(airFighter, input(0, { attackPressed: true, moveY: 1000 })) === 'up-air', 'up airborne attack must resolve up air');
assert(resolveStandardMove(airFighter, input(0, { attackPressed: true, moveY: -1000 })) === 'down-air', 'down airborne attack must resolve down air');
assert(resolveStandardMove(base, input(0, { specialPressed: true })) === 'neutral-special', 'neutral special must resolve');
assert(resolveStandardMove(base, input(0, { specialPressed: true, moveX: 1000 })) === 'side-special', 'side special must resolve');
assert(resolveStandardMove(base, input(0, { specialPressed: true, moveY: 1000 })) === 'up-special', 'up special must resolve');
assert(resolveStandardMove(base, input(0, { specialPressed: true, moveY: -1000 })) === 'down-special', 'down special must resolve');

function oneStep(overrides: Partial<Omit<SimInputFrame, 'frame'>>): WorldState {
  const state = createTwoFighterMatch(0x52_4f_55_54);
  state.fighters[0]!.x = fixed.fromInt(-6);
  state.fighters[1]!.x = fixed.fromInt(6);
  return stepMatchWorld(state, {
    frame: 0,
    byFighterId: { 'fighter-a': input(0, overrides), 'fighter-b': input(0) },
  }, attacks, 'greybox:jab', K1_MOVEMENT, grabs).state;
}

assert(oneStep({ specialPressed: true, moveX: 1000 }).fighters[0]?.attack?.attackId === 'greybox:side-special', 'match must start authored side special from semantic input');
assert(oneStep({ smashY: 1000 }).fighters[0]?.attack?.attackId === 'greybox:up-smash', 'match must start authored up smash from smash-stick input');

let airState = createTwoFighterMatch(0x41_49_52_41);
airState.fighters[0] = { ...airState.fighters[0]!, x: fixed.fromInt(-6), y: fixed.fromInt(5), grounded: false, groundSurfaceId: null, locomotion: 'airborne' };
airState.fighters[1]!.x = fixed.fromInt(6);
airState = stepMatchWorld(airState, {
  frame: 0,
  byFighterId: { 'fighter-a': input(0, { attackPressed: true, moveX: 1000 }), 'fighter-b': input(0) },
}, attacks, 'greybox:jab', K1_MOVEMENT, grabs).state;
assert(airState.fighters[0]?.attack?.attackId === 'greybox:forward-air', 'match must start authored forward air while airborne');

console.log('K5 ACTIONS PASS — participant/definition identity and standard normals, smashes, aerials, specials, and match routing certified.');
