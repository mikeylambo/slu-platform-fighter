/**
 * Pilgrimage (GDD 7, Momentum mode): one continuous floor across five screens, each dressed
 * as another stage's biome. Screen 0 is the centre; Player 1 marches right (+), Player 2 left.
 */
export const PILGRIMAGE = {
  screens: 5,
  /** Screen width in world units. */
  screenWidth: 36,
  /** Biome per screen, left (-2) to right (+2). */
  biomes: ['hollow-throne', 'bell-foundry', 'mirror-sanctum', 'eclipse', 'skyreach'],
  /** Platforms per screen in GDD units relative to the screen centre: [x, y, width]. */
  platforms: [
    [
      [-40, 35, 35],
      [40, 35, 35],
    ],
    [[0, 40, 35]],
    [
      [-40, 30, 30],
      [40, 30, 30],
      [0, 55, 30],
    ],
    [[0, 45, 40]],
    [
      [-45, 30, 25],
      [45, 40, 25],
    ],
  ] as [number, number, number][][],
  /** The victim respawns this far ahead of the Knight with right of way. */
  respawnAhead: 11,
  respawnHeight: 6,
  /** Distance before the final screen's far edge that counts as reaching the goal. */
  goalInset: 4,
  /** Blast zones are relative to the current screen centre (world units). */
  blast: { side: 36, top: 40, bottom: 28 },
  /** Index of the outermost screen on each side ((screens - 1) / 2). */
  finalScreen: 2,
  halfScreen: 18,
  /** Fixed-point rounding for respawn positions (thousandths). */
  precision: 1000,
} as const;

/** Screen centre in world units. */
export const screenCentre = (index: number): number => index * PILGRIMAGE.screenWidth;

/** All Pilgrimage platforms in GDD units (5 GDD units = 1 world unit). */
export function pilgrimagePlatforms(): [number, number, number][] {
  return PILGRIMAGE.platforms.flatMap((list, i) =>
    list.map(([x, y, width]) => [x + screenCentre(i - 2) * 5, y, width] as [number, number, number]),
  );
}
