import { fixed as f, type Fixed } from '../../../../../../packages/deterministic-math/src/fixed.js';
import { SPECIALS } from '../../../content/knight/specials.js';
import { setAttack, type Actor } from '../state.js';

const G = SPECIALS.gale;

/** Wings side special: a horizontal dash cut, limited uses per airtime (Ember chains twice). */
export function tryGaleLunge(actor: Actor): boolean {
  const { k, p, effects } = actor;
  if (k.sideUses >= effects.galeLungeUses) {
    return false;
  }
  setAttack(p, 'gale');
  k.sideUses++;
  return true;
}

export function stepGaleLunge(actor: Actor, attackFrame: number): void {
  const { p } = actor;
  if (attackFrame >= G.from && attackFrame < G.until && p.hitlagFrames === 0) {
    p.x = f.add(p.x, (G.speed * p.facing) as Fixed);
  }
}
