import { neutral } from '../session.js';
import type { Actor } from './state.js';

/** Landing or grabbing a ledge refreshes air dodge, helplessness, and per-airtime specials. */
export function refreshRecovery(actor: Actor): void {
  const { k, p } = actor;
  if (!p.grounded && p.locomotion !== 'ledge-hang') {
    return;
  }
  k.airDodge = false;
  k.helpless = false;
  k.sideUses = 0;
  k.riftUses = 0;
}

/** Being hit cancels helplessness, charging, grab windows, and guard. */
export function cancelOnHitstun(actor: Actor): void {
  const { k, p } = actor;
  if (p.hitstunFrames <= 0) {
    return;
  }
  k.helpless = false;
  k.charging = false;
  k.grab = 0;
  k.guard = 0;
}

/** True when the Knight may start a new action this frame. */
export function isFree(actor: Actor): boolean {
  const { k, p, g } = actor;
  return (
    !k.helpless &&
    p.landingLagFrames === 0 &&
    g.stance.unfurl === 0 &&
    p.respawnFrames === 0 &&
    !p.eliminated &&
    p.hitstunFrames === 0 &&
    p.hitlagFrames === 0 &&
    k.stagger === 0 &&
    k.lock === 0
  );
}

/** Action lockout (Kindle activation, feints, grab whiffs, Riposte). */
export function stepLock(actor: Actor): void {
  const { k, p, frame } = actor;
  if (k.lock <= 0) {
    return;
  }
  k.lock--;
  frame.inputs[p.id] = neutral(frame.w.frame);
}

/** Helpless Knights can only drift. */
export function stepHelpless(actor: Actor): void {
  const { k, p, raw, frame } = actor;
  if (!k.helpless) {
    return;
  }
  frame.inputs[p.id] = { ...neutral(frame.w.frame), moveX: raw.moveX };
  p.jumpsRemaining = 0;
}
