/**
 * Momentum proof: a complete CPU-vs-CPU Pilgrimage match, recorded as a deterministic replay
 * and verified by playing it back. Logs right-of-way changes, screen scrolls and the goal.
 */
import { writeFileSync } from 'node:fs';
import { ReplayPlayer, ReplayRecorder } from '../../../../packages/sim/src/replay.js';
import { hashWorldState } from '../../../../packages/sim/src/stateHash.js';
import { createDuel, DEFAULT_DUEL, duelData, stepDuel } from '../game/duel.js';
import { IDS, neutral } from '../game/session.js';
import { REPLAY_VERSION } from '../content/version.js';

const options = {
  ...DEFAULT_DUEL,
  format: 'momentum' as const,
  stage: 'pilgrimage',
  timer: 0,
  cpu: [7, 7] as [number, number],
};
const initial = createDuel(options, 0x9117);
const recorder = new ReplayRecorder(
  initial,
  { gameVersion: REPLAY_VERSION, participantIds: IDS, stageId: 'pilgrimage', rulesetId: 'momentum' },
  600,
);
const timeline: { frame: number; event: string; player: string; progress: number }[] = [];
let w = initial;
for (let frame = 0; frame < 60000; frame++) {
  const input = { frame: w.frame, byFighterId: { [IDS[0]]: neutral(w.frame), [IDS[1]]: neutral(w.frame) } };
  w = stepDuel(w, input).state;
  recorder.append(input, w);
  const d = duelData(w)!;
  for (const event of d.events) {
    if (event.type.startsWith('pilgrimage') || event.type === 'fracture') {
      timeline.push({ frame: w.frame, event: event.type, player: event.player, progress: d.progress });
    }
  }
  if (d.phase === 'over') break;
}
const d = duelData(w)!;
const tape = recorder.finish();
writeFileSync('apps/spectris/proofs/momentum-replay.json', JSON.stringify(tape));
const replayed = new ReplayPlayer(JSON.parse(JSON.stringify(tape)), stepDuel).playToEnd();
const report = {
  finished: d.phase === 'over',
  winner: d.winner,
  frames: w.frame,
  finalScreen: d.progress,
  replay: 'apps/spectris/proofs/momentum-replay.json',
  replayVerified: hashWorldState(replayed) === hashWorldState(w),
  timeline,
};
writeFileSync('apps/spectris/proofs/momentum-match.json', JSON.stringify(report, null, 2) + '\n');
console.log(
  `MOMENTUM ${report.finished ? 'FINISHED' : 'UNFINISHED'} winner=${report.winner} frames=${report.frames} screen=${report.finalScreen} events=${timeline.length} replay ${report.replayVerified ? 'verified' : 'MISMATCH'}`,
);
if (!report.finished || !report.replayVerified) process.exitCode = 1;
