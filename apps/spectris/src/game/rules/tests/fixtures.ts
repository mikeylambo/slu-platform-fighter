import type { SimInputFrame } from '../../../../../../packages/sim/src/types.js';
import { createDuel } from '../setup.js';
import { makeActor } from '../actor.js';
import { duelData, type Actor, type DuelOptions, type Frame } from '../state.js';
import { IDS, neutral } from '../../session.js';
import '../../duel.js';

/** A two-human duel frame on Mirror Sanctum with no clock. */
export function duelFrame(options: Partial<DuelOptions> = {}): Frame {
  const w = createDuel({ cpu: [0, 0], timer: 0, ...options });
  const d = duelData(w)!;
  return {
    w,
    d,
    inputs: { [IDS[0]]: neutral(w.frame), [IDS[1]]: neutral(w.frame) },
    samples: { [IDS[0]]: neutral(w.frame), [IDS[1]]: neutral(w.frame) },
    guards: new Map(),
    immediate: [],
    shatterTargets: new Set(),
  };
}

/** Builds the Actor for a slot with the given input this frame. */
export function actorFor(frame: Frame, index: 0 | 1, input: Partial<SimInputFrame> = {}): Actor {
  frame.inputs[IDS[index]] = { ...neutral(frame.w.frame), ...input };
  frame.samples[IDS[index]] = { ...frame.inputs[IDS[index]]! };
  return makeActor(frame, index, frame.w.fighters[index]!);
}

export { IDS };
