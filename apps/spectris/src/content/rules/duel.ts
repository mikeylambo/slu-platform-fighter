import { fixed as f } from '../../../../../packages/deterministic-math/src/fixed.js';
import type { ClashRules } from '../../../../../packages/clash/src/clash.js';
import type { StrainFractureRules } from '../../../../../packages/life-system/src/life.js';

/**
 * Duel rules content. Every tunable number used by `game/rules/` lives here.
 *
 * Units: Strain is stored in tenths (1000 = 100.0 Strain). Guard Integrity and meter
 * are stored in hundredths (10000 = 100). Distances are PF world units (5 GDD units).
 */
export const DUEL = {
  fractures: 4,
  threshold: 1000,
  maxStrain: 9990,
  respawn: 45,
  invulnerability: 90,
  roundPause: 120,
  /** Strain dealt by one Strain point of move data, in tenths. */
  strainScale: 10,
  /** Frames of invulnerability re-applied each frame to sustain an intangible window. */
  sustain: 2,
  /** Stick deflection (of 1000) that counts as a direction for actions and throws. */
  stick: { action: 450, throw: 400, full: 1000 },
  integrity: { max: 10000, afterBreak: 5000, shatterGrab: 4000 },
  guard: {
    parry: 4,
    chip: 1,
    regenDelay: 60,
    regen: 25,
    breakFrames: 120,
    release: 6,
    /** Defender Strain gain per blocked damage tenth. */
    strainChip: 0.15,
    /** Integrity per blocked damage tenth (Strain × 1.0 in integrity hundredths). */
    integrityPerTenth: 10,
    bareGauntlet: 2,
    anchor: 2,
    /** Recovery added to a parried attacker. */
    parryStun: 12,
  },
  clash: {
    window: 12,
    advantage: 20,
    chip: 1500,
    strainGap: 2,
    recoil: f.fromRatio(1, 5),
  },
  grab: {
    startup: 6,
    dash: 8,
    pivot: 10,
    air: 9,
    reach: 2.4,
    height: 2.5,
    hold: 90,
    minimumHold: 12,
    /** Hold frames removed per Strain tenth (0.4 per Strain point). */
    holdPerStrainTenth: 0.04,
    /** Escape time multiplier per consecutive regrab. */
    regrabDecay: 0.7,
    regrab: 180,
    escape: 4,
    /** Escape mash multiplier while the holder is unfurling a stance switch. */
    unfurlEscape: 2,
    pummel: 3,
    pummelStrain: 30,
    pummelSiphon: 400,
    /** Extra lockout after the grab window, covering the whiff. */
    whiff: 10,
    holdOffset: f.fromRatio(13, 10),
    release: 10,
    carryDistance: 4,
    airCarryHold: 10,
  },
  meter: {
    max: 10000,
    hit: 3,
    taken: 2,
    parry: 2000,
    win: 1500,
    lose: 500,
    feint: 2500,
    flash: 2500,
  },
  feint: {
    tap: 8,
    hold: 20,
    /** Frame of the feint at which holding commits a real ghost. */
    commit: 4,
    ghostLife: 20,
    ghostDelay: 5,
    ghostReach: 4,
    ghostHeight: 3,
    /** Ghost damage per authored Strain point, in tenths (50%). */
    ghostDamage: 5,
    fallbackStrain: 6,
    ghostDirection: [10, 4] as [number, number],
  },
  special: {
    charge: 60,
    travel: 40,
    wait: 30,
    range: 7,
    teleport: 5,
    carry: 4,
  },
  ai: { decision: 4 },
  momentum: { screens: 5, respawnX: 7, respawnY: 4 },
  rounds: {
    competitiveStages: 7,
    /** Minimum hold while a human chooses a counterpick. */
    counterpickHold: 2,
    suddenDeathLives: 1,
    suddenDeathStrain: 1000,
  },
  blast: {
    /** Frames per 1% Sudden Death shrink. */
    shrinkInterval: 60,
    shrinkSteps: 100,
    minimumScale: 0.01,
    /** Stage blast values are GDD units; scaled by `precision` then divided by `precision × unitsPerWorld`. */
    precision: 100,
    unitsPerWorld: 5,
  },
  /** Generic direct hits (throws, projectiles, ghosts) built at runtime. */
  directHit: {
    base: 45,
    growth: 75,
    baseDivisor: 125,
    growthDivisor: 100,
    hitlag: 6,
    hitstun: 15,
    totalFrames: 2,
  },
} as const;

/** Rounds needed to take a best-of-N set. */
export const winsNeeded = (bestOf: number): number => Math.floor(bestOf / 2) + 1;

/** Default world seed ("SPEC"). */
export const DEFAULT_SEED = 0x53504543;

/** Default match options (GDD section 4 defaults; CPU level 5 opponent). */
export const DEFAULT_OPTIONS = {
  stage: 'mirror-sanctum',
  format: 'rounds',
  bestOf: 3,
  lives: 4,
  timer: 21600,
  cpu: [0, 5],
  oaths: ['unsworn', 'unsworn'],
  buffer: 5,
} as const;

/** Life system parameters for Strain + Fractures. */
export const LIFE: StrainFractureRules = {
  lives: DUEL.fractures,
  threshold: DUEL.threshold,
  crackTiers: [250, 500, 1000, 1500],
  maxStrain: DUEL.maxStrain,
  respawnFrames: DUEL.respawn,
  respawnIntangibility: DUEL.invulnerability,
};

/** Clash parameters for the shared clash module (Strain units, not tenths). */
export const CLASH: ClashRules = {
  strainGap: DUEL.clash.strainGap,
  window: DUEL.clash.window,
  advantage: DUEL.clash.advantage,
  winnerMeter: DUEL.meter.win,
  loserMeter: DUEL.meter.lose,
  loserChip: DUEL.clash.chip,
  defaultChoice: 'press',
  stickThreshold: DUEL.stick.throw,
};

export type Oath = 'unsworn' | 'ember' | 'static' | 'stillness' | 'gale' | 'iron' | 'hunger';

export const OATHS: Record<Oath, { name: string; color: number; stage: string; description: string }> = {
  unsworn: {
    name: 'Unsworn',
    color: 0x71e9e0,
    stage: 'mirror-sanctum',
    description: 'The true mirror. No oath. No advantage.',
  },
  ember: {
    name: 'Ember',
    color: 0xff603b,
    stage: 'eclipse',
    description: 'Chain Gale Lunge. Charge Cleave twice as fast. Kindle leaves burning wounds.',
  },
  static: {
    name: 'Static',
    color: 0x448aff,
    stage: 'fault-screen',
    description: 'Stoop and Veil Step leave echoes. Kindle chains feints.',
  },
  stillness: {
    name: 'Stillness',
    color: 0xd8eeff,
    stage: 'stillwater',
    description: 'Ascend parries. Anchor becomes Riposte. Kindle doubles the parry window.',
  },
  gale: {
    name: 'Gale',
    color: 0x54ffc4,
    stage: 'skyreach',
    description: 'Ascend stays actionable. Rift twice. Kindle extends flight.',
  },
  iron: {
    name: 'Iron',
    color: 0xe8b153,
    stage: 'bell-foundry',
    description: 'Armored Blade Sling. Wider Anchor. Kindle armors smashes.',
  },
  hunger: {
    name: 'Hunger',
    color: 0xbc66ff,
    stage: 'hollow-throne',
    description: 'Blade Sling drains meter. Siphon steals twice as much. Kindle drains on hit.',
  },
};
