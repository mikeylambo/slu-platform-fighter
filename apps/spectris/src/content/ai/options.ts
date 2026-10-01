/**
 * Utility-AI option catalog (GDD 9). Each option has a base utility and, for attacks, the
 * horizontal/vertical range (world units, toward the opponent) where it is worth throwing.
 */
export type OptionId =
  | 'approach'
  | 'retreat'
  | 'wait'
  | 'jump'
  | 'jab'
  | 'forward-tilt'
  | 'up-tilt'
  | 'down-tilt'
  | 'dash-attack'
  | 'forward-smash'
  | 'up-smash'
  | 'down-smash'
  | 'neutral-air'
  | 'forward-air'
  | 'back-air'
  | 'up-air'
  | 'down-air'
  | 'neutral-special'
  | 'side-special'
  | 'up-special'
  | 'down-special'
  | 'grab'
  | 'pummel'
  | 'throw'
  | 'guard'
  | 'evade'
  | 'stance'
  | 'feint'
  | 'kindle'
  | 'edgeguard'
  | 'chase'
  | 'recover';

export interface OptionSpec {
  base: number;
  /** Ideal horizontal distance band [min, max] to the opponent. */
  range?: [number, number];
  /** Ideal vertical offset band [min, max] (opponent minus self). */
  height?: [number, number];
  /** Shatter-class (GDD 3.5): takes a Fracture outright at the Strain threshold. */
  finisher?: boolean;
  /** Category used for histograms and Unsworn adaptation. */
  category: 'movement' | 'ground' | 'smash' | 'aerial' | 'special' | 'grab' | 'defense' | 'meter' | 'offstage';
}

export const OPTIONS: Record<OptionId, OptionSpec> = {
  approach: { base: 0.42, category: 'movement' },
  retreat: { base: 0.12, category: 'movement' },
  wait: { base: 0.1, category: 'movement' },
  jump: { base: 0.12, height: [2, 9], category: 'movement' },
  jab: { base: 0.62, range: [0, 2.1], height: [-1, 1.6], category: 'ground' },
  'forward-tilt': { base: 0.56, range: [1.6, 3.1], height: [-1, 1.6], category: 'ground' },
  'up-tilt': { base: 0.5, range: [0, 1.8], height: [1.2, 4], category: 'ground' },
  'down-tilt': { base: 0.5, range: [0.6, 2.4], height: [-1, 1], category: 'ground' },
  'dash-attack': { base: 0.36, range: [3, 6], height: [-1, 1.6], category: 'ground' },
  'forward-smash': { base: 0.3, range: [2, 3.8], height: [-1, 1.6], finisher: true, category: 'smash' },
  'up-smash': { base: 0.28, range: [0, 1.9], height: [-0.5, 4], finisher: true, category: 'smash' },
  'down-smash': { base: 0.26, range: [0, 2.2], height: [-1, 1], category: 'smash' },
  'neutral-air': { base: 0.46, range: [0, 2], height: [-1.5, 2], category: 'aerial' },
  'forward-air': { base: 0.5, range: [1, 3.2], height: [-1.5, 2], category: 'aerial' },
  'back-air': { base: 0.4, range: [1, 2.8], height: [-1.5, 2], category: 'aerial' },
  'up-air': { base: 0.46, range: [0, 1.8], height: [1.4, 4.5], category: 'aerial' },
  'down-air': { base: 0.36, range: [0, 1.4], height: [-4, -1], category: 'aerial' },
  'neutral-special': { base: 0.2, range: [3, 7], height: [-1.5, 2], category: 'special' },
  'side-special': { base: 0.22, range: [2.5, 6], height: [-1.5, 2], category: 'special' },
  'up-special': { base: 0.08, range: [0, 2], height: [1, 5], category: 'special' },
  'down-special': { base: 0.18, range: [0, 3.2], height: [-3, 1], finisher: true, category: 'special' },
  grab: { base: 0.42, range: [0, 2.2], height: [-1, 1.2], category: 'grab' },
  pummel: { base: 0.5, category: 'grab' },
  throw: { base: 0.6, category: 'grab' },
  guard: { base: 0.3, range: [0, 5], category: 'defense' },
  evade: { base: 0.22, range: [0, 4], category: 'defense' },
  stance: { base: 0.06, category: 'meter' },
  feint: { base: 0.08, range: [1.5, 5], category: 'meter' },
  kindle: { base: 0.7, category: 'meter' },
  /** Hold the ledge and swat the recoverer as they arrive. */
  edgeguard: { base: 0.55, category: 'offstage' },
  /** Jump out after the recoverer and intercept offstage (riskier). */
  chase: { base: 0.3, category: 'offstage' },
  recover: { base: 2, category: 'offstage' },
};

export const OPTION_IDS = Object.keys(OPTIONS) as OptionId[];

/** Stick values and timings the planner uses. */
/** Sudden-death sense: weights applied when Strain is at the Shatter threshold. */
export const THRESHOLD = {
  /** Shatter-class options when the opponent can be Shattered. */
  finisher: 3.6,
  /** Shatter-class options before the opponent reaches the threshold. */
  early: 0.55,
  /** Guard/evade/retreat when this Knight can be Shattered. */
  defense: 1.9,
};

export const AI_INPUT = {
  full: 1000,
  drift: 400,
  /** Frames of jump before an aerial is thrown from the ground. */
  aerialRise: 5,
  guardHold: 8,
  feintHold: 16,
  smashCharge: 1,
  /** Distance from the ledge at which the edge-guarder stops and waits. */
  edgeStop: 1.2,
  /** Height above the ledge below which a recovering Knight uses its up special. */
  recoverySpecialHeight: 1.5,
  /** Jump while lower than this, or further out than recoveryJumpDistance. */
  recoveryJumpHeight: 3,
  recoveryJumpDistance: 4,
  recoveryLungeDistance: 6,
  /** Up special only when the ledge is within this horizontal reach. */
  recoveryReach: 4.5,
  glideLow: 1,
  glideHigh: 7,
  glideClimb: 600,
  /** Grounded CPUs never step past this distance from the ledge unless edge-guarding. */
  ledgeMargin: 0.9,
  /** Distance held from the opponent when this Knight can be Shattered. */
  thresholdSpacing: 4,
};
