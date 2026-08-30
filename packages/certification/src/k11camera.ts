import { fixed } from '../../deterministic-math/src/fixed.js';
import { directCamera } from '../../presentation/src/camera.js';
import { createFighterState, createWorld } from '../../sim/src/world.js';
import type { StageCameraDefinition } from '../../content/src/compileStage.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`K11 camera certification failure: ${message}`);
}

const camera: StageCameraDefinition = {
  left: fixed.fromInt(-18), right: fixed.fromInt(18), bottom: fixed.fromInt(-6), top: fixed.fromInt(14),
  padding: fixed.fromRatio(9, 5), minZoom: fixed.fromRatio(3, 5), maxZoom: fixed.fromRatio(9, 5),
};

let world = createWorld(0x4b_11_43_41);
world.fighters = [createFighterState('p1', fixed.zero, 1)];
let target = directCamera(world, camera);
assert(target.trackedFighterIds.length === 1 && target.trackedFighterIds[0] === 'p1', 'single active fighter must be tracked');
assert(target.zoom > camera.minZoom && target.zoom <= camera.maxZoom, 'single fighter framing must stay inside authored zoom limits');
assert(target.frameLeft >= camera.left && target.frameRight <= camera.right && target.frameBottom >= camera.bottom && target.frameTop <= camera.top, 'single fighter frame must remain inside authored camera bounds');

world.fighters = [
  createFighterState('p1', fixed.fromInt(-10), 1),
  createFighterState('p2', fixed.fromInt(10), -1),
];
const twoWide = directCamera(world, camera);
assert(twoWide.trackedFighterIds.join(',') === 'p1,p2', 'camera participant ordering must be canonical by fighter id');
assert(twoWide.zoom < target.zoom, 'camera must zoom out as active fighter spread grows');
assert(twoWide.centerX === fixed.zero, 'symmetric fighters must center camera symmetrically');

world.fighters = [
  createFighterState('p4', fixed.fromInt(15), -1),
  createFighterState('p2', fixed.fromInt(-15), 1),
  { ...createFighterState('p3', fixed.fromInt(3), -1), y: fixed.fromInt(10) },
  { ...createFighterState('p1', fixed.fromInt(-3), 1), y: fixed.fromInt(-4) },
];
const four = directCamera(world, camera);
assert(four.trackedFighterIds.join(',') === 'p1,p2,p3,p4', 'four-player camera must track all active fighters in stable order');
assert(four.zoom >= camera.minZoom && four.zoom <= camera.maxZoom, 'four-player framing must clamp zoom to stage metadata');
assert(four.frameLeft >= camera.left && four.frameRight <= camera.right && four.frameBottom >= camera.bottom && four.frameTop <= camera.top, 'four-player frame must clamp inside stage camera bounds');

world.fighters[0]!.eliminated = true;
world.fighters[1]!.respawnFrames = 20;
const filtered = directCamera(world, camera);
assert(!filtered.trackedFighterIds.includes('p4') && !filtered.trackedFighterIds.includes('p2'), 'eliminated and respawning fighters must not distort live gameplay framing');

world.fighters = world.fighters.map((fighter) => ({ ...fighter, eliminated: true, stocks: 0 }));
const empty = directCamera(world, camera);
assert(empty.trackedFighterIds.length === 0 && empty.zoom === camera.minZoom, 'no active fighters must return neutral stage-wide camera target');
assert(empty.centerX === fixed.zero && empty.centerY === fixed.fromInt(4), 'neutral camera target must use authored bounds midpoint');

console.log('K11 CAMERA PASS — 1P/2P/4P framing, stable participant ordering, bounds, zoom, respawn filtering and neutral view certified.');
