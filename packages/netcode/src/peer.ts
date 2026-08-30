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
  /** Exchange a deterministic state hash every N ready-to-simulate frames. */
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
  private readonly seenSequences = new Map<string, number>();
  private connectedPeers = new Set<string>();

  constructor(rollback: RollbackSession<TEvent>, config: OnlinePeerConfig) {
    const hashIntervalFrames = config.hashIntervalFrames ?? 30;
    const hashHistoryFrames = config.hashHistoryFrames ?? 240;
    if (!Number.isInteger(hashIntervalFrames) || hashIntervalFrames < 1) throw new Error('hashIntervalFrames must be positive integer');
    if (!Number.isInteger(hashHistoryFrames) || hashHistoryFrames < hashIntervalFrames) throw new Error('hashHistoryFrames must be integer >= hashIntervalFrames');
    this.rollback = rollback;
    this.config = { ...config, hashIntervalFrames, hashHistoryFrames };
    this.helloPacket = createHelloPacket(config);
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
      const last = this.seenSequences.get(packet.peerId) ?? -1;
      if (packet.sequence <= last) return;
      this.seenSequences.set(packet.peerId, packet.sequence);
      this.rollback.submitInput(packet.participantId, packet.input);
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

  advance(): PeerAdvance<TEvent> {
    const advanced = this.rollback.advance();
    const frame = advanced.state.frame;
    const hash = hashWorldState(advanced.state);
    this.localHashes.set(frame, hash);
    const pending = this.pendingRemoteHashes.get(frame) ?? [];
    for (const packet of pending) this.compareHash(packet, hash);
    this.pendingRemoteHashes.delete(frame);

    if (frame % this.config.hashIntervalFrames === 0) {
      this.outboundQueue.push({
        type: 'state-hash', protocolVersion: NETCODE_PROTOCOL_VERSION, sessionId: this.config.sessionId,
        peerId: this.config.peerId, frame, hash,
      });
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
    if (packet.hash === localHash) return;
    this.desyncQueue.push({ frame: packet.frame, localHash, remoteHash: packet.hash, remotePeerId: packet.peerId });
  }

  private pruneHashes(currentFrame: number): void {
    const oldest = Math.max(0, currentFrame - this.config.hashHistoryFrames);
    for (const frame of this.localHashes.keys()) if (frame < oldest) this.localHashes.delete(frame);
    for (const frame of this.pendingRemoteHashes.keys()) if (frame < oldest) this.pendingRemoteHashes.delete(frame);
  }
}
