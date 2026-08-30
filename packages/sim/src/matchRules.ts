import type { KoEvent, StockMatchRules } from './lifecycle.js';
import type { MatchInputFrame, MatchStepResult } from './match.js';
import { resolveWinningTeam, type TeamRules } from './teamPolicy.js';
import type { MatchMode, MatchRuntimeState, WorldState } from './types.js';

export interface MatchRules {
  mode: MatchMode;
  /** Required for time / stock-time. Null is valid only for stock. */
  timeLimitFrames?: number;
  koScore?: number;
  selfDestructPenalty?: number;
  suddenDeathOnTie?: boolean;
}

export type DirectedMatchStep = (state: WorldState, input: MatchInputFrame) => MatchStepResult;

function validateRules(rules: MatchRules): void {
  if ((rules.mode === 'time' || rules.mode === 'stock-time') && (!Number.isInteger(rules.timeLimitFrames) || (rules.timeLimitFrames ?? 0) < 1)) {
    throw new Error(`${rules.mode} rules require positive integer timeLimitFrames`);
  }
  if (rules.timeLimitFrames !== undefined && (!Number.isInteger(rules.timeLimitFrames) || rules.timeLimitFrames < 1)) throw new Error('timeLimitFrames must be positive integer');
  if (rules.koScore !== undefined && !Number.isInteger(rules.koScore)) throw new Error('koScore must be integer');
  if (rules.selfDestructPenalty !== undefined && !Number.isInteger(rules.selfDestructPenalty)) throw new Error('selfDestructPenalty must be integer');
}

export function createMatchRuntimeState(participantIds: readonly string[], rules: MatchRules): MatchRuntimeState {
  validateRules(rules);
  const ids = [...participantIds].sort();
  if (ids.length < 2 || new Set(ids).size !== ids.length) throw new Error('match runtime requires at least two unique participant ids');
  const scores: Record<string, number> = {};
  for (const id of ids) scores[id] = 0;
  return {
    mode: rules.mode,
    framesRemaining: rules.mode === 'stock' ? null : rules.timeLimitFrames!,
    scores,
    winningTeamId: null,
    suddenDeath: false,
    ended: false,
  };
}

/** Returns lifecycle rules compatible with the selected match mode. */
export function stockLifecycleRulesForMatch(base: StockMatchRules, rules: MatchRules): StockMatchRules {
  validateRules(rules);
  return { ...base, finiteStocks: rules.mode !== 'time' };
}

function koEvents(result: MatchStepResult): KoEvent[] {
  return result.events.filter((event): event is KoEvent => event.type === 'ko');
}

function scoreKOs(scoresInput: Readonly<Record<string, number>>, result: MatchStepResult, rules: MatchRules): Record<string, number> {
  const scores = { ...scoresInput };
  const koScore = rules.koScore ?? 1;
  const selfDestructPenalty = rules.selfDestructPenalty ?? -1;
  for (const event of koEvents(result)) {
    if (event.creditedAttackerId !== null) {
      if (scores[event.creditedAttackerId] === undefined) scores[event.creditedAttackerId] = 0;
      scores[event.creditedAttackerId]! += koScore;
    } else if (event.selfDestruct) {
      if (scores[event.fighterId] === undefined) scores[event.fighterId] = 0;
      scores[event.fighterId]! += selfDestructPenalty;
    }
  }
  return scores;
}

function uniqueLeaderByScore(scores: Readonly<Record<string, number>>): string | null {
  const entries = Object.entries(scores).sort(([a], [b]) => a.localeCompare(b));
  if (entries.length === 0) return null;
  const best = Math.max(...entries.map(([, score]) => score));
  const leaders = entries.filter(([, score]) => score === best);
  return leaders.length === 1 ? leaders[0]![0] : null;
}

function uniqueLeaderByStocksThenScore(state: WorldState, scores: Readonly<Record<string, number>>): string | null {
  const candidates = [...state.fighters].sort((a, b) => a.id.localeCompare(b.id));
  if (candidates.length === 0) return null;
  const bestStocks = Math.max(...candidates.map((fighter) => fighter.stocks));
  const stockLeaders = candidates.filter((fighter) => fighter.stocks === bestStocks);
  if (stockLeaders.length === 1) return stockLeaders[0]!.id;
  const bestScore = Math.max(...stockLeaders.map((fighter) => scores[fighter.id] ?? 0));
  const scoreLeaders = stockLeaders.filter((fighter) => (scores[fighter.id] ?? 0) === bestScore);
  return scoreLeaders.length === 1 ? scoreLeaders[0]!.id : null;
}

function teamIds(teamRules: TeamRules): string[] {
  return [...new Set(Object.values(teamRules.teamByParticipant).filter((team): team is NonNullable<typeof team> => team !== null))].sort();
}

