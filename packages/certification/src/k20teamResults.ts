import { createMatchRuntimeState, applyMatchRules, type MatchRules } from '../../sim/src/matchRules.js';
import { serializeWorldState } from '../../sim/src/serialize.js';
import type { TeamRules } from '../../sim/src/teamPolicy.js';
import { createFighterState } from '../../sim/src/world.js';
import type { MatchStepResult } from '../../sim/src/match.js';
import type { WorldState } from '../../sim/src/types.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`K20 team-results certification failure: ${message}`);
}

const ids = ['p1', 'p2', 'p3', 'p4'] as const;
const teamRules: TeamRules = {
  enabled: true,
  friendlyFire: false,
  teamByParticipant: { p1: 'red', p2: 'red', p3: 'blue', p4: 'blue' },
};

function worldFor(rules: MatchRules): WorldState {
  return {
    frame: 0,
    seed: 0x4b_20_0001,
    fighters: ids.map((id) => createFighterState(id)),
    entities: [], nextEntitySerial: 1, surfaces: [], ledges: [],
    match: createMatchRuntimeState(ids, rules),
    winnerId: null,
  };
}
function resultFrom(state: WorldState): MatchStepResult {
  return { state: { ...structuredClone(state), frame: state.frame + 1 }, events: [] };
}

// A stock team can win while multiple teammates still survive; no individual winner is fabricated.
const stockRules: MatchRules = { mode: 'stock' };
let previous = worldFor(stockRules);
let stepped = resultFrom(previous);
for (const id of ['p3', 'p4']) {
  const fighter = stepped.state.fighters.find((entry) => entry.id === id)!;
  fighter.stocks = 0;
  fighter.eliminated = true;
}
let directed = applyMatchRules(previous, stepped, stockRules, teamRules);
assert(directed.state.match?.winningTeamId === 'red' && directed.state.match.ended, 'sole surviving team must resolve stock team victory even with two surviving teammates');
assert(directed.state.winnerId === null, 'team victory must not overload participant winnerId');

// Timed team results aggregate participant scores by static team assignment.
const timeRules: MatchRules = { mode: 'time', timeLimitFrames: 1 };
previous = worldFor(timeRules);
previous.match!.scores = { p1: 2, p2: 1, p3: 2, p4: 0 };
stepped = resultFrom(previous);
directed = applyMatchRules(previous, stepped, timeRules, teamRules);
assert(directed.state.match?.winningTeamId === 'red' && directed.state.match.suddenDeath === false, 'Time team result must use aggregate team score');

// Stock+Time compares aggregate remaining stocks before aggregate score.
const stockTimeRules: MatchRules = { mode: 'stock-time', timeLimitFrames: 1 };
previous = worldFor(stockTimeRules);
previous.fighters.find((fighter) => fighter.id === 'p1')!.stocks = 2;
previous.fighters.find((fighter) => fighter.id === 'p2')!.stocks = 2;
previous.fighters.find((fighter) => fighter.id === 'p3')!.stocks = 2;
previous.fighters.find((fighter) => fighter.id === 'p4')!.stocks = 1;
previous.match!.scores = { p1: 0, p2: 0, p3: 10, p4: 10 };
stepped = resultFrom(previous);
directed = applyMatchRules(previous, stepped, stockTimeRules, teamRules);
assert(directed.state.match?.winningTeamId === 'red', 'Stock+Time team timeout must prioritize aggregate remaining stocks over aggregate score');

// Exact team ties request sudden death and keep winningTeamId null.
previous = worldFor(timeRules);
previous.match!.scores = { p1: 1, p2: 0, p3: 1, p4: 0 };
stepped = resultFrom(previous);
directed = applyMatchRules(previous, stepped, timeRules, teamRules);
assert(directed.state.match?.winningTeamId === null && directed.state.match.suddenDeath, 'tied team regulation must request sudden death without inventing a team winner');

const withoutWinner = structuredClone(directed.state);
const withWinner = structuredClone(directed.state);
withWinner.match!.winningTeamId = 'red';
assert(Buffer.compare(Buffer.from(serializeWorldState(withoutWinner)), Buffer.from(serializeWorldState(withWinner))) !== 0, 'winning team must participate in binary rollback identity');

console.log('K20 TEAM RESULTS PASS — stock survivor teams, timed aggregate scoring, Stock+Time team tiebreaks, sudden death and serialized winningTeamId certified.');
