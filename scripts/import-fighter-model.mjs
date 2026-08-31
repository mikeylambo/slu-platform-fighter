import { createHash } from 'node:crypto';
import { basename, isAbsolute, join, resolve } from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const [fighterId, source, rigProfile = 'slu-humanoid-v1', ...rest] = process.argv.slice(2);
if (!fighterId || !source) {
  throw new Error('Usage: node scripts/import-fighter-model.mjs <fighter-id> <file-or-url> [rig-profile] [--author=...] [--license=...] [--license-url=...]');
}
const option = (name, fallback = '') => rest.find((entry) => entry.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const author = option('author', 'TBD');
const license = option('license', 'TBD');
const licenseUrl = option('license-url', '');
const fighterDir = resolve('fighters', fighterId);
const fighterPath = join(fighterDir, 'fighter.json');
const renderPath = join(fighterDir, 'render.json');
const fighter = JSON.parse(await readFile(fighterPath, 'utf8'));
const render = JSON.parse(await readFile(renderPath, 'utf8'));

let bytes;
let sourceUrl = source;
if (/^https?:\/\//i.test(source)) {
  const response = await fetch(source, { headers: { 'user-agent': 'slu-platform-fighter-model-import/1.0' } });
  if (!response.ok) throw new Error(`model download failed ${response.status} ${response.statusText}`);
  bytes = new Uint8Array(await response.arrayBuffer());
} else {
  const localPath = isAbsolute(source) ? source : resolve(source);
  bytes = new Uint8Array(await readFile(localPath));
  sourceUrl = localPath;
}
if (bytes.byteLength < 20) throw new Error('model is too small to be a GLB');
const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
if (view.getUint32(0, true) !== 0x46546c67 || view.getUint32(4, true) !== 2) throw new Error('fighter:model:import currently requires GLB v2');
if (view.getUint32(8, true) !== bytes.byteLength) throw new Error('GLB length header does not match imported bytes');
const sha256 = createHash('sha256').update(bytes).digest('hex');
const assetDir = join(fighterDir, 'assets');
await mkdir(assetDir, { recursive: true });
const modelRelativePath = 'assets/model.glb';
await writeFile(join(fighterDir, modelRelativePath), bytes);

const socketProfiles = {
  'mixamo-humanoid-v1': {
    hand_r: 'mixamorig:RightHand',
    hand_l: 'mixamorig:LeftHand',
    head: 'mixamorig:Head',
    root: 'mixamorig:Hips',
  },
  'slu-humanoid-v1': {
    hand_r: 'Hand.R',
    hand_l: 'Hand.L',
    head: 'Head',
    root: 'Root',
  },
};
const sockets = socketProfiles[rigProfile] ?? render.sockets ?? {};
const sourceRecord = {
  id: 'primary-model',
  role: 'model',
  name: basename(source.split('?')[0] || 'model.glb'),
  author,
  license,
  sourceUrl,
  ...(licenseUrl ? { licenseUrl } : {}),
  sha256,
};
render.model = modelRelativePath;
render.rigProfile = rigProfile;
render.sockets = { ...(render.sockets ?? {}), ...sockets };
render.sources = [...(render.sources ?? []).filter((entry) => entry.id !== 'primary-model'), sourceRecord];
fighter.rigProfile = rigProfile;
fighter.provenance ??= { code: 'Original SLU fighter definition', assets: [] };
const fighterSource = { role: 'model', name: sourceRecord.name, author, license, sourceUrl, ...(licenseUrl ? { licenseUrl } : {}), sha256 };
fighter.provenance.assets = [...(fighter.provenance.assets ?? []).filter((entry) => entry.role !== 'model'), fighterSource];
await writeFile(renderPath, `${JSON.stringify(render, null, 2)}\n`);
await writeFile(fighterPath, `${JSON.stringify(fighter, null, 2)}\n`);
console.log(`FIGHTER MODEL IMPORT PASS — ${fighterId}`);
console.log(`  source: ${sourceUrl}`);
console.log(`  bytes: ${bytes.byteLength}`);
console.log(`  sha256: ${sha256}`);
console.log(`  rigProfile: ${rigProfile}`);
console.log(`  model: fighters/${fighterId}/${modelRelativePath}`);
console.log('Next: npm run fighter:autobind -- <fighter-id> --apply; npm run fighter:audit -- <fighter-id>; npm run fighter:handoff -- <fighter-id>');
