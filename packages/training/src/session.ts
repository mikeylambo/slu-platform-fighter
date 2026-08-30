import { DEFAULT_SHIELD_HEALTH, DEFAULT_STOCKS } from '../../sim/src/world.js';
import type { MatchInputFrame, MatchStepResult } from '../../sim/src/match.js';
import type { FighterState, SimInputFrame, WorldState } from '../../sim/src/types.js';

export type DummyProfile = 'stand' | 'shield' | 'crouch' | 'jump' | 'di-left' | 'di-right' | 'sdI-left' | 'sdI-right';
export type TrainingStep = (state: WorldState, input: MatchInputFrame) => MatchStepResult;

export interface SavedTrainingPosition {
  readonly fighters: Readonly<Record<string, Pick<FighterState, 'x' | 'y' | 'vx' | 'vy' | 'facing' | 'grounded' | 'groundSurfaceId' | 'locomotion' | 'locomotionFrame'>>>;
}

export interface TrainingRecording {
  readonly startFrame: number;
  readonly frames: readonly MatchInputFrame[];
}

function neutral(frame: number): SimInputFrame {
  return { frame, moveX: 0, moveY: 0, jumpPressed: false, jumpHeld: false, attackPressed: false, specialPressed: false, grabPressed: false, smashX: 0, smashY: 0, dodgePressed: false, shieldHeld: false };
}

function dummyInput(frame: number, profile: DummyProfile): SimInputFrame {
  const input = neutral(frame);
  if (profile === 'shield') return { ...input, shieldHeld: true };
  if (profile === 'crouch') return { ...input, moveY: -1000 };
  if (profile === 'di-left' || profile === 'sdI-left') return { ...input, moveX: -1000 };
  if (profile === 'di-right' || profile === 'sdI-right') return { ...input, moveX: 1000 };
  if (profile === 'jump') {
    const phase = frame % 60;
    return { ...input, jumpPressed: phase === 0, jumpHeld: phase < 4 };
  }
  return input;
}

function resetCombatState(fighter: FighterState): FighterState {
  return {
    ...fighter,
    vx: 0 as FighterState['vx'], vy: 0 as FighterState['vy'],
    percentTenths: 0, hitlagFrames: 0, hitstunFrames: 0, attack: null, landingLagFrames: 0,
    shielding: false, shieldHealth: DEFAULT_SHIELD_HEALTH, shieldStunFrames: 0, shieldRegenDelayFrames: 0,
    grabTargetId: null, grabbedById: null, grabFrames: 0, grabAction: null,
    stocks: DEFAULT_STOCKS, eliminated: false, respawnFrames: 0,
    invulnerableFrames: 0,
  };
}

export class TrainingSession {
  private state: WorldState;
  private readonly step: TrainingStep;
  private readonly participants: readonly string[];
  private paused = true;
  private readonly dummyProfiles = new Map<string, DummyProfile>();
  private readonly savedPositions = new Map<string, SavedTrainingPosition>();
  private recordingStartFrame: number | null = null;
  private recordedFrames: MatchInputFrame[] = [];

  constructor(initialState: WorldState, participantIds: readonly string[], step: TrainingStep) {
    const ids = [...participantIds];
    if (ids.length < 2 || ids.some((id) => !initialState.fighters.some((fighter) => fighter.id === id))) throw new Error('training session requires at least two valid participant ids');
    if (new Set(ids).size !== ids.length) throw new Error('training participant ids must be unique');
    this.state = structuredClone(initialState);
    this.participants = ids;
    this.step = step;
    for (const id of ids.slice(1)) this.dummyProfiles.set(id, 'stand');
  }

  get snapshot(): WorldState { return structuredClone(this.state); }
  get isPaused(): boolean { return this.paused; }
  setPaused(paused: boolean): void { this.paused = paused; }

  setDummyProfile(participantId: string, profile: DummyProfile): void {
    if (!this.participants.includes(participantId)) throw new Error(`unknown training participant ${participantId}`);
    this.dummyProfiles.set(participantId, profile);
  }

