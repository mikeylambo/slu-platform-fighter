import { fixed } from '../../deterministic-math/src/fixed.js';
import type { EntityDefinition } from '../../content/src/compileEntities.js';
import { stepOwnedEntities } from '../../sim/src/entities.js';
import { createTwoFighterMatch, stepMatchWorld } from '../../sim/src/match.js';
import { createTeamInteractionPolicy, resolveWinningTeam, validateTeamRules, type TeamRules } from '../../sim/src/teamPolicy.js';
import { createFighterState } from '../../sim/src/world.js';
import type { AttackDefinition } from '../../sim/src/combat.js';
import type { OwnedEntityState, SimInputFrame, WorldState } from '../../sim/src/types.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`K15 teams certification failure: ${message}`);
}
function neutral(frame: number, patch: Partial<Omit<SimInputFrame, 'frame'>> = {}): SimInputFrame {
  return { frame, moveX: 0, moveY: 0, jumpPressed: false, jumpHeld: false, attackPressed: false, specialPressed: false, grabPressed: false, smashX: 0, smashY: 0, dodgePressed: false, shieldHeld: false, ...patch };
}

const teamRules: TeamRules = {
  enabled: true,
  friendlyFire: false,
  teamByParticipant: { 'fighter-a': 'red', 'fighter-b': 'red', 'fighter-c': 'blue' },
};
validateTeamRules(['fighter-a', 'fighter-b', 'fighter-c'], teamRules);
const policy = createTeamInteractionPolicy(teamRules);
assert(!policy.canTarget('fighter-a', 'fighter-b') && policy.canTarget('fighter-a', 'fighter-c'), 'friendly fire off must reject teammate targeting and retain enemy targeting');
assert(createTeamInteractionPolicy({ ...teamRules, friendlyFire: true }).canTarget('fighter-a', 'fighter-b'), 'friendly fire on must restore teammate targeting');

const jab: AttackDefinition = {
  id: 'greybox:jab', totalFrames: 5,
  hitboxes: [{ startFrame: 0, endFrame: 0, hitbox: {
    id: 'team-test', offsetX: fixed.fromRatio(4, 5), offsetY: fixed.fromRatio(3, 2), radius: fixed.fromRatio(3, 4),
    damageTenths: 50, baseKnockback: fixed.fromRatio(1, 5), growthPer100Percent: fixed.fromRatio(1, 4),
    directionX: 1000, directionY: 200, hitlagFrames: 2, hitstunFrames: 8,
  }}],
};
const attacks = new Map([[jab.id, jab]]);

function baseWorld(): WorldState {
  const world = createTwoFighterMatch(0x4b_15_0001);
  world.fighters[0]!.x = fixed.zero;
  world.fighters[1]!.x = fixed.fromRatio(1, 2);
  world.fighters.push(createFighterState('fighter-c', fixed.fromInt(1), -1, 'greybox'));
  return world;
}

let world = baseWorld();
let result = stepMatchWorld(world, { frame: 0, byFighterId: {
  'fighter-a': neutral(0, { attackPressed: true }), 'fighter-b': neutral(0), 'fighter-c': neutral(0),
}}, attacks, 'greybox:jab', undefined, undefined, undefined, undefined, undefined, undefined, undefined, policy);
assert(result.events.some((event) => event.type === 'hit' && event.attackerId === 'fighter-a' && event.targetId === 'fighter-c'), 'enemy in shared hitbox must be hit');
assert(!result.events.some((event) => (event.type === 'hit' || event.type === 'block') && event.targetId === 'fighter-b'), 'teammate in shared hitbox must not be hit or shielded when friendly fire is off');
assert(result.state.fighters.find((fighter) => fighter.id === 'fighter-b')?.percentTenths === 0, 'filtered teammate must retain damage state');

world = baseWorld();
result = stepMatchWorld(world, { frame: 0, byFighterId: {
  'fighter-a': neutral(0, { grabPressed: true }), 'fighter-b': neutral(0), 'fighter-c': neutral(0),
}}, attacks, 'greybox:jab', undefined, undefined, undefined, undefined, undefined, undefined, undefined, policy);
assert(result.events.some((event) => event.type === 'grab' && event.attackerId === 'fighter-a' && event.targetId === 'fighter-c'), 'grab targeting must skip a closer teammate and acquire an enemy');
assert(!result.events.some((event) => event.type === 'grab' && event.targetId === 'fighter-b'), 'friendly-fire policy must also filter grabs');

const entityDefinition: EntityDefinition = {
  id: 'greybox:team-bolt', fighterId: 'greybox', localId: 'team-bolt', kind: 'projectile', lifetimeFrames: 20,
  radius: fixed.fromInt(2), spawnOffsetX: fixed.zero, spawnOffsetY: fixed.zero, velocityX: fixed.zero, velocityY: fixed.zero, gravity: fixed.zero,
  damageTenths: 40, baseKnockback: fixed.fromRatio(1, 5), growthPer100Percent: fixed.fromRatio(1, 5), directionX: 1000, directionY: 100,
  hitlagFrames: 2, hitstunFrames: 7, destroyOnHit: true, maxHits: 1,
};
const entity: OwnedEntityState = {
  id: 'e1', definitionId: entityDefinition.id, ownerId: 'fighter-a', ownerDefinitionId: 'greybox',
  x: fixed.fromRatio(1, 2), y: fixed.fromRatio(3, 2), vx: fixed.zero, vy: fixed.zero, facing: 1,
  ageFrames: 0, lifetimeFrames: 20, hitsRemaining: 1, hitTargets: [],
};
world = baseWorld();
const entityResult = stepOwnedEntities([entity], world.fighters, new Map([[entityDefinition.id, entityDefinition]]), {}, (ownerId, targetId) => policy.canTarget(ownerId, targetId));
assert(entityResult.events.some((event) => event.type === 'entity-hit' && event.targetId === 'fighter-c'), 'fighter-owned projectile must skip teammate and hit enemy under same policy');
assert(!entityResult.events.some((event) => event.targetId === 'fighter-b'), 'fighter-owned projectile must not interact with teammate when friendly fire is off');

const eliminated = baseWorld();
eliminated.fighters.find((fighter) => fighter.id === 'fighter-c')!.eliminated = true;
assert(resolveWinningTeam(eliminated.fighters, teamRules) === 'red', 'team lifecycle helper must resolve sole surviving team');

console.log('K15 TEAMS PASS — melee, grabs and fighter-owned entities share deterministic friendly-fire filtering; surviving-team resolution certified.');
