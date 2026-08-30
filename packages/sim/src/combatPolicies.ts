import type { Fixed } from '../../deterministic-math/src/fixed.js';

export interface ArmorPolicy {
  /** Maximum incoming launch magnitude ignored while armor is active. Null means super armor. */
  launchThreshold: Fixed | null;
  /** Damage is still applied when armor absorbs launch. */
  retainDamage: boolean;
}

export interface ParryPolicy {
  enabled: boolean;
  perfectWindowFrames: number;
  attackerFreezeFrames: number;
  defenderAdvantageFrames: number;
  shieldHealthCost: number;
}

export interface CancelWindowPolicy {
  /** Semantic actions permitted during the authored window, e.g. jump, attack, special, dodge. */
  allowedActions: readonly string[];
  /** Whether hit confirmation is required for this cancel window. */
  requireHitConfirm: boolean;
  /** Whether shield/block confirmation qualifies alongside a hit. */
  allowBlockConfirm: boolean;
}

export interface CombatModifierPolicy {
  staleMove?: { enabled: boolean; queueSize: number; multipliersPermille: readonly number[] };
  comeback?: { enabled: boolean; maxBonusPermille: number; startPercentTenths: number; fullPercentTenths: number };
}

export function validateArmorPolicy(policy: ArmorPolicy): void {
  if (policy.launchThreshold !== null && (!Number.isInteger(policy.launchThreshold) || policy.launchThreshold < 0)) throw new Error('armor launchThreshold must be nonnegative fixed integer or null');
}
export function validateParryPolicy(policy: ParryPolicy): void {
  for (const [name, value] of Object.entries({ perfectWindowFrames: policy.perfectWindowFrames, attackerFreezeFrames: policy.attackerFreezeFrames, defenderAdvantageFrames: policy.defenderAdvantageFrames, shieldHealthCost: policy.shieldHealthCost })) {
    if (!Number.isInteger(value) || value < 0) throw new Error(`parry ${name} must be nonnegative integer`);
  }
}
export function validateCancelWindowPolicy(policy: CancelWindowPolicy): void {
  if (policy.allowedActions.length === 0 || new Set(policy.allowedActions).size !== policy.allowedActions.length || policy.allowedActions.some((value) => !value)) throw new Error('cancel window allowedActions must be unique/non-empty');
}
export function validateCombatModifierPolicy(policy: CombatModifierPolicy): void {
  const stale = policy.staleMove;
  if (stale) {
    if (!Number.isInteger(stale.queueSize) || stale.queueSize < 1) throw new Error('stale queueSize must be positive integer');
    if (stale.multipliersPermille.length !== stale.queueSize || stale.multipliersPermille.some((v) => !Number.isInteger(v) || v < 0)) throw new Error('stale multipliers must match queue size and be nonnegative integer permille');
  }
  const comeback = policy.comeback;
  if (comeback && (!Number.isInteger(comeback.maxBonusPermille) || comeback.maxBonusPermille < 0 || !Number.isInteger(comeback.startPercentTenths) || !Number.isInteger(comeback.fullPercentTenths) || comeback.startPercentTenths < 0 || comeback.fullPercentTenths <= comeback.startPercentTenths)) throw new Error('invalid comeback policy');
}
