/**
 * Fracture AI personalities (GDD 6) as weight tables over the option catalog. Weights
 * multiply each option's utility; 1 = the Unsworn baseline. No personality is a code branch.
 */
import type { Oath } from '../rules/duel.js';
import type { OptionId } from './options.js';

export interface Personality {
  summary: string;
  weights: Partial<Record<OptionId, number>>;
  /** Preference for each stance (scales the stance-switch option toward it). */
  stance: { wings: number; cape: number };
}

export const PERSONALITIES: Record<Oath, Personality> = {
  unsworn: {
    summary: 'Level 9 mirror; adapts by weighting counters to the option the player uses most.',
    weights: {},
    stance: { wings: 1, cape: 1 },
  },
  ember: {
    summary: 'Rushdown: high aggression, few defensive options.',
    weights: {
      approach: 9,
      'dash-attack': 2,
      'neutral-air': 8,
      'forward-air': 8,
      'back-air': 6,
      'up-air': 6,
      'down-air': 5,
      'side-special': 1.6,
      jump: 2.5,
      jab: 0.5,
      'forward-tilt': 0.5,
      'up-tilt': 0.5,
      'down-tilt': 0.5,
      grab: 0.3,
      guard: 0.2,
      evade: 0.2,
      retreat: 0.1,
      wait: 0.2,
    },
    stance: { wings: 2, cape: 0.5 },
  },
  static: {
    summary: 'Feint-heavy cross-ups and Veil Step mixups.',
    weights: { feint: 9, 'side-special': 4.5, stance: 2, evade: 1.4 },
    stance: { wings: 0.5, cape: 3 },
  },
  stillness: {
    summary: 'Patient: parry and counter focused.',
    weights: { guard: 5, 'down-special': 2.5, wait: 2.5, approach: 0.45, retreat: 1.6, jab: 1.3 },
    stance: { wings: 0.4, cape: 3 },
  },
  gale: {
    summary: 'Offstage hunter: edge-guards and aerial chases.',
    weights: { chase: 8, edgeguard: 0.6, jump: 2, 'forward-air': 1.6, 'back-air': 1.8, 'down-air': 2, 'up-air': 1.4 },
    stance: { wings: 3, cape: 0.4 },
  },
  iron: {
    summary: 'Armored trades and Anchor pressure.',
    weights: { 'down-special': 5, 'neutral-special': 5, 'forward-smash': 1.6, evade: 0.4, retreat: 0.4 },
    stance: { wings: 0.4, cape: 3 },
  },
  hunger: {
    summary: 'Grab-heavy, meter denial.',
    weights: { grab: 5, pummel: 4, approach: 1.4, 'dash-attack': 0.7 },
    stance: { wings: 1, cape: 1 },
  },
};

/**
 * Unsworn adaptation: when the player favours a category, the mirror boosts these counters.
 */
export const COUNTERS: Record<string, OptionId[]> = {
  grab: ['evade', 'jab', 'retreat'],
  aerial: ['up-tilt', 'up-air', 'guard'],
  smash: ['guard', 'evade', 'dash-attack'],
  ground: ['guard', 'grab'],
  special: ['guard', 'approach'],
  defense: ['grab', 'feint'],
  movement: ['forward-tilt', 'dash-attack'],
};
