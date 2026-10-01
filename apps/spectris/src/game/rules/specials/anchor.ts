import type { FighterState } from '../../../../../../packages/sim/src/types.js';
import { SPECIALS } from '../../../content/knight/specials.js';
import { startRiposte } from '../defense.js';
import { setAttack, type Actor } from '../state.js';

const A = SPECIALS.anchor;

/** Cape down special: plant the sword (Iron: wider), plunge in the air, or Stillness Riposte. */
export function startAnchor(actor: Actor): void {
  const { p, effects } = actor;
  if (effects.riposte) {
    startRiposte(actor);
    return;
  }
  setAttack(p, p.grounded ? effects.anchorMove : 'anchor-air');
}

/** The aerial plunge drives down and converts to the grounded shockwave on touchdown. */
export function stepAnchorPlunge(actor: Actor): void {
  const { p, effects } = actor;
  p.vy = A.plunge;
  if (p.grounded) {
    setAttack(p, effects.anchorMove);
    p.landingLagFrames = 0;
  }
}

/** After PF movement: a plunge that just landed becomes the grounded Anchor with no landing lag. */
export function landAnchorPlunge(p: FighterState, old: FighterState, anchorMove: string): void {
  if (old.attack?.attackId.endsWith(':anchor-air') && p.grounded && !old.grounded) {
    setAttack(p, anchorMove);
    p.landingLagFrames = 0;
  }
}

/** Grounded Anchor is armored through its early frames (hitstun ignored). */
export const anchorArmors = (key: string, attackFrame: number): boolean =>
  key === 'anchor' && attackFrame < A.armorUntil;

/** Any Anchor variant absorbs hits during its armored frames. */
export const anchorAbsorbs = (key: string | undefined, attackFrame: number): boolean =>
  !!key?.startsWith('anchor') && attackFrame < A.armorUntil;
