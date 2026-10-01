import { fixed as f, type Fixed } from '../../../../../packages/deterministic-math/src/fixed.js';
import type { FighterState, SimInputFrame } from '../../../../../packages/sim/src/types.js';
import { DUEL } from '../../content/rules/duel.js';
import { AUX } from '../../content/rules/input.js';
import { STANCES } from '../../content/knight/stances.js';
import { THROWS, THROW_DI_DIVISOR } from '../../content/knight/specials.js';
import { directHit } from './direct-hit.js';
import { siphon } from './meter.js';
import { commitKnight, emit, freeze, type Actor, type DuelKnight } from './state.js';

const R = DUEL.grab;

/** Consecutive-regrab memory expires after the regrab window. */
export function tickRegrab(k: DuelKnight): void {
  if (k.regrab > 0) {
    k.regrab--;
  } else {
    k.regrabs = 0;
  }
}

export function tickPummel(k: DuelKnight): void {
  if (k.pummel > 0) {
    k.pummel--;
  }
}

/** Grab press: standing/dash on the ground, Wing Carry in the air (costs a midair jump). */
export function tryGrab(actor: Actor): boolean {
  const { raw, k, p, frame } = actor;
  const canAirGrab = p.definitionId === 'wings' && p.jumpsRemaining > 0;
  if (!raw.grabPressed || !(p.grounded || canAirGrab)) {
    return false;
  }
  if (!p.grounded) {
    k.grab = R.air;
  } else {
    k.grab = p.locomotion === 'dash' ? R.dash : R.startup;
  }
  k.lock = k.grab + R.whiff;
  if (!p.grounded) {
    p.jumpsRemaining--;
  }
  freeze(frame, p);
  return true;
}

/** Escape time: base hold reduced by Strain and by each consecutive regrab. */
function holdFrames(target: FighterState, regrabs: number): number {
  const base = (R.hold - target.percentTenths * R.holdPerStrainTenth) * R.regrabDecay ** regrabs;
  return Math.max(R.minimumHold, Math.round(base));
}

/** The grab window closes: catch the opponent if in reach. */
export function stepGrabWindow(actor: Actor): void {
  const { k, p, t, tk, frame } = actor;
  if (!(k.grab > 0 && --k.grab === 0)) {
    return;
  }
  const inReach =
    Math.abs(f.toNumber(f.sub(t.x, p.x))) < R.reach &&
    Math.abs(f.toNumber(f.sub(t.y, p.y))) < R.height &&
    t.invulnerableFrames === 0 &&
    !tk.heldBy;
  if (!inReach) {
    return;
  }
  k.holding = t.id;
  tk.heldBy = p.id;
  k.hold = holdFrames(t, tk.regrabs);
  tk.regrabs++;
  tk.regrab = R.regrab;
  k.shatterGrab = tk.integrity <= DUEL.integrity.shatterGrab;
  p.grabTargetId = t.id;
  t.grabbedById = p.id;
  p.grabFrames = 0;
  t.grabFrames = 0;
  p.attack = null;
  t.attack = null;
  emit(frame.d, 'grab', p);
  if (!p.grounded) {
    // Wing Carry: drag the victim forward, then release almost at once.
    p.x = f.add(p.x, f.fromInt(p.facing * R.carryDistance));
    t.x = p.x;
    k.hold = R.airCarryHold;
    t.hitstunFrames = 0;
  }
}

/** A held Knight is frozen in the holder's gauntlets. Returns true if this Knight is held. */
export function holdVictim(actor: Actor): boolean {
  const { k, p, frame } = actor;
  if (!k.heldBy) {
    return false;
  }
  freeze(frame, p);
  p.grabbedById = k.heldBy;
  return true;
}

