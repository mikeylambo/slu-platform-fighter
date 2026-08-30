import { fixed, type Fixed } from '../../deterministic-math/src/fixed.js';
import type { StageWallDefinition } from '../../content/src/compileStage.js';
import type { AttackDefinition } from './combat.js';
import type { MatchInputFrame, MatchStepResult } from './match.js';
import type { FighterState, StageLedge, StageSurface, WorldState } from './types.js';

export interface UniversalLocomotionRules {
  ledgeGetupOffset: Fixed;
  ledgeGetupInvulnerabilityFrames: number;
  ledgeRollSpeed: Fixed;
  ledgeRollFrames: number;
  ledgeAttackInvulnerabilityFrames: number;
  wallJumpHorizontalSpeed: Fixed;
  wallJumpVerticalSpeed: Fixed;
  wallClingFallSpeed: Fixed;
  wallContactTolerance: Fixed;
  hardLandingVelocityThreshold: Fixed;
  hardLandingFrames: number;
}

export const ENGINEERING_UNIVERSAL_LOCOMOTION: UniversalLocomotionRules = {
  ledgeGetupOffset: fixed.fromRatio(3, 4),
  ledgeGetupInvulnerabilityFrames: 20,
  ledgeRollSpeed: fixed.fromRatio(4, 25),
  ledgeRollFrames: 20,
  ledgeAttackInvulnerabilityFrames: 12,
  wallJumpHorizontalSpeed: fixed.fromRatio(1, 4),
  wallJumpVerticalSpeed: fixed.fromRatio(9, 20),
  wallClingFallSpeed: fixed.fromRatio(1, 10),
  wallContactTolerance: fixed.fromRatio(1, 20),
  hardLandingVelocityThreshold: fixed.fromRatio(2, 5),
  hardLandingFrames: 8,
};

export interface UniversalLocomotionOptions {
  wallJumpEnabled: boolean;
  wallClingEnabled: boolean;
  rules?: UniversalLocomotionRules;
}
export type UniversalLocomotionStep = (state: WorldState, input: MatchInputFrame) => MatchStepResult;

function surfaceForLedge(ledge: StageLedge, surfaces: readonly StageSurface[]): StageSurface | undefined {
  return [...surfaces]
    .filter((surface) => surface.y === ledge.y)
    .filter((surface) => ledge.x === surface.xMin || ledge.x === surface.xMax || (ledge.x >= surface.xMin && ledge.x <= surface.xMax))
    .sort((a, b) => a.id.localeCompare(b.id))[0];
}
function neutralizedInput(input: MatchInputFrame, fighterId: string): MatchInputFrame {
  const existing = input.byFighterId[fighterId]; if (!existing) return input;
  return { ...input, byFighterId: { ...input.byFighterId, [fighterId]: { ...existing, attackPressed: false, dodgePressed: false, jumpPressed: false, grabPressed: false } } };
}

function preprocessLedgeOptions(
  state: WorldState,
  input: MatchInputFrame,
  attacks: ReadonlyMap<string, AttackDefinition>,
  rules: UniversalLocomotionRules,
): { state: WorldState; input: MatchInputFrame } {
  let nextInput = input;
  const fighters = state.fighters.map((fighter) => {
    if (fighter.locomotion !== 'ledge-hang' || fighter.ledgeId === null) return fighter;
    const fighterInput = input.byFighterId[fighter.id]; if (!fighterInput) return fighter;
    const ledge = state.ledges.find((entry) => entry.id === fighter.ledgeId); if (!ledge) return fighter;
    const surface = surfaceForLedge(ledge, state.surfaces); if (!surface) return fighter;
    const inward = ledge.inward;
    const ontoStageX = fixed.add(ledge.x, fixed.mul(fixed.fromInt(inward), rules.ledgeGetupOffset));
    const wantsAttack = fighterInput.attackPressed;
    const wantsRoll = fighterInput.dodgePressed;
    const wantsGetup = fighterInput.moveY > 400 || fighterInput.moveX * inward > 400;
    if (!wantsAttack && !wantsRoll && !wantsGetup) return fighter;
    nextInput = neutralizedInput(nextInput, fighter.id);
    const common: FighterState = {
      ...fighter,
      x: ontoStageX, y: ledge.y, grounded: true, groundSurfaceId: surface.id, ledgeId: null,
      ledgeRegrabLockoutFrames: Math.max(fighter.ledgeRegrabLockoutFrames, 30),
      fastFalling: false, vy: fixed.zero,
    };
    if (wantsRoll) return { ...common, locomotion: 'roll', locomotionFrame: 0, vx: fixed.mul(fixed.fromInt(inward), rules.ledgeRollSpeed), facing: inward, invulnerableFrames: Math.max(common.invulnerableFrames, rules.ledgeGetupInvulnerabilityFrames) };
    if (wantsAttack) {
      const attackId = `${fighter.definitionId}:ledge-attack`;
      return { ...common, locomotion: 'idle', locomotionFrame: 0, vx: fixed.zero, attack: attacks.has(attackId) ? { attackId, frame: 0, hitTargets: [] } : null, invulnerableFrames: Math.max(common.invulnerableFrames, rules.ledgeAttackInvulnerabilityFrames), facing: inward };
    }
    return { ...common, locomotion: 'idle', locomotionFrame: 0, vx: fixed.zero, facing: inward, invulnerableFrames: Math.max(common.invulnerableFrames, rules.ledgeGetupInvulnerabilityFrames) };
  });
  return { state: { ...state, fighters }, input: nextInput };
}

