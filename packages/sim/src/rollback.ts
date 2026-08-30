import type { SimInputFrame, WorldSnapshot, WorldState } from './types.js';
import { restoreWorld, snapshotWorld } from './world.js';

export type ParticipantId = string;
export interface RollbackFrameInput {
  frame: number;
  byFighterId: Readonly<Record<ParticipantId, SimInputFrame>>;
}
export interface RollbackAdvanceResult<TEvent> {
  state: WorldState;
  events: readonly TEvent[];
}
export type RollbackStep<TEvent> = (state: WorldState, input: RollbackFrameInput) => RollbackAdvanceResult<TEvent>;

export interface RollbackConfig {
  /** Runtime participant IDs in stable canonical order. */
  participants: readonly ParticipantId[];
  /** Maximum historical frames retained for late-input correction. */
  historyFrames: number;
  /** Prediction policy for a participant whose exact frame input is not known yet. */
  predict?: (participantId: ParticipantId, frame: number, previous: SimInputFrame | null) => SimInputFrame;
}

export interface RollbackAdvance<TEvent> {
  state: WorldState;
  events: readonly TEvent[];
  /** Earliest frame restored/replayed by this advance; null when no rollback occurred. */
  rolledBackFromFrame: number | null;
  /** Number of historical frames replayed before advancing the new present frame. */
  resimulatedFrames: number;
}

function neutral(frame: number): SimInputFrame {
  return {
    frame,
    moveX: 0,
    moveY: 0,
    jumpPressed: false,
    jumpHeld: false,
    attackPressed: false,
    specialPressed: false,
    grabPressed: false,
    smashX: 0,
    smashY: 0,
    dodgePressed: false,
    shieldHeld: false,
  };
}

function cloneInput(input: SimInputFrame, frame = input.frame): SimInputFrame {
  return { ...input, frame };
}

function sameInput(a: SimInputFrame | undefined, b: SimInputFrame): boolean {
  if (!a) return false;
  return a.frame === b.frame
    && a.moveX === b.moveX && a.moveY === b.moveY
    && a.jumpPressed === b.jumpPressed && a.jumpHeld === b.jumpHeld
    && Boolean(a.attackPressed) === Boolean(b.attackPressed)
    && Boolean(a.specialPressed) === Boolean(b.specialPressed)
    && Boolean(a.grabPressed) === Boolean(b.grabPressed)
    && (a.smashX ?? 0) === (b.smashX ?? 0) && (a.smashY ?? 0) === (b.smashY ?? 0)
    && a.dodgePressed === b.dodgePressed && a.shieldHeld === b.shieldHeld;
}

/**
 * Transport-agnostic rollback session. Network code only submits exact frame
 * inputs; prediction, snapshot retention and deterministic restore/resimulation
 * live here and never enter the gameplay kernel.
 */
export class RollbackSession<TEvent = unknown> {
  private state: WorldState;
  private readonly step: RollbackStep<TEvent>;
  private readonly participants: readonly ParticipantId[];
  private readonly historyFrames: number;
  private readonly predict: NonNullable<RollbackConfig['predict']>;
  /** Snapshot keyed by the frame that snapshot is ready to simulate. */
  private readonly snapshots = new Map<number, WorldSnapshot>();
  /** Exact/authoritative inputs received from controllers or transport. */
  private readonly exactInputs = new Map<number, Map<ParticipantId, SimInputFrame>>();
  /** Inputs actually consumed by simulation, including predictions. */
  private readonly simulatedInputs = new Map<number, Map<ParticipantId, SimInputFrame>>();
  private earliestDirtyFrame: number | null = null;

  constructor(initial: WorldState, step: RollbackStep<TEvent>, config: RollbackConfig) {
    if (!Number.isInteger(config.historyFrames) || config.historyFrames < 2) throw new Error('rollback historyFrames must be integer >= 2');
    const participants = [...config.participants];
    if (participants.length === 0 || new Set(participants).size !== participants.length) throw new Error('rollback participants must be non-empty and unique');
    this.state = structuredClone(initial);
    this.step = step;
    this.participants = participants;
    this.historyFrames = config.historyFrames;
    this.predict = config.predict ?? ((_, frame, previous) => previous ? cloneInput(previous, frame) : neutral(frame));
    this.snapshots.set(initial.frame, snapshotWorld(initial));
  }

  get currentState(): WorldState { return structuredClone(this.state); }
  get currentFrame(): number { return this.state.frame; }

