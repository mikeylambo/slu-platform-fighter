import assert from 'node:assert/strict';
import { REPLAY_VERSION } from '../content/version.js';
import { writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { RollbackSession } from '../../../../packages/sim/src/rollback.js';
import { OnlineRollbackPeer } from '../../../../packages/netcode/src/peer.js';
import type { NetPacket } from '../../../../packages/netcode/src/protocol.js';
import { hashWorldState } from '../../../../packages/sim/src/stateHash.js';
import { createDuel, stepDuel, duelData } from '../game/duel.js';
import { IDS, neutral } from '../game/session.js';
const initial = createDuel({ cpu: [0, 0], format: 'continuous', lives: 1, timer: 0 });
const peers = IDS.map(
  (id, i) =>
    new OnlineRollbackPeer(new RollbackSession(initial, stepDuel, { participants: IDS, historyFrames: 240 }), {
      sessionId: 'spectris-certification',
      peerId: `peer-${i}`,
      participantIds: IDS,
      localParticipantIds: [id],
      inputDelayFrames: 2,
      gameVersion: REPLAY_VERSION,
      contentHash: hashWorldState(initial),
    }),
);
peers[0]!.acceptHello(peers[1]!.hello);
peers[1]!.acceptHello(peers[0]!.hello);
assert.throws(() => peers[0]!.acceptHello({ ...peers[1]!.hello, contentHash: 'different-rules' }));
let queue: { due: number; target: number; packet: NetPacket }[] = [],
  rollbacks = 0,
  desyncs = 0;
const samples: number[] = [];
let states = [initial, initial];
for (let frame = 0; frame < 480; frame++) {
  for (const delivery of queue.filter((q) => q.due <= frame)) peers[delivery.target]!.receive(delivery.packet);
  queue = queue.filter((q) => q.due > frame);
  for (const [i, peer] of peers.entries()) {
    peer.submitLocalInput(IDS[i]!, { ...neutral(peer.currentFrame), moveX: frame < 300 && i === 0 ? 1000 : 0 });
    const start = performance.now(),
      result = peer.advance();
    samples.push(performance.now() - start);
    states[i] = result.state;
    rollbacks += result.resimulatedFrames;
    desyncs += result.desyncs.length;
    queue.push(...result.outbound.map((packet) => ({ due: frame + 6, target: 1 - i, packet })));
  }
}
for (const item of queue) peers[item.target]!.receive(item.packet);
for (const [i, peer] of peers.entries()) {
  peer.submitLocalInput(IDS[i]!, neutral(peer.currentFrame));
  const result = peer.advance();
  states[i] = result.state;
}
assert.equal(hashWorldState(states[0]!), hashWorldState(states[1]!));
assert.equal(duelData(states[0]!)!.phase, 'over');
assert(rollbacks > 0);
assert.equal(desyncs, 0);
samples.sort((a, b) => a - b);
const result = {
  transport: 'PF OnlineRollbackPeer over a deterministic packet queue; not a live WebRTC browser test',
  latencyMs: 100,
  rollbacks,
  desyncs,
  frames: states[0]!.frame,
  finalHash: hashWorldState(states[0]!),
  winner: duelData(states[0]!)!.winner,
  advanceP95Ms: samples[Math.floor(samples.length * 0.95)],
  browserWebRTC:
    'See proofs/online-two-tab.json: real WebRTC between two tabs (room code, rollback, zero desyncs). Cross-network/NAT validation: ONLINE_TEST.md.',
};
writeFileSync('apps/spectris/proofs/online-protocol.json', JSON.stringify(result, null, 2) + '\n');
console.log('ONLINE PROTOCOL PASS', JSON.stringify(result));
