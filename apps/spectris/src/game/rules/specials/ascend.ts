import type { FighterState } from '../../../../../../packages/sim/src/types.js';
import { SPECIALS } from '../../../content/knight/specials.js';
import { setAttack, type Actor } from '../state.js';

/** Wings up special: a wing burst with a rising arc strike. */
export function startAscend(actor: Actor): void {
  const { p, effects } = actor;
  setAttack(p, 'ascend');
  p.grounded = false;
  p.groundSurfaceId = null;
  p.vy = SPECIALS.ascend.launch;
  if (effects.ascendIntangible) {
    p.invulnerableFrames = effects.ascendIntangible;
  }
}

/** Ascend ends in helplessness unless the Oath says otherwise. */
export function ascendLeavesHelpless(old: FighterState, ascendHelpless: boolean): boolean {
  return ascendHelpless && !!old.attack?.attackId.endsWith(':ascend');
}
