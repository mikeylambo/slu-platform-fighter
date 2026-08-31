import { fixed, type Fixed } from '../../deterministic-math/src/fixed.js';
import type { CompiledStageDefinition, StageHazardDefinition } from '../../content/src/compileStage.js';
import type { MatchInputFrame, MatchStepResult } from './match.js';
import type { FighterState, WorldState } from './types.js';

export interface HazardEffectPolicy {
  damageTenthsByHazardId?: Readonly<Record<string, number>>;
  launchByHazardId?: Readonly<Record<string, { x: Fixed; y: Fixed; hitstunFrames: number }>>;
}
export type HazardEffect =
  | { type: 'damage'; hazardId: string; targetId: string; damageTenths: number }
  | { type: 'launch'; hazardId: string; targetId: string; x: Fixed; y: Fixed; hitstunFrames: number }
  | { type: 'ko'; hazardId: string; targetId: string };
export type HazardAwareStep = (state: WorldState, input: MatchInputFrame) => MatchStepResult;

export function hazardActiveAtFrame(hazard: StageHazardDefinition, frame: number): boolean {
  const cycle = hazard.activeFrames + hazard.inactiveFrames;
  if (cycle <= 0 || hazard.activeFrames <= 0) return false;
  const local = ((frame + hazard.phaseFrames) % cycle + cycle) % cycle;
  return local < hazard.activeFrames;
}

export function resolveHazardEffect(hazard: StageHazardDefinition, targetId: string, policy: HazardEffectPolicy): HazardEffect {
  if (hazard.kind === 'ko') return { type: 'ko', hazardId: hazard.id, targetId };
  if (hazard.kind === 'damage') {
    const damageTenths = policy.damageTenthsByHazardId?.[hazard.id];
    if (damageTenths === undefined || !Number.isInteger(damageTenths) || damageTenths < 0) throw new Error(`hazard ${hazard.id} requires authored nonnegative integer damageTenths policy`);
    return { type: 'damage', hazardId: hazard.id, targetId, damageTenths };
  }
  const launch = policy.launchByHazardId?.[hazard.id];
  if (!launch || !Number.isInteger(launch.x) || !Number.isInteger(launch.y) || !Number.isInteger(launch.hitstunFrames) || launch.hitstunFrames < 0) throw new Error(`hazard ${hazard.id} requires authored launch policy`);
  return { type: 'launch', hazardId: hazard.id, targetId, ...launch };
}

function overlapsHazard(fighter: FighterState, hazard: StageHazardDefinition): boolean {
  const dx = fixed.sub(fighter.x, hazard.x);
  const dy = fixed.sub(fighter.y, hazard.y);
  return fixed.add(fixed.mul(dx, dx), fixed.mul(dy, dy)) <= fixed.mul(hazard.radius, hazard.radius);
}

function applyHazardEffect(fighter: FighterState, effect: HazardEffect, stage: CompiledStageDefinition): FighterState {
  if (effect.type === 'damage') return { ...fighter, percentTenths: fighter.percentTenths + effect.damageTenths };
  if (effect.type === 'launch') {
    return {
      ...fighter,
      vx: effect.x,
      vy: effect.y,
      hitstunFrames: Math.max(fighter.hitstunFrames, effect.hitstunFrames),
      attack: null,
      shielding: false,
      grounded: false,
      groundSurfaceId: null,
      locomotion: 'airborne',
      locomotionFrame: 0,
    };
  }
  return {
    ...fighter,
    x: fixed.sub(stage.stockRules.blastLeft, fixed.fromInt(1)),
    y: fixed.sub(stage.stockRules.blastBottom, fixed.fromInt(1)),
    vx: fixed.zero,
    vy: fixed.zero,
    hitstunFrames: Math.max(1, fighter.hitstunFrames),
    attack: null,
    shielding: false,
    grounded: false,
    groundSurfaceId: null,
    locomotion: 'airborne',
    locomotionFrame: 0,
  };
}

/** Applies active authored stage hazards before the canonical match step so stock lifecycle sees KO hazards in the same deterministic frame. */
export function applyStageHazards(state: WorldState, stage: CompiledStageDefinition, policy: HazardEffectPolicy): WorldState {
  if (stage.hazards.length === 0) return state;
  const fighters = state.fighters.map((fighter) => {
    if (fighter.eliminated || fighter.respawnFrames > 0 || fighter.invulnerableFrames > 0) return fighter;
    let next = fighter;
    for (const hazard of stage.hazards) {
      if (!hazardActiveAtFrame(hazard, state.frame) || !overlapsHazard(next, hazard)) continue;
      next = applyHazardEffect(next, resolveHazardEffect(hazard, next.id, policy), stage);
    }
    return next;
  });
  return { ...state, fighters };
}

/** Deterministic composition adapter: stage hazard content/policy -> ordinary canonical match step. */
export function withStageHazards(step: HazardAwareStep, stage: CompiledStageDefinition, policy: HazardEffectPolicy): HazardAwareStep {
  return (state, input) => step(applyStageHazards(state, stage, policy), input);
}
