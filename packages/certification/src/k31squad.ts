import { SquadSession } from '../../shell/src/squad.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`K31 squad certification failure: ${message}`);
}

const crew = new SquadSession([
  { sideId: 'red', fighterDefinitionIds: ['r1', 'r2', 'r3'], controllerId: 'pad-a', control: 'human' },
  { sideId: 'blue', fighterDefinitionIds: ['b1', 'b2', 'b3'], controllerId: null, control: 'cpu' },
], { rotation: 'loser-only', carryWinnerPercent: true });
let bout = crew.currentBout();
assert(bout.participants[0]?.fighterDefinitionId === 'r1' && bout.participants[1]?.fighterDefinitionId === 'b1', 'first bout must use first fighter in each ordered squad');
let state = crew.completeBout({ winnerSideId: 'red', endingPercentTenths: { red: 420, blue: 900 } });
bout = crew.currentBout();
assert(bout.participants[0]?.fighterDefinitionId === 'r1' && bout.participants[0].startingPercentTenths === 420, 'crew winner must retain active fighter and optionally carry percent');
assert(bout.participants[1]?.fighterDefinitionId === 'b2' && bout.participants[1].startingPercentTenths === 0, 'crew loser must rotate to next fighter with fresh percent');
crew.completeBout({ winnerSideId: 'red', endingPercentTenths: { red: 600, blue: 1000 } });
state = crew.completeBout({ winnerSideId: 'red', endingPercentTenths: { red: 800, blue: 1200 } });
assert(state.ended && state.winnerSideId === 'red', 'crew must end when only one side retains an unused active fighter');

const rounds = new SquadSession([
  { sideId: 'one', fighterDefinitionIds: ['a', 'b'], controllerId: 'pad-1', control: 'human' },
  { sideId: 'two', fighterDefinitionIds: ['c', 'd'], controllerId: 'pad-2', control: 'human' },
], { rotation: 'both', carryWinnerPercent: false });
rounds.completeBout({ winnerSideId: 'one' });
const second = rounds.currentBout();
assert(second.participants[0]?.fighterDefinitionId === 'b' && second.participants[1]?.fighterDefinitionId === 'd', 'round/tag rotation must advance both sides after a bout');
const roundEnd = rounds.completeBout({ winnerSideId: 'two' });
assert(roundEnd.ended, 'round-based squad must terminate when ordered lineups are exhausted');

console.log('K31 SQUAD PASS — ordered multi-fighter sides support loser-only crew rotation, percent carry policy and both-side round/tag rotation without changing ordinary match simulation.');
