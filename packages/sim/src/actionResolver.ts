import type { FighterState, SimInputFrame } from './types.js';

export type StandardMoveName =
  | 'jab'
  | 'dash-attack'
  | 'forward-tilt' | 'up-tilt' | 'down-tilt'
  | 'forward-smash' | 'up-smash' | 'down-smash'
  | 'neutral-air' | 'forward-air' | 'back-air' | 'up-air' | 'down-air'
  | 'neutral-special' | 'side-special' | 'up-special' | 'down-special';

export interface ActionResolverRules {
  directionThreshold: number;
  smashThreshold: number;
}

export const STANDARD_ACTION_RULES: ActionResolverRules = {
  directionThreshold: 500,
  smashThreshold: 500,
};

function relativeHorizontal(value: number, facing: -1 | 1): number {
  return value * facing;
}

function directionalSpecial(input: SimInputFrame, facing: -1 | 1, rules: ActionResolverRules): StandardMoveName {
  if (input.moveY >= rules.directionThreshold) return 'up-special';
  if (input.moveY <= -rules.directionThreshold) return 'down-special';
  if (Math.abs(input.moveX) >= rules.directionThreshold) return 'side-special';
  return 'neutral-special';
}

function aerialAttack(input: SimInputFrame, facing: -1 | 1, rules: ActionResolverRules): StandardMoveName {
  if (input.moveY >= rules.directionThreshold) return 'up-air';
  if (input.moveY <= -rules.directionThreshold) return 'down-air';
  const relative = relativeHorizontal(input.moveX, facing);
  if (relative >= rules.directionThreshold) return 'forward-air';
  if (relative <= -rules.directionThreshold) return 'back-air';
  return 'neutral-air';
}

function groundedAttack(fighter: FighterState, input: SimInputFrame, rules: ActionResolverRules): StandardMoveName {
  const smashX = input.smashX ?? 0;
  const smashY = input.smashY ?? 0;
  if (Math.abs(smashY) >= Math.abs(smashX) && smashY >= rules.smashThreshold) return 'up-smash';
  if (Math.abs(smashY) >= Math.abs(smashX) && smashY <= -rules.smashThreshold) return 'down-smash';
  if (Math.abs(smashX) >= rules.smashThreshold) return 'forward-smash';

  if (fighter.locomotion === 'dash' || fighter.locomotion === 'run') return 'dash-attack';
  if (input.moveY >= rules.directionThreshold) return 'up-tilt';
  if (input.moveY <= -rules.directionThreshold) return 'down-tilt';
  if (Math.abs(input.moveX) >= rules.directionThreshold) return 'forward-tilt';
  return 'jab';
}

/** Resolves a controller-semantic combat request into a standard fighter-pack move name. */
export function resolveStandardMove(
  fighter: FighterState,
  input: SimInputFrame,
  rules: ActionResolverRules = STANDARD_ACTION_RULES,
): StandardMoveName | null {
  if (input.specialPressed) return directionalSpecial(input, fighter.facing, rules);
  const hasSmashRequest = Math.abs(input.smashX ?? 0) >= rules.smashThreshold || Math.abs(input.smashY ?? 0) >= rules.smashThreshold;
  if (!input.attackPressed && !hasSmashRequest) return null;
  if (!fighter.grounded) return aerialAttack(input, fighter.facing, rules);
  return groundedAttack(fighter, input, rules);
}

export function resolveStandardAttackId(
  fighterId: string,
  fighter: FighterState,
  input: SimInputFrame,
  availableAttackIds: ReadonlySet<string>,
  rules: ActionResolverRules = STANDARD_ACTION_RULES,
): string | null {
  const move = resolveStandardMove(fighter, input, rules);
  if (!move) return null;
  const attackId = `${fighterId}:${move}`;
  return availableAttackIds.has(attackId) ? attackId : null;
}
