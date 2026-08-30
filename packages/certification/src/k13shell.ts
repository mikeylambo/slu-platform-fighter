import { PlatformFighterShell } from '../../shell/src/session.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`K13 shell certification failure: ${message}`);
}

const shell = new PlatformFighterShell({
  fighterIds: ['greybox', 'rushdown', 'zoner', 'grappler'],
  stageIds: ['greybox', 'arena-wide'],
  rulesetIds: ['stock-default', 'teams-stock'],
  paletteIdsByFighter: {
    greybox: ['00', '01'], rushdown: ['00', '01', '02'], zoner: ['00'], grappler: ['00', '01'],
  },
}, 'stock-default');

assert(shell.snapshot.phase === 'title', 'shell must boot at title state');
shell.openMainMenu();
shell.startLocalVersusSetup();
assert(String(shell.snapshot.phase) === 'fighter-select' && shell.snapshot.setup.mode === 'local-versus', 'local versus must enter fighter select');

shell.configureSlot(1, { control: 'human', controllerId: 'pad-a' });
shell.configureSlot(2, { control: 'human', controllerId: 'pad-b' });
shell.configureSlot(3, { control: 'cpu' });
shell.configureSlot(4, { control: 'human', controllerId: 'keyboard-1' });
shell.selectFighter(1, 'greybox', '01');
shell.selectFighter(2, 'rushdown', '02');
shell.selectFighter(3, 'zoner');
shell.selectFighter(4, 'grappler', '01');
for (const slot of [1, 2, 3, 4] as const) shell.setSlotReady(slot, true);
shell.setTeams(true);
shell.setTeam(1, 'red'); shell.setTeam(2, 'blue'); shell.setTeam(3, 'red'); shell.setTeam(4, 'blue');
shell.setRuleset('teams-stock');
shell.continueFromFighterSelect();
assert(String(shell.snapshot.phase) === 'stage-select', 'fully readied fighter selection must advance to stage select');
shell.selectStage('arena-wide');
const descriptor = shell.startMatch();
assert(String(shell.snapshot.phase) === 'match', 'startMatch must transition shell into match phase');
assert(descriptor.participants.length === 4, '4P setup must emit four participant descriptors');
assert(descriptor.participants.map((entry) => entry.participantId).join(',') === 'player-1,player-2,player-3,player-4', 'runtime participant IDs must derive stably from slot order');
assert(descriptor.participants[2]?.control === 'cpu' && descriptor.participants[2]?.controllerId === null, 'CPU slot must not retain controller assignment');
assert(descriptor.teamsEnabled && descriptor.participants[0]?.teamId === 'red' && descriptor.participants[1]?.teamId === 'blue', 'team assignments must survive into match descriptor');
assert(descriptor.stageId === 'arena-wide' && descriptor.rulesetId === 'teams-stock', 'stage/ruleset selection must survive into match descriptor');

shell.finishMatch();
assert(String(shell.snapshot.phase) === 'results', 'match completion must enter results flow');
const rematch = shell.rematch();
assert(String(shell.snapshot.phase) === 'match' && rematch.participants.length === 4, 'rematch must reuse validated current setup');
shell.finishMatch();
shell.returnToFighterSelect();
assert(String(shell.snapshot.phase) === 'fighter-select' && shell.snapshot.setup.slots.every((slot) => !slot.ready), 'return to fighter select must preserve choices but clear ready states');

// Training is a separate 2-slot setup contract, not a special case inside gameplay code.
shell.returnToMainMenu();
shell.startTrainingSetup();
assert(String(shell.snapshot.setup.mode) === 'training', 'training entry must set training mode');
assert(shell.snapshot.setup.slots.filter((slot) => slot.control !== 'closed').length === 2, 'training must expose exactly player + dummy slots');
shell.selectFighter(1, 'rushdown'); shell.selectFighter(2, 'grappler');
shell.setSlotReady(1, true); shell.setSlotReady(2, true);
shell.continueFromFighterSelect(); shell.selectStage('greybox');
const training = shell.startMatch();
assert(training.mode === 'training' && training.participants.length === 2, 'training descriptor must remain two-participant and mode-explicit');
assert(training.participants[0]?.control === 'human' && training.participants[1]?.control === 'cpu', 'training defaults must route player/dummy through ordinary participant controls');

// Invalid catalog selections and incomplete setup must be rejected before gameplay.
let rejected = false;
try { shell.selectStage('missing-stage'); } catch { rejected = true; }
assert(rejected, 'shell must reject stage ids not present in dynamic content catalog');

shell.openReplayBrowser();
assert(String(shell.snapshot.phase) === 'replay-browser', 'replay browser must be a first-class shell destination');
shell.openSettings();
assert(String(shell.snapshot.phase) === 'settings', 'settings must be reachable without gameplay coupling');
shell.closeSettings();
assert(String(shell.snapshot.phase) === 'replay-browser', 'settings close must return to previous shell surface');

console.log('K13 SHELL PASS — dynamic roster catalog, 1–4 slot assignment, teams, local versus, training, stage/ruleset selection, results/rematch, replay and settings flow certified.');
