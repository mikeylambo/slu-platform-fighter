import { fixed, type Fixed } from '../../deterministic-math/src/fixed.js';
import type { StageHazardDefinition, StageMovingPlatformDefinition } from '../../content/src/compileStage.js';
import type { StageSurface } from './types.js';

export interface SampledMovingPlatform {
  id: string;
  surface: StageSurface;
  centerX: Fixed;
  centerY: Fixed;
}

function positiveMod(value: number, modulus: number): number {
  const result = value % modulus;
  return result < 0 ? result + modulus : result;
}

function lerpFixed(a: Fixed, b: Fixed, numerator: number, denominator: number): Fixed {
  if (denominator <= 0) return a;
  return fixed.add(a, fixed.mul(fixed.sub(b, a), fixed.fromRatio(numerator, denominator)));
}

/**
 * Samples a moving platform on a closed path. The full period is divided evenly
 * among path segments; the last authored point connects back to the first.
 * Integer frame/segment arithmetic keeps this rollback-safe and renderer-free.
 */
export function sampleMovingPlatform(definition: StageMovingPlatformDefinition, frame: number): SampledMovingPlatform {
  if (!Number.isInteger(frame)) throw new Error(`stage frame must be integer, got ${frame}`);
  if (definition.path.length < 2) throw new Error(`moving platform ${definition.id} requires at least 2 path points`);
  if (definition.periodFrames < 2) throw new Error(`moving platform ${definition.id} period must be >= 2`);

  const phase = positiveMod(frame + definition.phaseFrames, definition.periodFrames);
  const segmentCount = definition.path.length;
  const scaled = phase * segmentCount;
  const segmentIndex = Math.floor(scaled / definition.periodFrames);
  const segmentNumerator = scaled % definition.periodFrames;
  const from = definition.path[segmentIndex];
  const to = definition.path[(segmentIndex + 1) % segmentCount];
  if (!from || !to) throw new Error(`moving platform ${definition.id} path sampling failed`);

  const centerX = lerpFixed(from.x, to.x, segmentNumerator, definition.periodFrames);
  const centerY = lerpFixed(from.y, to.y, segmentNumerator, definition.periodFrames);
  const halfWidth = fixed.div(definition.width, fixed.fromInt(2));
  return {
    id: definition.id,
    centerX,
    centerY,
    surface: {
      id: `moving:${definition.id}`,
      kind: definition.kind,
      y: centerY,
      xMin: fixed.sub(centerX, halfWidth),
      xMax: fixed.add(centerX, halfWidth),
    },
  };
}

export function sampleMovingPlatforms(definitions: readonly StageMovingPlatformDefinition[], frame: number): SampledMovingPlatform[] {
  return [...definitions].sort((a, b) => a.id.localeCompare(b.id)).map((definition) => sampleMovingPlatform(definition, frame));
}

/** Active/inactive hazard cadence; stage-owned effects use this boolean as the deterministic gate. */
export function isHazardActive(definition: StageHazardDefinition, frame: number): boolean {
  if (!Number.isInteger(frame)) throw new Error(`stage frame must be integer, got ${frame}`);
  const period = definition.activeFrames + definition.inactiveFrames;
  if (period <= 0) return false;
  return positiveMod(frame + definition.phaseFrames, period) < definition.activeFrames;
}
