import type { AttackDefinition } from '../../sim/src/combat.js';
import type { FighterState, WorldState } from '../../sim/src/types.js';

export interface FighterActionabilityTelemetry {
  fighterId: string;
  attackId: string | null;
  attackFrame: number | null;
  attackRemainingFrames: number;
  landingLagFrames: number;
  hitlagFrames: number;
  hitstunFrames: number;
  shieldStunFrames: number;
  respawnFrames: number;
  /** Conservative number of frames until ordinary player action can resume. */
  actionLockFrames: number;
}

export interface ActionabilityGap {
  firstFighterId: string;
  secondFighterId: string;
  /** Positive means first fighter is actionable this many frames sooner. */
  firstAdvantageFrames: number;
  first: FighterActionabilityTelemetry;
  second: FighterActionabilityTelemetry;
}

export function fighterActionability(fighter: FighterState, attacks: ReadonlyMap<string, AttackDefinition>): FighterActionabilityTelemetry {
  const attackDefinition = fighter.attack ? attacks.get(fighter.attack.attackId) : undefined;
  const attackRemainingFrames = fighter.attack && attackDefinition
    ? Math.max(0, attackDefinition.totalFrames - fighter.attack.frame - 1)
    : 0;
  const actionLockFrames = Math.max(
    attackRemainingFrames,
    fighter.landingLagFrames,
    fighter.hitlagFrames,
    fighter.hitstunFrames,
    fighter.shieldStunFrames,
    fighter.respawnFrames,
  );
  return {
    fighterId: fighter.id,
    attackId: fighter.attack?.attackId ?? null,
    attackFrame: fighter.attack?.frame ?? null,
    attackRemainingFrames,
    landingLagFrames: fighter.landingLagFrames,
    hitlagFrames: fighter.hitlagFrames,
    hitstunFrames: fighter.hitstunFrames,
    shieldStunFrames: fighter.shieldStunFrames,
    respawnFrames: fighter.respawnFrames,
    actionLockFrames,
  };
}

/**
 * Renderer/lab diagnostic only. This is intentionally called an actionability
 * gap rather than definitive frame advantage: future cancel/parry rules may
 * create earlier legal actions than the conservative universal lock estimate.
 */
export function actionabilityGap(
  state: WorldState,
  firstFighterId: string,
  secondFighterId: string,
  attacks: ReadonlyMap<string, AttackDefinition>,
): ActionabilityGap {
  const firstFighter = state.fighters.find((fighter) => fighter.id === firstFighterId);
  const secondFighter = state.fighters.find((fighter) => fighter.id === secondFighterId);
  if (!firstFighter || !secondFighter) throw new Error(`training actionability requires fighters ${firstFighterId} and ${secondFighterId}`);
  const first = fighterActionability(firstFighter, attacks);
  const second = fighterActionability(secondFighter, attacks);
  return {
    firstFighterId,
    secondFighterId,
    firstAdvantageFrames: second.actionLockFrames - first.actionLockFrames,
    first,
    second,
  };
}
