import { hashWorldState } from './stateHash.js';
import { restoreWorld, snapshotWorld } from './world.js';
import type { SimInputFrame, WorldSnapshot, WorldState } from './types.js';

export const REPLAY_FORMAT_VERSION = 1;

export interface ReplayMetadata {
  formatVersion: typeof REPLAY_FORMAT_VERSION;
  gameVersion: string;
  createdAt?: string;
  seed: number;
  participantIds: readonly string[];
  fighterDefinitionIds: Readonly<Record<string, string>>;
  stageId: string;
  rulesetId: string;
}

export interface ReplayFrame {
  frame: number;
  byFighterId: Readonly<Record<string, SimInputFrame>>;
}

export interface ReplayCheckpoint {
  /** State ready to simulate this frame. */
  frame: number;
  snapshot: WorldSnapshot;
  hash: string;
}

export interface ReplayTape {
  metadata: ReplayMetadata;
  initial: ReplayCheckpoint;
  frames: readonly ReplayFrame[];
  checkpoints: readonly ReplayCheckpoint[];
}

export interface ReplayStepResult<TEvent = unknown> { state: WorldState; events: readonly TEvent[]; }
export type ReplayStep<TEvent = unknown> = (state: WorldState, input: ReplayFrame) => ReplayStepResult<TEvent>;

function cloneInput(input: SimInputFrame): SimInputFrame { return { ...input }; }
function cloneFrame(frame: ReplayFrame): ReplayFrame {
  const byFighterId: Record<string, SimInputFrame> = {};
  for (const [id, input] of Object.entries(frame.byFighterId)) byFighterId[id] = cloneInput(input);
  return { frame: frame.frame, byFighterId };
}
function checkpoint(state: WorldState): ReplayCheckpoint {
  return { frame: state.frame, snapshot: snapshotWorld(state), hash: hashWorldState(state) };
}

export class ReplayRecorder {
  private readonly metadata: ReplayMetadata;
  private readonly initial: ReplayCheckpoint;
  private readonly checkpointInterval: number;
  private readonly frames: ReplayFrame[] = [];
  private readonly checkpoints: ReplayCheckpoint[] = [];
  private nextFrame: number;

  constructor(initialState: WorldState, metadata: Omit<ReplayMetadata, 'formatVersion' | 'seed' | 'fighterDefinitionIds'> & { fighterDefinitionIds?: Readonly<Record<string, string>> }, checkpointInterval = 120) {
    if (!Number.isInteger(checkpointInterval) || checkpointInterval < 1) throw new Error('replay checkpointInterval must be positive integer');
    const participantIds = [...metadata.participantIds];
    if (participantIds.length === 0 || new Set(participantIds).size !== participantIds.length) throw new Error('replay participantIds must be non-empty and unique');
    const fighterDefinitionIds: Record<string, string> = {};
    for (const id of participantIds) {
      const fighter = initialState.fighters.find((entry) => entry.id === id);
      const explicit = metadata.fighterDefinitionIds?.[id];
      const definitionId = explicit ?? fighter?.definitionId;
      if (!definitionId) throw new Error(`replay missing fighter definition for participant ${id}`);
      fighterDefinitionIds[id] = definitionId;
    }
    this.metadata = { ...metadata, formatVersion: REPLAY_FORMAT_VERSION, seed: initialState.seed, participantIds, fighterDefinitionIds };
    this.initial = checkpoint(initialState);
    this.checkpointInterval = checkpointInterval;
    this.nextFrame = initialState.frame;
  }

  append(frameInput: ReplayFrame, resultingState: WorldState): void {
    if (frameInput.frame !== this.nextFrame) throw new Error(`replay expected frame ${this.nextFrame}, got ${frameInput.frame}`);
    if (resultingState.frame !== frameInput.frame + 1) throw new Error('replay append requires resulting state exactly one frame later');
    const byFighterId: Record<string, SimInputFrame> = {};
    for (const participantId of this.metadata.participantIds) {
      const input = frameInput.byFighterId[participantId];
      if (!input || input.frame !== frameInput.frame) throw new Error(`replay frame ${frameInput.frame} missing canonical input for ${participantId}`);
      byFighterId[participantId] = cloneInput(input);
    }
    this.frames.push({ frame: frameInput.frame, byFighterId });
    this.nextFrame = resultingState.frame;
    if ((resultingState.frame - this.initial.frame) % this.checkpointInterval === 0) this.checkpoints.push(checkpoint(resultingState));
  }

  finish(): ReplayTape { return structuredClone({ metadata: this.metadata, initial: this.initial, frames: this.frames, checkpoints: this.checkpoints }); }
}

export class ReplayPlayer<TEvent = unknown> {
  private readonly tape: ReplayTape;
  private readonly step: ReplayStep<TEvent>;
  private readonly frameByNumber: Map<number, ReplayFrame>;

  constructor(tape: ReplayTape, step: ReplayStep<TEvent>) {
    if (tape.metadata.formatVersion !== REPLAY_FORMAT_VERSION) throw new Error(`unsupported replay format ${tape.metadata.formatVersion}; expected ${REPLAY_FORMAT_VERSION}`);
    this.tape = structuredClone(tape);
    this.step = step;
    this.frameByNumber = new Map(this.tape.frames.map((frame) => [frame.frame, frame] as const));
    if (hashWorldState(restoreWorld(this.tape.initial.snapshot)) !== this.tape.initial.hash) throw new Error('replay initial checkpoint hash mismatch');
    for (const stored of this.tape.checkpoints) {
      if (hashWorldState(restoreWorld(stored.snapshot)) !== stored.hash) throw new Error(`replay checkpoint ${stored.frame} hash mismatch`);
    }
  }

  get startFrame(): number { return this.tape.initial.frame; }
  get endFrame(): number { return this.tape.initial.frame + this.tape.frames.length; }

  private bestCheckpoint(targetFrame: number): ReplayCheckpoint {
    const candidates = [this.tape.initial, ...this.tape.checkpoints].filter((entry) => entry.frame <= targetFrame).sort((a, b) => b.frame - a.frame);
    const best = candidates[0];
    if (!best) throw new Error(`replay target frame ${targetFrame} predates initial frame ${this.startFrame}`);
    return best;
  }

  seek(targetFrame: number): WorldState {
    if (!Number.isInteger(targetFrame) || targetFrame < this.startFrame || targetFrame > this.endFrame) throw new Error(`replay target frame ${targetFrame} outside [${this.startFrame}, ${this.endFrame}]`);
    const base = this.bestCheckpoint(targetFrame);
    let state = restoreWorld(base.snapshot);
    while (state.frame < targetFrame) {
      const frameInput = this.frameByNumber.get(state.frame);
      if (!frameInput) throw new Error(`replay missing input frame ${state.frame}`);
      const result = this.step(state, cloneFrame(frameInput));
      if (result.state.frame !== state.frame + 1) throw new Error(`replay step failed to advance frame ${state.frame}`);
      state = result.state;
    }
    return state;
  }

  playToEnd(): WorldState { return this.seek(this.endFrame); }
}

export function replayWorldHash(state: WorldState): string { return hashWorldState(state); }
