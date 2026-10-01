/**
 * Role budgets (GDD 3.8 / 15): the design envelope each normal must sit inside.
 * Moves with no Brawl counterpart (Jab 2 and 3) are certified against these alone.
 * Ranges are inclusive, one-based frames.
 */
export interface RoleBudget {
  role: string;
  startup: [number, number];
  faf?: [number, number];
  landing?: [number, number];
}

const JAB: RoleBudget = { role: 'jab opener', startup: [1, 4], faf: [12, 20] };
const JAB_FOLLOWUP: RoleBudget = { role: 'jab follow-up', startup: [1, 5], faf: [12, 22] };
const RAPID: RoleBudget = { role: 'rapid jab', startup: [1, 4], faf: [18, 30] };
const TILT: RoleBudget = { role: 'tilt', startup: [4, 8], faf: [14, 32] };
const DASH: RoleBudget = { role: 'dash attack', startup: [5, 10], faf: [28, 40] };
const SMASH: RoleBudget = { role: 'smash (Shatter-class kill)', startup: [7, 16], faf: [36, 52] };
const WINGS_AIR: RoleBudget = { role: 'Wings aerial (fast pressure)', startup: [3, 7], landing: [6, 12] };
const CAPE_AIR: RoleBudget = { role: 'Cape aerial (committal)', startup: [7, 11], landing: [10, 20] };

export const GROUND_BUDGETS: Record<string, RoleBudget> = {
  jab: JAB,
  'jab-2': JAB_FOLLOWUP,
  'jab-3': JAB_FOLLOWUP,
  'rapid-jab': RAPID,
  'forward-tilt': TILT,
  'up-tilt': TILT,
  'down-tilt': TILT,
  'dash-attack': DASH,
  'forward-smash': SMASH,
  'up-smash': SMASH,
  'down-smash': SMASH,
};

export const AERIAL_BUDGETS: Record<'wings' | 'cape', RoleBudget> = { wings: WINGS_AIR, cape: CAPE_AIR };

/** Rapid Jab finisher: GDD "+3 finisher", the last strike of the rapid jab. */
export const RAPID_FINISHER_BUDGET: RoleBudget = { role: 'rapid jab finisher', startup: [10, 30] };
