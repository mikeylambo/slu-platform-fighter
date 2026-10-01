import type { Oath } from './rules/duel.js';

/**
 * Presentation content (GDD section 10). Rendering code reads every look value from here.
 * World units: the Knight's hurtbox is 2.8 tall; the silhouette below is ~3.0 tall.
 */
export const PRESENTATION = {
  colors: [0x71e9e0, 0xe8a975],
  background: 0x050b14,
  steel: 0x283446,
  silver: 0x8098ab,
  renderScale: 1.5,
  /** Bloom runs only on the emissive layer (visor, blade edge, flame, Kindle). */
  bloomStrength: 0.62,
  bloomRadius: 0.32,
  bloomThreshold: 0.0,
  /** Bloom renders at this fraction of the canvas resolution. */
  bloomResolution: 0.5,
  particleCount: 160,
  stars: 700,
  wingFeathers: 6,
  helmScale: 1.25,
  bladeWidth: 0.22,
  hitPool: 48,
  camera: { fov: 34, near: 0.1, far: 400 },
  palettes: ['#71e9e0', '#e8a975'],
  /** Screen-edge darkening so the play area keeps the light values (GDD 10). */
  vignette: { strength: 0.42, softness: 0.55 },
} as const;

/** Knight body plan (GDD 3.1, v2 Duelist). Positions are relative to the feet. */
export const KNIGHT = {
  /** Helm height in world units; the helm is ~60% of the silhouette. */
  /** 1.85 of a ~2.9 body (wisp tip to crest) = ~64%; the sword is excluded from the measure. */
  helmHeight: 1.85,
  helmCenterY: 1.92,
  helmDepthScale: 1,
  /** Chest shell, 0.6x of the pre-revision build. */
  chest: { width: 0.78, height: 0.62, depth: 0.42, y: 0.98 },
  pauldron: { length: 0.62, width: 0.18, x: 0.44, y: 1.2, splay: 0.62 },
  /** Flame wisp replaces legs: about the helm's height. */
  wisp: { height: 0.92, radius: 0.32, y: 0.62 },
  fist: { size: 0.27, gripX: 0.5, gripY: 0.98, gripZ: 0.42, freeX: -0.58, freeY: 1.0, freeZ: 0.3 },
  sword: {
    length: 2.7,
    width: 0.27,
    thickness: 0.09,
    guardWidth: 0.82,
    guardHeight: 0.13,
    gem: 0.085,
    handle: 0.42,
  },
  wing: {
    feathers: 6,
    length: 2.25,
    /** Folded: feathers stacked behind the back. Fanned: spread for glide, jumps, wing attacks. */
    foldedSpread: 0.06,
    fannedSpread: 0.19,
    rootX: 0.16,
    rootY: 1.3,
    rootZ: -0.3,
  },
  cape: { width: 1.3, length: 1.9, y: 1.12, z: -0.35 },
  outline: 0.022,
  rim: { power: 3.6, strength: 0.6 },
  specular: { threshold: 0.985, strength: 0.55 },
} as const;

/** Oath looks (GDD 5): helm, trim metal, and flame palette. */
export const OATH_LOOK: Record<Oath, { helm: string; trim: 'gold' | 'steel' }> = {
  unsworn: { helm: 'duelist', trim: 'steel' },
  ember: { helm: 'reaper', trim: 'steel' },
  static: { helm: 'glitch', trim: 'steel' },
  stillness: { helm: 'herald', trim: 'gold' },
  gale: { helm: 'vanguard', trim: 'steel' },
  iron: { helm: 'sentinel', trim: 'gold' },
  hunger: { helm: 'inquisitor', trim: 'steel' },
};

export const METALS = {
  armor: 0x0b0e14,
  steel: 0x161b24,
  gold: 0xc8973c,
} as const;

/**
 * Stage lighting (GDD 10, stage value contrast): the area behind the fighting plane is a
 * light-to-mid value (gradient sky, fog, glow); darkness lives at the edges and foreground.
 */
export interface StageLook {
  skyTop: number;
  horizon: number;
  glow: number;
  fog: number;
  fogDensity: number;
  stone: number;
  edge: number;
  silhouette: number;
}

export const STAGE_LOOK: Record<string, StageLook> = {
  'mirror-sanctum': {
    skyTop: 0x4d6f78,
    horizon: 0xc8dcd8,
    glow: 0xe6fbf6,
    fog: 0x9fbcbc,
    fogDensity: 0.011,
    stone: 0x34444d,
    edge: 0x8aa3a6,
    silhouette: 0x557077,
  },
  eclipse: {
    skyTop: 0x5a2f2c,
    horizon: 0xe2a78a,
    glow: 0xffe1c4,
    fog: 0xbb7f6a,
    fogDensity: 0.011,
    stone: 0x40302e,
    edge: 0xa8806f,
    silhouette: 0x6e4740,
  },
  'fault-screen': {
    skyTop: 0x27447f,
    horizon: 0xa4c0ee,
    glow: 0xe5f0ff,
    fog: 0x7f9fd6,
    fogDensity: 0.011,
    stone: 0x2c3a58,
    edge: 0x8aa2d4,
    silhouette: 0x3f5a92,
  },
  stillwater: {
    skyTop: 0x8a9db0,
    horizon: 0xeee9dc,
    glow: 0xfffaee,
    fog: 0xcdd3d4,
    fogDensity: 0.01,
    stone: 0x4a5560,
    edge: 0xb7b5a2,
    silhouette: 0x8794a0,
  },
  'bell-foundry': {
    skyTop: 0x4d3d2f,
    horizon: 0xdcb070,
    glow: 0xfff0c8,
    fog: 0xaf8a5e,
    fogDensity: 0.012,
    stone: 0x3e352e,
    edge: 0xa58a62,
    silhouette: 0x6b5641,
  },
  skyreach: {
    skyTop: 0x4f909b,
    horizon: 0xd3f1e7,
    glow: 0xf3fff9,
    fog: 0xa8d6cf,
    fogDensity: 0.009,
    stone: 0x34504f,
    edge: 0x93bdb4,
    silhouette: 0x5d8e8c,
  },
  'hollow-throne': {
    skyTop: 0x3a2a52,
    horizon: 0xb096cc,
    glow: 0xf0e2ff,
    fog: 0x8a74a8,
    fogDensity: 0.012,
    stone: 0x352d42,
    edge: 0x9a87b4,
    silhouette: 0x584773,
  },
  unsworn: {
    skyTop: 0x555c68,
    horizon: 0xdde2e8,
    glow: 0xffffff,
    fog: 0xaab1bb,
    fogDensity: 0.011,
    stone: 0x3a3f48,
    edge: 0xa3aab6,
    silhouette: 0x6b7280,
  },
  pilgrimage: {
    skyTop: 0x62533f,
    horizon: 0xe3cfa9,
    glow: 0xfff3dc,
    fog: 0xbca581,
    fogDensity: 0.01,
    stone: 0x463c31,
    edge: 0xb39d79,
    silhouette: 0x7a6852,
  },
};

/** Camera framing: about 30% closer than the pre-revision build, zooming to keep both Knights and the nearest ledge. */
export const FRAMING = {
  minDistance: 34,
  maxDistance: 78,
  /** Extra space around the framed points, as a fraction of the framed size. */
  margin: 0.32,
  /** Minimum framed height in world units. */
  minHeight: 11,
  /** Vertical aim offset above the framed centre. */
  lift: 1.4,
  follow: 0.06,
  /** Only frame the nearest ledge when a Knight is within this distance of it. */
  ledgeReach: 22,
  titleDistance: 26,
} as const;
