// Brawl reference comparison and role-budget certification (GDD 3.8, 15).
//
// Mapping (GDD 3.8 mapping note): Brawl Meta Knight has no 3-hit jab. Jab 1 and the
// Rapid Jab compare to his rapid-jab row (first hit frame 7); the Rapid Jab finisher
// compares to his jab finisher (frame 30). Jab 2 and Jab 3 have no counterpart and
// are certified against role budgets only. Every normal must sit inside its budget.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { MOVES } from '../dist/apps/spectris/src/content/knight/moves/index.js';
import { PHYSICS } from '../dist/apps/spectris/src/content/knight/physics.js';
import {
  AERIAL_BUDGETS,
  GROUND_BUDGETS,
  RAPID_FINISHER_BUDGET,
} from '../dist/apps/spectris/src/content/knight/role-budgets.js';

const REFERENCE = 'reference/brawl-mk.json';
const NORMALS = new Set([
  ...Object.keys(GROUND_BUDGETS),
  'neutral-air',
  'forward-air',
  'back-air',
  'up-air',
  'down-air',
]);
const SOURCE_FOR = {
  jab: 'Jab',
  'rapid-jab': 'Jab',
  'forward-tilt': 'Forward tilt 1',
  'up-tilt': 'Up tilt',
  'down-tilt': 'Down tilt',
  'dash-attack': 'Dash attack',
  'forward-smash': 'Forward Smash',
  'up-smash': 'Up Smash',
  'down-smash': 'Down Smash',
  'neutral-air': 'Neutral air',
  'forward-air': 'Forward air',
  'back-air': 'Back air',
  'up-air': 'Messed Up air',
  'down-air': 'Down air',
};
const BUDGET_ONLY = new Set(['jab-2', 'jab-3']);
const DIFFERENT_STRUCTURE = new Set(['rapid-jab', 'forward-tilt', 'neutral-air', 'back-air']);

if (!existsSync(REFERENCE)) {
  console.error('REFERENCE MISSING: import the independently supplied source first.');
  process.exit(2);
}
const reference = JSON.parse(readFileSync(REFERENCE, 'utf8'));
if (reference.schemaVersion !== 2 || !reference.source?.sha256 || !reference.moves) {
  throw Error('Expected imported reference schema 2');
}
const checksum = createHash('sha256').update(readFileSync(reference.source.csv)).digest('hex');
if (checksum !== reference.source.sha256) {
  throw Error('Raw source changed: rerun the reference importer and review differences.');
}

const integer = (value) => (/^\d+$/.test(value ?? '') ? Number(value) : null);

function sourceTiming(name) {
  const source = reference.moves[name];
  if (!source) throw Error(`Missing source row ${name}`);
  const row = source.rows[0];
  const startup = Number(row.active.match(/^\d+/)?.[0]);
  if (!Number.isFinite(startup)) throw Error(`Unparseable startup for ${name}`);
  return {
    sourceRow: source.sourceRow,
    timing: { startup, faf: integer(row.faf), landing: integer(row.landing) },
    footnote: row.faf.includes('*'),
  };
}

const within = (value, range) => !range || (value >= range[0] && value <= range[1]);

function checkBudget(id, timing, budget) {
  const ok =
    within(timing.startup, budget.startup) && within(timing.faf, budget.faf) && within(timing.landing, budget.landing);
  if (!ok)
    throw Error(`${id} outside its ${budget.role} budget: ${JSON.stringify(timing)} vs ${JSON.stringify(budget)}`);
  return budget.role;
}

const comparisons = [];
for (const [id, move] of MOVES) {
  const [stance, key] = id.split(':');
  if (!NORMALS.has(key)) continue;
  const timing = { startup: move.strikes[0].start, faf: move.faf, landing: move.landing };
  const budget = GROUND_BUDGETS[key] ?? AERIAL_BUDGETS[stance];
  const role = checkBudget(
    id,
    key in GROUND_BUDGETS ? { ...timing, landing: undefined } : { ...timing, faf: undefined },
    budget,
  );
  const entry = { id, role, spectrisTiming: timing, budget };
  if (BUDGET_ONLY.has(key)) {
    comparisons.push({
      ...entry,
      sourceName: null,
      comparison: 'Role budget only: no Brawl counterpart (Brawl MK has no 3-hit jab)',
    });
    continue;
  }
  const source = sourceTiming(SOURCE_FOR[key]);
  const delta = Object.fromEntries(
    Object.entries(timing).map(([field, value]) => [
      field,
      source.timing[field] === null ? null : value - source.timing[field],
    ]),
  );
  comparisons.push({
    ...entry,
    sourceName: SOURCE_FOR[key],
    sourceRow: source.sourceRow,
    sourceTiming: source.timing,
    delta,
    comparison:
      DIFFERENT_STRUCTURE.has(key) || (stance === 'cape' && move.landing > 0)
        ? 'Role comparison: different strike structure or stance kit'
        : 'Timing comparison; not a claim of equal range or knockback',
    notes: source.footnote ? 'Source FAF has a footnote; treat the numeric delta with care.' : null,
  });
  if (key === 'rapid-jab') {
    const finisher = move.strikes.at(-1);
    const finisherTiming = { startup: finisher.start, faf: null, landing: 0 };
    const finisherSource = sourceTiming('Jab (final hit)');
    comparisons.push({
      id: `${id} (finisher)`,
      role: checkBudget(`${id} finisher`, { startup: finisher.start }, RAPID_FINISHER_BUDGET),
      spectrisTiming: finisherTiming,
      budget: RAPID_FINISHER_BUDGET,
      sourceName: 'Jab (final hit)',
      sourceRow: finisherSource.sourceRow,
      sourceTiming: finisherSource.timing,
      delta: { startup: finisher.start - finisherSource.timing.startup, faf: null, landing: null },
      comparison: 'Finisher timing: our rapid jab ends on its fourth strike; Brawl loops until the finisher input',
      notes: null,
    });
  }
}