  /**
   * Submit an exact participant input. Inputs may arrive before or after their
   * simulation frame. A changed input for an already-simulated frame marks the
   * earliest affected frame dirty for the next advance/resimulation.
   */
  submitInput(participantId: ParticipantId, input: SimInputFrame): void {
    if (!this.participants.includes(participantId)) throw new Error(`unknown rollback participant ${participantId}`);
    if (!Number.isInteger(input.frame) || input.frame < 0) throw new Error(`invalid rollback input frame ${input.frame}`);
    const oldestRetained = Math.max(0, this.state.frame - this.historyFrames);
    if (input.frame < oldestRetained) throw new Error(`rollback input frame ${input.frame} is older than retained frame ${oldestRetained}`);
    let frameInputs = this.exactInputs.get(input.frame);
    if (!frameInputs) { frameInputs = new Map(); this.exactInputs.set(input.frame, frameInputs); }
    const normalized = cloneInput(input);
    frameInputs.set(participantId, normalized);

    if (input.frame < this.state.frame) {
      const consumed = this.simulatedInputs.get(input.frame)?.get(participantId);
      if (!sameInput(consumed, normalized)) {
        this.earliestDirtyFrame = this.earliestDirtyFrame === null ? input.frame : Math.min(this.earliestDirtyFrame, input.frame);
      }
    }
  }

  submitFrame(frameInput: RollbackFrameInput): void {
    for (const participantId of this.participants) {
      const input = frameInput.byFighterId[participantId];
      if (input) this.submitInput(participantId, input);
    }
  }

  private previousConsumed(participantId: ParticipantId, frame: number): SimInputFrame | null {
    for (let candidate = frame - 1; candidate >= Math.max(0, frame - this.historyFrames); candidate -= 1) {
      const previous = this.simulatedInputs.get(candidate)?.get(participantId);
      if (previous) return previous;
    }
    return null;
  }

  private inputsFor(frame: number): Map<ParticipantId, SimInputFrame> {
    const exact = this.exactInputs.get(frame);
    const result = new Map<ParticipantId, SimInputFrame>();
    for (const participantId of this.participants) {
      const known = exact?.get(participantId);
      const chosen = known ?? this.predict(participantId, frame, this.previousConsumed(participantId, frame));
      if (chosen.frame !== frame) throw new Error(`rollback prediction for ${participantId} returned frame ${chosen.frame}, expected ${frame}`);
      result.set(participantId, cloneInput(chosen));
    }
    return result;
  }

  private simulateOneFrame(): readonly TEvent[] {
    const frame = this.state.frame;
    this.snapshots.set(frame, snapshotWorld(this.state));
    const inputs = this.inputsFor(frame);
    this.simulatedInputs.set(frame, inputs);
    const byFighterId: Record<string, SimInputFrame> = {};
    for (const [participantId, input] of inputs) byFighterId[participantId] = input;
    const result = this.step(this.state, { frame, byFighterId });
    if (result.state.frame !== frame + 1) throw new Error(`rollback step must advance exactly one frame (${frame} -> ${result.state.frame})`);
    this.state = result.state;
    this.prune();
    return result.events;
  }

  private prune(): void {
    const oldest = Math.max(0, this.state.frame - this.historyFrames);
    for (const frame of [...this.snapshots.keys()]) if (frame < oldest) this.snapshots.delete(frame);
    for (const frame of [...this.simulatedInputs.keys()]) if (frame < oldest) this.simulatedInputs.delete(frame);
    for (const frame of [...this.exactInputs.keys()]) if (frame < oldest) this.exactInputs.delete(frame);
  }

  private resimulateDirtyHistory(): { from: number | null; frames: number } {
    if (this.earliestDirtyFrame === null) return { from: null, frames: 0 };
    const from = this.earliestDirtyFrame;
    const present = this.state.frame;
    const snapshot = this.snapshots.get(from);
    if (!snapshot) throw new Error(`rollback snapshot for dirty frame ${from} is unavailable`);
    this.state = restoreWorld(snapshot);
    for (const frame of [...this.simulatedInputs.keys()]) if (frame >= from) this.simulatedInputs.delete(frame);
    let frames = 0;
    while (this.state.frame < present) { this.simulateOneFrame(); frames += 1; }
    this.earliestDirtyFrame = null;
    return { from, frames };
  }

  /** Resimulates dirty history if necessary, then advances exactly one new frame. */
  advance(): RollbackAdvance<TEvent> {
    const rollback = this.resimulateDirtyHistory();
    const events = this.simulateOneFrame();
    return {
      state: structuredClone(this.state),
      events,
      rolledBackFromFrame: rollback.from,
      resimulatedFrames: rollback.frames,
    };
  }
}