  setPercent(participantId: string, percentTenths: number): void {
    if (!Number.isInteger(percentTenths) || percentTenths < 0) throw new Error('training percent must be non-negative integer tenths');
    this.mutateFighter(participantId, (fighter) => ({ ...fighter, percentTenths }));
  }

  setStocks(participantId: string, stocks: number): void {
    if (!Number.isInteger(stocks) || stocks < 0) throw new Error('training stocks must be non-negative integer');
    this.mutateFighter(participantId, (fighter) => ({ ...fighter, stocks, eliminated: stocks === 0 }));
  }

  resetFighter(participantId: string): void { this.mutateFighter(participantId, resetCombatState); }
  resetAll(): void {
    this.state = { ...this.state, fighters: this.state.fighters.map(resetCombatState), winnerId: null };
  }

  savePosition(label = 'default'): void {
    const fighters: Record<string, SavedTrainingPosition['fighters'][string]> = {};
    for (const fighter of this.state.fighters) {
      fighters[fighter.id] = {
        x: fighter.x, y: fighter.y, vx: fighter.vx, vy: fighter.vy, facing: fighter.facing,
        grounded: fighter.grounded, groundSurfaceId: fighter.groundSurfaceId,
        locomotion: fighter.locomotion, locomotionFrame: fighter.locomotionFrame,
      };
    }
    this.savedPositions.set(label, { fighters });
  }

  loadPosition(label = 'default'): void {
    const saved = this.savedPositions.get(label);
    if (!saved) throw new Error(`unknown saved training position ${label}`);
    this.state = {
      ...this.state,
      fighters: this.state.fighters.map((fighter) => {
        const position = saved.fighters[fighter.id];
        return position ? { ...fighter, ...position } : fighter;
      }),
    };
  }

  startRecording(): void {
    this.recordingStartFrame = this.state.frame;
    this.recordedFrames = [];
  }

  stopRecording(): TrainingRecording {
    if (this.recordingStartFrame === null) throw new Error('training recording is not active');
    const recording = { startFrame: this.recordingStartFrame, frames: structuredClone(this.recordedFrames) };
    this.recordingStartFrame = null;
    this.recordedFrames = [];
    return recording;
  }

  stepFrame(inputs: Readonly<Record<string, SimInputFrame>> = {}): MatchStepResult {
    const frame = this.state.frame;
    const byFighterId: Record<string, SimInputFrame> = {};
    for (const id of this.participants) {
      const provided = inputs[id];
      const profile = this.dummyProfiles.get(id);
      const resolved = provided ?? (profile ? dummyInput(frame, profile) : neutral(frame));
      if (resolved.frame !== frame) throw new Error(`training input ${id} frame ${resolved.frame} does not match ${frame}`);
      byFighterId[id] = { ...resolved };
    }
    const input: MatchInputFrame = { frame, byFighterId };
    const result = this.step(this.state, input);
    if (result.state.frame !== frame + 1) throw new Error('training step must advance exactly one deterministic frame');
    this.state = result.state;
    if (this.recordingStartFrame !== null) this.recordedFrames.push(structuredClone(input));
    return result;
  }

  runFrames(count: number, inputProvider?: (frame: number) => Readonly<Record<string, SimInputFrame>>): MatchStepResult[] {
    if (!Number.isInteger(count) || count < 0) throw new Error('training runFrames count must be non-negative integer');
    const results: MatchStepResult[] = [];
    for (let index = 0; index < count; index += 1) results.push(this.stepFrame(inputProvider?.(this.state.frame) ?? {}));
    return results;
  }

  tick(inputs: Readonly<Record<string, SimInputFrame>> = {}): MatchStepResult | null {
    return this.paused ? null : this.stepFrame(inputs);
  }

  private mutateFighter(participantId: string, mutate: (fighter: FighterState) => FighterState): void {
    let found = false;
    const fighters = this.state.fighters.map((fighter) => {
      if (fighter.id !== participantId) return fighter;
      found = true;
      return mutate(fighter);
    });
    if (!found) throw new Error(`unknown training participant ${participantId}`);
    this.state = { ...this.state, fighters };
  }
}
