import { fixed } from '../../deterministic-math/src/fixed.js';
import { K1_MOVEMENT } from '../../sim/src/movement.js';
import { createWorld, stepWorld } from '../../sim/src/world.js';
import type { SimInputFrame, WorldState } from '../../sim/src/types.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`K1 certification failure: ${message}`);
}

function input(world: WorldState, overrides: Partial<Omit<SimInputFrame, 'frame'>> = {}): SimInputFrame {
  return {
    frame: world.frame,
    moveX: 0,
    moveY: 0,
    jumpPressed: false,
    jumpHeld: false,
    attackPressed: false,
    dodgePressed: false,
    shieldHeld: false,
    ...overrides,
  };
}

function fighter(world: WorldState) {
  const value = world.fighters[0];
  if (!value) throw new Error('K1 world has no fighter');
  return value;
}

let world = createWorld(1001);
for (let i = 0; i < 40; i += 1) world = stepWorld(world, input(world, { moveX: 1000 }));
assert(fighter(world).locomotion === 'run', 'sustained full stick must transition dash -> run');
assert(fighter(world).inputHistory.length === K1_MOVEMENT.inputHistoryFrames, 'input history must remain bounded');
world = stepWorld(world, input(world, { moveX: -1000 }));
assert(fighter(world).locomotion === 'turn', 'run reversal must enter turn state');
assert(fighter(world).facing === -1, 'run reversal must update facing deterministically');

world = createWorld(1002);
world = stepWorld(world, input(world, { jumpPressed: true, jumpHeld: true }));
assert(fighter(world).locomotion === 'jump-squat', 'ground jump must enter jumpsquat');
for (let i = 0; i < K1_MOVEMENT.jumpSquatFrames; i += 1) world = stepWorld(world, input(world, { jumpHeld: true }));
assert(!fighter(world).grounded && fighter(world).locomotion === 'airborne', 'jumpsquat must terminate in airborne state');
assert(fighter(world).vy > fixed.zero, 'full hop must launch upward');
world = stepWorld(world, input(world, { jumpPressed: true, jumpHeld: true }));
assert(fighter(world).jumpsRemaining === 0, 'double jump must consume aerial jump resource');
assert(fighter(world).vy > fixed.zero, 'double jump must restore upward velocity');

world = createWorld(1003);
const falling = fighter(world);
falling.x = fixed.zero;
falling.y = fixed.fromInt(10);
falling.vy = fixed.fromRatio(-1, 10);
falling.grounded = false;
falling.groundSurfaceId = null;
falling.locomotion = 'airborne';
falling.inputHistory = [{ frame: -1, moveX: 0, moveY: 0, jumpPressed: false, jumpHeld: false, attackPressed: false, dodgePressed: false, shieldHeld: false }];
world = stepWorld(world, input(world, { moveY: -1000 }));
assert(fighter(world).fastFalling, 'descending down-flick must activate fastfall');
assert(fighter(world).vy === fixed.mul(fixed.fromInt(-1), K1_MOVEMENT.fastFallSpeed), 'fastfall must use configured terminal speed');

world = createWorld(1004);
const platformLanding = fighter(world);
platformLanding.x = fixed.zero;
platformLanding.y = fixed.fromRatio(41, 10);
platformLanding.vy = fixed.fromRatio(-1, 5);
platformLanding.grounded = false;
platformLanding.groundSurfaceId = null;
platformLanding.locomotion = 'airborne';
world = stepWorld(world, input(world));
assert(fighter(world).grounded, 'fighter must land on one-way platform from above');
assert(fighter(world).groundSurfaceId === 'platform-center', 'landing must identify the contacted platform');
assert(fighter(world).y === fixed.fromInt(4), 'one-way landing must snap to platform height');
world = stepWorld(world, input(world, { moveY: -1000 }));
assert(!fighter(world).grounded, 'down input on one-way platform must drop through');
assert(fighter(world).dropThroughFrames > 0, 'platform drop must create one-way ignore window');
assert(fighter(world).y < fixed.fromInt(4), 'platform drop must move fighter below the contacted plane');

world = createWorld(1005);
const buffered = fighter(world);
buffered.x = fixed.fromInt(8);
buffered.y = fixed.fromRatio(1, 10);
buffered.vy = fixed.fromRatio(-1, 5);
buffered.grounded = false;
buffered.groundSurfaceId = null;
buffered.locomotion = 'airborne';
buffered.jumpsRemaining = 0;
world = stepWorld(world, input(world, { jumpPressed: true, jumpHeld: true }));
assert(fighter(world).grounded, 'buffer test must land on ground');
assert(fighter(world).jumpBufferFrames > 0, 'jump press before landing must survive in buffer');
world = stepWorld(world, input(world, { jumpHeld: true }));
assert(fighter(world).locomotion === 'jump-squat', 'buffered landing jump must enter jumpsquat on next frame');

console.log('K1 PASS — dash/run/turn, jumpsquat, hops, double jump, air state, fastfall, one-way platforms, and jump buffering certified.');
