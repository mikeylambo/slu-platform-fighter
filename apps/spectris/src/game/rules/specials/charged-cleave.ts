import { SPECIALS } from '../../../content/knight/specials.js';
import { DUEL } from '../../../content/rules/duel.js';
import { freeze, setAttack, type Actor } from '../state.js';

/** Cape neutral special: begin holding a Charged Cleave. */
export function startCleaveCharge(actor: Actor): void {
  actor.k.charging = true;
  actor.k.charge = 0;
}

/** Charges while Special is held; releases into the matching tier, or the full Shatter cleave. */
export function stepCleaveCharge(actor: Actor): void {
  const { k, p, effects, heldSpecial, frame } = actor;
  if (!k.charging) {
    return;
  }
  freeze(frame, p);
  k.charge = Math.min(DUEL.special.charge, k.charge + effects.cleaveChargeRate);
  const full = k.charge === DUEL.special.charge;
  if (heldSpecial && !full) {
    return;
  }
  setAttack(p, full ? 'cleave-full' : `cleave-${Math.floor(k.charge / SPECIALS.cleave.tierFrames)}`);
  k.charging = false;
}

/** Full charge absorbs hits up to the armor threshold. */
export const cleaveArmors = (key: string): boolean => key === 'cleave-full';

export const cleaveAbsorbs = (key: string | undefined, damage: number): boolean =>
  key === 'cleave-full' && damage <= SPECIALS.cleave.armor;
