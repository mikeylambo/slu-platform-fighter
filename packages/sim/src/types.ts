import type { Fixed } from '../../deterministic-math/src/fixed.js';

export type LocomotionState =
  | 'idle'
  | 'walk'
  | 'dash'
  | 'run'
  | 'turn'
  | 'crouch'
  | 'jump-squat'
  | 'airborne'
  | 'landing';

export interface SimInputFrame {
  frame: number;
  /** Quantized analogue horizontal axis in [-1000, 1000]. */
  moveX: number;
  /** Quantized analogue vertical axis in [-1000, 1000]. */
  moveY: number;
  jumpPressed: boolean;
  jumpHeld: boolean;
}

export interface StageSurface {
  id: string;
  kind: 'solid' | 'one-way';
  y: Fixed;
  xMin: Fixed;
  xMax: Fixed;
}

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
}

export interface WorldState {
  frame: number;
  seed: number;
  fighters: FighterState[];
  surfaces: StageSurface[];
}

export interface WorldSnapshot {
  state: WorldState;
}
