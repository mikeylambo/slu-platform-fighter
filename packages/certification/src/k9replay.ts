import { compileFighterGrabActions } from '../../content/src/compileGrabActions.js';
import { compileFighterMoveRuntime } from '../../content/src/compileMoveRuntime.js';
import { compileFighterAttacks } from '../../content/src/compileMoves.js';
import { ALL_FIGHTER_PACKS } from '../../content/src/generated/fighterRegistry.js';
import { createTwoFighterMatch, stepMatchWorld } from '../../sim/src/match.js';
import { ReplayPlayer, ReplayRecorder, replayWorldHash, type ReplayFrame } from '../../sim/src/replay.js';
import type { SimInputFrame, WorldState } from '../../sim/src/types.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`K9 replay certification failure: ${message}`);
}

function input(frame: number, id: 'fighter-a' | 'fighter-b'): SimInputFrame {
  const phase = id === 'fighter-a' ? 0 : 13;
  return {
    frame,
    moveX: (frame + phase) % 70 < 24 ? (id === 'fighter-a' ? 720 : -680) : 0,
    moveY: (frame + phase) % 59 === 7 ? 800 : 0,
    jumpPressed: (frame + phase) % 101 === 23,
    jumpHeld: (frame + phase) % 101 >= 23 && (frame + phase) % 101 < 27,
    attackPressed: (frame + phase) % 43 === 5,
    specialPressed: (frame + phase) % 89 === 31,
    grabPressed: (frame + phase) % 127 === 49,
    smashX: (frame + phase) % 137 === 71 ? (id === 'fighter-a' ? 1000 : -1000) : 0,
    smashY: 0,
    dodgePressed: (frame + phase) % 83 === 17,
    shieldHeld: (frame + phase) % 61 >= 42 && (frame + phase) % 61 < 47,
  };
}

const pack = ALL_FIGHTER_PACKS.find((candidate) => candidate.id === 'greybox');
assert(pack !== undefined, 'greybox pack must exist');
const attacks = compileFighterAttacks(pack);
const grabs = compileFighterGrabActions(pack);
const runtime = compileFighterMoveRuntime(pack);
const jabId = 'greybox:jab';

const step = (state: WorldState, frameInput: ReplayFrame) =>
  stepMatchWorld(state, frameInput, attacks, jabId, undefined, grabs, undefined, undefined, undefined, runtime);

let state = createTwoFighterMatch(0x4b_39_52_50);
const recorder = new ReplayRecorder(state, {
  gameVersion: 'cert-k9',
  participantIds: ['fighter-a', 'fighter-b'],
  stageId: 'greybox',
  rulesetId: 'stock-default',
}, 30);

const hashes = new Map<number, string>([[state.frame, replayWorldHash(state)]]);
const TOTAL = 240;
for (let frame = 0; frame < TOTAL; frame += 1) {
  const frameInput: ReplayFrame = {
    frame,
    byFighterId: {
      'fighter-a': input(frame, 'fighter-a'),
      'fighter-b': input(frame, 'fighter-b'),
    },
  };
  const result = step(state, frameInput);
  state = result.state;
  recorder.append(frameInput, state);
  hashes.set(state.frame, replayWorldHash(state));
}
const tape = recorder.finish();
assert(tape.metadata.formatVersion === 1 && tape.metadata.seed === 0x4b_39_52_50, 'replay metadata must lock format version and seed');
assert(tape.frames.length === TOTAL, 'replay must store one canonical input bundle per simulated frame');
assert(tape.checkpoints.length === TOTAL / 30, 'replay must store deterministic periodic checkpoints');
assert(tape.metadata.fighterDefinitionIds['fighter-a'] === 'greybox' && tape.metadata.fighterDefinitionIds['fighter-b'] === 'greybox', 'replay metadata must capture participant fighter definitions');

const player = new ReplayPlayer(tape, step);
const end = player.playToEnd();
assert(replayWorldHash(end) === replayWorldHash(state), 'full replay playback must converge bit-identically with recorded match');

for (const target of [1, 29, 30, 31, 89, 137, 179, 239, 240]) {
  const seeked = player.seek(target);
  assert(replayWorldHash(seeked) === hashes.get(target), `replay seek must match recorded state hash at frame ${target}`);
}

const corrupted = structuredClone(tape);
corrupted.initial.sha256 = '0'.repeat(64);
let rejectedCorruption = false;
try { new ReplayPlayer(corrupted, step); } catch { rejectedCorruption = true; }
assert(rejectedCorruption, 'replay player must reject corrupted checkpoint hashes');

const incompatible = structuredClone(tape) as typeof tape & { metadata: { formatVersion: number } };
incompatible.metadata.formatVersion = 999;
let rejectedVersion = false;
try { new ReplayPlayer(incompatible as typeof tape, step); } catch { rejectedVersion = true; }
assert(rejectedVersion, 'replay player must reject unsupported format versions');

console.log(`K9 REPLAY PASS — ${TOTAL} input frames recorded, ${tape.checkpoints.length} checkpoints, deterministic playback, seek, corruption and version guards certified.`);
