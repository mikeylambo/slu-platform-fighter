import type { Fixed } from '../../deterministic-math/src/fixed.js';

export interface SimInputFrame {
  frame: number;
  moveX: -1 | 0 | 1;
  jumpPressed: boolean;
}

export interface FighterState {
  id: string;
  x: Fixed;
  y: Fixed;
  vx: Fixed;
  vy: Fixed;
  grounded: boolean;
}

export interface WorldState {
  frame: number;
  seed: number;
  fighters: FighterState[];
}

export interface WorldSnapshot {
  state: WorldState;
}
