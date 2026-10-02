/**
 * Utility-AI proofs (continuation brief Step 4).
 *
 *   node ai-eval.js benchmark [matches]        level 9 vs level 3, alternating slots
 *   node ai-eval.js personalities [matches]    behaviour histograms per Fracture personality
 *
 * Runs matches across worker threads. Every match is a deterministic function of its seed.
 */
import { writeFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';
import { createDuel, stepDuel, duelData } from '../game/duel.js';
import { neutral, IDS } from '../game/session.js';
import { STAGES } from '../content/stages/roster.js';
import { OATHS, type Oath } from '../content/rules/duel.js';

interface Job {
  id: number;
  cpu: [number, number];
  oaths: [Oath, Oath];
  stage: string;
  seed: number;
  /** Slot whose behaviour is recorded. */
  subject: number;
}

interface Outcome {
  id: number;
  winner: number | null;
  frames: number;
  /** Behaviour counters for the subject slot. */
  counts: Record<string, number>;
  options: Record<string, number>;
}

/** GDD 4 default match: 4 Fractures, 6:00 timer (Sudden Death restarts are bounded by shrink). */
const TIMER = 21600;
const MAX_FRAMES = 40000;

function play(job: Job): Outcome {
  let w = createDuel(
    { cpu: job.cpu, oaths: job.oaths, stage: job.stage, format: 'continuous', lives: 4, timer: TIMER },
    job.seed,
  );
  const counts: Record<string, number> = {};
  const add = (key: string, n = 1) => {
    counts[key] = (counts[key] ?? 0) + n;
  };
  const subject = IDS[job.subject]!;
  let frames = 0;
  for (; frames < MAX_FRAMES; frames++) {
    const input = { frame: w.frame, byFighterId: { [IDS[0]]: neutral(w.frame), [IDS[1]]: neutral(w.frame) } };
    const before = w.fighters[job.subject]!.attack?.attackId;
    w = stepDuel(w, input).state;
    const d = duelData(w)!;
    const me = w.fighters[job.subject]!;
    const k = d.knights[subject]!;
    if (me.attack && me.attack.attackId !== before && me.attack.frame <= 1) {
      const key = me.attack.attackId.split(':')[1]!;
      add(`attack:${me.attack.attackId}`);
      if (key.endsWith('-air')) {
        add('aerials');
        const other = w.fighters[1 - job.subject]!;
        if (Math.sign(other.x - me.x) * Math.sign(me.vx) > 0) add('approach-aerials');
      }
      if (key === 'veil' || key === 'veil-cut') add('veil-step');
      if (key.startsWith('anchor') || key.startsWith('cleave')) add('anchor-cleave');
    }
    if (k.guard > 0) add('guard-frames');
    const half = (STAGES.find((stage) => stage.id === job.stage)?.width ?? 160) / 10;
    const opponent = w.fighters[1 - job.subject]!;
    const beyond = (x: number) => Math.abs(x / 1e6) > half;
    if (!me.grounded && beyond(me.x) && beyond(opponent.x) && me.hitstunFrames === 0) add('offstage-chase');
    const closing = Math.sign(opponent.x - me.x) * Math.sign(me.vx);
    if (closing > 0 && Math.abs(me.vx) > 5e4 && me.hitstunFrames === 0) add('approach-frames');
    for (const event of d.events) {
      if (event.player !== subject) continue;
      add(`event:${event.type}`);
    }
    if (d.phase === 'over') break;
  }
  const d = duelData(w)!;
  const options = d.knights[subject]!.mind.used;
  const winner = d.winner ? IDS.indexOf(d.winner as (typeof IDS)[number]) : null;
  return { id: job.id, winner, frames, counts, options };
}

async function runAll(jobs: Job[]): Promise<Outcome[]> {
  const threads = Math.max(1, Math.min(availableParallelism(), 4));
  const chunks = Array.from({ length: threads }, (_, i) => jobs.filter((_, j) => j % threads === i));
  const file = fileURLToPath(import.meta.url);
  const results = await Promise.all(
    chunks.map(
      (chunk) =>
        new Promise<Outcome[]>((resolve, reject) => {
          const worker = new Worker(file, { workerData: chunk });
          worker.on('message', resolve);
          worker.on('error', reject);
        }),
    ),
  );
  return results.flat().sort((a, b) => a.id - b.id);
}

async function benchmark(matches: number) {
  const jobs: Job[] = Array.from({ length: matches }, (_, id) => {
    const slot9 = id % 2;
    return {
      id,
      cpu: slot9 ? [3, 9] : [9, 3],
      oaths: ['unsworn', 'unsworn'],
      stage: STAGES[id % 7]!.id,
      seed: 7000 + id,
      subject: slot9,
    };
  });
  const outcomes = await runAll(jobs);
  const wins = outcomes.filter((o) => o.winner === jobs[o.id]!.subject).length;
  const report = {
    protocol: `${matches} continuous 4-Fracture matches, 6:00 timer (GDD default), 7 competitive stages, level 9 alternating slots, Unsworn vs Unsworn`,
    level9Wins: wins,
    matches,
    winRate: wins / matches,
    pass: wins / matches >= 0.8,
    meanFrames: outcomes.reduce((sum, o) => sum + o.frames, 0) / matches,
  };
  writeFileSync('apps/spectris/proofs/ai-benchmark.json', JSON.stringify(report, null, 2) + '\n');
  console.log(
    `AI BENCHMARK level 9 won ${wins}/${matches} (${(report.winRate * 100).toFixed(0)}%) ${report.pass ? 'PASS' : 'FAIL'}`,
  );
  if (!report.pass) process.exitCode = 1;
}

/** Each personality's signature behaviour (GDD 6) and how it is measured. */
const SIGNATURES: Record<Exclude<Oath, 'unsworn'>, { label: string; keys: string[] }> = {
  ember: { label: 'aerials thrown while approaching', keys: ['approach-aerials'] },
  static: { label: 'feints + Veil Step', keys: ['event:feint', 'veil-step'] },
  stillness: { label: 'guard frames + parries', keys: ['guard-frames', 'event:parry'] },
  gale: { label: 'offstage chase frames', keys: ['offstage-chase'] },
  iron: { label: 'Anchor + Charged Cleave', keys: ['anchor-cleave'] },
  hunger: { label: 'grabs + pummels', keys: ['event:grab', 'event:pummel'] },
};

async function personalities(matches: number) {
  const only = process.argv[4]?.split(',') as Oath[] | undefined;
  const subjects: Oath[] = only ?? ['unsworn', 'ember', 'static', 'stillness', 'gale', 'iron', 'hunger'];
  const jobs: Job[] = [];
  for (const [p, oath] of subjects.entries()) {
    for (let m = 0; m < matches; m++) {
      const slot = m % 2;
      const oaths: [Oath, Oath] = slot ? ['unsworn', oath] : [oath, 'unsworn'];
      jobs.push({ id: p * matches + m, cpu: [7, 7], oaths, stage: STAGES[m % 7]!.id, seed: 9000 + m, subject: slot });
    }
  }
  const outcomes = await runAll(jobs);
  const totals = new Map<Oath, Record<string, number>>();
  const minutes = new Map<Oath, number>();
  for (const outcome of outcomes) {
    const oath = subjects[Math.floor(outcome.id / matches)]!;
    const total = totals.get(oath) ?? {};
    for (const [key, n] of Object.entries(outcome.counts)) total[key] = (total[key] ?? 0) + n;
    for (const [key, n] of Object.entries(outcome.options)) total[`option:${key}`] = (total[`option:${key}`] ?? 0) + n;
    totals.set(oath, total);
    minutes.set(oath, (minutes.get(oath) ?? 0) + outcome.frames / 3600);
  }
  const rate = (oath: Oath, keys: string[]) =>
    keys.reduce((sum, key) => sum + (totals.get(oath)![key] ?? 0), 0) / minutes.get(oath)!;
  const rows = (Object.keys(SIGNATURES) as Exclude<Oath, 'unsworn'>[])
    .filter((oath) => subjects.includes(oath))
    .map((oath) => {
      const signature = SIGNATURES[oath];
      const value = rate(oath, signature.keys);
      const baseline = rate('unsworn', signature.keys);
      const ratio = baseline > 0 ? value / baseline : Infinity;
      return {
        oath,
        signature: signature.label,
        perMinute: value,
        unswornPerMinute: baseline,
        ratio,
        pass: ratio >= 2,
      };
    });
  const histograms = Object.fromEntries(
    subjects.map((oath) => {
      const total = totals.get(oath)!;
      const options = Object.entries(total)
        .filter(([key]) => key.startsWith('option:'))
        .map(([key, n]) => [key.slice(7), n] as const)
        .sort((a, b) => b[1] - a[1]);
      const sum = options.reduce((s, [, n]) => s + n, 0);
      return [oath, Object.fromEntries(options.map(([key, n]) => [key, +(n / sum).toFixed(4)]))];
    }),
  );
  const report = {
    protocol: `${matches} matches per personality at CPU level 7 against an Unsworn level 7, alternating slots, 7 stages; rates per simulated minute`,
    signatures: rows,
    histograms,
    raw: Object.fromEntries(subjects.map((oath) => [oath, { minutes: minutes.get(oath), counts: totals.get(oath) }])),
  };
  writeFileSync('apps/spectris/proofs/ai-personalities.json', JSON.stringify(report, null, 2) + '\n');
  writeHistogramPage(report.signatures, histograms);
  for (const row of rows) {
    console.log(
      `PERSONALITY ${row.oath.padEnd(10)} ${row.signature.padEnd(26)} ${row.perMinute.toFixed(2)}/min vs Unsworn ${row.unswornPerMinute.toFixed(2)}/min = ${row.ratio.toFixed(1)}x ${row.pass ? 'PASS' : 'FAIL'}`,
    );
  }
  if (rows.some((row) => !row.pass)) process.exitCode = 1;
}

/** A self-contained HTML histogram (one bar chart per personality) for the final report. */
function writeHistogramPage(
  rows: { oath: string; signature: string; ratio: number; pass: boolean }[],
  histograms: Record<string, Record<string, number>>,
) {
  const colour = (oath: string) => `#${(OATHS[oath as Oath]?.color ?? 0x888888).toString(16).padStart(6, '0')}`;
  const charts = Object.entries(histograms)
    .map(([oath, bars]) => {
      const top = Object.entries(bars).slice(0, 12);
      const max = Math.max(...top.map(([, v]) => v));
      const row = rows.find((r) => r.oath === oath);
      const caption = row ? `${row.signature}: ${row.ratio.toFixed(1)}× Unsworn ${row.pass ? '✓' : '✗'}` : 'baseline';
      const items = top
        .map(
          ([key, value]) =>
            `<div class="bar"><span>${key}</span><i style="width:${((value / max) * 100).toFixed(1)}%;background:${colour(oath)}"></i><b>${(value * 100).toFixed(1)}%</b></div>`,
        )
        .join('');
      return `<section><h2>${OATHS[oath as Oath].name}</h2><p>${caption}</p>${items}</section>`;
    })
    .join('');
  const html = `<!doctype html><meta charset="utf-8"><title>Spectris AI personalities</title><style>body{font:13px system-ui;background:#0b1016;color:#d6e2e4;margin:24px}main{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:18px}section{background:#121a22;padding:16px;border-radius:8px}h2{margin:0;font:600 16px Georgia}p{color:#8fa6ab;margin:4px 0 12px}.bar{display:grid;grid-template-columns:120px 1fr 52px;gap:8px;align-items:center;margin:3px 0}.bar i{height:10px;border-radius:2px;display:block}.bar b{font-weight:400;text-align:right;color:#a9bcbf}</style><h1>Option usage by Fracture personality</h1><main>${charts}</main>`;
  writeFileSync('apps/spectris/proofs/ai-personalities.html', html);
}

if (!isMainThread) {
  parentPort!.postMessage((workerData as Job[]).map(play));
} else {
  const mode = process.argv[2] ?? 'benchmark';
  const matches = Number(process.argv[3] ?? (mode === 'benchmark' ? 100 : 50));
  if (mode === 'benchmark') await benchmark(matches);
  else await personalities(matches);
}
