import { RollbackSession } from '../../../../packages/sim/src/rollback.js';
import { REPLAY_VERSION } from '../content/version.js';
import { OnlineRollbackPeer } from '../../../../packages/netcode/src/peer.js';
import { hashWorldState } from '../../../../packages/sim/src/stateHash.js';
import type { NetPacket } from '../../../../packages/netcode/src/protocol.js';
import type { SimInputFrame } from '../../../../packages/sim/src/types.js';
import { createDuel, stepDuel, type DuelOptions } from '../game/duel.js';
import { IDS } from '../game/session.js';
import { ONLINE } from '../content/online.js';
import { createTransport, normalizeCode, roomCode, type SignalingTransport, type SignalMessage } from './signaling.js';
interface PairCode {
  version: 3;
  session: string;
  options: DuelOptions;
  delay: number;
  sdp: RTCSessionDescriptionInit;
}
/** Manual signaling keeps the match peer-to-peer; simulation and correction use PF rollback. */
export class OnlineDuel {
  readonly connection = new RTCPeerConnection({ iceServers: ONLINE.iceServers });
  private signal: SignalingTransport | null = null;
  private readonly id = crypto.randomUUID();
  /** Candidates that arrived before the remote description. */
  private pending: RTCIceCandidateInit[] = [];
  room = '';
  private channel: RTCDataChannel | null = null;
  private peer: OnlineRollbackPeer | null = null;
  private session: string = crypto.randomUUID();
  private options: DuelOptions;
  private delay: number;
  private slot = 0;
  ready = false;
  remoteFrame = 0;
  rollbacks = 0;
  desyncs = 0;
  status = 'Waiting for pairing';
  onReady: (options: DuelOptions) => void = () => {};
  onStatus: (status: string) => void = () => {};
  constructor(options: DuelOptions, delay = 2) {
    this.options = { ...options, cpu: [0, 0] };
    this.delay = delay;
    this.connection.ondatachannel = (e) => this.bind(e.channel);
    this.connection.onconnectionstatechange = () => {
      if (['failed', 'disconnected', 'closed'].includes(this.connection.connectionState)) {
        this.ready = false;
        this.report(`Connection ${this.connection.connectionState}`);
      }
    };
  }
  private report(s: string) {
    this.status = s;
    this.onStatus(s);
  }
  private ensurePeer() {
    if (this.peer) return;
    const initial = createDuel(this.options);
    const rollback = new RollbackSession(initial, stepDuel, { participants: IDS, historyFrames: 240 });
    this.peer = new OnlineRollbackPeer(rollback, {
      sessionId: this.session,
      peerId: `peer-${this.slot}`,
      participantIds: IDS,
      localParticipantIds: [IDS[this.slot]!],
      inputDelayFrames: this.delay,
      gameVersion: REPLAY_VERSION,
      contentHash: hashWorldState(initial),
    });
    this.channel?.readyState === 'open' ? this.send(this.peer.hello) : this.queueHello();
    this.report('Validating duel rules…');
  }

  /** Sends our hello as soon as the channel opens. */
  private queueHello() {
    this.channel?.addEventListener('open', () => this.peer && this.send(this.peer.hello), { once: true });
  }

  private bind(channel: RTCDataChannel) {
    this.channel = channel;
    // A remote message can beat our own 'open' event; whichever comes first builds the peer.
    channel.onopen = () => this.ensurePeer();
    channel.onmessage = (e) => {
      try {
        if (typeof e.data !== 'string' || e.data.length > 64000) throw Error('Invalid packet size');
        const packet = JSON.parse(e.data) as NetPacket;
        this.ensurePeer();
        if (!this.peer) throw Error('Peer is not initialized');
        this.peer.receive(packet);
        if (packet.type === 'hello' && !this.ready) {
          this.ready = true;
          this.report('Connected · rollback active');
          this.signal?.close();
          this.signal = null;
          this.onReady(this.options);
        }
        if (packet.type === 'input') this.remoteFrame = Math.max(this.remoteFrame, packet.input.frame);
      } catch (error) {
        this.ready = false;
        this.report(`Network error: ${String(error)}`);
      }
    };
  }
  private send(value: NetPacket) {
    if (this.channel?.readyState === 'open') this.channel.send(JSON.stringify(value));
  }
  private async code() {
    if (this.connection.iceGatheringState !== 'complete')
      await new Promise<void>((resolve) => {
        const done = () => {
          if (this.connection.iceGatheringState === 'complete') {
            clearTimeout(timeout);
            this.connection.removeEventListener('icegatheringstatechange', done);
            resolve();
          }
        };
        const timeout = setTimeout(() => {
          this.connection.removeEventListener('icegatheringstatechange', done);
          resolve();
        }, 5000);
        this.connection.addEventListener('icegatheringstatechange', done);
      });
    if (!this.connection.localDescription?.sdp.includes('a=candidate:'))
      throw Error(
        'This browser exposed no WebRTC connection candidates. Try a network/browser that allows peer connections.',
      );
    const data: PairCode = {
      version: 3,
      session: this.session,
      options: this.options,
      delay: this.delay,
      sdp: this.connection.localDescription!.toJSON(),
    };
    return btoa(JSON.stringify(data));
  }
  private parse(code: string): PairCode {
    if (code.length > 30000) throw Error('Pairing code is too long');
    const data = JSON.parse(atob(code.trim())) as PairCode;
    if (data.version !== 3 || !data.sdp?.sdp || !['offer', 'answer'].includes(data.sdp.type))
      throw Error('Invalid pairing code');
    if (!Number.isInteger(data.delay) || data.delay < 0 || data.delay > 8) throw Error('Invalid input delay');
    return data;
  }
  async host() {
    this.slot = 0;
    this.bind(this.connection.createDataChannel('spectris', { ordered: true }));
    await this.connection.setLocalDescription(await this.connection.createOffer());
    this.report('Send the invitation to your opponent');
    return this.code();
  }
  async join(code: string) {
    const data = this.parse(code);
    if (data.sdp.type !== 'offer') throw Error('An invitation is required');
    this.slot = 1;
    this.options = { ...data.options, cpu: [0, 0] };
    this.session = data.session;
    this.delay = data.delay;
    await this.connection.setRemoteDescription(data.sdp);
    await this.connection.setLocalDescription(await this.connection.createAnswer());
    this.report('Send the answer back to the host');
    return this.code();
  }
  async accept(code: string) {
    const data = this.parse(code);
    if (data.sdp.type !== 'answer' || data.session !== this.session) throw Error('Answer belongs to another duel');
    await this.connection.setRemoteDescription(data.sdp);
    this.report('Connecting…');
  }
  // ---------------------------------------------------------------- room codes

