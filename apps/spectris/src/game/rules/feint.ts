import { fixed as f } from '../../../../../packages/deterministic-math/src/fixed.js';
import type { MatchEvent } from '../../../../../packages/sim/src/match.js';
import type { FighterState, WorldState } from '../../../../../packages/sim/src/types.js';
import { DUEL } from '../../content/rules/duel.js';
import { AUX } from '../../content/rules/input.js';
import { MOVES } from '../../content/knight/moves/index.js';
import { directHit } from './direct-hit.js';
import { kindleFeintCost } from './kindle.js';
import { afterimage, emit, freeze, type Actor, type DuelKnight } from './state.js';

const F = DUEL.feint;

/** Attack + Special: throw out an afterimage of the last attack (tap) — hold to make it real. */
export function tryFeint(actor: Actor): boolean {
  const { raw, k, p, oath, frame } = actor;
  if (!raw.specialPressed || !raw.attackPressed) {
    return false;
  }
  const cost = kindleFeintCost(k, oath);
  if (k.meter < cost) {
    return false;
  }
  k.meter -= cost;
  k.feint = 1;
  k.feintCommitted = false;
  k.ghost = afterimage(p, k.lastMove);
  k.lock = F.tap;
  freeze(frame, p);
  emit(frame.d, 'feint', p);
  return true;
}

/** Holding Attack + Special past the commit frame turns the ghost into a real, slower hit. */
export function stepFeint(actor: Actor): void {
  const { k, raw, heldSpecial } = actor;
  if (!k.feint) {
    return;
  }
  k.feint++;
  const holding = heldSpecial && !!((raw.auxiliaryButtons ?? 0) & AUX.attackHeld);
  if (holding && k.feint >= F.commit && !k.feintCommitted) {
    k.feintCommitted = true;
    k.lock = F.hold - k.feint;
    if (k.ghost) {
      k.ghost.real = true;
    }
  }
  if (k.feint >= F.hold) {
    k.feint = 0;
  }
}

/** Ages an afterimage; a real ghost strikes once at 50% Strain when the opponent is in reach. */
export function stepGhost(w: WorldState, p: FighterState, t: FighterState, k: DuelKnight, events: MatchEvent[]): void {
  const ghost = k.ghost;
  if (!ghost) {
    return;
  }
  ghost.age++;
  const inReach =
    Math.abs(ghost.x - t.x) < f.fromInt(F.ghostReach) && Math.abs(ghost.y - t.y) < f.fromInt(F.ghostHeight);
  if (ghost.real && !ghost.hit && ghost.age >= F.ghostDelay && inReach) {
    const strain = MOVES.get(ghost.move)?.strikes[0]?.strain ?? F.fallbackStrain;
    const source = { ...p, x: ghost.x, y: ghost.y, facing: ghost.facing };
    const hit = directHit(w, source, t, {
      damage: Math.round(strain * F.ghostDamage),
      direction: F.ghostDirection,
    });
    if (hit) {
      events.push(hit);
      ghost.hit = true;
    }
  }
  if (ghost.age >= F.ghostLife) {
    k.ghost = null;
  }
}
