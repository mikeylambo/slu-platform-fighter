import type { AerialLandingDefinition } from '../../content/src/compileLanding.js';
import type { FighterPhysicsDefinition } from '../../content/src/compileFighterPhysics.js';
import { isAutoCancelFrame } from '../../content/src/compileLanding.js';
import { movementRulesForFighter } from './fighterPhysics.js';
import type { MatchInputFrame, MatchStepResult } from './match.js';
import { K1_MOVEMENT, stepFighterMovement, type MovementRules } from './movement.js';
import type { FighterState, SimInputFrame, WorldState } from './types.js';

export type LandingAwareStep = (state: WorldState, input: MatchInputFrame) => MatchStepResult;

function neutral(frame: number): SimInputFrame {
  return { frame, moveX: 0, moveY: 0, jumpPressed: false, jumpHeld: false, attackPressed: false, specialPressed: false, grabPressed: false, smashX: 0, smashY: 0, dodgePressed: false, shieldHeld: false };
}

function predictsLanding(
  fighter: FighterState,
  input: SimInputFrame,
  state: WorldState,
  movementRules: MovementRules,
  physics: FighterPhysicsDefinition | undefined,
): boolean {
  if (fighter.grounded || fighter.attack === null || fighter.hitlagFrames > 0 || fighter.hitstunFrames > 0) return false;
  if (fighter.eliminated || fighter.respawnFrames > 0 || fighter.grabbedById !== null || fighter.grabTargetId !== null) return false;
  const rules = movementRulesForFighter(movementRules, physics);
  const projected = stepFighterMovement(fighter, input, state.surfaces, state.ledges, rules);
  return !fighter.grounded && projected.grounded && projected.locomotion === 'landing';
}

function landingInput(frame: number): SimInputFrame { return neutral(frame); }

/**
 * Adds fighter-authored aerial landing lag/autocancel to any canonical match step.
 * Landing is predicted with the same deterministic movement function so the aerial
 * can be terminated before same-frame combat resolution. Recovery then remains in
 * authoritative FighterState and therefore participates in rollback/replay hashes.
 */
export function withAerialLandingPolicies(
  step: LandingAwareStep,
  policies: ReadonlyMap<string, AerialLandingDefinition>,
  fighterPhysics: ReadonlyMap<string, FighterPhysicsDefinition> = new Map(),
  movementRules: MovementRules = K1_MOVEMENT,
): LandingAwareStep {
  return (state, input) => {
    const landingByFighter = new Map<string, { lag: number; autoCancel: boolean }>();
    const preFighters = state.fighters.map((fighter) => {
      if (fighter.attack === null) return fighter;
      const policy = policies.get(fighter.attack.attackId);
      if (!policy) return fighter;
      const fighterInput = input.byFighterId[fighter.id] ?? neutral(state.frame);
      if (!predictsLanding(fighter, fighterInput, state, movementRules, fighterPhysics.get(fighter.definitionId))) return fighter;
      const autoCancel = isAutoCancelFrame(policy, fighter.attack.frame);
      landingByFighter.set(fighter.id, { lag: autoCancel ? movementRules.landingFrames : policy.landingLagFrames, autoCancel });
      // Ending the aerial before the raw step prevents a landing-frame hitbox from resolving on the ground.
      return { ...fighter, attack: null };
    });

    const lockedIds = new Set(state.fighters.filter((fighter) => fighter.landingLagFrames > 0).map((fighter) => fighter.id));
    const sanitizedByFighterId: Record<string, SimInputFrame> = { ...input.byFighterId };
    for (const fighterId of lockedIds) sanitizedByFighterId[fighterId] = landingInput(state.frame);

    const preState = landingByFighter.size > 0 ? { ...state, fighters: preFighters } : state;
    const result = step(preState, { frame: input.frame, byFighterId: sanitizedByFighterId });
    const fighters = result.state.fighters.map((fighter) => {
      const started = landingByFighter.get(fighter.id);
      if (started) {
        if (fighter.hitstunFrames > 0 || !fighter.grounded) return { ...fighter, landingLagFrames: 0 };
        const remaining = Math.max(0, started.lag - 1);
        return { ...fighter, attack: null, landingLagFrames: remaining, locomotion: remaining > 0 ? 'landing' : fighter.locomotion, locomotionFrame: 0 };
      }
      const prior = state.fighters.find((candidate) => candidate.id === fighter.id);
      if (!prior || prior.landingLagFrames <= 0) return fighter;
      if (fighter.hitstunFrames > 0 || !fighter.grounded) return { ...fighter, landingLagFrames: 0 };
      const remaining = Math.max(0, prior.landingLagFrames - 1);
      return {
        ...fighter,
        attack: null,
        shielding: false,
        landingLagFrames: remaining,
        locomotion: remaining > 0 ? 'landing' : fighter.locomotion,
        locomotionFrame: remaining > 0 ? prior.locomotionFrame + 1 : fighter.locomotionFrame,
      };
    });
    return { ...result, state: { ...result.state, fighters } };
  };
}
