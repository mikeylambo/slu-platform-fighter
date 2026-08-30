import { readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);
const profileDir = join(root, 'content', 'rig-profiles');
const fighterDir = join(root, 'fighters');
const profiles = new Map();
for (const name of (await readdir(profileDir)).filter((entry) => entry.endsWith('.json')).sort()) {
  const data = JSON.parse(await readFile(join(profileDir, name), 'utf8'));
  if (data.schemaVersion !== 1 || typeof data.id !== 'string' || !data.id || typeof data.rootBone !== 'string' || !Array.isArray(data.requiredBones) || !Array.isArray(data.requiredSockets)) throw new Error(`invalid rig profile ${name}`);
  if (profiles.has(data.id)) throw new Error(`duplicate rig profile ${data.id}`);
  profiles.set(data.id, data);
}
let checked = 0;
for (const id of (await readdir(fighterDir, { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort()) {
  const path = join(fighterDir, id, 'render.json');
  if (!existsSync(path)) continue;
  const render = JSON.parse(await readFile(path, 'utf8'));
  const profile = profiles.get(render.rigProfile);
  if (!profile) throw new Error(`${id} references unknown rig profile ${render.rigProfile}`);
  for (const socket of profile.requiredSockets) if (!render.sockets?.[socket]) throw new Error(`${id} (${profile.id}) missing required semantic socket ${socket}`);
  checked++;
}
console.log(`Rig profile validation PASS (${profiles.size} profiles / ${checked} fighter render packs).`);
