import type { Fixed } from '../../deterministic-math/src/fixed.js';

export interface FighterPhysicsDefinition {
  id: string;
  weight: number;
  hurtboxWidth: Fixed;
  hurtboxHeight: Fixed;
  walkSpeed: Fixed;
  initialDashSpeed: Fixed;
  runSpeed: Fixed;
  gravity: Fixed;
  fallSpeed: Fixed;
  fastFallSpeed: Fixed;
  shortHopVelocity: Fixed;
  fullHopVelocity: Fixed;
  doubleJumpVelocity: Fixed;
  airAcceleration: Fixed;
  airSpeed: Fixed;
  traction: Fixed;
  jumpSquatFrames: number;
}

interface FighterPhysicsPackLike {
  id: string;
  attributes: {
    weight: number;
    hurtboxWidth: number;
    hurtboxHeight: number;
  };
  movement: Readonly<Record<string, number>>;
}

function integer(record: Readonly<Record<string, number>>, key: string): number {
  const value = record[key];
  if (!Number.isInteger(value)) throw new Error(`${key} must be deterministic integer/fixed-point fighter data`);
  return value as number;
}

export function compileFighterPhysics(pack: FighterPhysicsPackLike): FighterPhysicsDefinition {
  if (!Number.isInteger(pack.attributes.weight) || pack.attributes.weight <= 0) throw new Error(`${pack.id} weight must be positive integer`);
  if (!Number.isInteger(pack.attributes.hurtboxWidth) || pack.attributes.hurtboxWidth <= 0) throw new Error(`${pack.id} hurtboxWidth must be positive fixed-point integer`);
  if (!Number.isInteger(pack.attributes.hurtboxHeight) || pack.attributes.hurtboxHeight <= 0) throw new Error(`${pack.id} hurtboxHeight must be positive fixed-point integer`);
  const movement = pack.movement;
  const jumpSquatFrames = integer(movement, 'jumpSquatFrames');
  if (jumpSquatFrames < 1) throw new Error(`${pack.id} jumpSquatFrames must be >= 1`);
  return {
    id: pack.id,
    weight: pack.attributes.weight,
    hurtboxWidth: pack.attributes.hurtboxWidth as Fixed,
    hurtboxHeight: pack.attributes.hurtboxHeight as Fixed,
    walkSpeed: integer(movement, 'walkSpeed') as Fixed,
    initialDashSpeed: integer(movement, 'initialDashSpeed') as Fixed,
    runSpeed: integer(movement, 'runSpeed') as Fixed,
    gravity: integer(movement, 'gravity') as Fixed,
    fallSpeed: integer(movement, 'fallSpeed') as Fixed,
    fastFallSpeed: integer(movement, 'fastFallSpeed') as Fixed,
    shortHopVelocity: integer(movement, 'shortHopVelocity') as Fixed,
    fullHopVelocity: integer(movement, 'fullHopVelocity') as Fixed,
    doubleJumpVelocity: integer(movement, 'doubleJumpVelocity') as Fixed,
    airAcceleration: integer(movement, 'airAcceleration') as Fixed,
    airSpeed: integer(movement, 'airSpeed') as Fixed,
    traction: integer(movement, 'traction') as Fixed,
    jumpSquatFrames,
  };
}

export function compileFighterPhysicsRegistry(packs: readonly FighterPhysicsPackLike[]): Map<string, FighterPhysicsDefinition> {
  const result = new Map<string, FighterPhysicsDefinition>();
  for (const pack of [...packs].sort((a, b) => a.id.localeCompare(b.id))) {
    if (result.has(pack.id)) throw new Error(`duplicate fighter physics definition ${pack.id}`);
    result.set(pack.id, compileFighterPhysics(pack));
  }
  return result;
}
