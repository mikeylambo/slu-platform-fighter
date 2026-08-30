import { RollbackSession, type RollbackAdvance } from '../../sim/src/rollback.js';
import { hashWorldState } from '../../sim/src/stateHash.js';
import type { SimInputFrame } from '../../sim/src/types.js';
import {
  NETCODE_PROTOCOL_VERSION,
  compareHandshake,
  createHelloPacket,
  validateNetPacket,
  type HandshakeIdentity,
  type NetHelloPacket,
  type NetInputPacket,
  type NetPacket,
  type NetStateHashPacket,
} from './protocol.js';

export interface OnlinePeerConfig extends HandshakeIdentity {
  /** Exchange a deterministic state hash every N confirmed frames. */
  hashIntervalFrames?: number;
  /** Number of recent frame hashes retained for delayed comparison. */
  hashHistoryFrames?: number;
}

export interface DesyncRecord {
  frame: number;
  localHash: string;
  remoteHash: string;
  remotePeerId: string;
}

export interface PeerAdvance<TEvent> extends RollbackAdvance<TEvent> {
  outbound: NetPacket[];
  desyncs: DesyncRecord[];
}

function shifted(input: SimInputFrame, frame: number): SimInputFrame { return { ...input, frame }; }
function neutral(frame: number): SimInputFrame {
  return { frame, moveX: 0, moveY: 0, jumpPressed: false, jumpHeld: false, attackPressed: false, specialPressed: false, grabPressed: false, smashX: 0, smashY: 0, dodgePressed: false, shieldHeld: false };
}

/**
 * Transport-neutral peer around RollbackSession. Callers move outbound packets
 * over WebRTC/WebSocket/LAN/etc. and feed received packets back through receive().
 */
export class OnlineRollbackPeer<TEvent = unknown> {
  private readonly rollback: RollbackSession<TEvent>;
  private readonly config: Required<Pick<OnlinePeerConfig, 'hashIntervalFrames' | 'hashHistoryFrames'>> & OnlinePeerConfig;
  private readonly helloPacket: NetHelloPacket;
  private sequence = 0;
  private readonly outboundQueue: NetPacket[] = [];
  private readonly localHashes = new Map<number, string>();
  private readonly pendingRemoteHashes = new Map<number, NetStateHashPacket[]>();
  private readonly desyncQueue: DesyncRecord[] = [];
  /** Exact packet sequences already consumed, per remote peer. Arrival order is irrelevant. */
  private readonly seenSequences = new Map<string, Set<number>>();
  private readonly exactInputFrames = new Map<string, Set<number>>();
  private readonly confirmedStateHashes = new Set<number>();
  private connectedPeers = new Set<string>();

  constructor(rollback: RollbackSession<TEvent>, config: OnlinePeerConfig) {
    const hashIntervalFrames = config.hashIntervalFrames ?? 30;
    const hashHistoryFrames = config.hashHistoryFrames ?? 240;
    if (!Number.isInteger(hashIntervalFrames) || hashIntervalFrames < 1) throw new Error('hashIntervalFrames must be positive integer');
    if (!Number.isInteger(hashHistoryFrames) || hashHistoryFrames < hashIntervalFrames) throw new Error('hashHistoryFrames must be integer >= hashIntervalFrames');
    this.rollback = rollback;
    this.config = { ...config, hashIntervalFrames, hashHistoryFrames };
    this.helloPacket = createHelloPacket(config);
    for (const participantId of config.participantIds) this.exactInputFrames.set(participantId, new Set<number>());
    // Input-delay padding before the first captured frame is deterministic neutral input.
    for (const participantId of config.participantIds) {
      for (let frame = 0; frame < config.inputDelayFrames; frame += 1) {
        this.rollback.submitInput(participantId, neutral(frame));
        this.exactInputFrames.get(participantId)!.add(frame);
      }
    }
  }

  get hello(): NetHelloPacket { return structuredClone(this.helloPacket); }
  get currentFrame(): number { return this.rollback.currentFrame; }

  /** Validate a remote hello before accepting gameplay packets from that peer. */
  acceptHello(remote: NetHelloPacket): void {
    validateNetPacket(remote);
    const compatibility = compareHandshake(this.helloPacket, remote);
    if (!compatibility.compatible) throw new Error(`incompatible rollback peer: ${compatibility.reasons.join('; ')}`);
    this.connectedPeers.add(remote.peerId);
  }

  /**
   * Captures local physical input and schedules it inputDelayFrames ahead. The
   * delayed exact input is submitted locally immediately and emitted for transport.
   */
  submitLocalInput(participantId: string, captured: SimInputFrame): NetInputPacket {
    if (!this.config.localParticipantIds.includes(participantId)) throw new Error(`${participantId} is not owned by local peer ${this.config.peerId}`);
    if (captured.frame !== this.rollback.currentFrame) throw new Error(`local capture frame ${captured.frame} must equal current rollback frame ${this.rollback.currentFrame}`);
    const input = shifted(captured, captured.frame + this.config.inputDelayFrames);
    this.rollback.submitInput(participantId, input);
    this.exactInputFrames.get(participantId)?.add(input.frame);
    const packet: NetInputPacket = {
      type: 'input', protocolVersion: NETCODE_PROTOCOL_VERSION, sessionId: this.config.sessionId, peerId: this.config.peerId,
      sequence: this.sequence++, participantId, input,
    };
    this.outboundQueue.push(packet);
    return structuredClone(packet);
  }

