import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const pilotId = process.argv[2] ?? 'riven-real';
const pilot = JSON.parse(await readFile(resolve('content', 'asset-pilots', `${pilotId}.json`), 'utf8'));
const contract = JSON.parse(await readFile(resolve('content', 'animation-contract.json'), 'utf8'));
const clips = new Set(pilot.observed?.animations ?? []);

function normalize(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, '_');
}

const clipByNormalized = new Map([...clips].map((clip) => [normalize(clip), clip]));
const rows = contract.roles.map((role) => {
  const exact = clipByNormalized.get(normalize(role));
  return {
    role,
    status: exact ? 'safe-exact-bind' : 'author-required',
    clip: exact ?? null,
  };
});
const safe = rows.filter((row) => row.status === 'safe-exact-bind');
const waiting = rows.filter((row) => row.status === 'author-required');
const report = {
  pilotId,
  sourceClips: [...clips],
  contractRoles: contract.roles.length,
  safelyBindable: safe,
  authorRequired: waiting.map((row) => row.role),
  summary: `${safe.length}/${contract.roles.length} safely bindable; ${waiting.length} require authored/retargeted animation`,
};
console.log(JSON.stringify(report, null, 2));
console.log(`ANIMATION WORKLIST — ${pilotId}: ${report.summary}`);
