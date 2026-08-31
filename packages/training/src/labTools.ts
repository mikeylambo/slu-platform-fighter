import { remapAxis, remapButton, type AxisBinding, type InputProfile, type SemanticAxis, type SemanticButton } from '../../input/src/profile.js';
import { ReplayPlayer, ReplayRecorder, type ReplayFrame, type ReplayMetadata, type ReplayStep, type ReplayTape } from '../../sim/src/replay.js';
import type { WorldState } from '../../sim/src/types.js';

export type LabReplayMode = 'live' | 'recording' | 'playback';

export interface LabReplaySnapshot {
  mode: LabReplayMode;
  currentFrame: number;
  startFrame: number;
  endFrame: number;
  hasTape: boolean;
}

/** Shared deterministic replay controller for Movement/Combat/Stage labs. */
export class LabReplaySession<TEvent = unknown> {
  private readonly step: ReplayStep<TEvent>;
  private readonly metadata: Omit<ReplayMetadata, 'formatVersion' | 'seed' | 'fighterDefinitionIds'> & { fighterDefinitionIds?: Readonly<Record<string, string>> };
  private readonly checkpointInterval: number;
  private recorder: ReplayRecorder | null = null;
  private player: ReplayPlayer<TEvent> | null = null;
  private tape: ReplayTape | null = null;
  private current: WorldState;
  private modeValue: LabReplayMode = 'live';

  constructor(initialState: WorldState, metadata: Omit<ReplayMetadata, 'formatVersion' | 'seed' | 'fighterDefinitionIds'> & { fighterDefinitionIds?: Readonly<Record<string, string>> }, step: ReplayStep<TEvent>, checkpointInterval = 120) {
    this.current = structuredClone(initialState);
    this.metadata = structuredClone(metadata);
    this.step = step;
    this.checkpointInterval = checkpointInterval;
  }

  get mode(): LabReplayMode { return this.modeValue; }
  get state(): WorldState { return structuredClone(this.current); }
  get replayTape(): ReplayTape | null { return this.tape ? structuredClone(this.tape) : null; }

  startRecording(initialState: WorldState = this.current): void {
    this.current = structuredClone(initialState);
    this.recorder = new ReplayRecorder(this.current, this.metadata, this.checkpointInterval);
    this.player = null;
    this.tape = null;
    this.modeValue = 'recording';
  }

  appendRecordedFrame(frameInput: ReplayFrame, resultingState: WorldState): void {
    if (this.modeValue !== 'recording' || !this.recorder) throw new Error('lab replay is not recording');
    this.recorder.append(frameInput, resultingState);
    this.current = structuredClone(resultingState);
  }

  stopRecording(): ReplayTape {
    if (this.modeValue !== 'recording' || !this.recorder) throw new Error('lab replay is not recording');
    this.tape = this.recorder.finish();
    this.player = new ReplayPlayer<TEvent>(this.tape, this.step);
    this.recorder = null;
    this.modeValue = 'playback';
    return structuredClone(this.tape);
  }

  load(tape: ReplayTape): WorldState {
    this.tape = structuredClone(tape);
    this.player = new ReplayPlayer<TEvent>(this.tape, this.step);
    this.current = this.player.seek(this.player.startFrame);
    this.recorder = null;
    this.modeValue = 'playback';
    return this.state;
  }

  seek(frame: number): WorldState {
    if (!this.player) throw new Error('lab replay has no loaded tape');
    this.current = this.player.seek(frame);
    this.modeValue = 'playback';
    return this.state;
  }

  stepForward(): WorldState {
    if (!this.player) throw new Error('lab replay has no loaded tape');
    const next = Math.min(this.player.endFrame, this.current.frame + 1);
    return this.seek(next);
  }

  stepBackward(): WorldState {
    if (!this.player) throw new Error('lab replay has no loaded tape');
    const previous = Math.max(this.player.startFrame, this.current.frame - 1);
    return this.seek(previous);
  }

  playToEnd(): WorldState {
    if (!this.player) throw new Error('lab replay has no loaded tape');
    this.current = this.player.playToEnd();
    this.modeValue = 'playback';
    return this.state;
  }

  returnToLive(state: WorldState = this.current): void {
    this.current = structuredClone(state);
    this.recorder = null;
    this.player = null;
    this.modeValue = 'live';
  }

  snapshot(): LabReplaySnapshot {
    const startFrame = this.player?.startFrame ?? this.current.frame;
    const endFrame = this.player?.endFrame ?? this.current.frame;
    return { mode: this.modeValue, currentFrame: this.current.frame, startFrame, endFrame, hasTape: this.tape !== null };
  }
}

export interface LabInputEditorSnapshot {
  profile: InputProfile;
  buttonRows: readonly { semantic: SemanticButton; physicalIds: readonly string[] }[];
  axisRows: readonly { semantic: SemanticAxis; binding: AxisBinding }[];
}

/** UI-facing immutable editor over the certified semantic input profile contract. */
export class LabInputProfileEditor {
  private profileValue: InputProfile;
  constructor(profile: InputProfile) { this.profileValue = structuredClone(profile); }
  get profile(): InputProfile { return structuredClone(this.profileValue); }

  bindButton(semantic: SemanticButton, physicalIds: readonly string[]): InputProfile {
    this.profileValue = remapButton(this.profileValue, semantic, physicalIds.map((id) => id.trim()).filter(Boolean));
    return this.profile;
  }

  bindAxis(semantic: SemanticAxis, binding: AxisBinding): InputProfile {
    this.profileValue = remapAxis(this.profileValue, semantic, binding);
    return this.profile;
  }

  replace(profile: InputProfile): void { this.profileValue = structuredClone(profile); }

  snapshot(): LabInputEditorSnapshot {
    const buttons = ['jump','attack','special','grab','dodge','shield'] as const;
    const axes = ['moveX','moveY','smashX','smashY'] as const;
    return {
      profile: this.profile,
      buttonRows: buttons.map((semantic) => ({ semantic, physicalIds: [...this.profileValue.buttons[semantic]] })),
      axisRows: axes.map((semantic) => ({ semantic, binding: { ...this.profileValue.axes[semantic] } })),
    };
  }
}