function teamScoreTable(scores: Readonly<Record<string, number>>, teamRules: TeamRules): Record<string, number> {
  const result: Record<string, number> = {};
  for (const teamId of teamIds(teamRules)) result[teamId] = 0;
  for (const [participantId, score] of Object.entries(scores)) {
    const teamId = teamRules.teamByParticipant[participantId];
    if (teamId !== undefined && teamId !== null) result[teamId] = (result[teamId] ?? 0) + score;
  }
  return result;
}

function teamStockTable(state: WorldState, teamRules: TeamRules): Record<string, number> {
  const result: Record<string, number> = {};
  for (const teamId of teamIds(teamRules)) result[teamId] = 0;
  for (const fighter of state.fighters) {
    const teamId = teamRules.teamByParticipant[fighter.id];
    if (teamId !== undefined && teamId !== null) result[teamId] = (result[teamId] ?? 0) + fighter.stocks;
  }
  return result;
}

function uniqueTeamLeaderByStocksThenScore(state: WorldState, scores: Readonly<Record<string, number>>, teamRules: TeamRules): string | null {
  const stocks = teamStockTable(state, teamRules);
  const teamScores = teamScoreTable(scores, teamRules);
  const entries = Object.entries(stocks).sort(([a], [b]) => a.localeCompare(b));
  if (entries.length === 0) return null;
  const bestStocks = Math.max(...entries.map(([, total]) => total));
  const stockLeaders = entries.filter(([, total]) => total === bestStocks).map(([teamId]) => teamId);
  if (stockLeaders.length === 1) return stockLeaders[0] ?? null;
  const bestScore = Math.max(...stockLeaders.map((teamId) => teamScores[teamId] ?? 0));
  const scoreLeaders = stockLeaders.filter((teamId) => (teamScores[teamId] ?? 0) === bestScore);
  return scoreLeaders.length === 1 ? scoreLeaders[0] ?? null : null;
}

/**
 * Advances match-level timer/score/end policy after the ordinary fighter sim.
 * Static team assignment is supplied separately so it never bloats per-frame
 * fighter state, while the resolved winning team remains rollback-authoritative.
 */
export function applyMatchRules(previousState: WorldState, result: MatchStepResult, rules: MatchRules, teamRules?: TeamRules): MatchStepResult {
  validateRules(rules);
  const prior = previousState.match ?? createMatchRuntimeState(previousState.fighters.map((fighter) => fighter.id), rules);
  if (prior.mode !== rules.mode) throw new Error(`world match mode ${prior.mode} does not match active rules ${rules.mode}`);
  if (prior.ended) return { ...result, state: { ...result.state, match: prior, winnerId: previousState.winnerId } };

  const teamsEnabled = teamRules?.enabled === true;
  const scores = scoreKOs(prior.scores, result, rules);
  const framesRemaining = prior.framesRemaining === null ? null : Math.max(0, prior.framesRemaining - 1);
  let winnerId = teamsEnabled ? null : result.state.winnerId;
  let winningTeamId: string | null = null;
  let ended = false;
  let suddenDeath = false;

  if (rules.mode === 'stock') {
    if (teamsEnabled && teamRules) winningTeamId = resolveWinningTeam(result.state.fighters, teamRules);
    ended = teamsEnabled ? winningTeamId !== null : winnerId !== null;
  } else if (rules.mode === 'stock-time') {
    if (teamsEnabled && teamRules) {
      winningTeamId = resolveWinningTeam(result.state.fighters, teamRules);
      if (winningTeamId !== null) ended = true;
    } else if (winnerId !== null) {
      ended = true;
    }
  }

  if (!ended && framesRemaining === 0 && rules.mode !== 'stock') {
    if (teamsEnabled && teamRules) {
      winningTeamId = rules.mode === 'time'
        ? uniqueLeaderByScore(teamScoreTable(scores, teamRules))
        : uniqueTeamLeaderByStocksThenScore(result.state, scores, teamRules);
      winnerId = null;
      suddenDeath = winningTeamId === null && (rules.suddenDeathOnTie ?? true);
    } else {
      winnerId = rules.mode === 'time'
        ? uniqueLeaderByScore(scores)
        : uniqueLeaderByStocksThenScore(result.state, scores);
      suddenDeath = winnerId === null && (rules.suddenDeathOnTie ?? true);
    }
    ended = true;
  }

  const match: MatchRuntimeState = { mode: rules.mode, framesRemaining, scores, winningTeamId, suddenDeath, ended };
  return { ...result, state: { ...result.state, match, winnerId } };
}

/** Wraps any canonical fighter-step function with rollback-authoritative match policy. */
export function withMatchRules(step: DirectedMatchStep, rules: MatchRules, teamRules?: TeamRules): DirectedMatchStep {
  validateRules(rules);
  return (state, input) => applyMatchRules(state, step(state, input), rules, teamRules);
}
