import { access, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const id = process.argv[2];
if (!id) throw new Error('Usage: npm run fighter:handoff -- <fighter-id>');
const dir = resolve('fighters', id); await access(dir);
const fighter = JSON.parse(await readFile(join(dir, 'fighter.json'), 'utf8'));
const render = JSON.parse(await readFile(join(dir, 'render.json'), 'utf8'));
const contract = JSON.parse(await readFile(resolve('content/animation-contract.json'), 'utf8'));
const modelPath = join(dir, render.model);
const missingRoles = contract.roles.filter((role) => !render.animations?.[role]?.clip);
const authorRequired = contract.roles.filter((role) => render.animations?.[role]?.grade === 'author_required');
const tbdIdentity = Object.values(fighter.identity ?? {}).filter((value) => typeof value === 'string' && /\bTBD\b/i.test(value)).length;
const aerials = ['neutral-air','forward-air','back-air','up-air','down-air'];
const missingLanding = aerials.filter((move) => !fighter.moves?.[move]?.landing);
const categories = {
  engine: [],
  gameplay: [
    ...(tbdIdentity ? [`identity has ${tbdIdentity} TBD field(s)`] : []),
    ...(missingLanding.length ? [`missing landing contracts: ${missingLanding.join(', ')}`] : []),
  ],
  modelRig: [
    ...(!existsSync(modelPath) ? [`missing model: ${render.model}`] : []),
    ...(!render.rigProfile ? ['missing rigProfile'] : []),
  ],
  animation: [
    ...(missingRoles.length ? [`${missingRoles.length}/${contract.roles.length} semantic roles have no clip binding`] : []),
    ...(authorRequired.length ? [`${authorRequired.length} role(s) remain author_required`] : []),
  ],
  certification: fighter.status === 'release' ? [] : [`fighter status is ${fighter.status}`],
};
console.log(`\n${fighter.identity?.displayName ?? id} — production handoff\n`);
for (const [name, items] of Object.entries(categories)) {
  console.log(`${name.toUpperCase()}: ${items.length === 0 ? 'READY' : 'WAITING'}`);
  for (const item of items) console.log(`  - ${item}`);
}
console.log(`\nENGINE HANDOFF: ${categories.engine.length === 0 ? 'PASS — no fighter-specific engine work declared.' : 'FAIL'}`);
const assetReady = categories.modelRig.length === 0 && categories.animation.length === 0;
const gameplayReady = categories.gameplay.length === 0;
console.log(`ASSET READY: ${assetReady ? 'YES' : 'NO'} | GAMEPLAY READY: ${gameplayReady ? 'YES' : 'NO'} | RELEASE READY: ${fighter.status === 'release' && assetReady && gameplayReady ? 'YES' : 'NO'}`);
