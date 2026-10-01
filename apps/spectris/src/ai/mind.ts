/**
 * CPU memory. Lives inside the duel state so replays, rollback and online play see the
 * same AI decisions. Opponent snapshots are compact tuples to keep serialization cheap.
 */
import type { SimInputFrame } from '../../../../packages/sim/src/types.js';
import { neutral } from '../game/session.js';

/** [x, y, vy, attackId, attackFrame, flags] — Fixed values stored raw. */
export type Snapshot = [number, number, number, string, number, number];

export const FLAG = {
  grounded: 1,
  guarding: 2,
  grabbing: 4,
  hitstun: 8,
  offstage: 16,
  evading: 32,
  landingLag: 64,
  helpless: 128,
  holding: 256,
} as const;

export interface PlanStep {
  frames: number;
  input: Partial<SimInputFrame>;
}

export interface Mind {
  history: Snapshot[];
  plan: PlanStep[];
  option: string;
  /** Last input sent (held between decisions). */
  input: SimInputFrame;
  /** This CPU's option usage (histograms). */
  used: Record<string, number>;
  /** Opponent option categories observed (Unsworn adaptation). */
  seen: Record<string, number>;
  /** Opponent's last attack id, to count each attack once. */
  lastSeen: string;
}

export const emptyMind = (): Mind => ({
  history: [],
  plan: [],
  option: 'wait',
  input: neutral(0),
  used: {},
  seen: {},
  lastSeen: '',
});

/** Keeps long-term statistics across Fractures and rounds; clears the moment-to-moment plan. */
export const carryMind = (mind: Mind): Mind => ({ ...emptyMind(), used: mind.used, seen: mind.seen });
