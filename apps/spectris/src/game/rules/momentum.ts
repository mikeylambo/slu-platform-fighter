import { fixed as f } from '../../../../../packages/deterministic-math/src/fixed.js';
import type { WorldState, FighterState } from '../../../../../packages/sim/src/types.js';
import { DUEL } from '../../content/rules/duel.js';
import { emit, type DuelState } from './state.js';

const M = DUEL.momentum;

/**
 * Momentum (Pilgrimage): each Fracture earns right of way for the other Knight. Reaching
 * the final screen wins; otherwise both respawn with the winner pushed forward.
 */
export function stepMomentumFracture(w: WorldState, d: DuelState, p: FighterState, ids: readonly string[]): void {
  if (d.options.format !== 'momentum') {
    return;
  }
  d.progress += p.id === ids[1] ? 1 : -1;
  if (Math.abs(d.progress) >= M.screens) {
    d.phase = 'over';
    d.winner = d.progress > 0 ? ids[0]! : ids[1]!;
    return;
  }
  p.eliminated = false;
  p.stocks = d.options.lives;
  w.winnerId = null;
  const direction = p.id === ids[1] ? 1 : -1;
  for (const fighter of w.fighters) {
    fighter.x = f.fromInt((fighter.id === p.id ? 1 : -1) * direction * M.respawnX);
    fighter.y = f.fromInt(M.respawnY);
    fighter.grounded = false;
    fighter.groundSurfaceId = null;
    fighter.vx = f.zero;
    fighter.vy = f.zero;
    fighter.attack = null;
  }
  emit(d, 'pilgrimage', p);
}