function crossingWall(before: FighterState, after: FighterState, wall: StageWallDefinition, tolerance: Fixed): boolean {
  const inVerticalSpan = after.y >= wall.yMin && after.y <= wall.yMax;
  if (!inVerticalSpan) return false;
  if (wall.normal === -1) return before.x <= fixed.add(wall.x, tolerance) && after.x >= wall.x;
  return before.x >= fixed.sub(wall.x, tolerance) && after.x <= wall.x;
}

function resolveWallContact(before: FighterState, after: FighterState, input: MatchInputFrame, walls: readonly StageWallDefinition[], options: UniversalLocomotionOptions, rules: UniversalLocomotionRules): FighterState {
  if (after.grounded || after.eliminated || after.respawnFrames > 0) return after;
  const fighterInput = input.byFighterId[after.id];
  for (const wall of walls) {
    if (!crossingWall(before, after, wall, rules.wallContactTolerance)) continue;
    const towardWall = fighterInput ? fighterInput.moveX * wall.normal < -300 : false;
    if (options.wallJumpEnabled && fighterInput?.jumpPressed) {
      return { ...after, x: wall.x, vx: fixed.mul(fixed.fromInt(wall.normal), rules.wallJumpHorizontalSpeed), vy: rules.wallJumpVerticalSpeed, facing: wall.normal, locomotion: 'airborne', locomotionFrame: 0, grounded: false, groundSurfaceId: null, fastFalling: false };
    }
    if (options.wallClingEnabled && towardWall) {
      return { ...after, x: wall.x, vx: fixed.zero, vy: after.vy < fixed.sub(fixed.zero, rules.wallClingFallSpeed) ? fixed.sub(fixed.zero, rules.wallClingFallSpeed) : after.vy, facing: fixed.sign(fixed.fromInt(-wall.normal)) === 0 ? after.facing : (-wall.normal as -1 | 1), locomotion: 'airborne', locomotionFrame: 0 };
    }
    return { ...after, x: wall.x, vx: fixed.zero };
  }
  return after;
}

function applyHardLanding(before: FighterState, after: FighterState, rules: UniversalLocomotionRules): FighterState {
  const threshold = fixed.sub(fixed.zero, rules.hardLandingVelocityThreshold);
  if (before.grounded || !after.grounded || before.vy > threshold || before.hitstunFrames > 0) return after;
  return { ...after, locomotion: 'landing', locomotionFrame: 0, landingLagFrames: Math.max(after.landingLagFrames, rules.hardLandingFrames), vx: fixed.zero };
}

export function withUniversalLocomotion(
  step: UniversalLocomotionStep,
  walls: readonly StageWallDefinition[],
  attacks: ReadonlyMap<string, AttackDefinition>,
  options: UniversalLocomotionOptions,
): UniversalLocomotionStep {
  const rules = options.rules ?? ENGINEERING_UNIVERSAL_LOCOMOTION;
  return (state, input) => {
    const ledgePrepared = preprocessLedgeOptions(state, input, attacks, rules);
    const beforeById = new Map(ledgePrepared.state.fighters.map((fighter) => [fighter.id, fighter] as const));
    const result = step(ledgePrepared.state, ledgePrepared.input);
    const fighters = result.state.fighters.map((fighter) => {
      const before = beforeById.get(fighter.id); if (!before) return fighter;
      const wallResolved = resolveWallContact(before, fighter, ledgePrepared.input, walls, options, rules);
      return applyHardLanding(before, wallResolved, rules);
    });
    return { state: { ...result.state, fighters }, events: result.events };
  };
}
