import { fixed as f, type Fixed } from '../../../../../packages/deterministic-math/src/fixed.js';
import type { HitEvent } from '../../../../../packages/sim/src/combat.js';
import type { FighterState } from '../../../../../packages/sim/src/types.js';
import { DUEL, type Oath } from '../../content/rules/duel.js';
import { EVADE, EVADES } from '../../content/knight/defense.js';
import { SPECIALS } from '../../content/knight/specials.js';
import { kindleGuardChip, parryWindow } from './kindle.js';
import { gain } from './meter.js';
import {
  afterimage,
  emit,
  freeze,
  setAttack,
  type Actor,
  type DuelKnight,
  type Frame,
  type GuardSnapshot,
} from './state.js';

const G = DUEL.guard;

/** -1, 0 or 1 for a stick axis (never -0, which would change serialized state). */
const stickSign = (axis: number): number => (axis > 0 ? 1 : axis < 0 ? -1 : 0);

/** Guard Integrity regenerates after a delay without blocking. */
export function tickIntegrity(k: DuelKnight): void {
  if (k.regen > 0) {
    k.regen--;
  } else if (!k.guard && !k.stagger) {
    k.integrity = Math.min(DUEL.integrity.max, k.integrity + G.regen);
  }
}

/** Only Cape stance can guard. */
export function dropGuardOutsideCape(actor: Actor): void {
  if (actor.p.definitionId !== 'cape') {
    actor.k.guard = 0;
  }
}

export function tickGuardRelease(k: DuelKnight): void {
  if (k.guardRelease > 0) {
    k.guardRelease--;
  }
}

/** Guard break stagger: frozen, then Integrity resets to the post-break value. */
export function stepStagger(actor: Actor): void {
  const { k, p, frame } = actor;
  if (k.stagger <= 0) {
    return;
  }
  k.stagger--;
  p.attack = null;
  freeze(frame, p);
  p.vx = f.zero;
  if (k.stagger === 0 && k.integrity === 0) {
    k.integrity = DUEL.integrity.afterBreak;
  }
}

/** Advances an evade: intangible window, travel, and air-dodge helplessness. */
export function stepEvade(actor: Actor): void {
  const { k, p, frame } = actor;
  if (k.evade <= 0) {
    return;
  }
  const spec = EVADES[k.evadeKind];
  const elapsed = spec.frames - k.evade + 1;
  if (elapsed >= spec.intangibleFrom && elapsed <= spec.intangibleTo) {
    p.invulnerableFrames = Math.max(DUEL.sustain, p.invulnerableFrames);
  }
  if (spec.travels) {
    p.x = f.add(p.x, (EVADE.travel * k.evadeDirection) as Fixed);
  }
  freeze(frame, p);
  k.evade--;
  if (!k.evade && k.evadeKind === 'air' && p.y < 0) {
    k.helpless = true;
  }
}

/** Wings Evade: spot dodge, roll, or one directional air dodge per airtime. */
export function tryEvade(actor: Actor): boolean {
  const { raw, k, p, frame } = actor;
  if (!raw.dodgePressed || p.definitionId !== 'wings' || (!p.grounded && k.airDodge)) {
    return false;
  }
  if (!p.grounded) {
    k.evadeKind = 'air';
  } else {
    k.evadeKind = Math.abs(raw.moveX) > EVADE.rollThreshold ? 'roll' : 'spot';
  }
  k.evade = EVADES[k.evadeKind].frames;
  k.evadeDirection = stickSign(raw.moveX);
  k.ghost = afterimage(p, k.lastMove);
  if (!p.grounded) {
    k.airDodge = true;
    p.vy = f.fromRatio(raw.moveY, EVADE.airLiftDivisor);
  }
  freeze(frame, p);
  emit(frame.d, 'evade', p);
  return true;
}

/** Cape Guard: holding guard counts frames (the first frames parry). Jump/grab cancel it. */
export function tryGuard(actor: Actor): boolean {
  const { raw, k, p, frame } = actor;
  if (raw.shieldHeld && p.definitionId === 'cape') {
    if (raw.jumpPressed || raw.grabPressed) {
      k.guard = 0;
    } else {
      k.guard++;
      freeze(frame, p);
      p.vx = f.zero;
    }
    return true;
  }
  if (k.guard) {
    k.guard = 0;
    k.guardRelease = G.release;
    freeze(frame, p);
    return true;
  }
  return false;
}

