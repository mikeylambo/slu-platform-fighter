import { RollbackSession } from '../../sim/src/rollback.js';
import { createTwoFighterMatch, stepMatchWorld } from '../../sim/src/match.js';
import type { AttackDefinition } from '../../sim/src/combat.js';
import type { SimInputFrame } from '../../sim/src/types.js';
import { OnlineRollbackPeer } from '../../netcode/src/peer.js';
import type { NetPacket, NetStateHashPacket } from '../../netcode/src/protocol.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`K21 netcode certification failure: ${message}`);
}
function input(frame: number, moveX = 0): SimInputFrame {
  return { frame, moveX, moveY: 0, jumpPressed: false, jumpHeld: false, attackPressed: false, specialPressed: false, grabPressed: false, smashX: 0, smashY: 0, dodgePressed: false, shieldHeld: false };
}

const attacks = new Map<string, AttackDefinition>();
const step = (state: ReturnType<typeof createTwoFighterMatch>, frameInput: { frame: number; byFighterId: Readonly<Record<string, SimInputFrame>> }) =>
  stepMatchWorld(state, frameInput, attacks, '__none__');
const participants = ['fighter-a', 'fighter-b'] as const;
const initialA = createTwoFighterMatch(0x4b_21_0001);
const initialB = structuredClone(initialA);
const rbA = new RollbackSession(initialA, step, { participants, historyFrames: 120 });
const rbB = new RollbackSession(initialB, step, { participants, historyFrames: 120 });
const common = { gameVersion: 'k21', sessionId: 'session-k21', participantIds: participants, inputDelayFrames: 2, contentHash: 'content-k21', hashIntervalFrames: 2, hashHistoryFrames: 60 } as const;
const peerA = new OnlineRollbackPeer(rbA, { ...common, peerId: 'peer-a', localParticipantIds: ['fighter-a'] });
const peerB = new OnlineRollbackPeer(rbB, { ...common, peerId: 'peer-b', localParticipantIds: ['fighter-b'] });
peerA.acceptHello(peerB.hello);
peerB.acceptHello(peerA.hello);

let heldForB: NetPacket[] = [];
let sawRollback = false;
let falseDesyncs = 0;
for (let captureFrame = 0; captureFrame < 10; captureFrame += 1) {
  peerA.submitLocalInput('fighter-a', input(peerA.currentFrame, captureFrame >= 2 ? 1000 : 0));
  peerB.submitLocalInput('fighter-b', input(peerB.currentFrame, captureFrame >= 4 ? -1000 : 0));

  const outgoingA = peerA.drainOutbound();
  const outgoingB = peerB.drainOutbound();
  // Delay B's gameplay input packets for several frames to force prediction/rollback on A.
  for (const packet of outgoingA) peerB.receive(packet);
  for (const packet of outgoingB) {
    if (packet.type === 'input' && captureFrame >= 3 && captureFrame <= 5) heldForB.push(packet);
    else peerA.receive(packet);
  }

  const advanceA = peerA.advance();
  const advanceB = peerB.advance();
  sawRollback ||= advanceA.rolledBackFromFrame !== null || advanceB.rolledBackFromFrame !== null;
  falseDesyncs += advanceA.desyncs.length + advanceB.desyncs.length;
  for (const packet of advanceA.outbound) peerB.receive(packet);
  for (const packet of advanceB.outbound) peerA.receive(packet);

  if (captureFrame === 6) {
    for (const packet of heldForB) peerA.receive(packet);
    heldForB = [];
  }
}

// Advance enough frames for all delayed exact inputs to reconcile and confirmed hashes to exchange.
for (let i = 0; i < 4; i += 1) {
  peerA.submitLocalInput('fighter-a', input(peerA.currentFrame));
  peerB.submitLocalInput('fighter-b', input(peerB.currentFrame));
  for (const packet of peerA.drainOutbound()) peerB.receive(packet);
  for (const packet of peerB.drainOutbound()) peerA.receive(packet);
  const a = peerA.advance();
  const b = peerB.advance();
  sawRollback ||= a.rolledBackFromFrame !== null || b.rolledBackFromFrame !== null;
  falseDesyncs += a.desyncs.length + b.desyncs.length;
  for (const packet of a.outbound) peerB.receive(packet);
  for (const packet of b.outbound) peerA.receive(packet);
}
assert(sawRollback, 'delayed exact input must force rollback correction');
assert(falseDesyncs === 0, `ordinary prediction/reconciliation must not emit desyncs (got ${falseDesyncs})`);

// Compatibility gates must reject content/version mismatch before gameplay packets are accepted.
let rejected = false;
try {
  peerA.acceptHello({ ...peerB.hello, contentHash: 'different-content' });
} catch { rejected = true; }
assert(rejected, 'content hash mismatch must reject peer handshake');

// A deliberately corrupted hash for a confirmed historical state must be detected.
const confirmedFrame = peerA.currentFrame - 2;
const corrupt: NetStateHashPacket = {
  type: 'state-hash', protocolVersion: 1, sessionId: 'session-k21', peerId: 'peer-b', frame: confirmedFrame, hash: '0000000000000000',
};
peerA.receive(corrupt);
const desync = peerA.drainDesyncs();
assert(desync.length === 1 && desync[0]?.frame === confirmedFrame, 'corrupted confirmed hash must emit exactly one desync record');

console.log('K21 NETCODE PASS — handshake/content identity, input delay, delayed transport rollback, confirmed-frame hashes and real desync detection are transport-neutral and deterministic.');
