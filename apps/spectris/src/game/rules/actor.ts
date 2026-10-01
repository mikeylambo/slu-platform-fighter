import type { FighterState } from '../../../../../packages/sim/src/types.js';
import { gameData } from '../session.js';
import { AUX } from '../../content/rules/input.js';
import { bufferInput } from './input-buffer.js';
import { effectsOf, type Actor, type Frame } from './state.js';

/** Builds a Knight's per-frame working set; runs the action buffer for this frame. */
export function makeActor(frame: Frame, index: number, p: FighterState): Actor {
  const { w, d, inputs } = frame;
  const t = w.fighters[1 - index]!;
  const sample = inputs[p.id]!;
  const k = d.knights[p.id]!;
  const oath = d.options.oaths[index]!;
  const raw = bufferInput(k, sample, w.frame, d.options.buffer);
  return {
    frame,
    index,
    p,
    t,
    k,
    tk: d.knights[t.id]!,
    sample,
    raw,
    oath,
    effects: effectsOf(oath),
    g: gameData(w).knights[p.id]!,
    heldSpecial: !!((sample.auxiliaryButtons ?? 0) & AUX.specialHeld) || !!sample.specialPressed,
  };
}
