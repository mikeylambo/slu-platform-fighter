import { createHash } from 'node:crypto';
import { compileFighterGrabActions } from '../../content/src/compileGrabActions.js';
import { compileFighterMoveRuntime } from '../../content/src/compileMoveRuntime.js';
import { compileFighterAttacks } from '../../content/src/compileMoves.js';
import { ALL_FIGHTER_PACKS } from '../../content/src/generated/fighterRegistry.js';
import { cpuInputsForWorld } from '../../sim/src/cpu.js';
import { assertWorldInvariants } from '../../sim/src/invariants.js';
import { createTwoFighterMatch, stepMatchWorld } from '../../sim/src/match.js';
import { serializeWorldState } from '../../sim/src/serialize.js';
import type { WorldState } from '../../sim/src/types.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`K10 soak certification failure: ${message}`);
}

function hash(state: WorldState): string {
  return createHash('sha256').update(serializeWorldState(state)).digest('hex');
}

function numberArg(name: string, fallback: number): number {
  const prefix = `--${name}=`;
  const raw = process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) throw new Error(`${name} must be positive integer`);
  return value;
}

const MATCHES = numberArg('matches', 32);
const MAX_FRAMES = numberArg('frames', 900);
const pack = ALL_FIGHTER_PACKS.find((candidate) => candidate.id === 'greybox');
assert(pack !== undefined, 'greybox pack must exist');
const attacks = compileFighterAttacks(pack);
const grabs = compileFighterGrabActions(pack);
const runtime = compileFighterMoveRuntime(pack);
const jabId = 'greybox:jab';
const participantIds = ['fighter-a', 'fighter-b'] as const;

function run(seed: number): { state: WorldState; frames: number } {
  let world = createTwoFighterMatch(seed);
  assertWorldInvariants(world);
  let frames = 0;
  while (frames < MAX_FRAMES && world.winnerId === null) {
    const byFighterId = cpuInputsForWorld(world, participantIds);
    world = stepMatchWorld(world, { frame: world.frame, byFighterId }, attacks, jabId, undefined, grabs, undefined, undefined, undefined, runtime).state;
    assertWorldInvariants(world);
    frames += 1;
  }
  return { state: world, frames };
}

let simulatedFrames = 0;
let completedMatches = 0;
const deterministicSamples: { seed: number; hash: string; frames: number }[] = [];
for (let index = 0; index < MATCHES; index += 1) {
  const seed = (0x4b_10_0000 + index * 7919) >>> 0;
  const result = run(seed);
  simulatedFrames += result.frames;
  if (result.state.winnerId !== null) completedMatches += 1;
  if (index < Math.min(8, MATCHES)) deterministicSamples.push({ seed, hash: hash(result.state), frames: result.frames });
}

for (const sample of deterministicSamples) {
  const replay = run(sample.seed);
  assert(replay.frames === sample.frames, `CPU soak replay frame count diverged for seed ${sample.seed}`);
  assert(hash(replay.state) === sample.hash, `CPU soak final state diverged for seed ${sample.seed}`);
}
assert(simulatedFrames >= MATCHES, 'soak harness must simulate at least one frame per requested match');

console.log(`K10 SOAK PASS — ${MATCHES} deterministic CPU matches / ${simulatedFrames} frames, ${completedMatches} natural match completions, ${deterministicSamples.length} repeated seeds bit-identical.`);
if (MATCHES < 1000) console.log('For production soak: npm run build && npm run soak:matches -- --matches=1000 --frames=1800');
