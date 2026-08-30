import { fixed, type Fixed } from '../../deterministic-math/src/fixed.js';
import { K1_MOVEMENT, resolveGroundImpact, sanitizeInput, type MovementRules } from './movement.js';
import type { FighterState, SimInputFrame, StageSurface } from './types.js';

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
 * Advances launch velocity during hitstun without granting ordinary locomotion,
 * jumps, fastfall, dodges, or automatic ledge grabs. Hitlag is handled by the
 * match layer and must not call this function.
 *
 * Dodge input is still sampled into the tech buffer so collision reactions can
 * be authored/certified independently of future DI/SDI policy.
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
