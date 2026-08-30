import { createTwoFighterMatch, stepMatchWorld } from '../../sim/src/match.js';
import { ReplayPlayer, replayWorldHash, type ReplayFrame } from '../../sim/src/replay.js';
import type { AttackDefinition } from '../../sim/src/combat.js';
import type { SimInputFrame } from '../../sim/src/types.js';
import { SpectatorFeedPublisher, SpectatorFeedReceiver } from '../../netcode/src/spectator.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`K30 spectator certification failure: ${message}`);
}
function input(frame: number, moveX: number): SimInputFrame {
  return { frame, moveX, moveY: 0, jumpPressed: false, jumpHeld: false, attackPressed: false, specialPressed: false, grabPressed: false, smashX: 0, smashY: 0, dodgePressed: false, shieldHeld: false };
}

const attacks = new Map<string, AttackDefinition>();
const step = (state: ReturnType<typeof createTwoFighterMatch>, frame: ReplayFrame) => stepMatchWorld(state, frame, attacks, '__none__');
let world = createTwoFighterMatch(0x4b_30_0001);
const publisher = new SpectatorFeedPublisher(world, {
  gameVersion: 'k30', participantIds: ['fighter-a', 'fighter-b'], fighterDefinitionIds: { 'fighter-a': 'greybox', 'fighter-b': 'greybox' }, stageId: 'greybox', rulesetId: 'stock',
}, 'content-k30', 5);
const receiver = new SpectatorFeedReceiver();
receiver.receive(publisher.start(world), 'content-k30');

for (let frame = 0; frame < 15; frame += 1) {
  const replayFrame: ReplayFrame = { frame, byFighterId: { 'fighter-a': input(frame, frame < 8 ? 1000 : 0), 'fighter-b': input(frame, frame >= 4 ? -1000 : 0) } };
  const result = step(world, replayFrame);
  world = result.state;
  const checkpointPacket = publisher.append(replayFrame, world);
  if (frame % 3 === 2) {
    const packet = publisher.flush(3);
    if (packet) receiver.receive(packet);
  }
  if (checkpointPacket) receiver.receive(checkpointPacket);
}
const tail = publisher.flush();
if (tail) receiver.receive(tail);
const tape = receiver.toReplayTape();
assert(tape.frames.length === 15, 'spectator input batches must reconstruct every confirmed frame');
assert(tape.checkpoints.some((entry) => entry.frame === 5) && tape.checkpoints.some((entry) => entry.frame === 10), 'spectator feed must retain deterministic periodic checkpoints');
const replayed = new ReplayPlayer(tape, step).playToEnd();
assert(replayWorldHash(replayed) === replayWorldHash(world), 'spectator replay reconstruction must converge exactly to publisher final world');

let rejected = false;
try {
  const badReceiver = new SpectatorFeedReceiver();
  badReceiver.receive(publisher.start(world), 'different-content');
} catch { rejected = true; }
assert(rejected, 'spectator must reject incompatible content identity before playback');

console.log('K30 SPECTATOR PASS — checkpoint + confirmed-input feed reconstructs the ordinary replay format and deterministically reproduces the live match without spectator-specific gameplay simulation.');
