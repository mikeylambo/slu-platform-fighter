/**
 * Life systems: how a fighter loses a life and what a life costs.
 *
 * `LifeSystem` is the generic contract. `StrainFractures` is the Spectris
 * implementation: Strain behaves like percent, and a life (Fracture) is lost to
 * a blast zone or to a Shatter-class hit landed at or above a Strain threshold.
 */

export interface LifeRules {
  lives: number;
  threshold: number;
}

export interface LifeLossContext {
  /** Damage (Strain) the target had before the hit. */
  damage: number;
  /** The hit belongs to the lethal class (Shatter). */
  lethal: boolean;
  /** The target crossed a blast zone. */
  outside: boolean;
}

export interface LifeTaken {
  remaining: number;
  eliminated: boolean;
}

export interface RespawnState {
  damage: number;
  intangibleFrames: number;
  respawnFrames: number;
}

export interface LifeSystem {
  readonly id: string;
  readonly lives: number;
  /** True when this context costs a life. */
  losesLife(context: LifeLossContext): boolean;
  /** Removes one life. */
  takeLife(remaining: number): LifeTaken;
  /** True when the round is lost with this many lives left. */
  roundLost(remaining: number): boolean;
  /** State a fighter returns with after losing a life. */
  respawn(): RespawnState;
  /** Readable damage tier (for crack/visual tiers); 0 = pristine. */
  damageTier(damage: number): number;
  /** Clamps damage into the legal range. */
  clampDamage(damage: number): number;
}

export interface StrainFractureRules extends LifeRules {
  /** Ascending Strain values at which a new crack tier appears. */
  crackTiers: readonly number[];
  maxStrain: number;
  respawnFrames: number;
  respawnIntangibility: number;
}

/** Back-compatible predicate used by the Spectris duel. */
export function losesLife(strain: number, shatter: boolean, outside: boolean, rules: LifeRules): boolean {
  return outside || (shatter && strain >= rules.threshold);
}

export function takeLife(remaining: number): LifeTaken {
  return { remaining: Math.max(0, remaining - 1), eliminated: remaining <= 1 };
}

export class StrainFractures implements LifeSystem {
  readonly id = 'strain-fractures';

  constructor(private readonly rules: StrainFractureRules) {}

  get lives(): number {
    return this.rules.lives;
  }

  get threshold(): number {
    return this.rules.threshold;
  }

  losesLife(context: LifeLossContext): boolean {
    return losesLife(context.damage, context.lethal, context.outside, this.rules);
  }

  takeLife(remaining: number): LifeTaken {
    return takeLife(remaining);
  }

  roundLost(remaining: number): boolean {
    return remaining <= 0;
  }

  respawn(): RespawnState {
    return {
      damage: 0,
      intangibleFrames: this.rules.respawnIntangibility,
      respawnFrames: this.rules.respawnFrames,
    };
  }

  damageTier(damage: number): number {
    return this.rules.crackTiers.filter((tier) => damage >= tier).length;
  }

  clampDamage(damage: number): number {
    return Math.max(0, Math.min(this.rules.maxStrain, damage));
  }
}
