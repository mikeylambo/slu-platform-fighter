import type { Fixed } from '../../deterministic-math/src/fixed.js';

interface TimelineEvent {
  frame: number;
  type: string;
  data?: Record<string, unknown>;
}
interface PackMove { totalFrames: number; timeline: readonly TimelineEvent[]; }
interface FighterPackLike { id: string; moves: Readonly<Record<string, PackMove>>; }
interface EntityPackLike {
  fighterId: string;
  entities: Readonly<Record<string, {
    kind: 'projectile' | 'trap' | 'summon' | 'weapon';
    lifetimeFrames: number;
    radius: number;
    spawnOffsetX: number;
    spawnOffsetY: number;
    velocityX: number;
    velocityY: number;
    gravity: number;
    damageTenths: number;
    baseKnockback: number;
    growthPer100Percent: number;
    directionX: number;
    directionY: number;
    hitlagFrames: number;
    hitstunFrames: number;
    destroyOnHit: boolean;
    maxHits: number;
  }>>;
}

export interface EntityDefinition {
  id: string;
  fighterId: string;
  localId: string;
  kind: 'projectile' | 'trap' | 'summon' | 'weapon';
  lifetimeFrames: number;
  radius: Fixed;
  spawnOffsetX: Fixed;
  spawnOffsetY: Fixed;
  velocityX: Fixed;
  velocityY: Fixed;
  gravity: Fixed;
  damageTenths: number;
  baseKnockback: Fixed;
  growthPer100Percent: Fixed;
  directionX: number;
  directionY: number;
  hitlagFrames: number;
  hitstunFrames: number;
  destroyOnHit: boolean;
  maxHits: number;
}

export interface EntitySpawnDefinition {
  moveId: string;
  frame: number;
  entityDefinitionId: string;
  offsetX: Fixed;
  offsetY: Fixed;
}

function integer(data: Record<string, unknown>, key: string, fallback = 0): number {
  const value = data[key];
  if (value === undefined) return fallback;
  if (!Number.isInteger(value)) throw new Error(`entity timeline ${key} must be integer`);
  return value as number;
}

function string(data: Record<string, unknown>, key: string): string {
  const value = data[key];
  if (typeof value !== 'string' || value.length === 0) throw new Error(`entity timeline ${key} must be non-empty string`);
  return value;
}

export function compileEntityDefinitions(pack: EntityPackLike): Map<string, EntityDefinition> {
  const result = new Map<string, EntityDefinition>();
  for (const [localId, raw] of Object.entries(pack.entities).sort(([a],[b]) => a.localeCompare(b))) {
    const id = `${pack.fighterId}:${localId}`;
    result.set(id, {
      id,
      fighterId: pack.fighterId,
      localId,
      kind: raw.kind,
      lifetimeFrames: raw.lifetimeFrames,
      radius: raw.radius as Fixed,
      spawnOffsetX: raw.spawnOffsetX as Fixed,
      spawnOffsetY: raw.spawnOffsetY as Fixed,
      velocityX: raw.velocityX as Fixed,
      velocityY: raw.velocityY as Fixed,
      gravity: raw.gravity as Fixed,
      damageTenths: raw.damageTenths,
      baseKnockback: raw.baseKnockback as Fixed,
      growthPer100Percent: raw.growthPer100Percent as Fixed,
      directionX: raw.directionX,
      directionY: raw.directionY,
      hitlagFrames: raw.hitlagFrames,
      hitstunFrames: raw.hitstunFrames,
      destroyOnHit: raw.destroyOnHit,
      maxHits: raw.maxHits,
    });
  }
  return result;
}

export function compileEntitySpawns(pack: FighterPackLike, definitions: ReadonlyMap<string, EntityDefinition>): Map<string, EntitySpawnDefinition[]> {
  const result = new Map<string, EntitySpawnDefinition[]>();
  for (const [moveName, move] of Object.entries(pack.moves).sort(([a],[b]) => a.localeCompare(b))) {
    const moveId = `${pack.id}:${moveName}`;
    const spawns: EntitySpawnDefinition[] = [];
    for (const event of move.timeline) {
      if (event.type !== 'entity_spawn') continue;
      if (!event.data) throw new Error(`${moveId} entity_spawn requires data`);
      const localId = string(event.data, 'entityId');
      const entityDefinitionId = `${pack.id}:${localId}`;
      const definition = definitions.get(entityDefinitionId);
      if (!definition) throw new Error(`${moveId} references missing owned entity ${localId}`);
      spawns.push({
        moveId,
        frame: event.frame,
        entityDefinitionId,
        offsetX: integer(event.data, 'offsetX', 0) as Fixed,
        offsetY: integer(event.data, 'offsetY', 0) as Fixed,
      });
    }
    if (spawns.length > 0) result.set(moveId, spawns.sort((a,b) => a.frame - b.frame || a.entityDefinitionId.localeCompare(b.entityDefinitionId)));
  }
  return result;
}

export function compileEntityDefinitionRegistry(packs: readonly EntityPackLike[]): Map<string, EntityDefinition> {
  const result = new Map<string, EntityDefinition>();
  for (const pack of [...packs].sort((a,b) => a.fighterId.localeCompare(b.fighterId))) {
    for (const [id, definition] of compileEntityDefinitions(pack)) {
      if (result.has(id)) throw new Error(`duplicate entity definition ${id}`);
      result.set(id, definition);
    }
  }
  return result;
}
