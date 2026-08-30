import { fixed } from '../../deterministic-math/src/fixed.js';
import { withDamageAttribution } from '../../sim/src/damageAttribution.js';
import { DEFAULT_STOCK_MATCH_RULES } from '../../sim/src/lifecycle.js';
import { createTwoFighterMatch, stepMatchWorld } from '../../sim/src/match.js';
import { createMatchRuntimeState, stockLifecycleRulesForMatch, withMatchRules, type MatchRules } from '../../sim/src/matchRules.js';
import { serializeWorldState } from '../../sim/src/serialize.js';
import type { MatchInputFrame } from '../../sim/src/match.js';
import type { SimInputFrame, WorldState } from '../../sim/src/types.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`K18 match-rules certification failure: ${message}`);
}
function neutral(frame: number): SimInputFrame {
  return { frame, moveX: 0, moveY: 0, jumpPressed: false, jumpHeld: false, attackPressed: false, specialPressed: false, grabPressed: false, smashX: 0, smashY: 0, dodgePressed: false, shieldHeld: false };
}
function makeWorld(seed: number, rules: MatchRules): WorldState {
  const world = createTwoFighterMatch(seed);
  world.match = createMatchRuntimeState(['fighter-a', 'fighter-b'], rules);
  world.winnerId = null;
  return world;
}
function makeStep(rules: MatchRules) {
  const lifecycle = stockLifecycleRulesForMatch(DEFAULT_STOCK_MATCH_RULES, rules);
  const raw = (state: WorldState, input: MatchInputFrame) => stepMatchWorld(state, input, new Map(), 'unused', undefined, undefined, lifecycle);
  return withMatchRules(withDamageAttribution(raw, { creditWindowFrames: 600 }), rules);
}
function inputs(frame: number): MatchInputFrame {
  return { frame, byFighterId: { 'fighter-a': neutral(frame), 'fighter-b': neutral(frame) } };
}

// Pure Time: credited KOs score, stocks are not consumed, and fighters always respawn.
const timeRules: MatchRules = { mode: 'time', timeLimitFrames: 5, koScore: 1, selfDestructPenalty: -1 };
let world = makeWorld(0x4b_18_0001, timeRules);
world.fighters.find((fighter) => fighter.id === 'fighter-b')!.lastHitById = 'fighter-a';
world.fighters.find((fighter) => fighter.id === 'fighter-b')!.lastHitFrame = 0;
world.fighters.find((fighter) => fighter.id === 'fighter-b')!.x = fixed.fromInt(30);
let result = makeStep(timeRules)(world, inputs(0));
assert(result.state.match?.scores['fighter-a'] === 1, 'credited Time KO must increment attacker score');
assert(result.state.match?.framesRemaining === 4, 'Time timer must decrement exactly one authoritative frame per step');
const timedVictim = result.state.fighters.find((fighter) => fighter.id === 'fighter-b');
assert(timedVictim?.stocks === 3 && timedVictim.eliminated === false && (timedVictim.respawnFrames ?? 0) > 0, 'pure Time KO must preserve stock count and schedule infinite respawn');
assert(result.state.winnerId === null && result.state.match?.ended === false, 'Time match must continue before regulation expires');

// Self-destructs penalize the victim rather than awarding an attacker.
world = makeWorld(0x4b_18_0002, timeRules);
world.fighters.find((fighter) => fighter.id === 'fighter-b')!.x = fixed.fromInt(30);
result = makeStep(timeRules)(world, inputs(0));
assert(result.state.match?.scores['fighter-b'] === -1 && result.state.match?.scores['fighter-a'] === 0, 'Time self-destruct must apply configured victim penalty');

// One-frame regulation with a credited KO resolves the unique score leader.
const shortTime: MatchRules = { mode: 'time', timeLimitFrames: 1 };
world = makeWorld(0x4b_18_0003, shortTime);
world.fighters.find((fighter) => fighter.id === 'fighter-b')!.lastHitById = 'fighter-a';
world.fighters.find((fighter) => fighter.id === 'fighter-b')!.lastHitFrame = 0;
world.fighters.find((fighter) => fighter.id === 'fighter-b')!.x = fixed.fromInt(30);
result = makeStep(shortTime)(world, inputs(0));
assert(result.state.match?.framesRemaining === 0 && result.state.match.ended, 'Time regulation must end when authoritative timer reaches zero');
assert(result.state.winnerId === 'fighter-a' && result.state.match.suddenDeath === false, 'unique Time score leader must resolve winner without sudden death');

// A tied timer expiration signals sudden death instead of inventing a winner.
world = makeWorld(0x4b_18_0004, shortTime);
result = makeStep(shortTime)(world, inputs(0));
assert(result.state.winnerId === null && result.state.match?.ended === true && result.state.match.suddenDeath === true, 'tied Time regulation must request deterministic sudden death');

// Stock+Time prioritizes remaining stocks, then score, when the timer expires.
const stockTime: MatchRules = { mode: 'stock-time', timeLimitFrames: 1 };
world = makeWorld(0x4b_18_0005, stockTime);
world.fighters.find((fighter) => fighter.id === 'fighter-a')!.stocks = 2;
world.fighters.find((fighter) => fighter.id === 'fighter-b')!.stocks = 1;
result = makeStep(stockTime)(world, inputs(0));
assert(result.state.winnerId === 'fighter-a', 'Stock+Time timeout must prioritize remaining stocks before score');

world = makeWorld(0x4b_18_0006, stockTime);
world.fighters.forEach((fighter) => { fighter.stocks = 2; });
world.match!.scores['fighter-a'] = 3;
world.match!.scores['fighter-b'] = 1;
result = makeStep(stockTime)(world, inputs(0));
assert(result.state.winnerId === 'fighter-a', 'Stock+Time equal-stock timeout must use score as secondary tiebreak');

// Match-director fields participate in binary rollback identity.
const baseline = makeWorld(0x4b_18_0007, timeRules);
const changed = structuredClone(baseline);
changed.match!.scores['fighter-a'] = 2;
changed.match!.framesRemaining = 3;
assert(Buffer.compare(Buffer.from(serializeWorldState(baseline)), Buffer.from(serializeWorldState(changed))) !== 0, 'timer/score match state must alter binary rollback snapshot');

console.log('K18 MATCH RULES PASS — Stock/Time/Stock+Time lifecycle, KO/SD scoring, timer resolution, sudden death and rollback-serialized match state certified.');
