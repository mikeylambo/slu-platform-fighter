import type { Fixed } from '../../deterministic-math/src/fixed.js';
import type { StageLedge, StageSurface } from '../../sim/src/types.js';
import type { StockMatchRules } from '../../sim/src/lifecycle.js';

export interface StageSpawn { id: string; x: Fixed; y: Fixed; facing: -1 | 1; }
export interface StageCameraDefinition {
  left: Fixed;
  right: Fixed;
  bottom: Fixed;
  top: Fixed;
  padding: Fixed;
  minZoom: Fixed;
  maxZoom: Fixed;
}
export interface StageMovingPlatformDefinition {
  id: string;
  kind: 'solid' | 'one-way';
  width: Fixed;
  path: readonly { x: Fixed; y: Fixed }[];
  periodFrames: number;
  phaseFrames: number;
}
export interface StageHazardDefinition {
  id: string;
  kind: 'damage' | 'launch' | 'ko';
  x: Fixed;
  y: Fixed;
  radius: Fixed;
  activeFrames: number;
  inactiveFrames: number;
  phaseFrames: number;
}
export interface CompiledStageDefinition {
  id: string;
  displayName: string;
  surfaces: StageSurface[];
  ledges: StageLedge[];
  spawns: StageSpawn[];
  stockRules: StockMatchRules;
  camera: StageCameraDefinition;
  movingPlatforms: StageMovingPlatformDefinition[];
  hazards: StageHazardDefinition[];
}

interface StagePackLike {
  id: string;
  identity: { displayName: string };
  surfaces: readonly { id: string; kind: 'solid' | 'one-way'; y: number; xMin: number; xMax: number }[];
  ledges: readonly { id: string; x: number; y: number; inward: -1 | 1 }[];
  spawns: readonly { id: string; x: number; y: number; facing: -1 | 1 }[];
  blastZone: { left: number; right: number; bottom: number; top: number };
  camera: { bounds: { left: number; right: number; bottom: number; top: number }; padding: number; minZoom: number; maxZoom: number };
  movingPlatforms: readonly { id: string; kind: 'solid' | 'one-way'; width: number; path: readonly { x: number; y: number }[]; periodFrames: number; phaseFrames: number }[];
  hazards: readonly { id: string; kind: 'damage' | 'launch' | 'ko'; x: number; y: number; radius: number; activeFrames: number; inactiveFrames: number; phaseFrames: number }[];
}

export function compileStage(pack: StagePackLike): CompiledStageDefinition {
  const surfaces = [...pack.surfaces]
    .map((surface) => ({ ...surface, y: surface.y as Fixed, xMin: surface.xMin as Fixed, xMax: surface.xMax as Fixed }))
    .sort((a, b) => a.id.localeCompare(b.id));
  const ledges = [...pack.ledges]
    .map((ledge) => ({ ...ledge, x: ledge.x as Fixed, y: ledge.y as Fixed }))
    .sort((a, b) => a.id.localeCompare(b.id));
  const spawns = [...pack.spawns]
    .map((spawn) => ({ ...spawn, x: spawn.x as Fixed, y: spawn.y as Fixed }))
    .sort((a, b) => a.id.localeCompare(b.id));

  return {
    id: pack.id,
    displayName: pack.identity.displayName,
    surfaces,
    ledges,
    spawns,
    stockRules: {
      blastLeft: pack.blastZone.left as Fixed,
      blastRight: pack.blastZone.right as Fixed,
      blastBottom: pack.blastZone.bottom as Fixed,
      blastTop: pack.blastZone.top as Fixed,
      respawnXSpacing: 1_500_000 as Fixed,
      respawnY: pack.camera.bounds.top as Fixed,
      respawnFrames: 60,
      respawnInvulnerableFrames: 120,
    },
    camera: {
      left: pack.camera.bounds.left as Fixed,
      right: pack.camera.bounds.right as Fixed,
      bottom: pack.camera.bounds.bottom as Fixed,
      top: pack.camera.bounds.top as Fixed,
      padding: pack.camera.padding as Fixed,
      minZoom: pack.camera.minZoom as Fixed,
      maxZoom: pack.camera.maxZoom as Fixed,
    },
    movingPlatforms: [...pack.movingPlatforms]
      .map((platform) => ({
        ...platform,
        width: platform.width as Fixed,
        path: platform.path.map((point) => ({ x: point.x as Fixed, y: point.y as Fixed })),
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    hazards: [...pack.hazards]
      .map((hazard) => ({ ...hazard, x: hazard.x as Fixed, y: hazard.y as Fixed, radius: hazard.radius as Fixed }))
      .sort((a, b) => a.id.localeCompare(b.id)),
  };
}
