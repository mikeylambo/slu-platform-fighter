import { SPECIALS } from '../../../content/knight/specials.js';
import { afterimage, setAttack, type Actor } from '../state.js';

const S = SPECIALS.stoop;

/** Wings down special: a diving plunge. Static leaves a decoy Knight behind. */
export function startStoop(actor: Actor): void {
  const { k, p, effects } = actor;
  setAttack(p, 'stoop');
  p.vy = S.dive;
  if (effects.stoopDecoy) {
    k.ghost = afterimage(p, k.lastMove);
  }
}

/** Holding Jump late in the dive cancels into a glide. */
export function stepStoop(actor: Actor, attackFrame: number): void {
  const { p, raw } = actor;
  if (attackFrame < S.glideCancel || !raw.jumpHeld) {
    return;
  }
  p.attack = null;
  p.jumpsRemaining = 0;
  p.vy = S.glideVelocity;
}
