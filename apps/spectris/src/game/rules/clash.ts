import type { Fixed } from '../../../../../packages/deterministic-math/src/fixed.js';
import type { MatchEvent } from '../../../../../packages/sim/src/match.js';
import type { FighterState } from '../../../../../packages/sim/src/types.js';
import {
  clashOutcomes,
  detectClash,
  readClashChoice,
  resolveClash,
  type ClashChoice,
} from '../../../../../packages/clash/src/clash.js';
import { CLASH, DUEL } from '../../content/rules/duel.js';
import { MOVES } from '../../content/knight/moves/index.js';
import { resolveDoubleKindle } from './kindle.js';
import { gain } from './meter.js';
import { emit, type DuelState, type Frame } from './state.js';

/** Authored Strain of a move's first strike (0 if unknown). */
const strainOf = (attackId: string): number => MOVES.get(attackId)?.strikes[0]?.strain ?? 0;

/** A clank between two hitboxes close enough in Strain to open a clash window. */
export function findClash(events: readonly MatchEvent[]): MatchEvent | undefined {
  return events.find(
    (event) =>
      event.type === 'clank' &&
      detectClash(strainOf(event.attackAId), strainOf(event.attackBId), CLASH).kind === 'clash',
  );
}

/** A clank event opens the clash window when both moves are known and within the Strain gap. */
export function openClashFromClank(frame: Frame, attackA: string, attackB: string): void {
  const a = MOVES.get(attackA);
  const b = MOVES.get(attackB);
  if (!a || !b) {
    return;
  }
  if (detectClash(a.strikes[0]?.strain ?? 0, b.strikes[0]?.strain ?? 0, CLASH).kind !== 'clash') {
    return;
  }
  openClash(frame.d, frame.w.fighters);
  for (const p of frame.w.fighters) {
    emit(frame.d, 'clash', p);
  }
}

/** Freezes both Knights in a clash; choices reset to the default. */
export function openClash(d: DuelState, fighters: readonly FighterState[]): void {
  d.clash = CLASH.window;
  for (const p of fighters) {
    d.knights[p.id]!.choice = CLASH.defaultChoice;
  }
}

/** Undoes PF's hit results for both fighters: a clash means neither hit landed. */
export function cancelClashedHits(fighters: FighterState[], before: readonly FighterState[]): void {
  fighters.forEach((p, index) => {
    const old = before[index]!;
    p.percentTenths = old.percentTenths;
    p.hitstunFrames = old.hitstunFrames;
    p.vx = old.vx;
    p.vy = old.vy;
  });
}

/**
 * One frame of the clash choice window. `cpuChoice` supplies choices for CPU slots.
 * Resolves on the final frame: meter, advantage, chip, recoil, and Double Kindle.
 */
export function stepClashWindow(
  frame: Frame,
  ids: readonly string[],
  cpuChoice: (slot: number) => ClashChoice | null,
): void {
  const { w, d, inputs } = frame;
  for (const [index, p] of w.fighters.entries()) {
    const k = d.knights[p.id]!;
    const automatic = cpuChoice(index);
    if (automatic) {
      k.choice = automatic;
      continue;
    }
    k.choice = readClashChoice(inputs[p.id]!, p.facing, k.choice, CLASH);
  }
  if (--d.clash !== 0) {
    return;
  }
  const winner = resolveClash(d.knights[ids[0]!]!.choice, d.knights[ids[1]!]!.choice);
  const outcomes = clashOutcomes(winner, CLASH);
  for (const [index, p] of w.fighters.entries()) {
    const k = d.knights[p.id]!;
    const outcome = outcomes[index]!;
    p.attack = null;
    p.hitlagFrames = 0;
    p.vx = (DUEL.clash.recoil * (index ? 1 : -1)) as Fixed;
    if (outcome.won || outcome.lost) {
      gain(k, outcome.meter);
    }
    if (outcome.won) {
      k.clashes++;
    }
    if (outcome.lost) {
      k.stagger = outcome.stagger;
      k.integrity = Math.max(0, k.integrity - outcome.chip);
    }
    emit(d, 'clash-resolve', p);
  }
  if (d.doubleKindle) {
    resolveDoubleKindle(d, ids, winner);
  }
  d.doubleKindle = false;
}
