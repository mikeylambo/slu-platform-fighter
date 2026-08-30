import { fixed } from '../../deterministic-math/src/fixed.js';
import type { CompiledStageDefinition } from '../../content/src/compileStage.js';
import { movingPlatformPointAt, movingPlatformSurfaceAt, stageHazardActivityAt, stageSurfacesAt, withStageMotion } from '../../sim/src/stageRuntime.js';
import { createTwoFighterMatch } from '../../sim/src/match.js';
import type { MatchInputFrame, MatchStepResult } from '../../sim/src/match.js';
import type { SimInputFrame, WorldState } from '../../sim/src/types.js';
function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(`K27 stage runtime certification failure: ${message}`); }
function neutral(frame: number): SimInputFrame { return { frame, moveX: 0, moveY: 0, jumpPressed: false, jumpHeld: false, attackPressed: false, specialPressed: false, grabPressed: false, smashX: 0, smashY: 0, dodgePressed: false, shieldHeld: false }; }
const stage: CompiledStageDefinition = {
  id: 'stage-runtime-cert', displayName: 'Stage Runtime Cert', surfaces: [{ id: 'ground', kind: 'solid', y: fixed.zero, xMin: fixed.fromInt(-10), xMax: fixed.fromInt(10) }], walls: [], ledges: [], spawns: [],
  stockRules: { blastLeft: fixed.fromInt(-30), blastRight: fixed.fromInt(30), blastBottom: fixed.fromInt(-20), blastTop: fixed.fromInt(20), respawnXSpacing: fixed.fromInt(2), respawnY: fixed.fromInt(10), respawnFrames: 60, respawnInvulnerableFrames: 120 },
  camera: { left: fixed.fromInt(-20), right: fixed.fromInt(20), bottom: fixed.fromInt(-10), top: fixed.fromInt(15), padding: fixed.fromInt(2), minZoom: fixed.one, maxZoom: fixed.fromInt(2) },
  movingPlatforms: [{ id: 'shuttle', kind: 'one-way', width: fixed.fromInt(4), path: [{ x: fixed.fromInt(-6), y: fixed.fromInt(5) }, { x: fixed.fromInt(6), y: fixed.fromInt(5) }], periodFrames: 120, phaseFrames: 0 }],
  hazards: [{ id: 'pulse', kind: 'damage', x: fixed.zero, y: fixed.zero, radius: fixed.fromInt(2), activeFrames: 3, inactiveFrames: 2, phaseFrames: 1 }],
};
const platform = stage.movingPlatforms[0]!; const p0 = movingPlatformPointAt(platform, 0); const p30 = movingPlatformPointAt(platform, 30); const p60 = movingPlatformPointAt(platform, 60); const p90 = movingPlatformPointAt(platform, 90); const p120 = movingPlatformPointAt(platform, 120);
assert(p0.x === fixed.fromInt(-6), 'shuttle must begin at first authored point'); assert(p30.x === fixed.zero, 'quarter-period must interpolate halfway to second point'); assert(p60.x === fixed.fromInt(6), 'half-period must reach second authored point'); assert(p90.x === fixed.zero && p120.x === p0.x, 'second half must reverse continuously and return to start');
const surface = movingPlatformSurfaceAt(platform, 0); assert(surface.xMin === fixed.fromInt(-8) && surface.xMax === fixed.fromInt(-4) && surface.y === fixed.fromInt(5), 'moving platform width must become deterministic collision surface'); assert(stageSurfacesAt(stage, 0).some((entry) => entry.id === 'moving:shuttle'), 'dynamic surface must join static stage surfaces');
const hazardPattern = [0, 1, 2, 3, 4].map((frame) => stageHazardActivityAt(stage, frame)[0]!.active); assert(hazardPattern.join(',') === 'true,true,false,false,true', `hazard cadence/phase must be deterministic, got ${hazardPattern.join(',')}`);
const inner = (state: WorldState, input: MatchInputFrame): MatchStepResult => ({ state: { ...state, frame: state.frame + 1 }, events: [] }); const step = withStageMotion(inner, stage); let world = createTwoFighterMatch(0x4b_27_0001);
world = { ...world, surfaces: stageSurfacesAt(stage, 0), fighters: world.fighters.map((fighter, index) => index === 0 ? { ...fighter, x: fixed.fromInt(-6), y: fixed.fromInt(5), grounded: true, groundSurfaceId: 'moving:shuttle' } : fighter) };
const startX = world.fighters[0]!.x; for (let frame = 0; frame < 10; frame += 1) { const result = step(world, { frame, byFighterId: { 'fighter-a': neutral(frame), 'fighter-b': neutral(frame) } }); world = result.state; }
assert(world.fighters[0]!.x > startX && world.fighters[0]!.y === fixed.fromInt(5), 'grounded rider must inherit deterministic moving-platform delta'); assert(world.surfaces.some((entry) => entry.id === 'moving:shuttle'), 'world surfaces must advance with stage frame');
console.log('K27 STAGE RUNTIME PASS — authored moving platforms ping-pong deterministically, expose collision surfaces, carry grounded riders, and hazards expose frame/phase activity without invented effect values.');
