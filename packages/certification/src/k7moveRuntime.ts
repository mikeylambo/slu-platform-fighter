import { fixed } from '../../deterministic-math/src/fixed.js';
import { compileFighterGrabActions } from '../../content/src/compileGrabActions.js';
import { compileFighterMoveRuntime, compileMoveRuntime } from '../../content/src/compileMoveRuntime.js';
import { compileFighterAttacks } from '../../content/src/compileMoves.js';
import { ALL_FIGHTER_PACKS } from '../../content/src/generated/fighterRegistry.js';
import { createTwoFighterMatch, stepMatchWorld } from '../../sim/src/match.js';
import { applyMoveRuntimeFrame } from '../../sim/src/moveRuntime.js';
import { createFighterState } from '../../sim/src/world.js';
import type { SimInputFrame } from '../../sim/src/types.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`K7 move runtime certification failure: ${message}`);
}

function input(frame: number, overrides: Partial<Omit<SimInputFrame, 'frame'>> = {}): SimInputFrame {
  return {
    frame,
    moveX: 0,
    moveY: 0,
    jumpPressed: false,
    jumpHeld: false,
    attackPressed: false,
    specialPressed: false,
    grabPressed: false,
    smashX: 0,
    smashY: 0,
    dodgePressed: false,
    shieldHeld: false,
    ...overrides,
  };
}

const syntheticMove = {
  animationRole: 'jab_1',
  totalFrames: 12,
  timeline: [
    { frame: 0, type: 'velocity', data: { x: 500000, y: 100000 } },
    { frame: 0, type: 'impulse', data: { x: 100000, y: 200000 } },
    { frame: 0, type: 'invuln_on' },
    { frame: 2, type: 'invuln_off' },
  ],
} as const;
const synthetic = compileMoveRuntime('greybox', 'jab', syntheticMove);
assert(synthetic.velocities.length === 1 && synthetic.impulses.length === 1, 'velocity and impulse events must compile');
assert(synthetic.invulnerability.length === 1 && synthetic.invulnerability[0]?.startFrame === 0 && synthetic.invulnerability[0]?.endFrame === 1, 'invulnerability on/off must compile into inclusive frame window');

let fighter = createFighterState('test', fixed.zero, 1, 'greybox');
fighter.attack = { attackId: synthetic.id, frame: 0, hitTargets: [] };
fighter = applyMoveRuntimeFrame(fighter, new Map([[synthetic.id, synthetic]]));
assert(fighter.vx === 600000 && fighter.vy === 300000, 'velocity must apply before additive impulse on authored frame');
assert(fighter.invulnerableFrames >= 1, 'active move invulnerability must surface through authoritative fighter state');

let mirrored = createFighterState('mirror', fixed.zero, -1, 'greybox');
mirrored.attack = { attackId: synthetic.id, frame: 0, hitTargets: [] };
mirrored = applyMoveRuntimeFrame(mirrored, new Map([[synthetic.id, synthetic]]));
assert(mirrored.vx === -600000 && mirrored.vy === 300000, 'authored horizontal runtime vectors must mirror with facing while vertical vectors remain unchanged');

let threw = false;
try {
  compileMoveRuntime('bad', 'open-window', {
    totalFrames: 5,
    timeline: [{ frame: 1, type: 'invuln_on' }],
  });
} catch { threw = true; }
assert(threw, 'unterminated authored invulnerability window must fail compilation');

const pack = ALL_FIGHTER_PACKS.find((candidate) => candidate.id === 'greybox');
assert(pack !== undefined, 'greybox fighter pack must exist');
const attacks = compileFighterAttacks(pack);
const grabActions = compileFighterGrabActions(pack);
const runtime = compileFighterMoveRuntime(pack);
runtime.set(synthetic.id, synthetic);

let world = createTwoFighterMatch(0x4b_37_4d_52);
world.fighters[0]!.x = fixed.fromRatio(-3, 5);
world.fighters[1]!.x = fixed.fromRatio(3, 5);
let result = stepMatchWorld(
  world,
  {
    frame: 0,
    byFighterId: {
      'fighter-a': input(0, { attackPressed: true }),
      'fighter-b': input(0, { grabPressed: true }),
    },
  },
  attacks,
  'greybox:jab',
  undefined,
  grabActions,
  undefined,
  undefined,
  undefined,
  runtime,
);
world = result.state;
const a = world.fighters.find((entry) => entry.id === 'fighter-a')!;
assert(!result.events.some((event) => event.type === 'grab'), 'frame-zero authored invulnerability must be active before same-frame grab resolution');
assert(a.vx === 600000 && a.vy === 300000, 'unified match must execute authored velocity and impulse on attack frame zero');

result = stepMatchWorld(
  world,
  { frame: world.frame, byFighterId: { 'fighter-a': input(world.frame), 'fighter-b': input(world.frame) } },
  attacks,
  'greybox:jab',
  undefined,
  grabActions,
  undefined,
  undefined,
  undefined,
  runtime,
);
world = result.state;
assert((world.fighters.find((entry) => entry.id === 'fighter-a')?.invulnerableFrames ?? 0) >= 1, 'authored invulnerability must persist through every frame in its compiled window');

result = stepMatchWorld(
  world,
  { frame: world.frame, byFighterId: { 'fighter-a': input(world.frame), 'fighter-b': input(world.frame) } },
  attacks,
  'greybox:jab',
  undefined,
  grabActions,
  undefined,
  undefined,
  undefined,
  runtime,
);
world = result.state;
assert((world.fighters.find((entry) => entry.id === 'fighter-a')?.invulnerableFrames ?? 0) === 0, 'authored invulnerability must end exactly at invuln_off frame');

console.log('K7 MOVE RUNTIME PASS — authored velocity, impulse, facing mirroring, invulnerability windows, compile guards, and same-frame match ordering certified.');
