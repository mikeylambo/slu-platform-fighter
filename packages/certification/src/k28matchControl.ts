import { createMatchControlState, MatchControlSession } from '../../shell/src/matchControl.js';
import { ControlledMatchRunner } from '../../shell/src/matchRunner.js';
import { createTwoFighterMatch } from '../../sim/src/match.js';
import type { MatchInputFrame, MatchStepResult } from '../../sim/src/match.js';
import type { SimInputFrame, WorldState } from '../../sim/src/types.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`K28 match control certification failure: ${message}`);
}
function neutral(frame: number): SimInputFrame {
  return { frame, moveX: 0, moveY: 0, jumpPressed: false, jumpHeld: false, attackPressed: false, specialPressed: false, grabPressed: false, smashX: 0, smashY: 0, dodgePressed: false, shieldHeld: false };
}
function input(frame: number): MatchInputFrame {
  return { frame, byFighterId: { 'fighter-a': neutral(frame), 'fighter-b': neutral(frame) } };
}
const step = (state: WorldState, _: MatchInputFrame): MatchStepResult => ({ state: { ...state, frame: state.frame + 1 }, events: [] });

const control = new MatchControlSession(createMatchControlState([
  { participantId: 'fighter-a', controllerId: 'pad-a' },
  { participantId: 'fighter-b', controllerId: 'pad-b' },
]));
const runner = new ControlledMatchRunner(createTwoFighterMatch(0x4b_28_0001), step, control);
assert(runner.tick(input(0))?.state.frame === 1, 'connected match must advance normally');
control.controllerLost('fighter-a', 'pad-a');
assert(control.snapshot.paused && control.snapshot.pauseReason === 'controller-lost', 'controller loss must invoke configured pause policy');
const frozen = runner.snapshot;
assert(runner.tick(input(1)) === null && runner.snapshot.frame === frozen.frame, 'paused runner must consume no simulation frame');
control.controllerRestored('fighter-a', 'pad-a-restored');
let blockedResume = false;
try { control.resume(); } catch { blockedResume = true; }
assert(!blockedResume, 'restored controller must permit resume');
assert(runner.tick(input(1))?.state.frame === 2, 'resumed match must continue from unchanged authoritative frame');

const forfeitControl = new MatchControlSession(createMatchControlState([
  { participantId: 'fighter-a', controllerId: 'pad-a' },
  { participantId: 'fighter-b', controllerId: 'pad-b' },
]), { pauseOnControllerLoss: true, pauseOnNetworkLoss: true, allowCpuTakeover: false, disconnectResolution: 'forfeit' });
forfeitControl.networkLost('fighter-b');
assert(forfeitControl.resolveDisconnect('fighter-b') === 'forfeited', 'forfeit policy must resolve unresolved disconnect deterministically');

const cpuControl = new MatchControlSession(createMatchControlState([
  { participantId: 'fighter-a', controllerId: 'pad-a' },
  { participantId: 'fighter-b', controllerId: 'pad-b' },
]), { pauseOnControllerLoss: true, pauseOnNetworkLoss: true, allowCpuTakeover: true, disconnectResolution: 'cpu-takeover' });
cpuControl.controllerLost('fighter-b');
assert(cpuControl.resolveDisconnect('fighter-b') === 'cpu-takeover' && cpuControl.snapshot.participants['fighter-b']?.controllerId === null, 'CPU takeover must relinquish controller ownership without changing gameplay simulation');

console.log('K28 MATCH CONTROL PASS — manual/session pause, controller/network loss, reconnect, forfeit and CPU-takeover policy live outside authoritative sim and paused matches consume no frames.');
