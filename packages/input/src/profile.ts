import type { SimInputFrame } from '../../sim/src/types.js';

export type SemanticButton = 'jump' | 'attack' | 'special' | 'grab' | 'dodge' | 'shield';
export type SemanticAxis = 'moveX' | 'moveY' | 'smashX' | 'smashY';

export interface AxisBinding { physicalAxis: string; invert?: boolean; deadzone?: number; }
export interface InputProfile {
  id: string;
  buttons: Readonly<Record<SemanticButton, readonly string[]>>;
  axes: Readonly<Record<SemanticAxis, AxisBinding>>;
}
export interface RawInputSample {
  /** Monotonic adapter-owned sequence, not wall-clock time. */
  sequence: number;
  buttons: Readonly<Record<string, boolean>>;
  /** Normalized device axes in [-1, 1]. */
  axes: Readonly<Record<string, number>>;
}
export interface InputDiagnosticSnapshot {
  profileId: string;
  sampleSequence: number;
  rawButtons: Readonly<Record<string, boolean>>;
  rawAxes: Readonly<Record<string, number>>;
  pendingPressed: Readonly<Record<Exclude<SemanticButton, 'shield'>, boolean>>;
  semanticAxes: Readonly<Record<SemanticAxis, number>>;
  shieldHeld: boolean;
}

const EDGE_BUTTONS = ['jump', 'attack', 'special', 'grab', 'dodge'] as const;

function clamp(value: number, min: number, max: number): number { return Math.max(min, Math.min(max, value)); }
function validateProfile(profile: InputProfile): void {
  if (!profile.id) throw new Error('input profile id must be non-empty');
  for (const semantic of ['jump', 'attack', 'special', 'grab', 'dodge', 'shield'] as const) {
    if (!Array.isArray(profile.buttons[semantic])) throw new Error(`input profile missing ${semantic} buttons`);
  }
  for (const semantic of ['moveX', 'moveY', 'smashX', 'smashY'] as const) {
    const binding = profile.axes[semantic];
    if (!binding?.physicalAxis) throw new Error(`input profile missing ${semantic} axis`);
    const deadzone = binding.deadzone ?? 0.15;
    if (!(deadzone >= 0 && deadzone < 1)) throw new Error(`${semantic} deadzone must be in [0,1)`);
  }
}

export function quantizeAxis(rawInput: number, binding: AxisBinding): number {
  if (!Number.isFinite(rawInput)) return 0;
  const raw = clamp(binding.invert ? -rawInput : rawInput, -1, 1);
  const deadzone = binding.deadzone ?? 0.15;
  const magnitude = Math.abs(raw);
  if (magnitude <= deadzone) return 0;
  const normalized = (magnitude - deadzone) / (1 - deadzone);
  return clamp(Math.round(normalized * 1000) * Math.sign(raw), -1000, 1000);
}

function anyPressed(sample: RawInputSample, ids: readonly string[]): boolean {
  return ids.some((id) => sample.buttons[id] === true);
}

/**
 * Receives device samples at any rate and emits one semantic input frame at the
 * deterministic sim boundary. Edge buttons are accumulated between frame emits;
 * axes/held shield use the newest sample. No wall clock enters simulation.
 */
export class SemanticInputSampler {
  private profile: InputProfile;
  private latest: RawInputSample = { sequence: -1, buttons: {}, axes: {} };
  private previousHeld: Record<SemanticButton, boolean> = { jump: false, attack: false, special: false, grab: false, dodge: false, shield: false };
  private pendingPressed: Record<(typeof EDGE_BUTTONS)[number], boolean> = { jump: false, attack: false, special: false, grab: false, dodge: false };

  constructor(profile: InputProfile) { validateProfile(profile); this.profile = structuredClone(profile); }
  setProfile(profile: InputProfile): void { validateProfile(profile); this.profile = structuredClone(profile); }
  get profileId(): string { return this.profile.id; }

  sample(sample: RawInputSample): void {
    if (!Number.isInteger(sample.sequence) || sample.sequence <= this.latest.sequence) throw new Error(`input sample sequence must increase (${sample.sequence} <= ${this.latest.sequence})`);
    for (const value of Object.values(sample.axes)) if (!Number.isFinite(value) || value < -1 || value > 1) throw new Error(`raw input axis must be finite in [-1,1], got ${value}`);
    for (const semantic of EDGE_BUTTONS) {
      const held = anyPressed(sample, this.profile.buttons[semantic]);
      if (held && !this.previousHeld[semantic]) this.pendingPressed[semantic] = true;
      this.previousHeld[semantic] = held;
    }
    this.previousHeld.shield = anyPressed(sample, this.profile.buttons.shield);
    this.latest = { sequence: sample.sequence, buttons: { ...sample.buttons }, axes: { ...sample.axes } };
  }

  emitFrame(frame: number): SimInputFrame {
    if (!Number.isInteger(frame) || frame < 0) throw new Error(`semantic input frame must be non-negative integer, got ${frame}`);
    const semanticAxes = this.semanticAxes();
    const output: SimInputFrame = {
      frame,
      moveX: semanticAxes.moveX,
      moveY: semanticAxes.moveY,
      jumpPressed: this.pendingPressed.jump,
      jumpHeld: this.previousHeld.jump,
      attackPressed: this.pendingPressed.attack,
      specialPressed: this.pendingPressed.special,
      grabPressed: this.pendingPressed.grab,
      smashX: semanticAxes.smashX,
      smashY: semanticAxes.smashY,
      dodgePressed: this.pendingPressed.dodge,
      shieldHeld: this.previousHeld.shield,
    };
    for (const semantic of EDGE_BUTTONS) this.pendingPressed[semantic] = false;
    return output;
  }

  diagnostics(): InputDiagnosticSnapshot {
    return {
      profileId: this.profile.id,
      sampleSequence: this.latest.sequence,
      rawButtons: { ...this.latest.buttons },
      rawAxes: { ...this.latest.axes },
      pendingPressed: { ...this.pendingPressed },
      semanticAxes: this.semanticAxes(),
      shieldHeld: this.previousHeld.shield,
    };
  }

  private semanticAxes(): Record<SemanticAxis, number> {
    return {
      moveX: quantizeAxis(this.latest.axes[this.profile.axes.moveX.physicalAxis] ?? 0, this.profile.axes.moveX),
      moveY: quantizeAxis(this.latest.axes[this.profile.axes.moveY.physicalAxis] ?? 0, this.profile.axes.moveY),
      smashX: quantizeAxis(this.latest.axes[this.profile.axes.smashX.physicalAxis] ?? 0, this.profile.axes.smashX),
      smashY: quantizeAxis(this.latest.axes[this.profile.axes.smashY.physicalAxis] ?? 0, this.profile.axes.smashY),
    };
  }
}

export function remapButton(profile: InputProfile, semantic: SemanticButton, physicalIds: readonly string[]): InputProfile {
  return { ...structuredClone(profile), buttons: { ...profile.buttons, [semantic]: [...new Set(physicalIds)] } };
}
export function remapAxis(profile: InputProfile, semantic: SemanticAxis, binding: AxisBinding): InputProfile {
  return { ...structuredClone(profile), axes: { ...profile.axes, [semantic]: { ...binding } } };
}
