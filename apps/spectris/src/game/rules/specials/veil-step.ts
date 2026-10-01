import { fixed as f, type Fixed } from '../../../../../../packages/deterministic-math/src/fixed.js';
import { SPECIALS } from '../../../content/knight/specials.js';
import { DUEL } from '../../../content/rules/duel.js';
import { afterimage, setAttack, type Actor } from '../state.js';

const V = SPECIALS.veil;

/** Cape side special: phase forward through the opponent. */
export function startVeilStep(actor: Actor): void {
  setAttack(actor.p, 'veil');
}

/** Intangible phase; Static leaves an attacking afterimage on the last phase frame. */
export function stepVeilStep(actor: Actor, attackFrame: number): void {
  const { k, p, effects } = actor;
  if (attackFrame < V.from || attackFrame > V.until) {
    return;
  }
  p.invulnerableFrames = DUEL.sustain;
  p.x = f.add(p.x, (V.speed * p.facing) as Fixed);
  if (effects.veilEcho && attackFrame === V.until) {
    k.ghost = afterimage(p, 'cape:veil-cut', true);
  }
}
