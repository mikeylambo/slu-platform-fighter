import { canGainMeter } from '../../../../../packages/soulfire/src/soulfire.js';
import { DUEL } from '../../content/rules/duel.js';
import { KINDLE } from '../../content/rules/oaths.js';
import type { DuelKnight } from './state.js';

const M = DUEL.meter;

/** Adds (or removes) meter, clamped to the bar. Kindled Knights gain nothing. */
export function gain(k: DuelKnight, amount: number): void {
  if (!canGainMeter(KINDLE, k.soul)) {
    return;
  }
  k.meter = Math.max(0, Math.min(M.max, k.meter + amount));
}

/** Moves up to `amount` meter from `from` to `to` (Siphon). The thief still obeys `gain`. */
export function siphon(from: DuelKnight, to: DuelKnight, amount: number): void {
  const taken = Math.min(from.meter, amount);
  from.meter -= taken;
  gain(to, taken);
}

/** Meter for landing and taking a hit, scaled by damage in Strain tenths. */
export function hitMeter(attacker: DuelKnight, target: DuelKnight, damage: number): void {
  gain(attacker, damage * M.hit);
  gain(target, damage * M.taken);
}

/** Spends meter if available. Returns false (spending nothing) when short. */
export function spend(k: DuelKnight, cost: number): boolean {
  if (k.meter < cost) {
    return false;
  }
  k.meter -= cost;
  return true;
}
