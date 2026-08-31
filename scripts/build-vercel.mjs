#!/usr/bin/env node
import { rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const out = 'dist-vercel';
await rm(out, { recursive: true, force: true });

const builds = [
  ['apps/hub', out, '/'],
  ['apps/combat-lab', `${out}/combat`, '/combat/'],
  ['apps/movement-lab', `${out}/movement`, '/movement/'],
  ['apps/stage-lab', `${out}/stage`, '/stage/'],
  ['apps/shell-lab', `${out}/shell`, '/shell/'],
  ['apps/asset-pilot-lab', `${out}/asset`, '/asset/'],
];

for (const [root, output, base] of builds) {
  console.log(`BUILD ${root} -> ${output} (${base})`);
  const result = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', 'build', root, '--outDir', `../../${output}`, '--emptyOutDir', '--base', base], { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log('VERCEL STUDIO BUILD PASS');
