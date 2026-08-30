import { ALL_FIGHTER_PACKS } from '../../content/src/generated/fighterRegistry.js';
import { compileRosterRuntime } from '../../content/src/compileRosterRuntime.js';
import { createTwoFighterMatch, stepMatchWorld } from '../../sim/src/match.js';
import type { SimInputFrame } from '../../sim/src/types.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`K23 content fighter certification failure: ${message}`);
}
function input(frame: number, moveX = 0, attackPressed = false, specialPressed = false): SimInputFrame {
  return { frame, moveX, moveY: 0, jumpPressed: false, jumpHeld: false, attackPressed, specialPressed, grabPressed: false, smashX: 0, smashY: 0, dodgePressed: false, shieldHeld: false };
}

const packs = ALL_FIGHTER_PACKS.filter((pack) => pack.id === 'greybox' || pack.id === 'cert-bruiser');
assert(packs.length === 2, 'generated registry must contain both greybox and cert-bruiser content packs');
const runtime = compileRosterRuntime(packs);
assert(runtime.fighterDefinitionIds.includes('greybox') && runtime.fighterDefinitionIds.includes('cert-bruiser'), 'roster compiler must retain both content identities');

const greyPhysics = runtime.fighterPhysics.get('greybox');
const heavyPhysics = runtime.fighterPhysics.get('cert-bruiser');
assert(greyPhysics && heavyPhysics, 'both packs must compile fighter physics');
assert(heavyPhysics.weight > greyPhysics.weight && heavyPhysics.runSpeed < greyPhysics.runSpeed, 'cert-bruiser must be mechanically heavier/slower from pack data');

const greyJab = runtime.attacks.get('greybox:jab');
const heavyJab = runtime.attacks.get('cert-bruiser:jab');
assert(greyJab && heavyJab, 'both authored jabs must compile');
assert(heavyJab.totalFrames !== greyJab.totalFrames, 'pack-authored attack timing must differ without engine changes');
assert((heavyJab.hitboxes[0]?.hitbox.damageTenths ?? 0) > (greyJab.hitboxes[0]?.hitbox.damageTenths ?? 0), 'cert-bruiser jab must carry its own damage data');

const heavySide = runtime.moveRuntime.get('cert-bruiser:side-special');
assert(heavySide?.velocityEvents.length === 1 && heavySide.invulnerabilityWindows.length === 1, 'cert-bruiser side special must compile authored velocity and invulnerability');

let world = createTwoFighterMatch(0x4b_23_0001);
world = {
  ...world,
  fighters: world.fighters.map((fighter, index) => ({ ...fighter, definitionId: index === 0 ? 'greybox' : 'cert-bruiser' })),
};
const startA = world.fighters[0]!.x;
const startB = world.fighters[1]!.x;
for (let frame = 0; frame < 18; frame += 1) {
  const result = stepMatchWorld(
    world,
    { frame, byFighterId: { 'fighter-a': input(frame, 1000), 'fighter-b': input(frame, 1000) } },
    runtime.attacks,
    '__none__',
    undefined,
    runtime.grabActions,
    undefined,
    runtime.entityDefinitions,
    runtime.entitySpawnsByMoveId,
    runtime.moveRuntime,
    runtime.fighterPhysics,
  );
  world = result.state;
}
const distanceA = world.fighters[0]!.x - startA;
const distanceB = world.fighters[1]!.x - startB;
assert(distanceA > distanceB, 'same player input must produce fighter-specific locomotion from content-owned physics');

console.log('K23 CONTENT FIGHTER PASS — second physical fighter pack travels generated-registry → roster compiler → mixed match with independent body, movement, attack and move-runtime behavior; no fighter-specific engine branch required.');
