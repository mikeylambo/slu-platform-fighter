import type { StockMatchRules } from '../../sim/src/lifecycle.js';
import { withAerialLandingPolicies } from '../../sim/src/aerialLanding.js';
import { withAuthoredCombatPolicies } from '../../sim/src/authoredCombatPolicies.js';
import { withDamageAttribution, type DamageAttributionRules } from '../../sim/src/damageAttribution.js';
import { withGrabEscape, type GrabEscapePolicy } from '../../sim/src/grabEscape.js';
import { withAuthoritativeItems, type ItemRuntimePolicy } from '../../sim/src/itemRuntime.js';
import { stepMatchWorld, type MatchInputFrame, type MatchStepResult } from '../../sim/src/match.js';
import { createMatchRuntimeState, stockLifecycleRulesForMatch, withMatchRules, type MatchRules } from '../../sim/src/matchRules.js';
import { withMoveFollowUps } from '../../sim/src/moveFollowUps.js';
import { withParry } from '../../sim/src/parry.js';
import type { ParryPolicy } from '../../sim/src/combatPolicies.js';
import { withSmashCharge } from '../../sim/src/smashCharge.js';
import { withStageActors, type StageActorSpawnRule } from '../../sim/src/stageActors.js';
import { withStageHazards } from '../../sim/src/stageHazards.js';
import type { HazardEffectPolicy } from '../../sim/src/stageHazards.js';
import { stageSurfacesAt, withStageMotion } from '../../sim/src/stageRuntime.js';
import { withUniversalLocomotion, type UniversalLocomotionRules } from '../../sim/src/universalLocomotion.js';
import { createTeamInteractionPolicy, validateTeamRules, type TeamRules } from '../../sim/src/teamPolicy.js';
import { withWeightScaling, type WeightScalingPolicy } from '../../sim/src/weightScaling.js';
import type { WorldState } from '../../sim/src/types.js';
import type { ConstructedMatch } from './matchFactory.js';

export interface MatchExecutionOptions {
  matchRules: MatchRules;
  friendlyFire?: boolean;
  damageAttribution?: DamageAttributionRules;
  stockRules?: StockMatchRules;
  wallJumpEnabled?: boolean;
  wallClingEnabled?: boolean;
  universalLocomotionRules?: UniversalLocomotionRules;
  parryPolicy?: ParryPolicy;
  weightScalingPolicy?: WeightScalingPolicy;
  grabEscapePolicy?: GrabEscapePolicy;
  itemRuntime?: ItemRuntimePolicy;
  hazardEffects?: HazardEffectPolicy;
  stageActorRules?: readonly StageActorSpawnRule[];
}
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

  // Content-owned fighter expression is always composed. Empty registries are no-ops.
  let composed = withAuthoredCombatPolicies(rawStep, runtime.moveRuntime);
  composed = withMoveFollowUps(composed, runtime.moveFollowUps);
  composed = withSmashCharge(composed, runtime.smashCharges);

  // Optional universal rules are activated only by explicit match/ruleset policy.
  if (options.grabEscapePolicy) composed = withGrabEscape(composed, options.grabEscapePolicy);
  if (options.parryPolicy) composed = withParry(composed, options.parryPolicy);
  if (options.weightScalingPolicy) composed = withWeightScaling(composed, runtime.fighterPhysics, options.weightScalingPolicy);
  if (options.itemRuntime) composed = withAuthoritativeItems(composed, options.itemRuntime);
  if (options.stageActorRules?.length) composed = withStageActors(composed, constructed.stage.id, options.stageActorRules, runtime.entityDefinitions);
  if (options.hazardEffects) composed = withStageHazards(composed, constructed.stage, options.hazardEffects);

  const locomotionAware = withUniversalLocomotion(composed, constructed.stage.walls, runtime.attacks, {
    wallJumpEnabled: options.wallJumpEnabled ?? true,
    wallClingEnabled: options.wallClingEnabled ?? false,
    ...(options.universalLocomotionRules ? { rules: options.universalLocomotionRules } : {}),
  });
  const landingAware = withAerialLandingPolicies(locomotionAware, runtime.aerialLanding, runtime.fighterPhysics);
  const stageAware = withStageMotion(landingAware, constructed.stage);
  const attributed = withDamageAttribution(stageAware, options.damageAttribution);
  const directed = withMatchRules(attributed, options.matchRules, teamRules);
  const initialState: WorldState = {
    ...constructed.world,
    entities: constructed.world.entities ?? [],
    nextEntitySerial: constructed.world.nextEntitySerial ?? 1,
    items: constructed.world.items ?? [],
    nextItemSerial: constructed.world.nextItemSerial ?? 1,
    surfaces: stageSurfacesAt(constructed.stage, 0),
    match: createMatchRuntimeState(participantIds, options.matchRules),
    winnerId: null,
  };
  return { initialState, step: directed, teamRules, matchRules: options.matchRules, stockRules };
}
