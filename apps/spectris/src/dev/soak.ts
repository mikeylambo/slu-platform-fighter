import { writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { createDuel, stepDuel, duelData } from '../game/duel.js';
import { neutral, IDS } from '../game/session.js';
import { STAGES } from '../content/stages/roster.js';
import { OATHS, type Oath } from '../content/rules/duel.js';
import { hashWorldState } from '../../../../packages/sim/src/stateHash.js';
const count = Number(process.argv[2] ?? 1000),
  offset = Number(process.argv[3] ?? 0),
  oaths = Object.keys(OATHS) as Oath[];
let completed = 0,
  unfinished = 0,
  wins9 = 0,
  frames = 0;
const began = performance.now();
for (let match = offset; match < offset + count; match++) {
  const benchmark = match < 100;
  const slot9 = match % 2;
  const cpu: [number, number] = benchmark ? (slot9 ? [3, 9] : [9, 3]) : [1 + (match % 9), 1 + ((match * 7) % 9)];
  const options = {
    cpu,
    format: 'continuous' as const,
    lives: 4,
    timer: 3600,
    stage: STAGES[match % 7]!.id,
    oaths: benchmark
      ? (['unsworn', 'unsworn'] as [Oath, Oath])
      : ([oaths[match % 7]!, oaths[(match * 3 + 1) % 7]!] as [Oath, Oath]),
  };
  let w = createDuel(options, 100 + match),
    b = createDuel(options, 100 + match);
  for (let frame = 0; frame < 21000; frame++) {
    const input = { frame: w.frame, byFighterId: { [IDS[0]]: neutral(w.frame), [IDS[1]]: neutral(w.frame) } };
    w = stepDuel(w, input).state;
    if (match % 100 === 0) {
      b = stepDuel(b, input).state;
      if (frame % 120 === 0 && hashWorldState(w) !== hashWorldState(b))
        throw Error(`Desync match ${match} frame ${frame}`);
    }
    frames++;
    const d = duelData(w)!;
    if (d.phase === 'over') {
      completed++;
      if (benchmark && d.winner === IDS[slot9]) wins9++;
      break;
    }
    if (frame === 20999) {
      unfinished++;
      console.log(`WATCHDOG match=${match} round=${d.round} sudden=${d.sudden} suddenFrames=${d.suddenFrames}`);
    }
  }
  if ((match + 1) % 10 === 0)
    console.log(
      `SOAK ${match + 1}/${count} complete=${completed} timeout=${unfinished} level9wins=${wins9}/${Math.min(match + 1, 100)}`,
    );
}
const result = {
  matches: count,
  offset,
  completed,
  unfinished,
  level9WinsFirst100: wins9,
  frames,
  elapsedSeconds: (performance.now() - began) / 1000,
  protocol:
    'Four-Fracture continuous matches, 60-second timer, seven competitive stages, alternating level9 benchmark slots, Oaths thereafter. Duplicate deterministic simulations on each 100th match.',
};
writeFileSync(`apps/spectris/proofs/duel-soak-${offset}.json`, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result));
if (unfinished) process.exitCode = 1;
