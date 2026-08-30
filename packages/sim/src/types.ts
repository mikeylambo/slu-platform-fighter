import type { Fixed } from '../../deterministic-math/src/fixed.js';

export type LocomotionState =
  | 'idle' | 'walk' | 'dash' | 'run' | 'turn' | 'crouch' | 'jump-squat' | 'airborne' | 'landing'
  | 'ledge-hang' | 'air-dodge' | 'spot-dodge' | 'roll' | 'tech-in-place' | 'tech-roll' | 'knockdown';

export interface SimInputFrame {
  frame: number;
  /** Quantized analogue horizontal axis in [-1000, 1000]. */
  moveX: number;
  /** Quantized analogue vertical axis in [-1000, 1000]. */
  moveY: number;
  jumpPressed: boolean;
  jumpHeld: boolean;
  /** Movement-only adapters may omit this; combat adapters must provide it explicitly. */
  attackPressed?: boolean;
  dodgePressed: boolean;
  shieldHeld: boolean;
}

export interface StageSurface { id: string; kind: 'solid' | 'one-way'; y: Fixed; xMin: Fixed; xMax: Fixed; }
export interface StageLedge { id: string; x: Fixed; y: Fixed; /** Direction toward the stage interior. */ inward: -1 | 1; }
export interface FighterAttackState { attackId: string; frame: number; hitTargets: string[]; }

export interface FighterState {
  id: string;
  x: Fixed;
  y: Fixed;
  vx: Fixed;
  vy: Fixed;
  grounded: boolean;
  groundSurfaceId: string | null;
  facing: -1 | 1;
  locomotion: LocomotionState;
  locomotionFrame: number;
  jumpsRemaining: number;
  fastFalling: boolean;
  dropThroughFrames: number;
  jumpBufferFrames: number;
  inputHistory: SimInputFrame[];
  ledgeId: string | null;
  ledgeRegrabLockoutFrames: number;
  invulnerableFrames: number;
  dodgeCooldownFrames: number;
  techBufferFrames: number;
  /** Damage percent stored in tenths: 35 = 3.5%. */
  percentTenths: number;
  hitlagFrames: number;
  hitstunFrames: number;
  attack: FighterAttackState | null;
}

export interface WorldState {
  frame: number;
  seed: number;
  fighters: FighterState[];
  surfaces: StageSurface[];
  ledges: StageLedge[];
}

export interface WorldSnapshot { state: WorldState; }
