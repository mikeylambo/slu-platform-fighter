#!/usr/bin/env node
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fightersRoot = join(root, 'fighters');
const contractPath = join(root, 'content', 'animation-contract.json');
const greyboxPath = join(fightersRoot, 'greybox', 'fighter.json');
const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function fail(message) { throw new Error(message); }
async function json(path) { return JSON.parse(await readFile(path, 'utf8')); }
async function exists(path) { try { await access(path); return true; } catch { return false; } }
function titleCase(id) { return id.split('-').map((part) => part ? part[0].toUpperCase() + part.slice(1) : part).join(' '); }

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const force = args.includes('--force');
const manifestArg = args.find((arg) => !arg.startsWith('--'));
if (!manifestArg) fail('Usage: npm run roster:seed -- <manifest.json> [--dry-run] [--force]');
const manifestPath = isAbsolute(manifestArg) ? manifestArg : resolve(process.cwd(), manifestArg);
const manifest = await json(manifestPath);
if (!Array.isArray(manifest)) fail('roster manifest must be a JSON array');

const seen = new Set();
for (const [index, entry] of manifest.entries()) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) fail(`manifest entry ${index} must be an object`);
  if (typeof entry.id !== 'string' || !ID.test(entry.id)) fail(`manifest entry ${index} has invalid id`);
  if (seen.has(entry.id)) fail(`manifest contains duplicate fighter id ${entry.id}`);
  seen.add(entry.id);
}

const baselineTemplate = await json(greyboxPath);
const contract = await json(contractPath);
let created = 0;
let skipped = 0;

for (const entry of manifest) {
  const id = entry.id;
  const displayName = typeof entry.displayName === 'string' && entry.displayName.trim() ? entry.displayName.trim() : titleCase(id);
  const target = join(fightersRoot, id);
  const alreadyExists = await exists(target);
  if (alreadyExists && !force) {
    console.log(`SKIP ${id} — fighters/${id} already exists`);
    skipped += 1;
    continue;
  }

  const fighter = structuredClone(baselineTemplate);
  fighter.id = id;
  fighter.status = 'draft';
  fighter.identity = {
    displayName,
    archetype: typeof entry.archetype === 'string' && entry.archetype.trim() ? entry.archetype.trim() : 'TBD',
    playstyle: typeof entry.playstyle === 'string' && entry.playstyle.trim() ? entry.playstyle.trim() : 'TBD',
    guideSummary: typeof entry.guideSummary === 'string' && entry.guideSummary.trim()
      ? entry.guideSummary.trim()
      : 'Seeded from the certified Greybox gameplay envelope; replace values with character-authored design data.',
  };
  fighter.ownedEntities = [];
  fighter.provenance = { code: 'Original SLU fighter definition seeded from roster manifest', assets: [] };
  for (const move of Object.values(fighter.moves)) {
    move.timeline = move.timeline.filter((event) => event.type !== 'entity_spawn' && event.type !== 'entity_command');
  }

  const render = {
    '$schema': '../../content/render.schema.json', schemaVersion: 1, fighterId: id, kind: '3d',
    model: 'assets/model.glb', armature: 'Armature', rigProfile: 'slu-humanoid-v1', scale: 1, facing: 'right',
    materials: { primary: 'Primary', secondary: 'Secondary', accent: 'Accent', skin: 'Skin', hair: 'Hair', metal: 'Metal', energy: 'Energy' },
    sockets: { hand_r: 'Hand.R', hand_l: 'Hand.L', head: 'Head', root: 'Root' },
    animations: Object.fromEntries(contract.roles.map((role) => [role, { clip: '', grade: 'author_required' }])),
    sources: [],
  };

  console.log(`${dryRun ? 'WOULD SEED' : alreadyExists ? 'RESEED' : 'SEED'} ${id} — ${displayName} | ${Object.keys(fighter.moves).length} moves | ${contract.roles.length} animation roles`);
  if (!dryRun) {
    await mkdir(target, { recursive: true });
    await writeFile(join(target, 'fighter.json'), JSON.stringify(fighter, null, 2) + '\n');
    await writeFile(join(target, 'render.json'), JSON.stringify(render, null, 2) + '\n');
  }
  created += 1;
}

console.log(`Roster seed ${dryRun ? 'preview' : 'complete'} — ${created} ${dryRun ? 'planned' : 'written'}, ${skipped} skipped, ${manifest.length} manifest entries.`);
if (force) console.log('WARNING: --force replaces fighter.json/render.json for existing manifest fighters; model/animation asset files are not deleted.');
