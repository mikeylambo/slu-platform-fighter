import { fixed as f, type Fixed } from '../../../../../packages/deterministic-math/src/fixed.js';
import type { StockMatchRules } from '../../../../../packages/sim/src/lifecycle.js';
import type { FighterState, WorldState } from '../../../../../packages/sim/src/types.js';
import { PILGRIMAGE, screenCentre } from '../../content/stages/pilgrimage.js';
import { emit, type DuelState } from './state.js';

const P = PILGRIMAGE;
const FINAL = P.finalScreen;
const HALF_SCREEN = P.halfScreen;

/** Player 1 marches right (+1), Player 2 left (-1). */
const goalOf = (id: string, ids: readonly string[]): 1 | -1 => (id === ids[0] ? 1 : -1);

const isMomentum = (d: DuelState): boolean => d.options.format === 'momentum';

/** Puts a Knight back in play ahead of the right-of-way holder, airborne. */
function placeAhead(victim: FighterState, holder: FighterState, goal: 1 | -1, d: DuelState): void {
  const limit = (FINAL + 1) * P.screenWidth - HALF_SCREEN;
  const x = Math.max(-limit, Math.min(limit, f.toNumber(holder.x) + goal * P.respawnAhead));
  const centre = screenCentre(d.progress);
  const clamped = Math.max(centre - HALF_SCREEN, Math.min(centre + HALF_SCREEN, x));
  victim.x = f.fromRatio(Math.round(clamped * P.precision), P.precision);
  victim.y = f.fromInt(P.respawnHeight);
  victim.vx = f.zero;
  victim.vy = f.zero;
  victim.grounded = false;
  victim.groundSurfaceId = null;
  victim.attack = null;
}

/**
 * A Fracture in Momentum hands right of way to the other Knight; the victim is revived and
 * respawns ahead of them (GDD 4, Nidhogg rules). Lives never run out in Momentum.
 */
export function stepMomentumFracture(w: WorldState, d: DuelState, p: FighterState, ids: readonly string[]): void {
  if (!isMomentum(d)) {
    return;
  }
  const holder = w.fighters.find((fighter) => fighter.id !== p.id)!;
  d.rightOfWay = holder.id;
  p.eliminated = false;
  p.stocks = d.options.lives;
  w.winnerId = null;
  placeAhead(p, holder, goalOf(holder.id, ids), d);
  emit(d, 'pilgrimage', holder);
}

/**
 * The holder pushes the camera: crossing the screen edge in their goal direction scrolls one
 * screen; a Knight left behind respawns ahead. Crossing the final screen's goal line wins.
 */
export function stepMomentumScroll(w: WorldState, d: DuelState, ids: readonly string[]): void {
  if (!isMomentum(d) || !d.rightOfWay || d.phase !== 'fight') {
    return;
  }
  const holder = w.fighters.find((fighter) => fighter.id === d.rightOfWay)!;
  const other = w.fighters.find((fighter) => fighter.id !== d.rightOfWay)!;
  if (holder.respawnFrames > 0) {
    return;
  }
  const goal = goalOf(holder.id, ids);
  const x = f.toNumber(holder.x) * goal;
  const centre = screenCentre(d.progress) * goal;
  if (d.progress * goal === FINAL) {
    if (x >= centre + HALF_SCREEN - P.goalInset) {
      d.phase = 'over';
      d.winner = holder.id;
      emit(d, 'pilgrimage-goal', holder);
    }
    return;
  }
  if (x <= centre + HALF_SCREEN) {
    return;
  }
  d.progress += goal;
  emit(d, 'pilgrimage-scroll', holder);
  const behind = f.toNumber(other.x) * goal < screenCentre(d.progress) * goal - HALF_SCREEN;
  if (behind) {
    placeAhead(other, holder, goal, d);
  }
}

/** Blast zones follow the current screen. */
export function momentumBlast(d: DuelState, rules: StockMatchRules): StockMatchRules {
  if (!isMomentum(d)) {
    return rules;
  }
  const centre = screenCentre(d.progress);
  const at = (value: number): Fixed => f.fromRatio(Math.round(value * P.precision), P.precision);
  return {
    ...rules,
    blastLeft: at(centre - P.blast.side),
    blastRight: at(centre + P.blast.side),
    blastTop: f.fromInt(P.blast.top),
    blastBottom: f.fromInt(-P.blast.bottom),
  };
}
