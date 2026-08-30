import { fixed } from '../../deterministic-math/src/fixed.js';
import { compileRosterRuntime, type RuntimeFighterPack } from '../../content/src/compileRosterRuntime.js';
import { FIGHTER_ENTITY_PACKS } from '../../content/src/generated/entityRegistry.js';
import { ALL_FIGHTER_PACKS } from '../../content/src/generated/fighterRegistry.js';
import { createTwoFighterMatch, stepMatchWorld, type MatchEvent } from '../../sim/src/match.js';
import type { SimInputFrame, WorldState } from '../../sim/src/types.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`K12 mixed-roster certification failure: ${message}`);
}

type MutableMove = {
  animationRole: string;
  grabAction?: 'pummel' | 'forward-throw' | 'back-throw' | 'up-throw' | 'down-throw';
  totalFrames: number;
  timeline: Array<{ frame: number; type: string; data?: Record<string, unknown> }>;
};
type MutablePack = { id: string; moves: Record<string, MutableMove> };

function neutral(frame: number, overrides: Partial<Omit<SimInputFrame, 'frame'>> = {}): SimInputFrame {
  return {
    frame, moveX: 0, moveY: 0, jumpPressed: false, jumpHeld: false,
    attackPressed: false, specialPressed: false, grabPressed: false,
    smashX: 0, smashY: 0, dodgePressed: false, shieldHeld: false,
    ...overrides,
  };
}

const greybox = ALL_FIGHTER_PACKS.find((candidate) => candidate.id === 'greybox');
assert(greybox !== undefined, 'greybox pack must exist');
const variant = structuredClone(greybox) as unknown as MutablePack;
variant.id = 'cert-variant';
for (const move of Object.values(variant.moves)) {
  move.timeline = move.timeline.filter((event) => event.type !== 'entity_spawn' && event.type !== 'entity_command');
  if (move.grabAction !== 'forward-throw') continue;
  const release = move.timeline.find((event) => event.type === 'throw_release');
  assert(release?.data !== undefined, 'variant forward throw must retain throw_release data');
  release.data.damageTenths = 123;
  release.data.baseKnockback = 420000;
  release.data.growthPer100Percent = 510000;
  release.data.directionX = 1000;
  release.data.directionY = 100;
  release.data.hitstunFrames = 27;
}

const runtime = compileRosterRuntime(
  [greybox as unknown as RuntimeFighterPack, variant as RuntimeFighterPack],
  FIGHTER_ENTITY_PACKS,
);
assert(runtime.fighterDefinitionIds.join(',') === 'cert-variant,greybox', 'roster runtime must canonicalize fighter definition ordering');
assert(runtime.grabActions.has('greybox:forward-throw') && runtime.grabActions.has('cert-variant:forward-throw'), 'scoped grab registry must retain both fighters independent forward throws');
assert(runtime.attacks.has('greybox:jab') && runtime.attacks.has('cert-variant:jab'), 'mixed roster must compile independently scoped standard attacks');
assert(runtime.moveRuntime.has('greybox:up-special') && runtime.moveRuntime.has('cert-variant:up-special'), 'mixed roster must compile independently scoped move runtime definitions');

function step(world: WorldState, byFighterId: Record<string, SimInputFrame>) {
  return stepMatchWorld(
    world,
    { frame: world.frame, byFighterId },
    runtime.attacks,
    'greybox:jab',
    undefined,
    runtime.grabActions,
    undefined,
    runtime.entityDefinitions,
    runtime.entitySpawnsByMoveId,
    runtime.moveRuntime,
  );
}

function runForwardThrow(grabberId: 'fighter-a' | 'fighter-b', definitionId: string): { world: WorldState; event: Extract<MatchEvent, { type: 'throw' }> } {
  let world = createTwoFighterMatch(0x4b_12_0000 + (grabberId === 'fighter-a' ? 1 : 2));
  world.fighters[0]!.x = fixed.fromRatio(-3, 5);
  world.fighters[1]!.x = fixed.fromRatio(3, 5);
  const grabber = world.fighters.find((fighter) => fighter.id === grabberId)!;
  grabber.definitionId = definitionId;
  const otherId = grabberId === 'fighter-a' ? 'fighter-b' : 'fighter-a';

  let result = step(world, {
    [grabberId]: neutral(world.frame, { grabPressed: true }),
    [otherId]: neutral(world.frame),
  });
  world = result.state;
  assert(result.events.some((event) => event.type === 'grab' && event.attackerId === grabberId), `${definitionId} fighter must establish grab through universal grab system`);

  const moveX = grabberId === 'fighter-a' ? 1000 : -1000;
  result = step(world, {
    [grabberId]: neutral(world.frame, { attackPressed: true, moveX }),
    [otherId]: neutral(world.frame),
  });
  world = result.state;

  for (let i = 0; i < 40; i += 1) {
    result = step(world, { [grabberId]: neutral(world.frame), [otherId]: neutral(world.frame) });
    world = result.state;
    const throwEvent = result.events.find((event): event is Extract<MatchEvent, { type: 'throw' }> => event.type === 'throw');
    if (throwEvent) return { world, event: throwEvent };
  }
  throw new Error(`${definitionId} forward throw did not release within certification window`);
}

const greyResult = runForwardThrow('fighter-a', 'greybox');
assert(greyResult.event.actionId === 'greybox:forward-throw', 'Greybox captor must resolve Greybox-authored forward throw');
assert(greyResult.event.damageTenths === 55, 'Greybox forward throw must retain its own authored damage');

const variantResult = runForwardThrow('fighter-b', 'cert-variant');
assert(variantResult.event.actionId === 'cert-variant:forward-throw', 'variant captor must resolve variant-authored forward throw');
assert(variantResult.event.damageTenths === 123 && variantResult.event.hitstunFrames === 27, 'variant forward throw must use its own authored damage/hitstun rather than Greybox values');
assert(fixed.abs(variantResult.event.knockbackX) > fixed.abs(greyResult.event.knockbackX), 'mechanically divergent fighter throw launch must remain independently authored in the shared match');

console.log('K12 MIXED ROSTER PASS — two fighter definitions share one match runtime while resolving independent attacks, move timelines and scoped throw data.');
