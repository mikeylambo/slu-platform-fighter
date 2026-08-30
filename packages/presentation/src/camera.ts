import { fixed, type Fixed } from '../../deterministic-math/src/fixed.js';
import type { StageCameraDefinition } from '../../content/src/compileStage.js';
import type { FighterState, WorldState } from '../../sim/src/types.js';

export interface CameraTarget {
  centerX: Fixed;
  centerY: Fixed;
  /** 1_000_000 = 1x. Higher values mean closer/zoomed-in. */
  zoom: Fixed;
  frameLeft: Fixed;
  frameRight: Fixed;
  frameBottom: Fixed;
  frameTop: Fixed;
  trackedFighterIds: readonly string[];
}

function clamp(value: Fixed, min: Fixed, max: Fixed): Fixed {
  if (min > max) return fixed.div(fixed.add(min, max), fixed.fromInt(2));
  return Math.max(min, Math.min(max, value)) as Fixed;
}
function activeFighters(state: WorldState): FighterState[] {
  return [...state.fighters]
    .filter((fighter) => !fighter.eliminated && fighter.respawnFrames === 0)
    .sort((a, b) => a.id.localeCompare(b.id));
}
function midpoint(a: Fixed, b: Fixed): Fixed { return fixed.div(fixed.add(a, b), fixed.fromInt(2)); }

/**
 * Renderer-neutral 1–4+ player camera target. The director is intentionally
 * stateless: presentation layers may smooth between returned targets without
 * changing simulation or replay outcomes.
 */
export function directCamera(state: WorldState, camera: StageCameraDefinition): CameraTarget {
  const fighters = activeFighters(state);
  if (fighters.length === 0) {
    return {
      centerX: midpoint(camera.left, camera.right),
      centerY: midpoint(camera.bottom, camera.top),
      zoom: camera.minZoom,
      frameLeft: camera.left,
      frameRight: camera.right,
      frameBottom: camera.bottom,
      frameTop: camera.top,
      trackedFighterIds: [],
    };
  }

  let minX = fighters[0]!.x;
  let maxX = fighters[0]!.x;
  let minY = fighters[0]!.y;
  let maxY = fighters[0]!.y;
  for (const fighter of fighters.slice(1)) {
    minX = Math.min(minX, fighter.x) as Fixed;
    maxX = Math.max(maxX, fighter.x) as Fixed;
    minY = Math.min(minY, fighter.y) as Fixed;
    maxY = Math.max(maxY, fighter.y) as Fixed;
  }

  const desiredLeft = fixed.sub(minX, camera.padding);
  const desiredRight = fixed.add(maxX, camera.padding);
  const desiredBottom = fixed.sub(minY, camera.padding);
  const desiredTop = fixed.add(maxY, camera.padding);
  const fullWidth = fixed.sub(camera.right, camera.left);
  const fullHeight = fixed.sub(camera.top, camera.bottom);
  const desiredWidth = Math.min(fullWidth, fixed.sub(desiredRight, desiredLeft)) as Fixed;
  const desiredHeight = Math.min(fullHeight, fixed.sub(desiredTop, desiredBottom)) as Fixed;
  const halfWidth = fixed.div(desiredWidth, fixed.fromInt(2));
  const halfHeight = fixed.div(desiredHeight, fixed.fromInt(2));

  let centerX = midpoint(desiredLeft, desiredRight);
  let centerY = midpoint(desiredBottom, desiredTop);
  centerX = clamp(centerX, fixed.add(camera.left, halfWidth), fixed.sub(camera.right, halfWidth));
  centerY = clamp(centerY, fixed.add(camera.bottom, halfHeight), fixed.sub(camera.top, halfHeight));

  const widthRatio = fullWidth > fixed.zero ? fixed.div(desiredWidth, fullWidth) : fixed.one;
  const heightRatio = fullHeight > fixed.zero ? fixed.div(desiredHeight, fullHeight) : fixed.one;
  const spread = Math.max(widthRatio, heightRatio) as Fixed;
  const zoomRange = fixed.sub(camera.maxZoom, camera.minZoom);
  const zoom = clamp(fixed.sub(camera.maxZoom, fixed.mul(zoomRange, spread)), camera.minZoom, camera.maxZoom);

  return {
    centerX,
    centerY,
    zoom,
    frameLeft: fixed.sub(centerX, halfWidth),
    frameRight: fixed.add(centerX, halfWidth),
    frameBottom: fixed.sub(centerY, halfHeight),
    frameTop: fixed.add(centerY, halfHeight),
    trackedFighterIds: fighters.map((fighter) => fighter.id),
  };
}
