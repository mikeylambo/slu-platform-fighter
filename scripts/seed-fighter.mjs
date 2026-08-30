#!/usr/bin/env node
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fightersRoot = join(root, 'fighters');
const contractPath = join(root, 'content', 'animation-contract.json');
const greyboxPath = join(fightersRoot, 'greybox', 'fighter.json');
const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const STANDARD_AERIALS = ['neutral-air', 'forward-air', 'back-air', 'up-air', 'down-air'];

function fail(message) { throw new Error(message); }
function titleCase(id) { return id.split('-').map((part) => part ? part[0].toUpperCase() + part.slice(1) : part).join(' '); }
async function json(path) { return JSON.parse(await readFile(path, 'utf8')); }

const id = process.argv[2];
if (!id || !ID.test(id)) fail('Usage: npm run fighter:seed -- <fighter-id> [Display Name]');
const displayName = process.argv.slice(3).join(' ').trim() || titleCase(id);
const target = join(fightersRoot, id);
try { await access(target); fail(`fighter ${id} already exists`); } catch (error) { if (error.message?.includes('already exists')) throw error; }

const baseline = structuredClone(await json(greyboxPath));
const contract = await json(contractPath);
baseline.id = id;
baseline.status = 'draft';
baseline.identity = {
  displayName,
  archetype: 'TBD',
  playstyle: 'TBD',
  guideSummary: 'Seeded from the certified Greybox gameplay envelope; replace values with character-authored design data.',
};
baseline.ownedEntities = [];
baseline.provenance = { code: 'Original SLU fighter definition seeded from Greybox contract', assets: [] };
for (const [moveName, move] of Object.entries(baseline.moves)) {
  move.timeline = move.timeline.filter((event) => event.type !== 'entity_spawn' && event.type !== 'entity_command');
  if (STANDARD_AERIALS.includes(moveName)) {
    // Draft-neutral placeholder: explicit authoring surface, not a shipping timing choice.
    move.landing = { landingLagFrames: 0, autoCancelWindows: [] };
  } else {
    delete move.landing;
  }
}

const render = {
  '$schema': '../../content/render.schema.json',
  schemaVersion: 1,
  fighterId: id,
  kind: '3d',
  model: 'assets/model.glb',
  armature: 'Armature',
  rigProfile: 'slu-humanoid-v1',
  scale: 1,
  facing: 'right',
  materials: { primary: 'Primary', secondary: 'Secondary', accent: 'Accent', skin: 'Skin', hair: 'Hair', metal: 'Metal', energy: 'Energy' },
  sockets: { hand_r: 'Hand.R', hand_l: 'Hand.L', head: 'Head', root: 'Root' },
  animations: Object.fromEntries(contract.roles.map((role) => [role, { clip: '', grade: 'author_required' }])),
  sources: [],
};

await mkdir(target, { recursive: true });
await writeFile(join(target, 'fighter.json'), JSON.stringify(baseline, null, 2) + '\n');
await writeFile(join(target, 'render.json'), JSON.stringify(render, null, 2) + '\n');
console.log(`Seeded fighters/${id} (${displayName}) with ${Object.keys(baseline.moves).length} gameplay moves and ${contract.roles.length} animation roles.`);
console.log('Next: author identity/movement/moves + aerial landing data, add assets/model.glb, run fighter:autobind, then fighter:audit.');
