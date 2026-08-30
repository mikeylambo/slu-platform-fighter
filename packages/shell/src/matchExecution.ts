import type { StockMatchRules } from '../../sim/src/lifecycle.js';
import { withAerialLandingPolicies } from '../../sim/src/aerialLanding.js';
import { withAuthoredCombatPolicies } from '../../sim/src/authoredCombatPolicies.js';
import { withDamageAttribution, type DamageAttributionRules } from '../../sim/src/damageAttribution.js';
import { stepMatchWorld, type MatchInputFrame, type MatchStepResult } from '../../sim/src/match.js';
import { createMatchRuntimeState, stockLifecycleRulesForMatch, withMatchRules, type MatchRules } from '../../sim/src/matchRules.js';
import { stageSurfacesAt, withStageMotion } from '../../sim/src/stageRuntime.js';
import { createTeamInteractionPolicy, validateTeamRules, type TeamRules } from '../../sim/src/teamPolicy.js';
import type { WorldState } from '../../sim/src/types.js';
import type { ConstructedMatch } from './matchFactory.js';

export interface MatchExecutionOptions { matchRules: MatchRules; friendlyFire?: boolean; damageAttribution?: DamageAttributionRules; stockRules?: StockMatchRules; }
export interface MatchExecution { initialState: WorldState; step(state: WorldState, input: MatchInputFrame): MatchStepResult; teamRules: TeamRules; matchRules: MatchRules; stockRules: StockMatchRules; }

/** Canonical production composition root. Conventional fighters add content, not glue code. */
export function createMatchExecution(constructed: ConstructedMatch, options: MatchExecutionOptions): MatchExecution {
  const participantIds = constructed.world.fighters.map((fighter) => fighter.id);
  const teamsEnabled = participantIds.some((id) => constructed.teamByParticipant[id] !== null);
  const teamRules: TeamRules = { enabled: teamsEnabled, friendlyFire: options.friendlyFire ?? false, teamByParticipant: constructed.teamByParticipant };
  validateTeamRules(participantIds, teamRules);
  const stockRules = stockLifecycleRulesForMatch(options.stockRules ?? constructed.stage.stockRules, options.matchRules);
  const interactionPolicy = createTeamInteractionPolicy(teamRules);
  const runtime = constructed.runtime;
  const rawStep = (state: WorldState, input: MatchInputFrame): MatchStepResult => stepMatchWorld(state,input,runtime.attacks,'__no-global-default-attack__',undefined,runtime.grabActions,stockRules,runtime.entityDefinitions,runtime.entitySpawnsByMoveId,runtime.moveRuntime,runtime.fighterPhysics,interactionPolicy);
  // Cancel permission must be applied before raw movement/action routing; armor is
  // reconciled after ordinary hit resolution. Both are pure authored move-frame policy.
  const authoredCombatAware = withAuthoredCombatPolicies(rawStep, runtime.moveRuntime);
  const landingAware = withAerialLandingPolicies(authoredCombatAware, runtime.aerialLanding, runtime.fighterPhysics);
  const stageAware = withStageMotion(landingAware, constructed.stage);
  const attributed = withDamageAttribution(stageAware, options.damageAttribution);
  const directed = withMatchRules(attributed, options.matchRules, teamRules);
  const initialState: WorldState = { ...constructed.world, surfaces: stageSurfacesAt(constructed.stage, 0), match: createMatchRuntimeState(participantIds, options.matchRules), winnerId: null };
  return { initialState, step: directed, teamRules, matchRules: options.matchRules, stockRules };
}