const attribute = (name) => Number.parseFloat(reference.attributes[name].value);
const movement = [
  ['run', 'Dash', PHYSICS.run],
  ['walk', 'Walk', PHYSICS.walk],
  ['traction', 'Traction', PHYSICS.traction],
  ['gravity', 'Gravity', PHYSICS.gravity],
  ['airAcceleration', 'Air accel', PHYSICS.airAccel],
  ['wingsAirSpeed', 'Air speed', PHYSICS.wings.air],
  ['capeAirSpeed', 'Air speed', PHYSICS.cape.air],
  ['wingsFall', 'Fall speed', PHYSICS.wings.fall],
  ['wingsFastFall', 'Fast fall', PHYSICS.wings.fast],
  ['capeFall', 'Fall speed', PHYSICS.cape.fall],
  ['capeFastFall', 'Fast fall', PHYSICS.cape.fast],
  ['jumpSquat', 'Jumpsquat', PHYSICS.squat],
].map(([key, sourceKey, value]) => ({ key, source: attribute(sourceKey), spectris: value }));

const report = {
  source: reference.source,
  mapping:
    'GDD 3.8: Jab 1 + Rapid Jab vs Brawl rapid jab (f7); Rapid Jab finisher vs Brawl jab finisher (f30); Jab 2/3 role budgets only',
  comparisons,
  movement,
  status:
    'Every normal certified inside its role budget; Brawl deltas reported for comparable moves. Controller feel remains a playtest question.',
};
writeFileSync('apps/spectris/proofs/reference-comparison.json', JSON.stringify(report, null, 2) + '\n');

const cell = (ours, theirs) => `${ours ?? '—'} / ${theirs ?? '—'}`;
const lines = [
  '# Brawl reference comparison',
  '',
  `Source: [${reference.source.title}](${reference.source.url}), Meta Knight tab. Snapshot: ${reference.source.retrieved}.`,
  '',
  'All timings are one-based. "Ours / Brawl". Generated by `scripts/spectris-frame-budget.mjs`; do not edit by hand.',
  '',
  '**Mapping (GDD 3.8):** Brawl Meta Knight has no 3-hit jab. Jab 1 and the Rapid Jab compare to his rapid-jab row (first hit frame 7). The Rapid Jab finisher compares to his jab finisher (frame 30). Jab 2 and Jab 3 have no counterpart and are checked against role budgets only.',
  '',
  '| Move | Role budget | Startup | FAF | Landing | Comparison |',
  '| --- | --- | --- | --- | --- | --- |',
  ...comparisons.map(
    (c) =>
      `| ${c.id} | ${c.role} | ${cell(c.spectrisTiming.startup, c.sourceTiming?.startup)} | ${cell(c.spectrisTiming.faf, c.sourceTiming?.faf)} | ${cell(c.spectrisTiming.landing, c.sourceTiming?.landing)} | ${c.sourceName ?? 'budget only'} |`,
  ),
  '',
  '## Movement (GDD revision 2)',
  '',
  '| Attribute | Spectris | Brawl MK |',
  '| --- | --- | --- |',
  ...movement.map((m) => `| ${m.key} | ${m.spectris} | ${m.source} |`),
  '',
  '## Interpretation',
  '',
  "Wings drifts about 20% faster than Meta Knight (0.90 vs 0.752) so it is the mobile stance; Cape sits at his value (0.75). Traction moves toward his slide without going icy. Jumpsquat stays one frame snappier (3f); the feel lab A/Bs 3f against Brawl's 4f and traction 0.04 / 0.06 / 0.10 live.",
  '',
  'Source timings are evidence, not replacement values: the GDD defines a different kit. This report does not certify subjective feel or hardware performance.',
];
writeFileSync('apps/spectris/REFERENCE_COMPARISON.md', lines.join('\n') + '\n');
const budgeted = comparisons.length;
console.log(
  `REFERENCE COMPARISON PASS: ${budgeted} entries inside role budgets, ${movement.length} movement comparisons; CSV checksum verified.`,
);
