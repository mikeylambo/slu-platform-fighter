import { fixed as f } from '../../../../../packages/deterministic-math/src/fixed.js';
import { K1_MOVEMENT } from '../../../../../packages/sim/src/movement.js';
import type { FighterPhysicsDefinition } from '../../../../../packages/content/src/compileFighterPhysics.js';
// GDD units / 5 = PF world units. Velocities and acceleration share this scale.
export const PHYSICS = {
  unitsPerWorld: 5,
  weight: 85,
  walk: 1.2,
  run: 1.85,
  gravity: 0.095,
  fullHopVelocity: 2.59,
  shortHopVelocity: 1.79,
  airHopVelocity: 2.27,
  airAccel: 0.08,
  traction: 0.06,
  squat: 3,
  buffer: 5,
  wings: { jumps: 3, air: 0.9, fall: 1.4, fast: 1.95 },
  cape: { jumps: 2, air: 0.75, fall: 1.65, fast: 2.3 },
  glide: {
    duration: 120,
    maxPitch: 35,
    minSpeed: 1.1,
    maxSpeed: 2.4,
    initialSpeed: 1.65,
    acceleration: 0.014,
    lift: 0.52,
    sink: 0.045,
    landing: 8,
  },
  hurtboxWidth: 1.3,
  hurtboxHeight: 2.8,
  ledgeInvulnerability: 30,
} as const;
export const worldValue = (value: number) => f.fromRatio(Math.round(value * 10000), PHYSICS.unitsPerWorld * 10000);
export const MOVEMENT = {
  ...K1_MOVEMENT,
  jumpBufferFrames: PHYSICS.buffer,
  groundAccel: worldValue(0.32),
  groundFriction: worldValue(PHYSICS.traction),
  ledgeInvulnFrames: PHYSICS.ledgeInvulnerability,
  wallJumpEnabled: false,
  groundDodgeInvulnFrames: 0,
  airDodgeInvulnFrames: 0,
};
/**
 * Feel lab (GDD 16 open items): jumpsquat 3f vs Brawl's 4f, traction between Brawl's
 * slide (0.04) and a grippier 0.10. A match carries its feel in replay state, so A/B
 * runs stay deterministic. Absent = the GDD default (3f, 0.06).
 */
export const FEEL = {
  jumpsquat: [3, 4] as const,
  traction: { brawl: 0.04, gdd: 0.06, grippy: 0.1 } as const,
};
export type TractionPreset = keyof typeof FEEL.traction;
export interface FeelSettings {
  jumpsquat: (typeof FEEL.jumpsquat)[number];
  traction: TractionPreset;
}
export const DEFAULT_FEEL: FeelSettings = { jumpsquat: PHYSICS.squat, traction: 'gdd' };

export function knightPhysics(stance: 'wings' | 'cape', feel: FeelSettings = DEFAULT_FEEL): FighterPhysicsDefinition {
  const s = PHYSICS[stance];
  const traction = FEEL.traction[feel.traction];
  return {
    id: stance,
    weight: PHYSICS.weight,
    hurtboxWidth: f.fromRatio(13, 10),
    hurtboxHeight: f.fromRatio(28, 10),
    walkSpeed: worldValue(PHYSICS.walk),
    initialDashSpeed: worldValue(PHYSICS.run),
    runSpeed: worldValue(PHYSICS.run),
    gravity: worldValue(PHYSICS.gravity),
    fallSpeed: worldValue(s.fall),
    fastFallSpeed: worldValue(s.fast),
    shortHopVelocity: worldValue(PHYSICS.shortHopVelocity),
    fullHopVelocity: worldValue(PHYSICS.fullHopVelocity),
    doubleJumpVelocity: worldValue(PHYSICS.airHopVelocity),
    airAcceleration: worldValue(PHYSICS.airAccel),
    airSpeed: worldValue(s.air),
    traction: worldValue(traction),
    jumpSquatFrames: feel.jumpsquat,
  };
}
export const PHYSICS_REGISTRY = new Map(['wings', 'cape'].map((s) => [s, knightPhysics(s as 'wings' | 'cape')]));

const registries = new Map<string, Map<string, FighterPhysicsDefinition>>();

/** Physics registry for a feel setting (cached; the default is `PHYSICS_REGISTRY`). */
export function physicsRegistry(feel: FeelSettings | undefined): Map<string, FighterPhysicsDefinition> {
  if (!feel) {
    return PHYSICS_REGISTRY;
  }
  const key = `${feel.jumpsquat}:${feel.traction}`;
  let registry = registries.get(key);
  if (!registry) {
    registry = new Map(['wings', 'cape'].map((s) => [s, knightPhysics(s as 'wings' | 'cape', feel)]));
    registries.set(key, registry);
  }
  return registry;
}
