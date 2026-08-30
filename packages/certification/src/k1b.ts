import { fixed } from '../../deterministic-math/src/fixed.js';
import { canWallCling, canWallJump, K1_MOVEMENT, resolveGroundImpact } from '../../sim/src/movement.js';
import { createWorld, stepWorld } from '../../sim/src/world.js';
import type { SimInputFrame, WorldState } from '../../sim/src/types.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`K1b certification failure: ${message}`);
}

function input(world: WorldState, overrides: Partial<Omit<SimInputFrame, 'frame'>> = {}): SimInputFrame {
  return {
    frame: world.frame,
    moveX: 0,
    moveY: 0,
    jumpPressed: false,
    jumpHeld: false,
    dodgePressed: false,
    shieldHeld: false,
    ...overrides,
  };
}

function fighter(world: WorldState) {
  const value = world.fighters[0];
  if (!value) throw new Error('K1b world has no fighter');
  return value;
}

// Ground spot dodge.
let world = createWorld(2001);
world = stepWorld(world, input(world, { dodgePressed: true }));
assert(fighter(world).locomotion === 'spot-dodge', 'neutral dodge on ground must enter spot-dodge');
assert(fighter(world).invulnerableFrames > 0, 'spot dodge must grant deterministic invulnerability window');
for (let i = 0; i < K1_MOVEMENT.spotDodgeFrames; i += 1) world = stepWorld(world, input(world));
assert(fighter(world).locomotion === 'idle', 'spot dodge must terminate to idle');

// Ground roll.
world = createWorld(2002);
world = stepWorld(world, input(world, { moveX: 1000, dodgePressed: true }));
assert(fighter(world).locomotion === 'roll', 'directional ground dodge must enter roll');
assert(fighter(world).vx > fixed.zero, 'forward roll must produce deterministic horizontal movement');

// Air dodge.
world = createWorld(2003);
const aerial = fighter(world);
aerial.y = fixed.fromInt(8);
aerial.grounded = false;
aerial.groundSurfaceId = null;
aerial.locomotion = 'airborne';
aerial.vy = fixed.zero;
world = stepWorld(world, input(world, { moveX: 1000, moveY: 1000, dodgePressed: true }));
assert(fighter(world).locomotion === 'air-dodge', 'airborne dodge must enter air-dodge');
assert(fighter(world).vx > fixed.zero && fighter(world).vy > fixed.zero, 'directional air dodge must preserve input quadrant');
assert(fighter(world).invulnerableFrames > 0, 'air dodge must grant deterministic invulnerability window');

// Ledge grab from below/side while descending.
world = createWorld(2004);
const ledgeApproach = fighter(world);
ledgeApproach.x = fixed.fromRatio(-43, 10);
ledgeApproach.y = fixed.fromRatio(7, 2);
ledgeApproach.vy = fixed.fromRatio(-1, 10);
ledgeApproach.grounded = false;
ledgeApproach.groundSurfaceId = null;
ledgeApproach.locomotion = 'airborne';
world = stepWorld(world, input(world));
assert(fighter(world).locomotion === 'ledge-hang', 'descending fighter inside ledge volume must grab ledge');
assert(fighter(world).ledgeId === 'platform-center-left', 'ledge grab must identify exact ledge');
assert(fighter(world).facing === 1, 'left ledge must face fighter inward');

// Ledge drop starts a regrab lockout.
world = stepWorld(world, input(world, { moveY: -1000 }));
assert(fighter(world).locomotion === 'airborne', 'down from ledge must release into airborne state');
assert(fighter(world).ledgeId === null, 'ledge release must clear ledge ownership');
assert(fighter(world).ledgeRegrabLockoutFrames > 0, 'ledge release must start regrab lockout');

// Ledge jump launches inward/upward and also locks regrab.
world = createWorld(2005);
const ledgeJumpSetup = fighter(world);
ledgeJumpSetup.x = fixed.fromRatio(43, 10);
ledgeJumpSetup.y = fixed.fromRatio(7, 2);
ledgeJumpSetup.vy = fixed.fromRatio(-1, 10);
ledgeJumpSetup.grounded = false;
ledgeJumpSetup.groundSurfaceId = null;
ledgeJumpSetup.locomotion = 'airborne';
world = stepWorld(world, input(world));
assert(fighter(world).ledgeId === 'platform-center-right', 'right ledge must be grabbable');
world = stepWorld(world, input(world, { jumpPressed: true, jumpHeld: true }));
assert(fighter(world).locomotion === 'airborne', 'jump from ledge must release into airborne state');
assert(fighter(world).vy > fixed.zero, 'ledge jump must launch upward');
assert(fighter(world).vx < fixed.zero, 'right ledge jump must launch inward');

// Tech hook: dodge input opens a deterministic tech buffer; impact consumes it.
world = createWorld(2006);
const techSetup = fighter(world);
techSetup.y = fixed.fromInt(3);
techSetup.grounded = false;
techSetup.groundSurfaceId = null;
techSetup.locomotion = 'airborne';
world = stepWorld(world, input(world, { dodgePressed: true }));
assert(fighter(world).techBufferFrames > 0, 'dodge input must open tech buffer');
const teched = resolveGroundImpact(fighter(world), 1);
assert(teched.locomotion === 'tech-roll', 'buffered impact with direction must resolve to tech roll');
assert(teched.techBufferFrames === 0, 'tech must consume tech buffer');

const missedTech = resolveGroundImpact({ ...fighter(world), techBufferFrames: 0 }, 0);
assert(missedTech.locomotion === 'knockdown', 'impact without tech buffer must resolve to knockdown hook');

assert(canWallJump(), 'K1b default wall policy must expose wall jump as enabled');
assert(!canWallCling(), 'K1b default wall policy must expose wall cling as disabled');

console.log('K1b PASS — spot dodge, roll, air dodge, ledge grab/release/jump, regrab lockout, tech hooks, and wall policy certified.');
