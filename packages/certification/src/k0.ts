import { createHash } from 'node:crypto';
import { nextRngU32 } from '../../deterministic-math/src/rng.js';
import { serializeWorldState } from '../../sim/src/serialize.js';
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
    dodgePressed: false,
    shieldHeld: false,
  };
}

function hashState(state: WorldState): string {
  return createHash('sha256').update(serializeWorldState(state)).digest('hex');
}

const RNG_GOLDEN = [0x87985aa5, 0x155b24a3, 0x4820f4c4, 0x81b3ac98, 0x703a0788] as const;
let rng = 0x12345678;
for (let i = 0; i < RNG_GOLDEN.length; i += 1) {
  rng = nextRngU32(rng);
  if (rng !== RNG_GOLDEN[i]) {
    throw new Error(`K0 RNG golden-vector failure at index ${i}: expected ${RNG_GOLDEN[i]}, got ${rng}`);
  }
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
console.log('RNG golden vector PASS — xorshift32 sequence locked.');
console.log(`Final binary state hash: ${hashState(world)}`);
