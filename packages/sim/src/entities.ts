import { fixed, type Fixed } from '../../deterministic-math/src/fixed.js';
import type { EntityDefinition, EntitySpawnDefinition } from '../../content/src/compileEntities.js';
import { K2_DEFENSE } from './combat.js';
import { applyDirectionalInfluence } from './knockback.js';
import type { FighterState, OwnedEntityState, SimInputFrame } from './types.js';

const FIGHTER_HURTBOX_RADIUS = fixed.fromRatio(3, 4);
const FIGHTER_HURTBOX_OFFSET_Y = fixed.fromRatio(3, 2);

export interface EntityHitEvent {
  type: 'entity-hit';
  entityId: string;
  definitionId: string;
  ownerId: string;
  targetId: string;
  damageTenths: number;
  knockbackX: Fixed;
  knockbackY: Fixed;
  hitlagFrames: number;
  hitstunFrames: number;
}

export interface EntityBlockEvent {
  type: 'entity-block';
  entityId: string;
  definitionId: string;
  ownerId: string;
  targetId: string;
  shieldDamage: number;
  shieldHealthAfter: number;
  broken: boolean;
}

export type EntityEvent = EntityHitEvent | EntityBlockEvent;

function circlesOverlap(ax: Fixed, ay: Fixed, ar: Fixed, bx: Fixed, by: Fixed, br: Fixed): boolean {
  const dx = fixed.sub(ax, bx);
  const dy = fixed.sub(ay, by);
  const radius = fixed.add(ar, br);
  return fixed.add(fixed.mul(dx, dx), fixed.mul(dy, dy)) <= fixed.mul(radius, radius);
}

function normalizedDirection(definition: EntityDefinition, facing: -1 | 1): { x: Fixed; y: Fixed } {
  const rawX = definition.directionX * facing;
  const rawY = definition.directionY;
  const magnitude = Math.max(Math.abs(rawX), Math.abs(rawY), 1);
  return { x: fixed.fromRatio(rawX, magnitude), y: fixed.fromRatio(rawY, magnitude) };
}

function launchMagnitude(definition: EntityDefinition, percentTenths: number): Fixed {
  return fixed.add(definition.baseKnockback, fixed.mul(definition.growthPer100Percent, fixed.fromRatio(percentTenths, 1000)));
}

export function spawnOwnedEntity(
  owner: FighterState,
  definition: EntityDefinition,
  serial: number,
  spawn?: Pick<EntitySpawnDefinition, 'offsetX' | 'offsetY'>,
): OwnedEntityState {
  if (!Number.isInteger(serial) || serial < 1) throw new Error(`entity serial must be positive integer, got ${serial}`);
  if (definition.fighterId !== owner.definitionId) throw new Error(`${owner.id} (${owner.definitionId}) cannot spawn entity owned by ${definition.fighterId}`);
  const extraX = spawn?.offsetX ?? fixed.zero;
  const extraY = spawn?.offsetY ?? fixed.zero;
  const facingFixed = fixed.fromInt(owner.facing);
  const xOffset = fixed.mul(fixed.add(definition.spawnOffsetX, extraX), facingFixed);
  return {
    id: `e${serial}`,
    definitionId: definition.id,
    ownerId: owner.id,
    ownerDefinitionId: owner.definitionId,
    x: fixed.add(owner.x, xOffset),
    y: fixed.add(owner.y, fixed.add(definition.spawnOffsetY, extraY)),
    vx: fixed.mul(definition.velocityX, facingFixed),
    vy: definition.velocityY,
    facing: owner.facing,
    ageFrames: 0,
    lifetimeFrames: definition.lifetimeFrames,
    hitsRemaining: definition.maxHits,
    hitTargets: [],
  };
}

export function spawnEntitiesFromAttacks(
  fighters: readonly FighterState[],
  entitiesInput: readonly OwnedEntityState[],
  nextSerialInput: number,
  definitions: ReadonlyMap<string, EntityDefinition>,
  spawnsByMoveId: ReadonlyMap<string, readonly EntitySpawnDefinition[]>,
): { entities: OwnedEntityState[]; nextEntitySerial: number } {
  const entities = [...entitiesInput].map((entity) => ({ ...entity, hitTargets: [...entity.hitTargets] }));
  let nextEntitySerial = nextSerialInput;
  for (const fighter of [...fighters].sort((a, b) => a.id.localeCompare(b.id))) {
    if (!fighter.attack || fighter.eliminated || fighter.respawnFrames > 0) continue;
    const spawns = spawnsByMoveId.get(fighter.attack.attackId) ?? [];
    for (const spawn of spawns) {
      if (spawn.frame !== fighter.attack.frame) continue;
      const definition = definitions.get(spawn.entityDefinitionId);
      if (!definition) throw new Error(`missing entity definition ${spawn.entityDefinitionId}`);
      entities.push(spawnOwnedEntity(fighter, definition, nextEntitySerial, spawn));
      nextEntitySerial += 1;
    }
  }
  entities.sort((a, b) => a.id.localeCompare(b.id));
  return { entities, nextEntitySerial };
}

