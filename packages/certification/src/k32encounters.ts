import { compileEncounterLaunch, EncounterSequence, type EncounterDefinition } from '../../shell/src/encounter.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`K32 encounter certification failure: ${message}`);
}

const opener: EncounterDefinition = {
  id: 'adventure-01', kind: 'adventure', title: 'Opening Bout', stageId: 'greybox', rulesetId: 'adventure-stock', seed: 77,
  participants: [
    { slotId: 'p1', fighterDefinitionId: 'greybox', sideId: 'heroes', control: 'human', controllerId: null },
    { slotId: 'cpu1', fighterDefinitionId: 'cert-bruiser', sideId: 'foes', control: 'cpu', cpuLevel: 4, startingPercentTenths: 250 },
  ],
  tags: ['tutorial', 'route-a'], nextEncounterIds: ['adventure-02a', 'adventure-02b'],
};
const routeA: EncounterDefinition = {
  id: 'adventure-02a', kind: 'adventure', title: 'Upper Route', stageId: 'greybox', rulesetId: 'adventure-stock',
  participants: [
    { slotId: 'p1', fighterDefinitionId: 'greybox', sideId: 'heroes', control: 'human', controllerId: null },
    { slotId: 'cpu1', fighterDefinitionId: 'cert-bruiser', sideId: 'foes', control: 'cpu', cpuLevel: 6 },
  ],
};
const routeB: EncounterDefinition = { ...routeA, id: 'adventure-02b', title: 'Lower Route' };
const challenge: EncounterDefinition = {
  id: 'challenge-heavy', kind: 'challenge', title: 'Heavy Hitter', stageId: 'greybox', rulesetId: 'challenge-stock',
  participants: [
    { slotId: 'p1', fighterDefinitionId: 'greybox', sideId: 'player', control: 'human', controllerId: 'pad-1' },
    { slotId: 'cpu1', fighterDefinitionId: 'cert-bruiser', sideId: 'enemy', control: 'cpu', cpuLevel: 9, startingPercentTenths: 800 },
  ],
};

const launch = compileEncounterLaunch(challenge);
assert(launch.encounterId === 'challenge-heavy' && launch.participants[1]?.startingPercentTenths === 800, 'challenge content must compile to ordinary match launch data while preserving authored modifiers');
const sequence = new EncounterSequence([opener, routeA, routeB], 'adventure-01');
assert(sequence.launch().seed === 77 && sequence.choices().length === 2, 'adventure node must expose deterministic launch and authored route choices');
sequence.advance('adventure-02b');
assert(sequence.current.id === 'adventure-02b', 'adventure sequence must advance only through authored successor ids');
let rejected = false;
try { sequence.advance('adventure-02a'); } catch { rejected = true; }
assert(rejected, 'sequence must reject transitions not authored from the current node');

console.log('K32 ENCOUNTER PASS — Challenge/Event/Adventure content compiles into ordinary match launch data, supports authored CPU/percent modifiers and deterministic branching without mode-specific combat code.');
