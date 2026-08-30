import { fixed, type Fixed } from '../../deterministic-math/src/fixed.js';
import type { FighterPhysicsDefinition } from '../../content/src/compileFighterPhysics.js';
import type { MovementRules } from './movement.js';

export interface RuntimeHurtbox {
  radius: Fixed;
  offsetY: Fixed;
}

/** Fighter content supplies values; the universal movement rules supply policy. */
export function movementRulesForFighter(base: MovementRules, physics: FighterPhysicsDefinition | undefined): MovementRules {
  if (!physics) return base;
  return {
    ...base,
    walkSpeed: physics.walkSpeed,
    dashSpeed: physics.initialDashSpeed,
    runSpeed: physics.runSpeed,
    groundFriction: physics.traction,
    airAccel: physics.airAcceleration,
    maxAirSpeed: physics.airSpeed,
    fullHopSpeed: physics.fullHopVelocity,
    shortHopSpeed: physics.shortHopVelocity,
    doubleJumpSpeed: physics.doubleJumpVelocity,
    gravity: physics.gravity,
    maxFallSpeed: physics.fallSpeed,
    fastFallSpeed: physics.fastFallSpeed,
    jumpSquatFrames: physics.jumpSquatFrames,
  };
}

/**
 * Current collision kernel uses circular combat hurt volumes. Fighter pack width
 * and height are therefore adapted into a centered torso circle. This adapter is
 * deliberately isolated so a future multi-hurtbox/body-shape upgrade does not
 * change fighter pack data.
 */
export function hurtboxForFighter(physics: FighterPhysicsDefinition | undefined, fallbackRadius: Fixed, fallbackOffsetY: Fixed): RuntimeHurtbox {
  if (!physics) return { radius: fallbackRadius, offsetY: fallbackOffsetY };
  return {
    radius: fixed.div(physics.hurtboxWidth, fixed.fromInt(2)),
    offsetY: fixed.div(physics.hurtboxHeight, fixed.fromInt(2)),
  };
}
