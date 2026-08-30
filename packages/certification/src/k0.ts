import { createHash } from 'node:crypto';
import { createWorld, restoreWorld, snapshotWorld, stepWorld } from '../../sim/src/world.js';
import type { SimInputFrame, WorldState } from '../../sim/src/types.js';

function inputForFrame(frame: number): SimInputFrame {
  const jumping = frame >= 60 && frame <= 64;
  return {
    frame,
    moveX: frame < 60 || (frame >= 65 && frame < 100) ? 1000 : 0,
    moveY: 0,
    jumpPressed: frame === 60,
    jumpHeld: jumping,
  };
}

function canonicalState(state: WorldState): string {
  // Authoritative state is intentionally composed only of primitives, arrays,
  // and plain objects with stable construction order. Binary serialization will
  // replace this JSON harness before cross-engine golden vectors are frozen.
  return JSON.stringify(state);
}

function hashState(state: WorldState): string {
  return createHash('sha256').update(canonicalState(state)).digest('hex');
}

const TOTAL_FRAMES = 100_000;
const SNAPSHOT_FRAME = 40_000;

let world = createWorld(12345);
const firstPassHashes: string[] = [];
let checkpoint = snapshotWorld(world);

for (let frame = 0; frame < TOTAL_FRAMES; frame += 1) {
  if (frame === SNAPSHOT_FRAME) checkpoint = snapshotWorld(world);
  world = stepWorld(world, inputForFrame(frame));
  firstPassHashes.push(hashState(world));
}

let replay = restoreWorld(checkpoint);

for (let frame = SNAPSHOT_FRAME; frame < TOTAL_FRAMES; frame += 1) {
  replay = stepWorld(replay, inputForFrame(frame));
  const expected = firstPassHashes[frame];
  const actual = hashState(replay);
  if (actual !== expected) {
    throw new Error(`K0 determinism failure at frame ${frame + 1}: expected ${expected}, got ${actual}`);
  }
}

console.log(`K0 PASS — ${TOTAL_FRAMES.toLocaleString()} deterministic frames; restore/resim identical from frame ${SNAPSHOT_FRAME.toLocaleString()}.`);
console.log(`Final state hash: ${hashState(world)}`);
