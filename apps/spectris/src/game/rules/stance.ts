import { consumeFreeFlash } from '../../../../../packages/soulfire/src/soulfire.js';
import type { WorldState, FighterState } from '../../../../../packages/sim/src/types.js';
import { gameData, neutral } from '../session.js';
import { DUEL } from '../../content/rules/duel.js';
import { AUX } from '../../content/rules/input.js';
import { commitKnight, type Actor, type DuelKnight } from './state.js';

/**
 * Flash Unfurl: Stance + Guard spends meter (or Kindle's free flash) to switch with no
 * unfurl window. The session adapter performs the switch from the stance bit this frame.
 */
export function tryFlashUnfurl(actor: Actor): boolean {
  const { raw, k, p, g, frame } = actor;
  const requested = !!((raw.auxiliaryButtons ?? 0) & AUX.stance) && raw.shieldHeld;
  if (!requested || !(k.meter >= DUEL.meter.flash || k.soul.freeFlash)) {
    return false;
  }
  if (!consumeFreeFlash(k.soul)) {
    k.meter -= DUEL.meter.flash;
  }
  k.flash = true;
  frame.inputs[p.id] = {
    ...neutral(frame.w.frame),
    auxiliaryButtons: AUX.stance,
  };
  k.guard = 0;
  g.stance.unfurl = 0;
  commitKnight(frame.w, frame.d, p.id, g);
  return true;
}

/** After the session switched stance this frame, cancel the unfurl window for a flash. */
export function settleFlash(w: WorldState, p: FighterState, k: DuelKnight): void {
  if (!k.flash) {
    return;
  }
  const data = gameData(w);
  data.knights[p.id]!.stance.unfurl = 0;
  w.extensionState = JSON.stringify(data);
}
