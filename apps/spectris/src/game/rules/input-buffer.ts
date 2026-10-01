import type { SimInputFrame } from '../../../../../packages/sim/src/types.js';
import type { DuelKnight } from './state.js';

/** True when the sample presses a buffered action (special, grab, evade/guard). */
export const pressesBufferedAction = (sample: SimInputFrame): boolean =>
  !!sample.specialPressed || !!sample.grabPressed || sample.dodgePressed;

/**
 * Holds special/grab/evade presses for `window` frames so an action pressed during
 * lockout comes out on the first actionable frame. Held buttons and the stance bits
 * always come from the current sample.
 */
export function bufferInput(k: DuelKnight, sample: SimInputFrame, frame: number, window: number): SimInputFrame {
  if (pressesBufferedAction(sample)) {
    k.buffered = { ...sample };
    k.bufferFrames = window;
  } else if (k.bufferFrames > 0) {
    k.bufferFrames--;
  }
  if (k.bufferFrames === 0) {
    k.buffered = null;
  }
  if (!k.buffered) {
    return sample;
  }
  return {
    ...k.buffered,
    frame,
    jumpHeld: sample.jumpHeld,
    shieldHeld: sample.shieldHeld,
    auxiliaryButtons: sample.auxiliaryButtons ?? 0,
  };
}

/** Drops any buffered action (it was consumed or the Knight became busy). */
export function clearBuffer(k: DuelKnight): void {
  k.buffered = null;
  k.bufferFrames = 0;
}