/** Guard release frames lock out everything except jump and grab. */
export function holdGuardRelease(actor: Actor): void {
  const { raw, k, p, frame } = actor;
  if (k.guardRelease > 0 && !raw.jumpPressed && !raw.grabPressed) {
    freeze(frame, p);
  }
}

/** Stillness Riposte stance: guard pinned to its parry frame while the counter waits. */
export function holdRiposteGuard(actor: Actor): void {
  const { raw, k, effects } = actor;
  if (!effects.riposte) {
    return;
  }
  if (k.lock > 0 && k.guard > 0) {
    k.guard = 1;
  } else if (k.lock === 0 && !raw.shieldHeld) {
    k.guard = 0;
  }
}

/** Snapshot of guard/parry used when PF hits resolve this frame. */
export function captureGuard(actor: Actor): void {
  const { k, p, oath, effects, frame } = actor;
  const ascendParry =
    !!effects.ascendParry && p.attack?.attackId.endsWith(':ascend') === true && p.attack.frame < effects.ascendParry;
  const snapshot: GuardSnapshot = {
    active: k.guard > 0 || ascendParry,
    parry: (k.guard > 0 && k.guard <= parryWindow(k, oath)) || ascendParry,
    facing: p.facing,
  };
  frame.guards.set(p.id, snapshot);
}

/**
 * Resolves a hit against a guarding Knight. Returns true when the guard absorbed it
 * (parry or block); the caller then skips normal hit processing.
 */
export function resolveGuardedHit(
  frame: Frame,
  hit: HitEvent,
  defender: FighterState,
  attacker: FighterState,
  before: FighterState,
  defenderOath: { riposte: boolean },
  attackerOath: Oath,
): boolean {
  const { d } = frame;
  const k = d.knights[defender.id]!;
  const guard = frame.guards.get(defender.id);
  const facing = guard?.facing ?? before.facing;
  const front = (attacker.x - before.x) * facing >= 0;
  if (!guard?.active || !front) {
    return false;
  }
  defender.percentTenths = before.percentTenths;
  defender.vx = before.vx;
  defender.vy = before.vy;
  defender.hitstunFrames = 0;
  defender.hitlagFrames = 0;
  if (guard.parry) {
    parry(frame, defender, attacker, defenderOath.riposte);
    return true;
  }
  block(frame, hit, defender, d.knights[attacker.id]!, attackerOath);
  return true;
}

function parry(frame: Frame, defender: FighterState, attacker: FighterState, riposte: boolean): void {
  const k = frame.d.knights[defender.id]!;
  if (riposte && k.lock > 0) {
    k.lock = 0;
    k.guard = 0;
    setAttack(defender, 'riposte');
  }
  attacker.hitstunFrames = Math.max(attacker.hitstunFrames, G.parryStun);
  attacker.attack = null;
  gain(k, DUEL.meter.parry);
  k.parries++;
  emit(frame.d, 'parry', defender);
}

function block(
  frame: Frame,
  hit: HitEvent,
  defender: FighterState,
  attackerKnight: DuelKnight,
  attackerOath: Oath,
): void {
  const k = frame.d.knights[defender.id]!;
  const bare = k.blade ? G.bareGauntlet : 1;
  const anchor = hit.attackId.includes(':anchor') ? G.anchor : 1;
  const chip = kindleGuardChip(attackerKnight, attackerOath, hit.damageTenths * G.integrityPerTenth * bare) * anchor;
  k.integrity = Math.max(0, k.integrity - chip);
  defender.percentTenths += Math.round(hit.damageTenths * G.strainChip);
  k.regen = G.regenDelay;
  emit(frame.d, 'block', defender);
  if (!k.integrity) {
    k.stagger = G.breakFrames;
    k.guard = 0;
    emit(frame.d, 'guard-break', defender);
  }
}

/** Stillness Riposte replaces Anchor: a counter stance that waits for a hit. */
export function startRiposte(actor: Actor): void {
  const { k, p, frame } = actor;
  k.guard = 1;
  k.lock = SPECIALS.riposte.window;
  emit(frame.d, 'riposte', p);
}
