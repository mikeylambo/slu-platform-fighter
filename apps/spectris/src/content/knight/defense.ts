import { fixed as f } from '../../../../../packages/deterministic-math/src/fixed.js';

export type EvadeKind = 'spot' | 'roll' | 'air';

/**
 * Wings evades (GDD 3.7). `intangibleFrom`/`intangibleTo` are elapsed-frame indices on
 * which the rules re-apply intangibility; PF consumes it on the following step, so the
 * Knight is intangible one frame later (spot 3–16, roll 4–17, air 3–20 as authored).
 */
export interface EvadeSpec {
  frames: number;
  intangibleFrom: number;
  intangibleTo: number;
  travels: boolean;
}

export const EVADES: Record<EvadeKind, EvadeSpec> = {
  spot: { frames: 22, intangibleFrom: 2, intangibleTo: 15, travels: false },
  roll: { frames: 28, intangibleFrom: 3, intangibleTo: 16, travels: true },
  air: { frames: 30, intangibleFrom: 2, intangibleTo: 19, travels: true },
};

export const EVADE = {
  /** Horizontal travel per frame for rolls and air dodges. */
  travel: f.fromRatio(2, 5),
  /** Air dodge vertical velocity per stick unit (velocity = moveY / divisor). */
  airLiftDivisor: 2000,
  /** Stick deflection that turns a spot dodge into a roll. */
  rollThreshold: 400,
} as const;
