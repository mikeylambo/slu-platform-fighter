import { fixed as f, type Fixed } from '../../../../../../packages/deterministic-math/src/fixed.js';
import type { MatchEvent } from '../../../../../../packages/sim/src/match.js';
import type { FighterState, WorldState } from '../../../../../../packages/sim/src/types.js';
import { SPECIALS } from '../../../content/knight/specials.js';
import type { OathEffects } from '../../../content/rules/oaths.js';
import { directHit } from '../direct-hit.js';
import { siphon } from '../meter.js';
import { emit, setAttack, type Actor, type DuelKnight, type DuelState } from '../state.js';

const S = SPECIALS.sling;

/** Wings neutral special: throw the sword, or recall it early if it is already out. */
export function pressSling(actor: Actor): void {
  const { k, p } = actor;
  if (k.blade) {
    k.blade.returning = true;
    k.blade.wait = 0;
    return;
  }
  setAttack(p, 'sling');
}

/** While swordless, Attack is a single bare-gauntlet punch. */
export function tryPunch(actor: Actor): boolean {
  const { k, raw, p, frame } = actor;
  if (!k.blade || !raw.attackPressed) {
    return false;
  }
  setAttack(p, 'punch');
  frame.inputs[p.id]!.attackPressed = false;
  return true;
}

/** The blade leaves the gauntlet on its release frame. */
export function stepSlingAttack(actor: Actor, attackFrame: number): void {
  const { k, p } = actor;
  if (attackFrame !== S.release || k.blade) {
    return;
  }
  k.blade = {
    x: p.x,
    y: f.add(p.y, S.spawnHeight),
    origin: p.x,
    direction: p.facing,
    age: 0,
    returning: false,
    wait: 0,
    hit: false,
    returnHit: false,
  };
}

/** Flies the blade out, waits, homes back to the gauntlet, and lands its out/return hits. */
export function stepBlade(
  w: WorldState,
  d: DuelState,
  p: FighterState,
  t: FighterState,
  k: DuelKnight,
  effects: OathEffects,
  events: MatchEvent[],
): void {
  const b = k.blade;
  if (!b) {
    return;
  }
  b.age++;
  if (b.returning) {
    b.x = f.add(b.x, (S.returnSpeed * (b.x > p.x ? -1 : 1)) as Fixed);
    b.y = f.add(b.y, (S.returnLift * Math.sign(p.y + f.one - b.y)) as Fixed);
    if (Math.abs(b.x - p.x) < f.one) {
      k.blade = null;
      emit(d, 'recall', p);
    }
  } else if (b.wait > 0) {
    if (--b.wait === 0) {
      b.returning = true;
    }
  } else {
    b.x = f.add(b.x, (S.speed * b.direction) as Fixed);
    if (b.age >= S.travelFrames || Math.abs(b.x - b.origin) >= S.range) {
      b.wait = S.wait;
    }
  }
  const touching = Math.abs(b.x - t.x) < S.hitWidth && Math.abs(b.y - t.y - f.one) < S.hitHeight;
  const spent = b.returning ? b.returnHit : b.hit;
  if (!k.blade || !touching || spent) {
    return;
  }
  const damage = b.returning ? S.returnDamage : S.damage;
  const hit = directHit(w, p, t, { damage, direction: S.direction });
  if (!hit) {
    return;
  }
  events.push(hit);
  if (b.returning) {
    b.returnHit = true;
  } else {
    b.hit = true;
    b.wait = S.wait;
  }
  if (effects.slingSiphon) {
    siphon(d.knights[t.id]!, k, effects.slingSiphon);
  }
  emit(d, 'blade-hit', t);
}
