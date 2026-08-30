import { fixed } from '../../deterministic-math/src/fixed.js';
import type { CompiledStageDefinition } from '../../content/src/compileStage.js';
import type { RosterRuntime } from '../../content/src/compileRosterRuntime.js';
import { createFighterState } from '../../sim/src/world.js';
import { createMatchExecution } from '../../shell/src/matchExecution.js';
import type { ConstructedMatch } from '../../shell/src/matchFactory.js';
import type { SimInputFrame } from '../../sim/src/types.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`K19 execution certification failure: ${message}`);
}
function neutral(frame: number): SimInputFrame {
  return { frame, moveX: 0, moveY: 0, jumpPressed: false, jumpHeld: false, attackPressed: false, specialPressed: false, grabPressed: false, smashX: 0, smashY: 0, dodgePressed: false, shieldHeld: false };
}

const runtime: RosterRuntime = {
  fighterDefinitionIds: ['alpha', 'beta'], fighterPhysics: new Map(), attacks: new Map(), grabActions: new Map(), moveRuntime: new Map(), aerialLanding: new Map(),
  entityDefinitions: new Map(), entitySpawnsByMoveId: new Map(),
};
const stage: CompiledStageDefinition = {
  id: 'execution-stage', displayName: 'Execution Stage',
  surfaces: [{ id: 'ground', kind: 'solid', y: fixed.zero, xMin: fixed.fromInt(-10), xMax: fixed.fromInt(10) }],
  ledges: [],
  spawns: [
    { id: 'p1', x: fixed.fromInt(-2), y: fixed.zero, facing: 1 },
    { id: 'p2', x: fixed.fromInt(2), y: fixed.zero, facing: -1 },
  ],
  stockRules: {
    blastLeft: fixed.fromInt(-20), blastRight: fixed.fromInt(20), blastBottom: fixed.fromInt(-12), blastTop: fixed.fromInt(16),
    respawnXSpacing: fixed.fromInt(2), respawnY: fixed.fromInt(8), respawnFrames: 30, respawnInvulnerableFrames: 60,
  },
  camera: { left: fixed.fromInt(-15), right: fixed.fromInt(15), bottom: fixed.fromInt(-5), top: fixed.fromInt(12), padding: fixed.fromInt(2), minZoom: fixed.fromInt(1), maxZoom: fixed.fromInt(2) },
  movingPlatforms: [], hazards: [],
};
const a = createFighterState('player-1', fixed.fromInt(-2), 1, 'alpha');
const b = createFighterState('player-2', fixed.fromInt(2), -1, 'beta');
const constructed: ConstructedMatch = {
  world: { frame: 0, seed: 0x4b_19_0001, fighters: [a, b], entities: [], nextEntitySerial: 1, surfaces: stage.surfaces, ledges: stage.ledges, winnerId: null },
  runtime, stage,
  participantControl: { 'player-1': 'human', 'player-2': 'cpu' },
  controllerByParticipant: { 'player-1': 'pad-a', 'player-2': null },
  paletteByParticipant: { 'player-1': '00', 'player-2': '01' },
  teamByParticipant: { 'player-1': 'red', 'player-2': 'blue' },
  rulesetId: 'time-one-frame', mode: 'local-versus',
};

const execution = createMatchExecution(constructed, { matchRules: { mode: 'time', timeLimitFrames: 1 }, friendlyFire: false });
assert(execution.initialState.match?.mode === 'time' && execution.initialState.match.framesRemaining === 1, 'composition root must initialize selected match director mode/timer');
assert(Object.keys(execution.initialState.match?.scores ?? {}).sort().join(',') === 'player-1,player-2', 'composition root must initialize every participant score slot');
assert(execution.stockRules.finiteStocks === false, 'pure Time execution must configure infinite-respawn lifecycle');
assert(execution.teamRules.enabled && execution.teamRules.friendlyFire === false, 'static team interaction policy must be composed from shell selection');

const result = execution.step(execution.initialState, {
  frame: 0,
  byFighterId: { 'player-1': neutral(0), 'player-2': neutral(0) },
});
assert(result.state.frame === 1, 'composed production step must advance the ordinary authoritative simulation');
assert(result.state.match?.framesRemaining === 0 && result.state.match.ended && result.state.match.suddenDeath, 'composed step must also commit authoritative match-director resolution');
assert(result.state.winnerId === null, 'tied one-frame Time match must not invent an individual winner');

console.log('K19 EXECUTION PASS — content/stage/team/attribution/match-rule systems compose into one canonical production step with no fighter-specific wiring.');
