import type { Oath } from './duel.js';

/**
 * Oath parameter table (GDD section 5). Each Oath changes one special per stance,
 * the Kindle effect, and its palette. Rules code reads only this table; it never
 * branches on an Oath name.
 */
export interface OathEffects {
  /** Gale Lunge uses per airtime. */
  galeLungeUses: number;
  /** Charged Cleave frames gained per held frame. */
  cleaveChargeRate: number;
  /** Stoop leaves a cosmetic decoy Knight. */
  stoopDecoy: boolean;
  /** Veil Step leaves an attacking afterimage on its last intangible frame. */
  veilEcho: boolean;
  /** Ascend frames that parry (0 = none). */
  ascendParry: number;
  /** Ascend start-up intangibility. */
  ascendIntangible: number;
  /** Ascend leaves the Knight helpless. */
  ascendHelpless: boolean;
  /** Rift uses per airtime. */
  riftUses: number;
  /** Cape down special is a Riposte counter instead of Anchor. */
  riposte: boolean;
  /** Anchor move key used by this Oath. */
  anchorMove: 'anchor' | 'anchor-wide';
  /** Blade Sling has armor (ignores hitstun). */
  slingArmor: boolean;
  /** Meter drained from the target when the thrown blade hits. */
  slingSiphon: number;
  /** Meter stolen per Siphon pummel. */
  pummelSiphon: number;
  kindle: {
    /** Frames until a burn applies its Strain (0 = no burn). */
    burnFrames: number;
    /** Burn Strain in tenths. */
    burnStrain: number;
    /** Parry window while Kindled (0 = unchanged). */
    parryWindow: number;
    extraJumps: number;
    /** Glide duration while Kindled (0 = unchanged). */
    glideDuration: number;
    /** Smashes absorb hits up to this many Strain tenths (0 = none). */
    smashArmor: number;
    /** Meter drained from the target per hit. */
    hitDrain: number;
  };
}

const MIRROR: OathEffects = {
  galeLungeUses: 1,
  cleaveChargeRate: 1,
  stoopDecoy: false,
  veilEcho: false,
  ascendParry: 0,
  ascendIntangible: 0,
  ascendHelpless: true,
  riftUses: 1,
  riposte: false,
  anchorMove: 'anchor',
  slingArmor: false,
  slingSiphon: 0,
  pummelSiphon: 400,
  kindle: {
    burnFrames: 0,
    burnStrain: 0,
    parryWindow: 0,
    extraJumps: 0,
    glideDuration: 0,
    smashArmor: 0,
    hitDrain: 0,
  },
};

function oath(changes: Partial<Omit<OathEffects, 'kindle'>>, kindle: Partial<OathEffects['kindle']>): OathEffects {
  return { ...MIRROR, ...changes, kindle: { ...MIRROR.kindle, ...kindle } };
}

export const OATH_EFFECTS: Record<Oath, OathEffects> = {
  unsworn: MIRROR,
  ember: oath({ galeLungeUses: 2, cleaveChargeRate: 2 }, { burnFrames: 60, burnStrain: 40 }),
  static: oath({ stoopDecoy: true, veilEcho: true }, {}),
  stillness: oath({ ascendParry: 4, ascendIntangible: 4, riposte: true }, { parryWindow: 8 }),
  gale: oath({ ascendHelpless: false, riftUses: 2 }, { extraJumps: 1, glideDuration: 180 }),
  iron: oath({ anchorMove: 'anchor-wide', slingArmor: true }, { smashArmor: 150 }),
  hunger: oath({ slingSiphon: 1000, pummelSiphon: 800 }, { hitDrain: 500 }),
};

/** The Kindle (Soulfire) base parameter pack shared by every Oath. */
export const KINDLE = {
  duration: 480,
  activation: 18,
  cost: 10000,
  guardChip: 2,
  freeFeints: true,
  freeFlash: true,
  blocksMeterGain: true,
  finisher: { moveKey: 'kindle-finisher' },
  doubleIgnite: 'clash',
} as const;
