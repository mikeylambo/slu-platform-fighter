import { fixed as f } from '../../../../../packages/deterministic-math/src/fixed.js';

/**
 * Special-move behaviour numbers (GDD 3.8). Frame numbers are zero-based attack
 * frames as seen by the rules modules; move timing tables live in `moves/special.ts`.
 */
export const SPECIALS = {
  sling: {
    /** Attack frame on which the blade leaves the gauntlet. */
    release: 11,
    spawnHeight: f.fromRatio(14, 10),
    /** Outbound travel per frame. */
    speed: f.fromRatio(7, 40),
    travelFrames: 40,
    range: f.fromInt(7),
    /** Frames the blade waits after a hit or whiff before returning. */
    wait: 30,
    returnSpeed: f.fromRatio(5, 10),
    returnLift: f.fromRatio(1, 10),
    hitWidth: f.fromRatio(13, 10),
    hitHeight: f.fromRatio(15, 10),
    /** Damage in Strain tenths. */
    damage: 110,
    returnDamage: 70,
    direction: [10, 5] as [number, number],
  },
  gale: {
    from: 7,
    until: 18,
    speed: f.fromRatio(7, 10),
  },
  veil: {
    from: 5,
    until: 17,
    speed: f.fromRatio(1, 4),
    /** Frame on which the emerge cut starts if requested. */
    emerge: 18,
  },
  rift: {
    teleport: 7,
    /** Straight teleport distance (tenths of a world unit); diagonals use `diagonal`. */
    straight: 50,
    diagonal: 35,
    distanceDivisor: 10,
    intangible: 5,
    emerge: 12,
  },
  ascend: {
    launch: f.fromRatio(7, 10),
  },
  stoop: {
    dive: f.fromRatio(-4, 5),
    /** First attack frame on which holding Jump cancels into a glide. */
    glideCancel: 11,
    glideVelocity: f.fromRatio(-1, 10),
  },
  anchor: {
    plunge: f.fromInt(-1),
    /** Grounded Anchor armor lasts while the attack frame is below this. */
    armorUntil: 9,
  },
  cleave: {
    /** Charge frames per Charged Cleave tier (12 tiers between 12 and 23 Strain). */
    tierFrames: 5,
    /** Full charge absorbs hits up to this many Strain tenths. */
    armor: 120,
  },
  riposte: {
    /** Frames the Riposte counter stance waits for a hit. */
    window: 20,
  },
  /** Stick deflection required to aim a special. */
  aimThreshold: 450,
} as const;

/**
 * Throw table (GDD 3.9). Damage in Strain tenths; knockback base/growth on the 0–100 scale.
 * Direction X is mirrored whenever the stick is held backward, including on up and down throws.
 */
export interface ThrowSpec {
  damage: number;
  direction: [number, number];
  base: number;
  growth: number;
}

export const THROWS: Record<'wings' | 'cape', Record<'forward' | 'back' | 'up' | 'down', ThrowSpec>> = {
  wings: {
    forward: { damage: 80, direction: [10, 7], base: 45, growth: 75 },
    back: { damage: 100, direction: [10, 7], base: 50, growth: 85 },
    up: { damage: 60, direction: [10, 15], base: 70, growth: 40 },
    down: { damage: 70, direction: [10, -5], base: 60, growth: 30 },
  },
  cape: {
    forward: { damage: 0, direction: [10, 7], base: 45, growth: 75 },
    back: { damage: 0, direction: [10, 7], base: 50, growth: 85 },
    up: { damage: 50, direction: [10, 15], base: 30, growth: 40 },
    down: { damage: 60, direction: [10, -5], base: 60, growth: 30 },
  },
};

/** Throw DI: launch velocity added per stick unit. */
export const THROW_DI_DIVISOR = 10000;
