import { fixed } from '../../deterministic-math/src/fixed.js';
import type { CompiledStageDefinition } from '../../content/src/compileStage.js';
import type { RosterRuntime } from '../../content/src/compileRosterRuntime.js';
import { constructMatchFromDescriptor } from '../../shell/src/matchFactory.js';
import type { StartMatchDescriptor } from '../../shell/src/session.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`K14 match factory certification failure: ${message}`);
}

const runtime: RosterRuntime = {
  fighterDefinitionIds: ['grappler', 'greybox', 'rushdown', 'zoner'],
  fighterPhysics: new Map(), attacks: new Map(), grabActions: new Map(), moveRuntime: new Map(), aerialLanding: new Map(),
  entityDefinitions: new Map(), entitySpawnsByMoveId: new Map(),
};
const stage: CompiledStageDefinition = {
  id: 'cert-stage', displayName: 'Cert Stage',
  surfaces: [{ id: 'ground', kind: 'solid', y: fixed.zero, xMin: fixed.fromInt(-12), xMax: fixed.fromInt(12) }],
  ledges: [
    { id: 'left', x: fixed.fromInt(-12), y: fixed.zero, inward: 1 },
    { id: 'right', x: fixed.fromInt(12), y: fixed.zero, inward: -1 },
  ],
  spawns: [
    { id: 'p1', x: fixed.fromInt(-6), y: fixed.zero, facing: 1 },
    { id: 'p2', x: fixed.fromInt(-2), y: fixed.zero, facing: 1 },
    { id: 'p3', x: fixed.fromInt(2), y: fixed.zero, facing: -1 },
    { id: 'p4', x: fixed.fromInt(6), y: fixed.zero, facing: -1 },
  ],
  stockRules: {
    blastLeft: fixed.fromInt(-25), blastRight: fixed.fromInt(25), blastBottom: fixed.fromInt(-15), blastTop: fixed.fromInt(20),
    respawnXSpacing: fixed.fromRatio(3, 2), respawnY: fixed.fromInt(10), respawnFrames: 60, respawnInvulnerableFrames: 120,
  },
  camera: { left: fixed.fromInt(-18), right: fixed.fromInt(18), bottom: fixed.fromInt(-6), top: fixed.fromInt(14), padding: fixed.fromInt(2), minZoom: fixed.fromRatio(3, 5), maxZoom: fixed.fromRatio(9, 5) },
  movingPlatforms: [], hazards: [],
};
const descriptor: StartMatchDescriptor = {
  mode: 'local-versus', stageId: 'cert-stage', rulesetId: 'teams-stock', teamsEnabled: true,
  participants: [
    { participantId: 'player-1', slot: 1, control: 'human', controllerId: 'pad-a', fighterId: 'greybox', paletteId: '01', teamId: 'red' },
    { participantId: 'player-2', slot: 2, control: 'cpu', controllerId: null, fighterId: 'rushdown', paletteId: '02', teamId: 'blue' },
    { participantId: 'player-3', slot: 3, control: 'human', controllerId: 'pad-b', fighterId: 'zoner', paletteId: '00', teamId: 'red' },
    { participantId: 'player-4', slot: 4, control: 'cpu', controllerId: null, fighterId: 'grappler', paletteId: '03', teamId: 'blue' },
  ],
};
const constructed = constructMatchFromDescriptor(descriptor, runtime, stage, 0x4b_14_0001);
assert(constructed.world.fighters.length === 4, 'four selected slots must construct four authoritative fighters');
assert(constructed.world.fighters.map((fighter) => fighter.id).join(',') === 'player-1,player-2,player-3,player-4', 'slot order must define stable participant ordering');
assert(constructed.world.fighters.map((fighter) => fighter.definitionId).join(',') === 'greybox,rushdown,zoner,grappler', 'fighter selection must become authoritative definition identity');
assert(constructed.world.fighters[0]?.x === fixed.fromInt(-6) && constructed.world.fighters[3]?.x === fixed.fromInt(6), 'stage spawn order must place authoritative fighters');
assert(constructed.world.surfaces[0]?.id === 'ground' && constructed.world.ledges.length === 2, 'compiled stage collision must become authoritative world geometry');
assert(constructed.participantControl['player-2'] === 'cpu' && constructed.controllerByParticipant['player-2'] === null, 'CPU assignment must survive construction without fake controller ownership');
assert(constructed.paletteByParticipant['player-4'] === '03', 'palette selection must survive for presentation binding');
assert(constructed.teamByParticipant['player-1'] === 'red' && constructed.teamByParticipant['player-3'] === 'red', 'team ownership must survive shell-to-match construction');
assert(constructed.rulesetId === 'teams-stock' && constructed.mode === 'local-versus', 'mode and ruleset identity must survive construction');

let rejectedUnknown = false;
try {
  constructMatchFromDescriptor({ ...descriptor, participants: descriptor.participants.map((entry, index) => index === 0 ? { ...entry, fighterId: 'missing' } : entry) }, runtime, stage, 1);
} catch { rejectedUnknown = true; }
assert(rejectedUnknown, 'construction must reject fighter ids absent from compiled roster runtime');

console.log('K14 MATCH FACTORY PASS — shell selections deterministically construct 2–4P authoritative stage/fighter state while preserving control, palette and team metadata.');
