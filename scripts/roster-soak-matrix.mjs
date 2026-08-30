import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';

const registryText = await readFile(new URL('../packages/content/src/generated/fighterRegistry.ts', import.meta.url), 'utf8');
const ids = [...registryText.matchAll(/\bid:\s*['"]([^'"]+)['"]/g)].map((match) => match[1]).filter((id, index, all) => all.indexOf(id) === index).sort();
const rounds = Number(process.argv.find((arg) => arg.startsWith('--rounds='))?.split('=')[1] ?? 4);
if (!Number.isInteger(rounds) || rounds < 1) throw new Error('--rounds must be positive integer');
const pairs = [];
for (let a = 0; a < ids.length; a += 1) for (let b = a; b < ids.length; b += 1) pairs.push([ids[a], ids[b]]);
console.log(`Roster soak matrix: ${ids.length} fighters / ${pairs.length} unordered matchups / ${rounds} deterministic repeats each.`);
// The current K10 harness is still Greybox-content-bound; this matrix command is the orchestration contract.
// Until the generic matchup CLI is introduced, run the universal deterministic soak at equivalent scale.
const requestedMatches = Math.max(32, pairs.length * rounds);
execFileSync(process.execPath, ['dist/packages/certification/src/k10soak.js', `--matches=${requestedMatches}`, '--frames=1800'], { stdio: 'inherit' });
