/**
 * CPU levels 1–9 (GDD 9): reaction delay 30f → 6f, option breadth, DI quality, tech rate,
 * and decision noise. Level index 0 is unused (0 = human).
 */
import type { OptionId } from './options.js';

export interface LevelSpec {
  reaction: number;
  /** Probability of choosing correct survival DI while launched. */
  di: number;
  /** Probability of teching a knockdown. */
  tech: number;
  /** Random utility jitter added to every option (0 = perfect). */
  noise: number;
  /** Options this level does not know yet. */
  locked: OptionId[];
  /** Chance per decision of idling instead of acting (hesitation). */
  hesitation: number;
}

const ADVANCED: OptionId[] = ['feint', 'kindle', 'edgeguard', 'stance'];
const INTERMEDIATE: OptionId[] = ['forward-smash', 'up-smash', 'down-smash', 'down-special', 'neutral-special'];

function level(n: number): LevelSpec {
  const t = (n - 1) / 8;
  return {
    reaction: Math.round(30 - t * 24),
    di: 0.15 + t * 0.8,
    tech: 0.05 + t * 0.85,
    noise: 0.5 - t * 0.44,
    locked: n <= 2 ? [...ADVANCED, ...INTERMEDIATE] : n <= 4 ? ADVANCED : n <= 6 ? ['kindle', 'feint'] : [],
    hesitation: 0.45 - t * 0.43,
  };
}

export const LEVELS: LevelSpec[] = Array.from({ length: 10 }, (_, n) => level(Math.max(1, n)));

/** Memory sizes and adaptation rates. */
export const MIND = {
  /** Opponent snapshots kept (covers the slowest reaction delay). */
  history: 31,
  decision: 4,
  /** Unsworn: boost per counter at full opponent preference. */
  adaptBoost: 2.4,
  /** Opponent samples needed before Unsworn adapts. */
  adaptAfter: 6,
};
