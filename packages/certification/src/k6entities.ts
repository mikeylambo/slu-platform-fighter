import { createHash } from 'node:crypto';
import { fixed } from '../../deterministic-math/src/fixed.js';
import { compileEntityDefinitionRegistry, type EntitySpawnDefinition } from '../../content/src/compileEntities.js';
import { compileFighterGrabActions } from '../../content/src/compileGrabActions.js';
import { compileFighterAttacks } from '../../content/src/compileMoves.js';
import { FIGHTER_ENTITY_PACKS } from '../../content/src/generated/entityRegistry.js';
import { ALL_FIGHTER_PACKS } from '../../content/src/generated/fighterRegistry.js';
import { spawnOwnedEntity, stepOwnedEntities } from '../../sim/src/entities.js';
import { DEFAULT_STOCK_MATCH_RULES } from '../../sim/src/lifecycle.js';
import { createTwoFighterMatch, stepMatchWorld } from '../../sim/src/match.js';
import { K1_MOVEMENT } from '../../sim/src/movement.js';
import { serializeWorldState } from '../../sim/src/serialize.js';
import { createFighterState, createWorld, restoreWorld, snapshotWorld } from '../../sim/src/world.js';
import type { SimInputFrame, WorldState } from '../../sim/src/types.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`K6 entity certification failure: ${message}`);
}

function input(frame: number, moveX = 0, moveY = 0, attackPressed = false): SimInputFrame {
  return { frame, moveX, moveY, jumpPressed: false, jumpHeld: false, attackPressed, specialPressed: false, grabPressed: false, smashX: 0, smashY: 0, dodgePressed: false, shieldHeld: false };
}

function hash(state: WorldState): string {
  return createHash('sha256').update(serializeWorldState(state)).digest('hex');
}

const definitions = compileEntityDefinitionRegistry(FIGHTER_ENTITY_PACKS);
const pulse = definitions.get('greybox:pulse');
assert(pulse !== undefined, 'greybox:pulse must compile from fighter-owned entity pack');
assert(pulse.lifetimeFrames === 120 && pulse.damageTenths === 65 && pulse.destroyOnHit, 'entity authored lifetime/combat policy must compile exactly');

const pack = ALL_FIGHTER_PACKS.find((candidate) => candidate.id === 'greybox');
assert(pack !== undefined, 'greybox fighter pack must exist for unified entity certification');
const attacks = compileFighterAttacks(pack);
const grabActions = compileFighterGrabActions(pack);
const jabId = 'greybox:jab';
assert(attacks.has(jabId), 'greybox jab must compile for entity-spawn match test');
const syntheticSpawn: EntitySpawnDefinition = {
  moveId: jabId,
  frame: 0,
  entityDefinitionId: pulse.id,
  offsetX: fixed.zero,
  offsetY: fixed.zero,
};
const spawnsByMoveId = new Map<string, readonly EntitySpawnDefinition[]>([[jabId, [syntheticSpawn]]]);

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

// Unified match integration: an attack-frame spawn becomes authoritative world state and advances the serial.
let match = createTwoFighterMatch(0x4b_36_4d_41);
match.fighters[0]!.x = fixed.fromRatio(-9, 10);
match.fighters[1]!.x = fixed.fromInt(10);
let matchResult = stepMatchWorld(
  match,
  { frame: 0, byFighterId: { 'fighter-a': input(0, 0, 0, true), 'fighter-b': input(0) } },
  attacks,
  jabId,
  K1_MOVEMENT,
  grabActions,
  DEFAULT_STOCK_MATCH_RULES,
  definitions,
  spawnsByMoveId,
);
match = matchResult.state;
assert(match.entities?.length === 1, 'move-frame entity spawn must enter authoritative match world');
assert(match.entities[0]?.id === 'e1' && match.nextEntitySerial === 2, 'unified match must preserve stable entity serial allocation');

// Snapshot with a live projectile and require frame-identical replay.
const checkpoint = snapshotWorld(match);
const hashes: string[] = [];
for (let i = 0; i < 8; i += 1) {
  const frame = match.frame;
  match = stepMatchWorld(
    match,
    { frame, byFighterId: { 'fighter-a': input(frame), 'fighter-b': input(frame) } },
    attacks,
    jabId,
    K1_MOVEMENT,
    grabActions,
    DEFAULT_STOCK_MATCH_RULES,
    definitions,
    spawnsByMoveId,
  ).state;
  hashes.push(hash(match));
}
let replay = restoreWorld(checkpoint);
for (let i = 0; i < hashes.length; i += 1) {
  const frame = replay.frame;
  replay = stepMatchWorld(
    replay,
    { frame, byFighterId: { 'fighter-a': input(frame), 'fighter-b': input(frame) } },
    attacks,
    jabId,
    K1_MOVEMENT,
    grabActions,
    DEFAULT_STOCK_MATCH_RULES,
    definitions,
    spawnsByMoveId,
  ).state;
  assert(hash(replay) === hashes[i], `live entity rollback replay diverged at sample ${i}`);
}

// Unified match hit path: the spawned projectile can damage/launch through the same match event stream.
match = createTwoFighterMatch(0x4b_36_48_49);
match.fighters[0]!.x = fixed.fromRatio(-9, 10);
match.fighters[1]!.x = fixed.fromInt(2);
matchResult = stepMatchWorld(
  match,
  { frame: 0, byFighterId: { 'fighter-a': input(0, 0, 0, true), 'fighter-b': input(0) } },
  attacks,
  jabId,
  K1_MOVEMENT,
  grabActions,
  DEFAULT_STOCK_MATCH_RULES,
  definitions,
  spawnsByMoveId,
);
assert(matchResult.events.some((event) => event.type === 'entity-hit'), 'unified match event stream must include owned-entity hits');
const unifiedTarget = matchResult.state.fighters.find((fighter) => fighter.id === 'fighter-b');
assert(unifiedTarget?.percentTenths === 65 && unifiedTarget.hitstunFrames > 0, 'owned entity hit must update authoritative fighter combat state');
assert(matchResult.state.entities?.length === 0, 'destroy-on-hit entity must be removed from authoritative match world');

const world = createWorld(0x4b_36_45_4e);
world.entities = [spawnOwnedEntity(world.fighters[0]!, pulse, 7)];
world.nextEntitySerial = 8;
const worldHash = hash(world);
const changed = structuredClone(world);
changed.entities![0]!.ageFrames += 1;
const changedHash = hash(changed);
assert(worldHash !== changedHash, 'binary rollback hash must include authoritative entity state');

console.log('K6 ENTITIES PASS — owned entity compilation, deterministic spawn identity, match integration, hits, shield blocks, DI, lifetime, and live-entity rollback certified.');
