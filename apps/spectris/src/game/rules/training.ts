import type { SimInputFrame, WorldState } from '../../../../../packages/sim/src/types.js';
import { gameData } from '../session.js';
import { AUX } from '../../content/rules/input.js';
import type { DuelState } from './state.js';

const lockedStance = (d: DuelState): 'wings' | 'cape' | null => {
  const lock = d.options.stanceLock;
  return d.options.format === 'training' && lock && lock !== 'free' ? lock : null;
};

/** Training stance lock is authoritative replay state: force the stance every frame. */
export function applyStanceLock(w: WorldState, d: DuelState): void {
  const stance = lockedStance(d);
  if (!stance) {
    return;
  }
  const data = gameData(w);
  for (const p of w.fighters) {
    p.definitionId = stance;
    data.knights[p.id]!.stance.id = stance;
    data.knights[p.id]!.stance.unfurl = 0;
  }
  w.extensionState = JSON.stringify({ ...data, duel: d });
}

/** With the stance locked, the stance button does nothing. */
export function stripStanceInput(d: DuelState, inputs: Record<string, SimInputFrame>): void {
  if (!lockedStance(d)) {
    return;
  }
  for (const input of Object.values(inputs)) {
    input.auxiliaryButtons = (input.auxiliaryButtons ?? 0) & ~AUX.stance;
  }
}
