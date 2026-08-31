import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';

const registryText = await readFile(new URL('../packages/content/src/generated/fighterRegistry.ts', import.meta.url), 'utf8');
const ids = [...registryText.matchAll(/\bid:\s*['"]([^'"]+)['"]/g)].map((match) => match[1]).filter((id, index, all) => all.indexOf(id) === index).sort();
const rounds = Number(process.argv.find((arg) => arg.startsWith('--rounds='))?.split('=')[1] ?? 4);
const frames = Number(process.argv.find((arg) => arg.startsWith('--frames='))?.split('=')[1] ?? 1800);
if (!Number.isInteger(rounds) || rounds < 1) throw new Error('--rounds must be positive integer');
if (!Number.isInteger(frames) || frames < 1) throw new Error('--frames must be positive integer');
const pairs = [];
for (let a = 0; a < ids.length; a += 1) for (let b = a; b < ids.length; b += 1) pairs.push([ids[a], ids[b]]);
console.log(`Roster soak matrix: ${ids.length} fighters / ${pairs.length} unordered matchups / ${rounds} deterministic repeats each / max ${frames} frames.`);
execFileSync(process.execPath, ['dist/packages/certification/src/k48mixedRosterSoak.js', `--rounds=${rounds}`, `--frames=${frames}`], { stdio: 'inherit' });
