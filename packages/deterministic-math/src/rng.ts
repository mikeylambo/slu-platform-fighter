export function nextRngU32(seed: number): number {
  let x = seed >>> 0;
  if (x === 0) x = 0x6d2b79f5;
  x ^= (x << 13) >>> 0;
  x ^= x >>> 17;
  x ^= (x << 5) >>> 0;
  return x >>> 0;
}

export function rngRange(seed: number, maxExclusive: number): { value: number; nextSeed: number } {
  if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
    throw new Error(`rngRange requires positive integer maxExclusive, got ${maxExclusive}`);
  }
  const nextSeed = nextRngU32(seed);
  return { value: nextSeed % maxExclusive, nextSeed };
}
