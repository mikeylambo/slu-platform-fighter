import { fixed as f } from '../../../../../packages/deterministic-math/src/fixed.js';
import { K1_MOVEMENT } from '../../../../../packages/sim/src/movement.js';
import type { FighterPhysicsDefinition } from '../../../../../packages/content/src/compileFighterPhysics.js';
// GDD units / 5 = PF world units. Velocities and acceleration share this scale.
export const PHYSICS = {
  unitsPerWorld: 5, weight: 85, walk: 1.10, run: 1.85, gravity: .095,
  fullHopVelocity: 2.59, shortHopVelocity: 1.79, airHopVelocity: 2.27,
  airAccel: .09, traction: .2, squat: 3, buffer: 5,
  wings: { jumps: 3, air: 1.30, fall: 1.40, fast: 2.20 },
  cape: { jumps: 2, air: 1.05, fall: 1.65, fast: 2.60 },
  glide: { duration: 120, maxPitch: 35, minSpeed: 1.1, maxSpeed: 2.4, initialSpeed: 1.65, acceleration: .014, lift: .52, sink: .045, landing: 8 },
  hurtboxWidth: 1.3, hurtboxHeight: 2.8, ledgeInvulnerability: 30,
} as const;
export const worldValue = (value: number) => f.fromRatio(Math.round(value * 10000), PHYSICS.unitsPerWorld * 10000);
export const MOVEMENT = { ...K1_MOVEMENT, jumpBufferFrames: PHYSICS.buffer, groundAccel: worldValue(.32), groundFriction: worldValue(PHYSICS.traction), ledgeInvulnFrames: PHYSICS.ledgeInvulnerability, wallJumpEnabled: false, groundDodgeInvulnFrames: 0, airDodgeInvulnFrames: 0 };
export function knightPhysics(stance: 'wings' | 'cape'): FighterPhysicsDefinition {
  const s = PHYSICS[stance];
  return { id: stance, weight: PHYSICS.weight, hurtboxWidth: f.fromRatio(13,10), hurtboxHeight: f.fromRatio(28,10), walkSpeed: worldValue(PHYSICS.walk), initialDashSpeed: worldValue(PHYSICS.run), runSpeed: worldValue(PHYSICS.run), gravity: worldValue(PHYSICS.gravity), fallSpeed: worldValue(s.fall), fastFallSpeed: worldValue(s.fast), shortHopVelocity: worldValue(PHYSICS.shortHopVelocity), fullHopVelocity: worldValue(PHYSICS.fullHopVelocity), doubleJumpVelocity: worldValue(PHYSICS.airHopVelocity), airAcceleration: worldValue(PHYSICS.airAccel), airSpeed: worldValue(s.air), traction: worldValue(PHYSICS.traction), jumpSquatFrames: PHYSICS.squat };
}
export const PHYSICS_REGISTRY = new Map(['wings','cape'].map(s => [s, knightPhysics(s as 'wings'|'cape')]));
