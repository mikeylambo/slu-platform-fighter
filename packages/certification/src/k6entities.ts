import { createHash } from 'node:crypto';
import { fixed } from '../../deterministic-math/src/fixed.js';
import { compileEntityDefinitionRegistry } from '../../content/src/compileEntities.js';
import { FIGHTER_ENTITY_PACKS } from '../../content/src/generated/entityRegistry.js';
import { spawnOwnedEntity, stepOwnedEntities } from '../../sim/src/entities.js';
import { serializeWorldState } from '../../sim/src/serialize.js';
import { createFighterState, createWorld } from '../../sim/src/world.js';
import type { SimInputFrame } from '../../sim/src/types.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`K6 entity certification failure: ${message}`);
}

function input(frame: number, moveX = 0, moveY = 0): SimInputFrame {
  return { frame, moveX, moveY, jumpPressed: false, jumpHeld: false, attackPressed: false, specialPressed: false, grabPressed: false, smashX: 0, smashY: 0, dodgePressed: false, shieldHeld: false };
}

const definitions = compileEntityDefinitionRegistry(FIGHTER_ENTITY_PACKS);
const pulse = definitions.get('greybox:pulse');
assert(pulse !== undefined, 'greybox:pulse must compile from fighter-owned entity pack');
assert(pulse.lifetimeFrames === 120 && pulse.damageTenths === 65 && pulse.destroyOnHit, 'entity authored lifetime/combat policy must compile exactly');

const owner = createFighterState('fighter-a', fixed.fromInt(-5), 1, 'greybox');
let target = createFighterState('fighter-b', fixed.fromRatio(-31, 10), -1, 'greybox');
let entity = spawnOwnedEntity(owner, pulse, 1);
assert(entity.id === 'e1' && entity.ownerId === owner.id && entity.ownerDefinitionId === 'greybox', 'spawn must assign stable serial and owner identities');
assert(entity.x === fixed.fromRatio(-37, 10), 'spawn must apply authored facing-relative X offset');
assert(entity.vx > fixed.zero, 'forward-facing projectile must inherit forward authored velocity');

let result = stepOwnedEntities([entity], [owner, target], definitions, { 'fighter-b': input(0) });
assert(result.events.some((event) => event.type === 'entity-hit'), 'projectile overlap must emit entity-hit event');
target = result.fighters.find((fighter) => fighter.id === 'fighter-b')!;
assert(target.percentTenths === 65 && target.vx > fixed.zero && target.vy > fixed.zero, 'entity hit must apply authored damage and launch');
assert(result.entities.length === 0, 'destroy-on-hit projectile must despawn after successful hit');

const shieldOwner = createFighterState('fighter-a', fixed.fromInt(-5), 1, 'greybox');
const shieldTarget = { ...createFighterState('fighter-b', fixed.fromRatio(-31, 10), -1, 'greybox'), shielding: true };
entity = spawnOwnedEntity(shieldOwner, pulse, 2);
result = stepOwnedEntities([entity], [shieldOwner, shieldTarget], definitions);
const blockedTarget = result.fighters.find((fighter) => fighter.id === 'fighter-b')!;
assert(result.events.some((event) => event.type === 'entity-block'), 'shielded projectile overlap must emit entity-block rather than fighter damage');
assert(blockedTarget.percentTenths === 0 && blockedTarget.shieldHealth < shieldTarget.shieldHealth, 'entity block must preserve percent and consume shield health');

const leftOwner = createFighterState('fighter-left', fixed.fromInt(5), -1, 'greybox');
const leftEntity = spawnOwnedEntity(leftOwner, pulse, 3);
assert(leftEntity.vx < fixed.zero && leftEntity.x < leftOwner.x, 'entity spawn/velocity must mirror with owner facing');

const diOwner = createFighterState('fighter-a', fixed.fromInt(-5), 1, 'greybox');
const diTarget = createFighterState('fighter-b', fixed.fromRatio(-31, 10), -1, 'greybox');
const neutralEntity = spawnOwnedEntity(diOwner, pulse, 4);
const diEntity = spawnOwnedEntity(diOwner, pulse, 5);
const neutralHit = stepOwnedEntities([neutralEntity], [diOwner, diTarget], definitions, { 'fighter-b': input(0) }).fighters.find((fighter) => fighter.id === 'fighter-b')!;
const diHit = stepOwnedEntities([diEntity], [diOwner, diTarget], definitions, { 'fighter-b': input(0, 0, 1000) }).fighters.find((fighter) => fighter.id === 'fighter-b')!;
assert(diHit.vx < neutralHit.vx && diHit.vy > neutralHit.vy, 'fighter-owned entity launch must use universal defender DI policy');

let expiring = spawnOwnedEntity(createFighterState('fighter-a', fixed.fromInt(-10), 1, 'greybox'), pulse, 6);
expiring = { ...expiring, ageFrames: pulse.lifetimeFrames - 1, x: fixed.fromInt(-50) };
const expired = stepOwnedEntities([expiring], [owner, target], definitions);
assert(expired.entities.length === 0, 'entity must despawn exactly at authored lifetime');

const world = createWorld(0x4b_36_45_4e);
world.entities = [spawnOwnedEntity(world.fighters[0]!, pulse, 7)];
world.nextEntitySerial = 8;
const hash = createHash('sha256').update(serializeWorldState(world)).digest('hex');
const changed = structuredClone(world);
changed.entities![0]!.ageFrames += 1;
const changedHash = createHash('sha256').update(serializeWorldState(changed)).digest('hex');
assert(hash !== changedHash, 'binary rollback hash must include authoritative entity state');

console.log('K6 ENTITIES PASS — owned entity compilation, deterministic spawn identity, facing, movement, hits, shield blocks, DI, lifetime, and rollback serialization certified.');
