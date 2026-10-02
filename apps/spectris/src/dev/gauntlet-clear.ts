/**
 * Gauntlet proof: a level-9 CPU plays the player's slot through all seven Fracture fights
 * on Squire, retrying a fight it loses (as a player would). Each attempt is recorded as a
 * deterministic replay and verified by playing it back.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { ReplayPlayer, ReplayRecorder } from '../../../../packages/sim/src/replay.js';
import { hashWorldState } from '../../../../packages/sim/src/stateHash.js';
import { createDuel, DEFAULT_DUEL, duelData, stepDuel } from '../game/duel.js';
import { IDS, neutral } from '../game/session.js';
import { GAUNTLET_ORDER, gauntletFight } from '../content/gauntlet.js';
import { REPLAY_VERSION } from '../content/version.js';

const BOT_LEVEL = 9;
const MAX_ATTEMPTS = 5;
const MAX_FRAMES = 80000;
const DIR = 'apps/spectris/proofs/gauntlet';
mkdirSync(DIR, { recursive: true });

interface Attempt {
  oath: string;
  attempt: number;
  stage: string;
  cpuLevel: number;
  won: boolean;
  rounds: [number, number];
  frames: number;
  replay: string;
  replayVerified: boolean;
}
const results: Attempt[] = [];
for (const oath of GAUNTLET_ORDER) {
  const fight = gauntletFight(oath, 'Squire');
  let cleared = false;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS && !cleared; attempt++) {
    const options = {
      ...DEFAULT_DUEL,
      stage: fight.stage,
      cpu: [BOT_LEVEL, fight.level] as [number, number],
      oaths: fight.oaths,
    };
    const initial = createDuel(options, 0x6a0000 + GAUNTLET_ORDER.indexOf(oath) * 97 + attempt);
    const recorder = new ReplayRecorder(
      initial,
      { gameVersion: REPLAY_VERSION, participantIds: IDS, stageId: fight.stage, rulesetId: `gauntlet-squire-${oath}` },
      600,
    );
    let w = initial;
    let frames = 0;
    for (; frames < MAX_FRAMES; frames++) {
      const input = { frame: w.frame, byFighterId: { [IDS[0]]: neutral(w.frame), [IDS[1]]: neutral(w.frame) } };
      w = stepDuel(w, input).state;
      recorder.append(input, w);
      if (duelData(w)!.phase === 'over') break;
    }
    const d = duelData(w)!;
    const tape = recorder.finish();
    const replayed = new ReplayPlayer(JSON.parse(JSON.stringify(tape)), stepDuel).playToEnd();
    const verified = hashWorldState(replayed) === hashWorldState(w);
    cleared = d.winner === IDS[0];
    const file = `${DIR}/${oath}-attempt-${attempt}.json`;
    writeFileSync(file, JSON.stringify(tape));
    results.push({
      oath,
      attempt,
      stage: fight.stage,
      cpuLevel: fight.level,
      won: cleared,
      rounds: d.wins,
      frames,
      replay: file,
      replayVerified: verified,
    });
    console.log(
      `GAUNTLET ${oath.padEnd(9)} attempt ${attempt}: ${cleared ? 'CLEARED' : 'lost'} ${d.wins.join('-')} in ${frames} frames; replay ${verified ? 'verified' : 'MISMATCH'}`,
    );
  }
}
const clearedAll = GAUNTLET_ORDER.every((oath) => results.some((r) => r.oath === oath && r.won));
const summary = {
  difficulty: 'Squire',
  bot: `CPU level ${BOT_LEVEL} (Unsworn) in the player slot`,
  clearedAll,
  attempts: results.length,
  results,
};
writeFileSync(`${DIR}/summary.json`, JSON.stringify(summary, null, 2) + '\n');
console.log(`GAUNTLET ${clearedAll ? 'CLEARED' : 'NOT CLEARED'} in ${results.length} attempts`);
if (!clearedAll || results.some((r) => !r.replayVerified)) process.exitCode = 1;