/** The holder's frame: escape mash, stance swap, Siphon pummel, throws, release. */
export function stepHolding(actor: Actor): void {
  const { k, p, raw, g, effects, frame } = actor;
  if (!k.holding) {
    return;
  }
  const { w, d, inputs } = frame;
  p.grabFrames = 0;
  const victim = w.fighters.find((fighter) => fighter.id === k.holding)!;
  const vk = d.knights[victim.id]!;
  const mash = inputs[victim.id]!;
  victim.x = f.add(p.x, (R.holdOffset * p.facing) as Fixed);
  victim.y = p.y;
  victim.vx = f.zero;
  victim.vy = f.zero;
  victim.invulnerableFrames = DUEL.sustain;
  freeze(frame, victim);
  freeze(frame, p);
  const mashed = mash.attackPressed || mash.jumpPressed || mash.specialPressed || mash.grabPressed;
  const mashRate = g.stance.unfurl ? R.unfurlEscape : 1;
  k.hold -= 1 + (mashed ? R.escape * mashRate : 0);
  if ((raw.auxiliaryButtons ?? 0) & AUX.stance) {
    // Switching stance mid-grab swaps the throw set; the unfurl doubles the victim's mash.
    g.stance.id = g.stance.id === 'wings' ? 'cape' : 'wings';
    g.stance.unfurl = STANCES.unfurlFrames;
    commitKnight(w, d, p.id, g);
    p.definitionId = g.stance.id;
  }
  const deflected = Math.abs(raw.moveX) > DUEL.stick.throw || Math.abs(raw.moveY) > DUEL.stick.throw;
  if (raw.attackPressed && k.pummel === 0) {
    victim.percentTenths += R.pummelStrain;
    siphon(vk, k, effects.pummelSiphon);
    k.pummel = R.pummel;
    emit(d, 'pummel', p);
  } else if (deflected && !g.stance.unfurl) {
    throwVictim(actor, victim, mash);
  }
  if (k.hold <= 0) {
    release(actor, victim, vk);
  }
}

/** `di` is the victim's stick sampled before the grab froze their input. */
function throwVictim(actor: Actor, victim: FighterState, di: SimInputFrame): void {
  const { k, p, raw, frame } = actor;
  const up = raw.moveY > DUEL.stick.throw;
  const down = raw.moveY < -DUEL.stick.throw;
  const back = raw.moveX * p.facing < 0;
  const stance = p.definitionId === 'cape' ? 'cape' : 'wings';
  const kind = up ? 'up' : down ? 'down' : back ? 'back' : 'forward';
  const spec = THROWS[stance][kind];
  const carry = stance === 'cape' && !up && !down;
  if (carry) {
    // Cape Carry: both Knights vanish and reappear further along.
    const direction = back ? -p.facing : p.facing;
    p.x = f.add(p.x, f.fromInt(direction * R.carryDistance));
    victim.x = f.add(p.x, (R.holdOffset * direction) as Fixed);
  }
  victim.invulnerableFrames = 0;
  const strainBefore = victim.percentTenths;
  const direction: [number, number] = [back ? -spec.direction[0] : spec.direction[0], spec.direction[1]];
  const hit = directHit(frame.w, p, victim, {
    damage: spec.damage,
    direction,
    base: spec.base,
    growth: spec.growth,
  });
  if (hit) {
    frame.immediate.push(hit);
    victim.vx = f.add(victim.vx, f.fromRatio(di.moveX, THROW_DI_DIVISOR));
    victim.vy = f.add(victim.vy, f.fromRatio(di.moveY, THROW_DI_DIVISOR));
  }
  if (k.shatterGrab && strainBefore >= DUEL.threshold) {
    frame.shatterTargets.add(victim.id);
  }
  if (carry) {
    victim.hitstunFrames = R.release;
  }
  if (down && stance === 'cape') {
    victim.locomotion = 'knockdown';
  }
  k.hold = 0;
  emit(frame.d, 'throw', p);
}

function release(actor: Actor, victim: FighterState, vk: DuelKnight): void {
  const { k, p } = actor;
  vk.heldBy = null;
  k.holding = null;
  victim.grabbedById = null;
  p.grabTargetId = null;
  victim.locomotion = victim.grounded ? 'idle' : 'airborne';
  k.lock = 0;
  victim.invulnerableFrames = 0;
  if (!p.grounded) {
    victim.hitstunFrames = R.release;
  }
}
