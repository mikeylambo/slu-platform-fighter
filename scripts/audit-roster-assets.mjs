import { readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const root = new URL('../fighters/', import.meta.url);
const ids = (await readdir(root, { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
const requested = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
const selected = requested.length ? ids.filter((id) => requested.includes(id)) : ids;
let failed = 0;
for (const id of selected) {
  const fighterDir = new URL(`../fighters/${id}/`, import.meta.url);
  const renderPath = join(fighterDir.pathname, 'render.json');
  if (!existsSync(renderPath)) { console.log(`${id}: SKIP no render.json`); continue; }
  const render = JSON.parse(await readFile(renderPath, 'utf8'));
  const model = render.model?.path ?? render.modelPath;
  if (!model || !existsSync(join(fighterDir.pathname, model))) { console.log(`${id}: WAITING model asset`); continue; }
  const result = spawnSync('blender', ['--background', '--python', 'scripts/blender/audit_fighter.py', '--', renderPath], { stdio: 'inherit' });
  if (result.error?.code === 'ENOENT') { console.error('Blender executable not found. Install Blender or run this in the asset workstation environment.'); process.exit(2); }
  if (result.status !== 0) { failed++; console.error(`${id}: FAIL`); } else console.log(`${id}: PASS`);
}
if (failed) { console.error(`Roster asset audit FAIL (${failed} fighter packs).`); process.exit(1); }
console.log(`Roster asset audit complete (${selected.length} selected packs).`);