export function stepOwnedEntities(
  entitiesInput: readonly OwnedEntityState[],
  fightersInput: readonly FighterState[],
  definitions: ReadonlyMap<string, EntityDefinition>,
  inputs: Readonly<Record<string, SimInputFrame>> = {},
): { entities: OwnedEntityState[]; fighters: FighterState[]; events: EntityEvent[] } {
  const fighters = [...fightersInput].sort((a, b) => a.id.localeCompare(b.id)).map((fighter) => ({ ...fighter }));
  const events: EntityEvent[] = [];
  const survivors: OwnedEntityState[] = [];

  for (const source of [...entitiesInput].sort((a, b) => a.id.localeCompare(b.id))) {
    const definition = definitions.get(source.definitionId);
    if (!definition) throw new Error(`missing entity definition ${source.definitionId}`);
    let entity: OwnedEntityState = {
      ...source,
      ageFrames: source.ageFrames + 1,
      vy: fixed.sub(source.vy, definition.gravity),
      x: fixed.add(source.x, source.vx),
      y: fixed.add(source.y, fixed.sub(source.vy, definition.gravity)),
      hitTargets: [...source.hitTargets],
    };
    if (entity.ageFrames >= entity.lifetimeFrames || entity.hitsRemaining <= 0) continue;

    let consumed = false;
    for (let index = 0; index < fighters.length; index += 1) {
      const target = fighters[index];
      if (!target || target.id === entity.ownerId || target.eliminated || target.respawnFrames > 0 || target.invulnerableFrames > 0) continue;
      if (entity.hitTargets.includes(target.id)) continue;
      const hurtboxY = fixed.add(target.y, FIGHTER_HURTBOX_OFFSET_Y);
      if (!circlesOverlap(entity.x, entity.y, definition.radius, target.x, hurtboxY, FIGHTER_HURTBOX_RADIUS)) continue;

      entity = { ...entity, hitTargets: [...entity.hitTargets, target.id].sort(), hitsRemaining: entity.hitsRemaining - 1 };
      if (target.shielding && target.shieldHealth > 0) {
        const shieldDamage = K2_DEFENSE.shieldDamageBase + definition.damageTenths;
        const shieldHealthAfter = Math.max(0, target.shieldHealth - shieldDamage);
        const broken = shieldHealthAfter === 0;
        fighters[index] = {
          ...target,
          shieldHealth: shieldHealthAfter,
          shielding: !broken,
          shieldStunFrames: broken ? 0 : Math.max(target.shieldStunFrames, K2_DEFENSE.shieldStunBaseFrames + definition.hitlagFrames),
          shieldRegenDelayFrames: K2_DEFENSE.shieldRegenDelayFrames,
          hitlagFrames: Math.max(target.hitlagFrames, definition.hitlagFrames),
          hitstunFrames: broken ? Math.max(target.hitstunFrames, K2_DEFENSE.shieldBreakStunFrames) : target.hitstunFrames,
          attack: broken ? null : target.attack,
        };
        events.push({ type: 'entity-block', entityId: entity.id, definitionId: entity.definitionId, ownerId: entity.ownerId, targetId: target.id, shieldDamage, shieldHealthAfter, broken });
      } else {
        const percentTenths = target.percentTenths + definition.damageTenths;
        const magnitude = launchMagnitude(definition, percentTenths);
        const direction = normalizedDirection(definition, entity.facing);
        const baseX = fixed.mul(direction.x, magnitude);
        const baseY = fixed.mul(direction.y, magnitude);
        const influenced = applyDirectionalInfluence(baseX, baseY, inputs[target.id] ?? {
          frame: 0, moveX: 0, moveY: 0, jumpPressed: false, jumpHeld: false, dodgePressed: false, shieldHeld: false,
        });
        fighters[index] = {
          ...target,
          percentTenths,
          vx: influenced.vx,
          vy: influenced.vy,
          hitlagFrames: Math.max(target.hitlagFrames, definition.hitlagFrames),
          hitstunFrames: Math.max(target.hitstunFrames, definition.hitstunFrames),
          attack: null,
          shielding: false,
          grounded: false,
          groundSurfaceId: null,
          locomotion: 'airborne',
          locomotionFrame: 0,
        };
        events.push({
          type: 'entity-hit', entityId: entity.id, definitionId: entity.definitionId, ownerId: entity.ownerId,
          targetId: target.id, damageTenths: definition.damageTenths, knockbackX: influenced.vx, knockbackY: influenced.vy,
          hitlagFrames: definition.hitlagFrames, hitstunFrames: definition.hitstunFrames,
        });
      }

      if (definition.destroyOnHit || entity.hitsRemaining <= 0) { consumed = true; break; }
    }

    if (!consumed && entity.hitsRemaining > 0) survivors.push(entity);
  }

  return { entities: survivors, fighters, events };
}