  /** Host: open a room and return its code; the offer goes out when a guest joins. */
  async hostRoom(): Promise<string> {
    this.slot = 0;
    this.room = roomCode();
    this.bind(this.connection.createDataChannel('spectris', { ordered: true }));
    this.trickle();
    await this.openSignal(async (message) => {
      if (message.type === 'join') {
        await this.connection.setLocalDescription(await this.connection.createOffer());
        const payload = JSON.stringify({ options: this.options, delay: this.delay });
        await this.signal!.send({
          type: 'offer',
          from: this.id,
          sdp: this.connection.localDescription!.toJSON(),
          session: this.session,
          payload,
        });
        this.report('Opponent found · connecting…');
      } else if (message.type === 'answer') {
        await this.connection.setRemoteDescription(message.sdp);
        await this.flushCandidates();
      }
    });
    this.report(`Room ${this.room} · share this code (${this.signal!.name})`);
    return this.room;
  }

  /** Guest: join a room by code; answers the host's offer. */
  async joinRoom(code: string): Promise<void> {
    this.slot = 1;
    this.room = normalizeCode(code);
    this.trickle();
    await this.openSignal(async (message) => {
      if (message.type !== 'offer') return;
      const settings = JSON.parse(message.payload) as { options: DuelOptions; delay: number };
      if (!Number.isInteger(settings.delay) || settings.delay < 0 || settings.delay > 8)
        throw Error('Invalid input delay');
      this.options = { ...settings.options, cpu: [0, 0] };
      this.delay = settings.delay;
      this.session = message.session;
      await this.connection.setRemoteDescription(message.sdp);
      await this.connection.setLocalDescription(await this.connection.createAnswer());
      await this.signal!.send({ type: 'answer', from: this.id, sdp: this.connection.localDescription!.toJSON() });
      await this.flushCandidates();
      this.report('Connecting…');
    });
    await this.signal!.send({ type: 'join', from: this.id });
    this.report(`Joined room ${this.room} · waiting for host`);
  }

  private async openSignal(handle: (message: SignalMessage) => Promise<void>): Promise<void> {
    this.signal = createTransport();
    await this.signal.join(this.room, (message) => {
      if (message.from === this.id) return;
      if (message.type === 'ice') {
        void this.addCandidate(message.candidate);
        return;
      }
      handle(message).catch((error) => this.report(`Signaling error: ${String(error)}`));
    });
  }

  private trickle(): void {
    this.connection.onicecandidate = (event) => {
      if (event.candidate && this.signal)
        void this.signal.send({ type: 'ice', from: this.id, candidate: event.candidate.toJSON() });
    };
  }

  private async addCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.connection.remoteDescription) {
      this.pending.push(candidate);
      return;
    }
    await this.connection.addIceCandidate(candidate);
  }

  private async flushCandidates(): Promise<void> {
    for (const candidate of this.pending.splice(0)) await this.connection.addIceCandidate(candidate);
  }

  advance(input: SimInputFrame) {
    if (!this.ready || !this.peer) return null;
    if (this.peer.currentFrame - this.remoteFrame > 12) {
      this.report('Waiting for opponent…');
      return null;
    }
    this.peer.submitLocalInput(IDS[this.slot]!, { ...input, frame: this.peer.currentFrame });
    const result = this.peer.advance();
    result.outbound.forEach((p) => this.send(p));
    this.rollbacks += result.resimulatedFrames;
    this.desyncs += result.desyncs.length;
    if (result.desyncs.length) {
      this.ready = false;
      this.report(`Desync at frame ${result.desyncs[0]!.frame}; match stopped`);
    }
    return result;
  }
  /** Live connection statistics (exposed to the two-tab test). */
  stats() {
    return {
      ready: this.ready,
      frame: this.peer?.currentFrame ?? 0,
      remoteFrame: this.remoteFrame,
      rollbacks: this.rollbacks,
      desyncs: this.desyncs,
      status: this.status,
      room: this.room,
    };
  }

  close() {
    this.ready = false;
    if (this.signal) void this.signal.send({ type: 'bye', from: this.id });
    this.signal?.close();
    this.channel?.close();
    this.connection.close();
  }
}
