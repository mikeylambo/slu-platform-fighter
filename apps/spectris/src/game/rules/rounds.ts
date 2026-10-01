import { fixed as f } from '../../../../../packages/deterministic-math/src/fixed.js';
import type { StockMatchRules } from '../../../../../packages/sim/src/lifecycle.js';
import type { MatchEvent, MatchInputFrame } from '../../../../../packages/sim/src/match.js';
import type { WorldState } from '../../../../../packages/sim/src/types.js';
import { DUEL, winsNeeded } from '../../content/rules/duel.js';
import { AUX } from '../../content/rules/input.js';
import { STAGES, type Stage } from '../../content/stages/roster.js';
import { STOCK_RULES } from '../../content/stages/sanctum.js';
import { createDuel } from './setup.js';
import { duelData, emit, save, type DuelState } from './state.js';
import { carryMind } from '../../ai/mind.js';

const B = DUEL.blast;
const ROUNDS = DUEL.rounds;

/** The losing player picks the next stage between rounds (CPU losers pick deterministically). */
function counterpick(d: DuelState, bundle: MatchInputFrame, ids: readonly string[]): void {
  if (!d.options.counterpick || !d.winner) {
    return;
  }
  const loser = d.winner === ids[0] ? 1 : 0;
  const command = bundle.byFighterId[ids[loser]!]?.auxiliaryButtons ?? 0;
  if (d.options.cpu[loser]) {
    d.options.stage = STAGES[(d.round + loser) % ROUNDS.competitiveStages]!.id;
    return;
  }
  if (!(command & AUX.counterpick)) {
    d.pause = Math.max(ROUNDS.counterpickHold, d.pause);
    return;
  }
  const stage = STAGES[(command >> AUX.counterpickShift) & AUX.counterpickMask];
  if (stage && STAGES.indexOf(stage) < ROUNDS.competitiveStages) {
    d.options.stage = stage.id;
    d.pause = 1;
  }
}

/** Between rounds: wait out the pause (and counterpick), then build the next round's world. */
export function stepRoundEnd(
  w: WorldState,
  d: DuelState,
  bundle: MatchInputFrame,
  ids: readonly string[],
): { state: WorldState; events: MatchEvent[] } {
  counterpick(d, bundle, ids);
  if (--d.pause > 0) {
    w.frame++;
    save(w, d);
    return { state: w, events: [] };
  }
  const next = createDuel(d.options, (w.seed ^ w.frame) >>> 0);
  next.frame = w.frame + 1;
  const nd = duelData(next)!;
  nd.wins = d.wins;
  nd.round = d.round + 1;
  nd.progress = d.progress;
  if (d.winner === null && d.sudden) {
    // A simultaneous Sudden Death loss replays Sudden Death.
    nd.sudden = true;
    nd.clock = 0;
    for (const p of next.fighters) {
      p.stocks = ROUNDS.suddenDeathLives;
      p.percentTenths = ROUNDS.suddenDeathStrain;
    }
  }
  for (const id of ids) {
    nd.knights[id]!.parries = d.knights[id]!.parries;
    nd.knights[id]!.clashes = d.knights[id]!.clashes;
    nd.knights[id]!.fractures = d.knights[id]!.fractures;
    nd.knights[id]!.mind = carryMind(d.knights[id]!.mind);
  }
  save(next, nd);
  return { state: next, events: [] };
}

/** Counts the match clock down; at zero both Knights drop to one Fracture at the Shatter threshold. */
export function tickClock(w: WorldState, d: DuelState): void {
  const timed = d.options.format !== 'training' && d.options.timer > 0;
  if (timed && !d.sudden && --d.clock <= 0) {
    d.sudden = true;
    d.suddenFrames = 0;
    for (const p of w.fighters) {
      p.stocks = ROUNDS.suddenDeathLives;
      p.percentTenths = ROUNDS.suddenDeathStrain;
      emit(d, 'sudden-death', p);
    }
  }
  if (d.sudden) {
    d.suddenFrames++;
  }
}

/** Blast zones for this frame; Sudden Death shrinks them 1% per interval down to a floor. */
export function blastRules(d: DuelState, stage: Stage): StockMatchRules {
  const shrink = d.sudden
    ? Math.max(B.minimumScale, 1 - Math.floor(d.suddenFrames / B.shrinkInterval) / B.shrinkSteps)
    : 1;
  const zone = (value: number, sign: number) =>
    f.fromRatio(sign * Math.round(value * shrink * B.precision), B.precision * B.unitsPerWorld);
  const [left, right, top, bottom] = stage.blast;
  return {
    ...STOCK_RULES,
    finiteStocks: d.options.format !== 'training',
    blastLeft: zone(left, -1),
    blastRight: zone(right, 1),
    blastTop: zone(top, 1),
    blastBottom: zone(bottom, -1),
  };
}

/** A Knight out of Fractures ends the round, or the match when the set is decided. */
export function checkRoundEnd(w: WorldState, d: DuelState, ids: readonly string[]): void {
  const format = d.options.format;
  if (format === 'training' || format === 'momentum' || !w.fighters.some((p) => p.eliminated)) {
    return;
  }
  const alive = w.fighters.filter((p) => !p.eliminated);
  const winner = alive[0]?.id ?? null;
  if (winner) {
    const index = ids.indexOf(winner);
    d.wins[index] = (d.wins[index] ?? 0) + 1;
    d.winner = winner;
  }
  const decided = format === 'continuous' || d.wins.some((wins) => wins >= winsNeeded(d.options.bestOf));
  d.phase = winner && decided ? 'over' : 'round-end';
  d.pause = DUEL.roundPause;
  emit(d, d.phase === 'over' ? 'match-win' : 'round-win', alive[0] ?? w.fighters[0]!);
}
