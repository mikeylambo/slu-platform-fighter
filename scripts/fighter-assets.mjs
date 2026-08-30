import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const [command, fighterId, ...rest] = process.argv.slice(2);
if (!['audit', 'autobind'].includes(command ?? '') || !fighterId) {
  console.error('Usage: node scripts/fighter-assets.mjs <audit|autobind> <fighter-id> [--apply]');
  process.exit(2);
}
if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(fighterId)) {
  console.error(`Invalid fighter id: ${fighterId}`);
  process.exit(2);
}
const renderPath = resolve(`fighters/${fighterId}/render.json`);
if (!existsSync(renderPath)) {
  console.error(`Missing fighter render pack: ${renderPath}`);
  process.exit(2);
}
const script = command === 'audit'
  ? resolve('scripts/blender/audit_fighter.py')
  : resolve('scripts/blender/autobind_animations.py');
const blenderArgs = ['--background', '--python', script, '--', renderPath];
if (command === 'autobind' && rest.includes('--apply')) blenderArgs.push('--apply');
const result = spawnSync(process.env.BLENDER_BIN || 'blender', blenderArgs, { stdio: 'inherit' });
if (result.error) {
  console.error(`Unable to launch Blender (${result.error.message}). Set BLENDER_BIN if Blender is not on PATH.`);
  process.exit(2);
}
process.exit(result.status ?? 1);
