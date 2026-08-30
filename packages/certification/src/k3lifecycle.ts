import { createHash } from 'node:crypto';
import { fixed } from '../../deterministic-math/src/fixed.js';
import { compileFighterGrabActions } from '../../content/src/compileGrabActions.js';
import { compileFighterAttacks } from '../../content/src/compileMoves.js';
import { ALL_FIGHTER_PACKS } from '../../content/src/generated/fighterRegistry.js';
import { createTwoFighterMatch, stepMatchWorld } from '../../sim/src/match.js';
import { K1_MOVEMENT } from '../../sim/src/movement.js';
import { DEFAULT_STOCK_MATCH_RULES } from '../../sim/src/lifecycle.js';
import { serializeWorldState } from '../../sim/src/serialize.js';
import { restoreWorld, snapshotWorld } from '../../sim/src/world.js';
import type { SimInputFrame, WorldState } from '../../sim/src/types.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`K3 lifecycle certification failure: ${message}`);
}

const pack = ALL_FIGHTER_PACKS.find((candidate) => candidate.id === 'greybox');
assert(pack !== undefined, 'greybox pack must exist');
const attacks = compileFighterAttacks(pack);
const grabActions = compileFighterGrabActions(pack);
const jabId = 'greybox:jab';

function neutral(frame: number): SimInputFrame {
  return { frame, moveX: 0, moveY: 0, jumpPressed: false, jumpHeld: false, attackPressed: false, grabPressed: false, dodgePressed: false, shieldHeld: false };
}

function step(state: WorldState) {
  return stepMatchWorld(state, {
    frame: state.frame,
    byFighterId: Object.fromEntries(state.fighters.map((fighter) => [fighter.id, neutral(state.frame)])),
  }, attacks, jabId, K1_MOVEMENT, grabActions, DEFAULT_STOCK_MATCH_RULES);
}

function hash(state: WorldState): string {
  return createHash('sha256').update(serializeWorldState(state)).digest('hex');
}

let state = createTwoFighterMatch(0x4b_33_4c_43);
const victimId = 'fighter-b';
const survivorId = 'fighter-a';

for (let stock = 3; stock >= 1; stock -= 1) {
  const victim = state.fighters.find((fighter) => fighter.id === victimId);
  assert(victim !== undefined, 'victim must exist');
  victim.x = fixed.add(DEFAULT_STOCK_MATCH_RULES.blastRight, fixed.fromInt(1));
  victim.percentTenths = 777;
  const ko = step(state);
  state = ko.state;
  const event = ko.events.find((candidate) => candidate.type === 'ko');
  assert(event?.type === 'ko' && event.fighterId === victimId, 'crossing blast zone must emit KO event');
  assert(event.stocksAfter === stock - 1, 'KO must decrement exactly one stock');

  const afterKo = state.fighters.find((fighter) => fighter.id === victimId);
  assert(afterKo !== undefined, 'victim must remain represented after KO');
  if (stock > 1) {
    assert(!afterKo.eliminated && afterKo.respawnFrames === DEFAULT_STOCK_MATCH_RULES.respawnFrames, 'non-final KO must enter deterministic respawn countdown');
    assert(afterKo.percentTenths === 0 && afterKo.attack === null && afterKo.grabTargetId === null && afterKo.grabbedById === null, 'respawn must clear transient combat state');

    const checkpoint = snapshotWorld(state);
    const hashes: string[] = [];
    let respawnObserved = false;
    for (let i = 0; i < DEFAULT_STOCK_MATCH_RULES.respawnFrames + 2; i += 1) {
      const next = step(state); state = next.state; hashes.push(hash(state));
      if (next.events.some((candidate) => candidate.type === 'respawn')) respawnObserved = true;
    }
    assert(respawnObserved, 'respawn countdown must emit respawn event');
    const returned = state.fighters.find((fighter) => fighter.id === victimId);
    assert(returned !== undefined && returned.respawnFrames === 0 && !returned.eliminated, 'fighter must return after respawn countdown');
    assert(returned.invulnerableFrames > 0 && returned.percentTenths === 0, 'respawn must grant deterministic invulnerability and zero percent');

    let replay = restoreWorld(checkpoint);
    for (let i = 0; i < hashes.length; i += 1) {
      replay = step(replay).state;
      assert(hash(replay) === hashes[i], `respawn restore/resim diverged at sample ${i}`);
    }
  } else {
    assert(afterKo.eliminated && afterKo.stocks === 0 && afterKo.respawnFrames === 0, 'final KO must eliminate fighter permanently');
    assert(state.winnerId === survivorId, 'last surviving fighter must become stable winner');
  }
}

const frozenWinner = state.winnerId;
for (let i = 0; i < 10; i += 1) state = step(state).state;
assert(state.winnerId === frozenWinner, 'winner state must remain stable after match resolution');

console.log('K3 LIFECYCLE PASS — blast zones, stock loss, respawn, invulnerability, elimination, winner resolution, and respawn rollback certified.');
console.log(`Final lifecycle state hash: ${hash(state)}`);
