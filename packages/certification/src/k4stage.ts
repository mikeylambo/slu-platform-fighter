import { fixed } from '../../deterministic-math/src/fixed.js';
import { compileStage } from '../../content/src/compileStage.js';
import { ALL_STAGE_PACKS } from '../../content/src/generated/stageRegistry.js';
import { isHazardActive, sampleMovingPlatform } from '../../sim/src/stage.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`K4 stage certification failure: ${message}`);
}

const pack = ALL_STAGE_PACKS.find((candidate) => candidate.id === 'greybox');
assert(pack !== undefined, 'generated registry must expose draft greybox stage to certification tooling');
const stage = compileStage(pack);
assert(stage.surfaces.length === 2, 'greybox static surfaces must compile from stage pack');
assert(stage.ledges.length === 4, 'greybox ledges must compile from stage pack');
assert(stage.spawns.length === 4, 'greybox must expose four deterministic player spawns');
assert(stage.stockRules.blastLeft === fixed.fromInt(-25) && stage.stockRules.blastRight === fixed.fromInt(25), 'blast zones must compile into stock lifecycle rules');
assert(stage.camera.left === fixed.fromInt(-18) && stage.camera.right === fixed.fromInt(18), 'camera bounds must compile from stage pack');

const shuttle = stage.movingPlatforms.find((candidate) => candidate.id === 'platform-shuttle');
assert(shuttle !== undefined, 'greybox moving platform must compile');
const frame0 = sampleMovingPlatform(shuttle, 0);
const frame60 = sampleMovingPlatform(shuttle, 60);
const frame120 = sampleMovingPlatform(shuttle, 120);
const frame180 = sampleMovingPlatform(shuttle, 180);
const frame240 = sampleMovingPlatform(shuttle, 240);
assert(frame0.centerX === fixed.fromInt(-7), 'moving platform must begin at authored first point');
assert(frame60.centerX === fixed.zero, 'moving platform must interpolate deterministically toward second point');
assert(frame120.centerX === fixed.fromInt(7), 'moving platform must reach authored second point at half-period');
assert(frame180.centerX === fixed.zero, 'moving platform must interpolate deterministically back toward first point');
assert(frame240.centerX === frame0.centerX, 'moving platform motion must loop exactly at period boundary');
assert(frame0.surface.xMax - frame0.surface.xMin === shuttle.width, 'sampled moving platform surface must preserve authored width');

const syntheticHazard = {
  id: 'pulse', kind: 'damage' as const,
  x: fixed.zero, y: fixed.zero, radius: fixed.fromInt(1),
  activeFrames: 10, inactiveFrames: 20, phaseFrames: 0,
};
assert(isHazardActive(syntheticHazard, 0) && isHazardActive(syntheticHazard, 9), 'hazard must be active throughout authored active window');
assert(!isHazardActive(syntheticHazard, 10) && !isHazardActive(syntheticHazard, 29), 'hazard must be inactive throughout authored inactive window');
assert(isHazardActive(syntheticHazard, 30), 'hazard cadence must loop exactly');

console.log('K4 STAGE PASS — stage pack compilation, spawns, blast/camera metadata, moving platform motion, and hazard cadence certified.');
