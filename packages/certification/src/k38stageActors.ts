import { fixed } from '../../deterministic-math/src/fixed.js';
import type { EntityDefinition } from '../../content/src/compileEntities.js';
import { createTwoFighterMatch, type MatchInputFrame, type MatchStepResult } from '../../sim/src/match.js';
import { spawnStageActors, withStageActors, type StageActorSpawnRule } from '../../sim/src/stageActors.js';
import type { WorldState } from '../../sim/src/types.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`K38 stage-actor certification failure: ${message}`);
}

const ownerId = 'stage:actor-cert';
const definition: EntityDefinition = {
  id: `${ownerId}:bolt`, fighterId: ownerId, localId: 'bolt', kind: 'projectile', lifetimeFrames: 120,
  radius: fixed.fromRatio(1, 2), spawnOffsetX: fixed.zero, spawnOffsetY: fixed.zero,
  velocityX: fixed.fromRatio(1, 2), velocityY: fixed.zero, gravity: fixed.zero,
  damageTenths: 80, baseKnockback: fixed.fromInt(2), growthPer100Percent: fixed.fromInt(1),
  directionX: 1, directionY: 1, hitlagFrames: 3, hitstunFrames: 10, destroyOnHit: true, maxHits: 1,
};
const definitions = new Map([[definition.id, definition]]);
const rules: StageActorSpawnRule[] = [{ id: 'left-cannon', entityDefinitionId: definition.id, x: fixed.fromInt(-3), y: fixed.fromInt(1), facing: 1, intervalFrames: 30, phaseFrames: 0, maxActive: 1 }];

let world = createTwoFighterMatch(38);
world = { ...world, entities: [], nextEntitySerial: 1 };
let spawned = spawnStageActors(world, 'actor-cert', rules, definitions);
assert(spawned.entities?.length === 1 && spawned.entities[0]?.ownerId === ownerId, 'stage actor must spawn into canonical entity collection with synthetic stage owner');
assert(spawned.entities[0]?.vx === fixed.fromRatio(1, 2) && spawned.nextEntitySerial === 2, 'stage actor must inherit deterministic authored velocity and monotonic serial');
spawned = spawnStageActors(spawned, 'actor-cert', rules, definitions);
assert(spawned.entities?.length === 1, 'maxActive must prevent duplicate stage actors on same cadence frame');

let captured: WorldState | null = null;
const probe = (state: WorldState, _input: MatchInputFrame): MatchStepResult => {
  captured = structuredClone(state);
  return { state: { ...state, frame: state.frame + 1 }, events: [] };
};
const wrapped = withStageActors(probe, 'actor-cert', rules, definitions);
wrapped(world, { frame: 0, byFighterId: {} });
assert(captured !== null && (captured as WorldState).entities?.[0]?.ownerDefinitionId === ownerId, 'stage actor adapter must feed spawned actor into ordinary authoritative match step');

let rejected = false;
try {
  const badDefinition = { ...definition, fighterId: 'greybox' };
  spawnStageActors(world, 'actor-cert', rules, new Map([[badDefinition.id, badDefinition]]));
} catch { rejected = true; }
assert(rejected, 'stage actor definition must explicitly belong to synthetic stage owner');

console.log('K38 STAGE ACTORS PASS — deterministic stage-owned projectiles/traps/summons reuse the canonical rollback entity collection, serials, collision engine and team-neutral ownership without stage-specific simulation code.');