  receive(packet: NetPacket): void {
    validateNetPacket(packet);
    if (packet.sessionId !== this.config.sessionId) throw new Error(`packet session ${packet.sessionId} does not match ${this.config.sessionId}`);
    if (packet.peerId === this.config.peerId) return;
    if (packet.type === 'hello') { this.acceptHello(packet); return; }
    if (!this.connectedPeers.has(packet.peerId)) throw new Error(`packet from unaccepted peer ${packet.peerId}`);

    if (packet.type === 'input') {
      if (!this.config.participantIds.includes(packet.participantId)) throw new Error(`remote input references unknown participant ${packet.participantId}`);
      if (this.config.localParticipantIds.includes(packet.participantId)) throw new Error(`remote peer attempted to submit locally owned participant ${packet.participantId}`);
      let seen = this.seenSequences.get(packet.peerId);
      if (!seen) { seen = new Set<number>(); this.seenSequences.set(packet.peerId, seen); }
      if (seen.has(packet.sequence)) return;
      seen.add(packet.sequence);
      this.rollback.submitInput(packet.participantId, packet.input);
      this.exactInputFrames.get(packet.participantId)?.add(packet.input.frame);
      return;
    }

    if (packet.type === 'state-hash') {
      const local = this.localHashes.get(packet.frame);
      if (local !== undefined) this.compareHash(packet, local);
      else {
        const queued = this.pendingRemoteHashes.get(packet.frame) ?? [];
        queued.push(structuredClone(packet));
        this.pendingRemoteHashes.set(packet.frame, queued);
      }
      return;
    }

    if (packet.type === 'disconnect') this.connectedPeers.delete(packet.peerId);
  }

  private isStateFrameConfirmed(stateFrame: number): boolean {
    if (stateFrame <= 0) return true;
    const simulatedInputFrame = stateFrame - 1;
    for (const participantId of this.config.participantIds) {
      if (!this.exactInputFrames.get(participantId)?.has(simulatedInputFrame)) return false;
    }
    return true;
  }

  advance(): PeerAdvance<TEvent> {
    const advanced = this.rollback.advance();
    const frame = advanced.state.frame;
    if (this.isStateFrameConfirmed(frame)) {
      const hash = hashWorldState(advanced.state);
      this.localHashes.set(frame, hash);
      this.confirmedStateHashes.add(frame);
      const pending = this.pendingRemoteHashes.get(frame) ?? [];
      for (const packet of pending) this.compareHash(packet, hash);
      this.pendingRemoteHashes.delete(frame);
      if (frame % this.config.hashIntervalFrames === 0) {
        this.outboundQueue.push({
          type: 'state-hash', protocolVersion: NETCODE_PROTOCOL_VERSION, sessionId: this.config.sessionId,
          peerId: this.config.peerId, frame, hash,
        });
      }
    }
    this.pruneHashes(frame);
    const outbound = this.drainOutbound();
    const desyncs = this.drainDesyncs();
    return { ...advanced, outbound, desyncs };
  }

  drainOutbound(): NetPacket[] {
    return this.outboundQueue.splice(0).map((packet) => structuredClone(packet));
  }

  drainDesyncs(): DesyncRecord[] { return this.desyncQueue.splice(0); }

  private compareHash(packet: NetStateHashPacket, localHash: string): void {
    if (!this.confirmedStateHashes.has(packet.frame)) return;
    if (packet.hash === localHash) return;
    this.desyncQueue.push({ frame: packet.frame, localHash, remoteHash: packet.hash, remotePeerId: packet.peerId });
  }

  private pruneHashes(currentFrame: number): void {
    const oldest = Math.max(0, currentFrame - this.config.hashHistoryFrames);
    for (const frame of this.localHashes.keys()) if (frame < oldest) this.localHashes.delete(frame);
    for (const frame of this.pendingRemoteHashes.keys()) if (frame < oldest) this.pendingRemoteHashes.delete(frame);
    for (const frame of this.confirmedStateHashes) if (frame < oldest) this.confirmedStateHashes.delete(frame);
    for (const frames of this.exactInputFrames.values()) for (const frame of frames) if (frame < oldest) frames.delete(frame);
    // Bound packet-sequence memory while retaining enough history to suppress realistic retransmits.
    const sequenceWindow = Math.max(64, this.config.hashHistoryFrames * 2);
    for (const sequences of this.seenSequences.values()) {
      if (sequences.size <= sequenceWindow) continue;
      const sorted = [...sequences].sort((a, b) => a - b);
      for (const sequence of sorted.slice(0, sorted.length - sequenceWindow)) sequences.delete(sequence);
    }
  }
}
