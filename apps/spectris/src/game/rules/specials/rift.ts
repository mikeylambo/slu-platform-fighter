import { fixed as f } from '../../../../../../packages/deterministic-math/src/fixed.js';
import type { FighterState } from '../../../../../../packages/sim/src/types.js';
import { SPECIALS } from '../../../content/knight/specials.js';
import { setAttack, type Actor } from '../state.js';

const R = SPECIALS.rift;

/** Cape up special: an eight-way teleport, limited uses per airtime (Gale: twice). */
export function tryRift(actor: Actor): boolean {
  const { k, p, effects } = actor;
  if (k.riftUses >= effects.riftUses) {
    return false;
  }
  setAttack(p, 'rift');
  k.riftUses++;
  return true;
}

/** Teleports on the Rift frame along the aim chosen at input time. */
export function stepRift(actor: Actor, attackFrame: number): void {
  const { k, p } = actor;
  if (attackFrame !== R.teleport) {
    return;
  }
  const [dx, dy] = k.aim;
  const distance = dx && dy ? R.diagonal : R.straight;
  p.x = f.add(p.x, f.fromRatio(dx * distance, R.distanceDivisor));
  p.y = f.add(p.y, f.fromRatio(dy * distance, R.distanceDivisor));
  p.grounded = false;
  p.groundSurfaceId = null;
  p.invulnerableFrames = R.intangible;
}

/** Rift (and its emerge cut) leaves the Knight helpless unless the cut lands. */
export function riftLeavesHelpless(old: FighterState): boolean {
  const id = old.attack?.attackId ?? '';
  return id.endsWith(':rift') || id.endsWith(':rift-cut');
}
