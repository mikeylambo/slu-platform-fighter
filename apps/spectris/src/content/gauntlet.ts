/**
 * Fracture Gauntlet (GDD 6): six Oath Fractures on their home stages, then the Unsworn.
 * Difficulty sets the Fracture CPU level; the Unsworn is always level 9.
 */
import { OATHS, type Oath } from './rules/duel.js';

export type Difficulty = 'Squire' | 'Knight' | 'Paragon';

export const GAUNTLET_ORDER: Oath[] = ['ember', 'static', 'stillness', 'gale', 'iron', 'hunger', 'unsworn'];

export const DIFFICULTY_LEVEL: Record<Difficulty, number> = { Squire: 3, Knight: 6, Paragon: 9 };

export const UNSWORN_LEVEL = 9;

/** Stage, CPU level and Oaths for one Gauntlet fight (the player is slot 0, Unsworn). */
export function gauntletFight(oath: Oath, difficulty: Difficulty) {
  return {
    stage: oath === 'unsworn' ? 'unsworn' : OATHS[oath].stage,
    level: oath === 'unsworn' ? UNSWORN_LEVEL : DIFFICULTY_LEVEL[difficulty],
    oaths: ['unsworn', oath] as [Oath, Oath],
  };
}
