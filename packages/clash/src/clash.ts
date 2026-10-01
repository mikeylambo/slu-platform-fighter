/**
 * Clash: generic hitbox-collision resolution with a rock-paper-scissors choice window.
 *
 * Two colliding hitboxes whose damage is within the strain-gap threshold open a choice
 * window. Larger gaps go to the heavier hit (the lighter one recoils), Smash style.
 */

export type ClashChoice = 'press' | 'parry' | 'slip';

export const CLASH_CHOICES: readonly ClashChoice[] = ['press', 'parry', 'slip'];

export interface ClashRules {
  /** Maximum damage difference (same units as the hit damage) that still clashes. */
  strainGap: number;
  /** Frames both fighters are frozen while choosing. */
  window: number;
  /** Frames of advantage the winner gets (applied as stagger to the loser). */
  advantage: number;
  winnerMeter: number;
  loserMeter: number;
  /** Guard integrity removed from the loser. */
  loserChip: number;
  /** Choice used when nothing is input. */
  defaultChoice: ClashChoice;
  /** Stick magnitude needed to register a choice. */
  stickThreshold: number;
}

export type ClashDetection = { kind: 'clash' } | { kind: 'heavier'; winner: 0 | 1 } | { kind: 'trade' };

/** Classifies a hitbox collision between two attacks with the given damage. */
export function detectClash(damageA: number, damageB: number, rules: Pick<ClashRules, 'strainGap'>): ClashDetection {
  const gap = Math.abs(damageA - damageB);
  if (gap <= rules.strainGap) {
    return { kind: 'clash' };
  }
  if (damageA === damageB) {
    return { kind: 'trade' };
  }
  return { kind: 'heavier', winner: damageA > damageB ? 0 : 1 };
}

/** Parry beats Press, Press beats Slip, Slip beats Parry. Returns the winning index or null on a tie. */
export function resolveClash(a: ClashChoice, b: ClashChoice): 0 | 1 | null {
  if (a === b) {
    return null;
  }
  const aWins = (a === 'parry' && b === 'press') || (a === 'press' && b === 'slip') || (a === 'slip' && b === 'parry');
  return aWins ? 0 : 1;
}

/**
 * Reads a clash choice from a stick: down = slip, toward = press, away = parry.
 * Keeps the current choice when the stick is neutral.
 */
export function readClashChoice(
  stick: { moveX: number; moveY: number },
  facing: -1 | 1,
  current: ClashChoice,
  rules: Pick<ClashRules, 'stickThreshold'>,
): ClashChoice {
  if (stick.moveY < -rules.stickThreshold) {
    return 'slip';
  }
  if (stick.moveX * facing < -rules.stickThreshold) {
    return 'parry';
  }
  if (stick.moveX * facing > rules.stickThreshold) {
    return 'press';
  }
  return current;
}

export interface ClashOutcome {
  won: boolean;
  lost: boolean;
  meter: number;
  /** Frames the fighter is staggered (the winner's advantage). */
  stagger: number;
  /** Guard integrity removed. */
  chip: number;
}

/** Per-fighter payloads for a resolved clash. A tie gives both fighters an empty outcome. */
export function clashOutcomes(winner: 0 | 1 | null, rules: ClashRules): [ClashOutcome, ClashOutcome] {
  const outcome = (index: 0 | 1): ClashOutcome => {
    if (winner === null) {
      return { won: false, lost: false, meter: 0, stagger: 0, chip: 0 };
    }
    if (winner === index) {
      return {
        won: true,
        lost: false,
        meter: rules.winnerMeter,
        stagger: 0,
        chip: 0,
      };
    }
    return {
      won: false,
      lost: true,
      meter: rules.loserMeter,
      stagger: rules.advantage,
      chip: rules.loserChip,
    };
  };
  return [outcome(0), outcome(1)];
}

export interface ClashWindow {
  remaining: number;
}

export const openClashWindow = (rules: Pick<ClashRules, 'window'>): ClashWindow => ({ remaining: rules.window });

/** Advances the window; returns true on the frame it closes and should be resolved. */
export function tickClashWindow(window: ClashWindow): boolean {
  window.remaining = Math.max(0, window.remaining - 1);
  return window.remaining === 0;
}
