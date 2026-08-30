#!/usr/bin/env node
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const stagesRoot = join(root, 'stages');
const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const id = process.argv[2];
if (!id || !ID.test(id)) throw new Error('Usage: npm run stage:seed -- <stage-id> [Display Name]');
const displayName = process.argv.slice(3).join(' ').trim() || id.split('-').map((part) => part[0]?.toUpperCase()+part.slice(1)).join(' ');
const target = join(stagesRoot, id);
try { await access(target); throw new Error(`stage ${id} already exists`); } catch (error) { if (error.message?.includes('already exists')) throw error; }
const baseline = JSON.parse(await readFile(join(stagesRoot, 'greybox', 'stage.json'), 'utf8'));
baseline.id = id; baseline.status = 'draft'; baseline.identity = { displayName, description: 'Seeded from the certified Greybox stage envelope; replace geometry/motion/camera with authored stage data.' };
baseline.provenance = { code: 'Original SLU stage definition seeded from Greybox contract', assets: [] };
await mkdir(target, { recursive: true }); await writeFile(join(target, 'stage.json'), JSON.stringify(baseline, null, 2) + '\n');
console.log(`Seeded stages/${id} (${displayName}).`);
console.log('Next: edit in Stage Lab, run stage:check, then stage:handoff.');
