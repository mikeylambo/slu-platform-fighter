import { fixed, type Fixed } from '../../deterministic-math/src/fixed.js';
import type { CompiledStageDefinition, StageHazardDefinition, StageMovingPlatformDefinition } from '../../content/src/compileStage.js';
import type { MatchInputFrame, MatchStepResult } from './match.js';
import type { StageSurface, WorldState } from './types.js';

export const MOVING_PLATFORM_SURFACE_PREFIX = 'moving:';

export interface StagePoint { x: Fixed; y: Fixed; }
export interface StageHazardActivity { id: string; kind: StageHazardDefinition['kind']; active: boolean; }
export type StageAwareStep = (state: WorldState, input: MatchInputFrame) => MatchStepResult;

function positiveMod(value: number, modulus: number): number {
  const result = value % modulus;
  return result < 0 ? result + modulus : result;
}

function lerpFixed(a: Fixed, b: Fixed, numerator: number, denominator: number): Fixed {
  if (denominator <= 0 || !Number.isInteger(numerator) || !Number.isInteger(denominator)) throw new Error('stage lerp requires integer numerator and positive denominator');
  const delta = fixed.sub(b, a);
  return fixed.add(a, fixed.mul(delta, fixed.fromRatio(numerator, denominator)));
}

/**
 * Samples an authored platform path as a deterministic ping-pong trajectory.
 * A two-point path therefore behaves as a shuttle; longer paths traverse every
 * segment forward, then reverse without teleporting from the last point to first.
 */
export function movingPlatformPointAt(platform: StageMovingPlatformDefinition, frame: number): StagePoint {
  if (!Number.isInteger(frame) || frame < 0) throw new Error(`stage frame must be non-negative integer, got ${frame}`);
  if (!Number.isInteger(platform.periodFrames) || platform.periodFrames < 1) throw new Error(`${platform.id} periodFrames must be positive integer`);
  if (platform.path.length < 2) throw new Error(`${platform.id} moving platform path requires at least two points`);

  const forwardSegments = platform.path.length - 1;
  const traversalSegments = forwardSegments * 2;
  const phase = positiveMod(frame + platform.phaseFrames, platform.periodFrames);
  const scaled = phase * traversalSegments;
  const segmentIndex = Math.min(traversalSegments - 1, Math.floor(scaled / platform.periodFrames));
  const localNumerator = scaled - segmentIndex * platform.periodFrames;
  const goingForward = segmentIndex < forwardSegments;
  const pathIndex = goingForward ? segmentIndex : traversalSegments - segmentIndex - 1;
  const from = goingForward ? platform.path[pathIndex] : platform.path[pathIndex + 1];
  const to = goingForward ? platform.path[pathIndex + 1] : platform.path[pathIndex];
  if (!from || !to) throw new Error(`${platform.id} path sampling resolved invalid segment ${segmentIndex}`);
  return {
    x: lerpFixed(from.x, to.x, localNumerator, platform.periodFrames),
    y: lerpFixed(from.y, to.y, localNumerator, platform.periodFrames),
  };
}

export function movingPlatformSurfaceAt(platform: StageMovingPlatformDefinition, frame: number): StageSurface {
  const point = movingPlatformPointAt(platform, frame);
  const half = fixed.mul(platform.width, fixed.fromRatio(1, 2));
  return {
    id: `${MOVING_PLATFORM_SURFACE_PREFIX}${platform.id}`,
    kind: platform.kind,
    y: point.y,
    xMin: fixed.sub(point.x, half),
    xMax: fixed.add(point.x, half),
  };
}

export function stageSurfacesAt(stage: CompiledStageDefinition, frame: number): StageSurface[] {
  return [
    ...stage.surfaces.map((surface) => ({ ...surface })),
    ...stage.movingPlatforms.map((platform) => movingPlatformSurfaceAt(platform, frame)),
  ].sort((a, b) => a.id.localeCompare(b.id));
}

export function isStageHazardActive(hazard: StageHazardDefinition, frame: number): boolean {
  if (!Number.isInteger(frame) || frame < 0) throw new Error(`stage frame must be non-negative integer, got ${frame}`);
  if (hazard.activeFrames < 0 || hazard.inactiveFrames < 0) throw new Error(`${hazard.id} hazard cadence cannot be negative`);
  const period = hazard.activeFrames + hazard.inactiveFrames;
  if (period === 0) return false;
  const phase = positiveMod(frame + hazard.phaseFrames, period);
  return phase < hazard.activeFrames;
}

export function stageHazardActivityAt(stage: CompiledStageDefinition, frame: number): StageHazardActivity[] {
  return stage.hazards.map((hazard) => ({ id: hazard.id, kind: hazard.kind, active: isStageHazardActive(hazard, frame) }));
}

/**
 * Adds deterministic moving-platform collision/rider carry around an ordinary
 * match step. Hazard cadence is intentionally query-only until hazard effect
 * payloads (damage/launch values) are explicitly authored in the stage schema.
 */
export function withStageMotion(step: StageAwareStep, stage: CompiledStageDefinition): StageAwareStep {
  return (state, input) => {
    const currentSurfaces = stageSurfacesAt(stage, state.frame);
    const currentById = new Map(currentSurfaces.map((surface) => [surface.id, surface] as const));
    const normalizedState: WorldState = { ...state, surfaces: currentSurfaces };
    const result = step(normalizedState, input);
    const nextSurfaces = stageSurfacesAt(stage, result.state.frame);
    const nextById = new Map(nextSurfaces.map((surface) => [surface.id, surface] as const));

    const fighters = result.state.fighters.map((fighter) => {
      const surfaceId = fighter.groundSurfaceId;
      if (!fighter.grounded || !surfaceId?.startsWith(MOVING_PLATFORM_SURFACE_PREFIX)) return fighter;
      const previousSurface = currentById.get(surfaceId);
      const nextSurface = nextById.get(surfaceId);
      if (!previousSurface || !nextSurface) return fighter;
      const previousCenter = Math.trunc((previousSurface.xMin + previousSurface.xMax) / 2) as Fixed;
      const nextCenter = Math.trunc((nextSurface.xMin + nextSurface.xMax) / 2) as Fixed;
      return {
        ...fighter,
        x: fixed.add(fighter.x, fixed.sub(nextCenter, previousCenter)),
        y: nextSurface.y,
      };
    });

    return { ...result, state: { ...result.state, fighters, surfaces: nextSurfaces } };
  };
}
