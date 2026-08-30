import { REPLAY_FORMAT_VERSION, type ReplayCheckpoint, type ReplayFrame, type ReplayMetadata, type ReplayTape } from '../../sim/src/replay.js';
import { hashWorldState } from '../../sim/src/stateHash.js';
import { snapshotWorld } from '../../sim/src/world.js';
import type { WorldState } from '../../sim/src/types.js';

export const SPECTATOR_FEED_VERSION = 1;

export interface SpectatorStartPacket {
  type: 'spectator-start';
  feedVersion: typeof SPECTATOR_FEED_VERSION;
  contentHash: string;
  metadata: ReplayMetadata;
  checkpoint: ReplayCheckpoint;
}
export interface SpectatorInputPacket {
  type: 'spectator-inputs';
  feedVersion: typeof SPECTATOR_FEED_VERSION;
  startFrame: number;
  frames: readonly ReplayFrame[];
}
export interface SpectatorCheckpointPacket {
  type: 'spectator-checkpoint';
  feedVersion: typeof SPECTATOR_FEED_VERSION;
  checkpoint: ReplayCheckpoint;
}
export type SpectatorPacket = SpectatorStartPacket | SpectatorInputPacket | SpectatorCheckpointPacket;

function checkpoint(state: WorldState): ReplayCheckpoint {
  return { frame: state.frame, snapshot: snapshotWorld(state), hash: hashWorldState(state) };
}
function cloneFrame(frame: ReplayFrame): ReplayFrame {
  return { frame: frame.frame, byFighterId: Object.fromEntries(Object.entries(frame.byFighterId).map(([id, input]) => [id, { ...input }])) };
}

/**
 * Publishes replay-compatible deterministic spectator packets. The caller only
 * appends confirmed simulation inputs; network transport/batching is external.
 */
export class SpectatorFeedPublisher {
  private readonly contentHash: string;
  private readonly metadata: ReplayMetadata;
  private readonly checkpointInterval: number;
  private nextFrame: number;
  private pending: ReplayFrame[] = [];

  constructor(state: WorldState, metadata: Omit<ReplayMetadata, 'formatVersion' | 'seed'>, contentHash: string, checkpointInterval = 120) {
    if (!contentHash) throw new Error('spectator feed requires content hash');
    if (!Number.isInteger(checkpointInterval) || checkpointInterval < 1) throw new Error('spectator checkpoint interval must be positive integer');
    this.contentHash = contentHash;
    this.metadata = { ...metadata, formatVersion: REPLAY_FORMAT_VERSION, seed: state.seed };
    this.checkpointInterval = checkpointInterval;
    this.nextFrame = state.frame;
  }

  start(state: WorldState): SpectatorStartPacket {
    if (state.frame !== this.nextFrame) throw new Error(`spectator start state frame ${state.frame} does not match publisher frame ${this.nextFrame}`);
    return { type: 'spectator-start', feedVersion: SPECTATOR_FEED_VERSION, contentHash: this.contentHash, metadata: structuredClone(this.metadata), checkpoint: checkpoint(state) };
  }

  append(frame: ReplayFrame, resultingState: WorldState): SpectatorCheckpointPacket | null {
    if (frame.frame !== this.nextFrame || resultingState.frame !== frame.frame + 1) throw new Error('spectator append requires one canonical sequential simulation frame');
    this.pending.push(cloneFrame(frame));
    this.nextFrame = resultingState.frame;
    return resultingState.frame % this.checkpointInterval === 0
      ? { type: 'spectator-checkpoint', feedVersion: SPECTATOR_FEED_VERSION, checkpoint: checkpoint(resultingState) }
      : null;
  }

  flush(maxFrames = Number.POSITIVE_INFINITY): SpectatorInputPacket | null {
    if (!(maxFrames > 0)) throw new Error('spectator flush maxFrames must be positive');
    if (this.pending.length === 0) return null;
    const count = Number.isFinite(maxFrames) ? Math.min(this.pending.length, Math.floor(maxFrames)) : this.pending.length;
    const frames = this.pending.splice(0, count);
    return { type: 'spectator-inputs', feedVersion: SPECTATOR_FEED_VERSION, startFrame: frames[0]!.frame, frames };
  }
}

/** Accumulates a spectator stream into the exact ReplayTape format. */
export class SpectatorFeedReceiver {
  private contentHash: string | null = null;
  private metadata: ReplayMetadata | null = null;
  private initial: ReplayCheckpoint | null = null;
  private readonly frames = new Map<number, ReplayFrame>();
  private readonly checkpoints = new Map<number, ReplayCheckpoint>();

  receive(packet: SpectatorPacket, expectedContentHash?: string): void {
    if (packet.feedVersion !== SPECTATOR_FEED_VERSION) throw new Error(`unsupported spectator feed ${packet.feedVersion}`);
    if (packet.type === 'spectator-start') {
      if (expectedContentHash !== undefined && packet.contentHash !== expectedContentHash) throw new Error('spectator content hash mismatch');
      if (hashWorldState(packet.checkpoint.snapshot.state) !== packet.checkpoint.hash) throw new Error('spectator start checkpoint hash mismatch');
      this.contentHash = packet.contentHash;
      this.metadata = structuredClone(packet.metadata);
      this.initial = structuredClone(packet.checkpoint);
      this.frames.clear();
      this.checkpoints.clear();
      return;
    }
    if (!this.initial || !this.metadata || !this.contentHash) throw new Error('spectator feed must receive start packet first');
    if (packet.type === 'spectator-inputs') {
      for (let index = 0; index < packet.frames.length; index += 1) {
        const frame = packet.frames[index]!;
        if (frame.frame !== packet.startFrame + index) throw new Error('spectator input packet frames must be contiguous');
        const existing = this.frames.get(frame.frame);
        if (existing && JSON.stringify(existing) !== JSON.stringify(frame)) throw new Error(`spectator conflicting input frame ${frame.frame}`);
        this.frames.set(frame.frame, cloneFrame(frame));
      }
      return;
    }
    if (hashWorldState(packet.checkpoint.snapshot.state) !== packet.checkpoint.hash) throw new Error(`spectator checkpoint ${packet.checkpoint.frame} hash mismatch`);
    this.checkpoints.set(packet.checkpoint.frame, structuredClone(packet.checkpoint));
  }

  toReplayTape(): ReplayTape {
    if (!this.initial || !this.metadata) throw new Error('spectator feed has not started');
    const frames = [...this.frames.values()].sort((a, b) => a.frame - b.frame);
    for (let index = 1; index < frames.length; index += 1) {
      if (frames[index]!.frame !== frames[index - 1]!.frame + 1) throw new Error(`spectator feed has gap between frames ${frames[index - 1]!.frame} and ${frames[index]!.frame}`);
    }
    return {
      metadata: structuredClone(this.metadata),
      initial: structuredClone(this.initial),
      frames,
      checkpoints: [...this.checkpoints.values()].sort((a, b) => a.frame - b.frame).map((entry) => structuredClone(entry)),
    };
  }
}
