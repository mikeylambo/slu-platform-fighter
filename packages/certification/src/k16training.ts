import { fixed } from '../../deterministic-math/src/fixed.js';
import { createTwoFighterMatch, stepMatchWorld } from '../../sim/src/match.js';
import type { MatchInputFrame } from '../../sim/src/match.js';
import type { SimInputFrame, WorldState } from '../../sim/src/types.js';
import { TrainingSession } from '../../training/src/session.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`K16 training certification failure: ${message}`);
}
function neutral(frame: number, patch: Partial<Omit<SimInputFrame, 'frame'>> = {}): SimInputFrame {
  return { frame, moveX: 0, moveY: 0, jumpPressed: false, jumpHeld: false, attackPressed: false, specialPressed: false, grabPressed: false, smashX: 0, smashY: 0, dodgePressed: false, shieldHeld: false, ...patch };
}
const step = (state: WorldState, input: MatchInputFrame) => stepMatchWorld(state, input, new Map(), 'unused');
const initial = createTwoFighterMatch(0x4b_16_0001);
const training = new TrainingSession(initial, ['fighter-a', 'fighter-b'], step);
assert(training.isPaused, 'training session must start paused for deterministic frame inspection');
assert(training.tick() === null && training.snapshot.frame === 0, 'paused tick must not advance simulation');

training.setPercent('fighter-b', 875);
training.setStocks('fighter-b', 2);
assert(training.snapshot.fighters.find((fighter) => fighter.id === 'fighter-b')?.percentTenths === 875, 'training must allow direct percent setup');
assert(training.snapshot.fighters.find((fighter) => fighter.id === 'fighter-b')?.stocks === 2, 'training must allow direct stock setup');
training.resetFighter('fighter-b');
assert(training.snapshot.fighters.find((fighter) => fighter.id === 'fighter-b')?.percentTenths === 0, 'fighter reset must clear combat damage state');

training.savePosition('neutral');
training.setPaused(false);
training.tick({ 'fighter-a': neutral(0, { moveX: 1000 }) });
training.runFrames(8, (frame) => ({ 'fighter-a': neutral(frame, { moveX: 1000 }) }));
const movedX = training.snapshot.fighters.find((fighter) => fighter.id === 'fighter-a')?.x ?? fixed.zero;
assert(movedX !== initial.fighters[0]?.x, 'running training frames must use ordinary deterministic movement');
training.loadPosition('neutral');
assert(training.snapshot.fighters.find((fighter) => fighter.id === 'fighter-a')?.x === initial.fighters[0]?.x, 'saved position load must restore authored fighter placement');

training.setDummyProfile('fighter-b', 'shield');
training.stepFrame({ 'fighter-a': neutral(training.snapshot.frame) });
assert(training.snapshot.fighters.find((fighter) => fighter.id === 'fighter-b')?.shielding === true, 'dummy shield profile must feed ordinary shield input through simulation');
training.setDummyProfile('fighter-b', 'di-left');
training.stepFrame({ 'fighter-a': neutral(training.snapshot.frame) });
const dummyInput = training.snapshot.fighters.find((fighter) => fighter.id === 'fighter-b')?.inputHistory.at(-1);
assert(dummyInput?.moveX === -1000, 'DI dummy profile must be visible in canonical fighter input history');

training.startRecording();
const recordingStart = training.snapshot.frame;
training.runFrames(5, (frame) => ({ 'fighter-a': neutral(frame, { moveX: frame % 2 === 0 ? 700 : -700 }) }));
const recording = training.stopRecording();
assert(recording.startFrame === recordingStart && recording.frames.length === 5, 'training recording must capture canonical per-frame input bundles');
assert(recording.frames.every((entry, index) => entry.frame === recordingStart + index), 'training recording frame sequence must be contiguous and deterministic');

training.resetAll();
assert(training.snapshot.fighters.every((fighter) => fighter.percentTenths === 0 && fighter.stocks === 3 && !fighter.eliminated), 'reset-all must restore reusable combat state for every participant');

console.log('K16 TRAINING PASS — pause/frame-step, dummy profiles, percent/stocks, position save-load, reset and deterministic input recording certified.');
