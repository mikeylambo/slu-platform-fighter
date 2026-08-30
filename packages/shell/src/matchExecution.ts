import type { StockMatchRules } from '../../sim/src/lifecycle.js';
import { withAerialLandingPolicies } from '../../sim/src/aerialLanding.js';
import { withDamageAttribution, type DamageAttributionRules } from '../../sim/src/damageAttribution.js';
import { stepMatchWorld, type MatchInputFrame, type MatchStepResult } from '../../sim/src/match.js';
import { createMatchRuntimeState, stockLifecycleRulesForMatch, withMatchRules, type MatchRules } from '../../sim/src/matchRules.js';
import { createTeamInteractionPolicy, validateTeamRules, type TeamRules } from '../../sim/src/teamPolicy.js';
import type { WorldState } from '../../sim/src/types.js';
import type { ConstructedMatch } from './matchFactory.js';

export interface MatchExecutionOptions {
  matchRules: MatchRules;
  friendlyFire?: boolean;
  damageAttribution?: DamageAttributionRules;
  stockRules?: StockMatchRules;
}

export interface MatchExecution {
  initialState: WorldState;
  step(state: WorldState, input: MatchInputFrame): MatchStepResult;
  teamRules: TeamRules;
  matchRules: MatchRules;
  stockRules: StockMatchRules;
}

/**
 * Canonical production composition root. UI/content selection hands us a
 * ConstructedMatch; this function wires every universal runtime subsystem once.
 * Adding a conventional fighter does not add code here.
 */
export function createMatchExecution(constructed: ConstructedMatch, options: MatchExecutionOptions): MatchExecution {
  const participantIds = constructed.world.fighters.map((fighter) => fighter.id);
  const teamsEnabled = participantIds.some((id) => constructed.teamByParticipant[id] !== null);
  const teamRules: TeamRules = {
    enabled: teamsEnabled,
    friendlyFire: options.friendlyFire ?? false,
    teamByParticipant: constructed.teamByParticipant,
  };
  validateTeamRules(participantIds, teamRules);

  const stockRules = stockLifecycleRulesForMatch(options.stockRules ?? constructed.stage.stockRules, options.matchRules);
  const interactionPolicy = createTeamInteractionPolicy(teamRules);
  const runtime = constructed.runtime;

  // An impossible fallback id prevents mixed-roster matches from silently
  // borrowing another fighter's jab. Standard action routing is definition-scoped.
  const rawStep = (state: WorldState, input: MatchInputFrame): MatchStepResult => stepMatchWorld(
    state,
    input,
    runtime.attacks,
    '__no-global-default-attack__',
    undefined,
    runtime.grabActions,
    stockRules,
    runtime.entityDefinitions,
    runtime.entitySpawnsByMoveId,
    runtime.moveRuntime,
    runtime.fighterPhysics,
    interactionPolicy,
  );

  const landingAware = withAerialLandingPolicies(rawStep, runtime.aerialLanding, runtime.fighterPhysics);
  const attributed = withDamageAttribution(landingAware, options.damageAttribution);
  const directed = withMatchRules(attributed, options.matchRules, teamRules);
  const initialState: WorldState = {
    ...constructed.world,
    match: createMatchRuntimeState(participantIds, options.matchRules),
    winnerId: null,
  };

  return { initialState, step: directed, teamRules, matchRules: options.matchRules, stockRules };
}
