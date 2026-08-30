import { fixed, type Fixed } from '../../deterministic-math/src/fixed.js';
import { K1_MOVEMENT, resolveGroundImpact, sanitizeInput, type MovementRules } from './movement.js';
import type { FighterState, SimInputFrame, StageSurface } from './types.js';

export interface KnockbackControlRules {
  /** Maximum perpendicular launch adjustment at full analogue input, in thousandths. */
  diStrengthPerThousand: number;
  /** Minimum stick change from prior sampled frame required to count as an SDI flick. */
  sdiFlickThreshold: number;
  /** World-space displacement produced by a qualifying full-strength SDI flick. */
  sdiDistance: Fixed;
}

export const K3_KNOCKBACK_CONTROL: KnockbackControlRules = {
  diStrengthPerThousand: 180,
  sdiFlickThreshold: 650,
  sdiDistance: fixed.fromRatio(3, 10),
};

function signOutsideDeadzone(value: number, rules: MovementRules): -1 | 0 | 1 {
  if (value > rules.deadzone) return 1;
  if (value < -rules.deadzone) return -1;
  return 0;
}

function findLandingSurface(oldY: Fixed, newY: Fixed, x: Fixed, surfaces: StageSurface[]): StageSurface | undefined {
  if (newY > oldY) return undefined;
  return surfaces
    .filter((surface) => x >= surface.xMin && x <= surface.xMax)
    .filter((surface) => oldY >= surface.y && newY <= surface.y)
    .sort((a, b) => b.y - a.y || a.id.localeCompare(b.id))[0];
}

/**
 * Applies defender directional influence exactly once to a newly-created launch.
 * The authored/base knockback remains the primary vector; DI contributes only a
 * bounded perpendicular component, so it changes launch angle without becoming
 * ordinary air movement or replacing fighter-authored knockback magnitude.
 */
export function applyDirectionalInfluence(
  vx: Fixed,
  vy: Fixed,
  rawInput: SimInputFrame,
  rules: KnockbackControlRules = K3_KNOCKBACK_CONTROL,
): { vx: Fixed; vy: Fixed } {
  const stickMagnitude = Math.max(Math.abs(rawInput.moveX), Math.abs(rawInput.moveY));
  if (stickMagnitude === 0 || (vx === fixed.zero && vy === fixed.zero)) return { vx, vy };

  const launchMagnitude = Math.max(fixed.abs(vx), fixed.abs(vy), 1);
  const perpendicularX = fixed.fromRatio(-vy, launchMagnitude);
  const perpendicularY = fixed.fromRatio(vx, launchMagnitude);
  const normalizedStickX = fixed.fromRatio(rawInput.moveX, Math.max(stickMagnitude, 1));
  const normalizedStickY = fixed.fromRatio(rawInput.moveY, Math.max(stickMagnitude, 1));
  const perpendicularIntent = fixed.add(fixed.mul(normalizedStickX, perpendicularX), fixed.mul(normalizedStickY, perpendicularY));
  const boundedIntent = Math.max(-fixed.one, Math.min(fixed.one, perpendicularIntent)) as Fixed;
  const strength = fixed.mul(fixed.fromRatio(rules.diStrengthPerThousand, 1000), boundedIntent);

  return {
    vx: fixed.add(vx, fixed.mul(fixed.mul(perpendicularX, launchMagnitude), strength)),
    vy: fixed.add(vy, fixed.mul(fixed.mul(perpendicularY, launchMagnitude), strength)),
  };
}

/**
 * Samples analogue flicks while hitlag is active. Qualifying direction changes
 * displace the fighter but never alter launch velocity. Input history is updated
 * here because ordinary movement is intentionally frozen during hitlag.
 */
export function stepHitlagSDI(
  fighter: FighterState,
  rawInput: SimInputFrame,
  movementRules: MovementRules = K1_MOVEMENT,
  rules: KnockbackControlRules = K3_KNOCKBACK_CONTROL,
): FighterState {
  const input = sanitizeInput(rawInput, movementRules);
  const prior = fighter.inputHistory.at(-1);
  const history = [...fighter.inputHistory, input].slice(-movementRules.inputHistoryFrames);
  if (!prior) return { ...fighter, inputHistory: history };

  const deltaX = input.moveX - prior.moveX;
  const deltaY = input.moveY - prior.moveY;
  const flickMagnitude = Math.max(Math.abs(deltaX), Math.abs(deltaY));
  if (flickMagnitude < rules.sdiFlickThreshold) return { ...fighter, inputHistory: history };

  const currentMagnitude = Math.max(Math.abs(input.moveX), Math.abs(input.moveY));
  if (currentMagnitude <= movementRules.deadzone) return { ...fighter, inputHistory: history };

  const dx = fixed.mul(fixed.fromRatio(input.moveX, currentMagnitude), rules.sdiDistance);
  const dy = fixed.mul(fixed.fromRatio(input.moveY, currentMagnitude), rules.sdiDistance);
  return { ...fighter, x: fixed.add(fighter.x, dx), y: fixed.add(fighter.y, dy), inputHistory: history };
}

/**
 * Advances launch velocity during hitstun without granting ordinary locomotion,
 * jumps, fastfall, dodges, or automatic ledge grabs. Hitlag is handled by the
 * match layer and must not call this function.
 *
 * Dodge input is still sampled into the tech buffer so collision reactions can
 * be authored/certified independently of launch-direction policy.
 */
export function stepHitstunKnockback(
  fighter: FighterState,
  rawInput: SimInputFrame,
  surfaces: StageSurface[],
  rules: MovementRules = K1_MOVEMENT,
): FighterState {
  const input = sanitizeInput(rawInput, rules);
  const history = [...fighter.inputHistory, input].slice(-rules.inputHistoryFrames);
  const horizontalIntent = signOutsideDeadzone(input.moveX, rules);
  const techBufferFrames = input.dodgePressed ? rules.techBufferFrames : Math.max(0, fighter.techBufferFrames - 1);
  const ledgeRegrabLockoutFrames = Math.max(0, fighter.ledgeRegrabLockoutFrames - 1);
  const invulnerableFrames = Math.max(0, fighter.invulnerableFrames - 1);
  const dodgeCooldownFrames = Math.max(0, fighter.dodgeCooldownFrames - 1);

  let vx = fighter.vx;
  let vy = fighter.vy;
  let x = fighter.x;
  let y = fighter.y;

  if (!fighter.grounded) vy = fixed.sub(vy, rules.gravity);
  const oldY = y;
  x = fixed.add(x, vx);
  y = fixed.add(y, vy);

  let next: FighterState = {
    ...fighter,
    x,
    y,
    vx,
    vy,
    grounded: false,
    groundSurfaceId: null,
    locomotion: 'airborne',
    locomotionFrame: fighter.locomotionFrame + 1,
    shielding: false,
    attack: null,
    inputHistory: history,
    techBufferFrames,
    ledgeRegrabLockoutFrames,
    invulnerableFrames,
    dodgeCooldownFrames,
    fastFalling: false,
  };

  if (vy <= fixed.zero) {
    const landing = findLandingSurface(oldY, y, x, surfaces);
    if (landing) {
      next = {
        ...next,
        y: landing.y,
        grounded: true,
        groundSurfaceId: landing.id,
      };
      next = resolveGroundImpact(next, horizontalIntent, rules);
      next = { ...next, groundSurfaceId: landing.id };
    }
  }

  return next;
}
