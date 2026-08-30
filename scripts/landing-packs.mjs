#!/usr/bin/env node
import { readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const fightersRoot = resolve('fighters');
const fail = (message) => { throw new Error(message); };
const dirs = (await readdir(fightersRoot, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
  .map((entry) => entry.name).sort();
let policies = 0;
for (const id of dirs) {
  const pack = JSON.parse(await readFile(join(fightersRoot, id, 'fighter.json'), 'utf8'));
  for (const [moveName, move] of Object.entries(pack.moves ?? {})) {
    const landing = move.landing;
    if (landing === undefined) continue;
    policies += 1;
    if (!Number.isInteger(landing.landingLagFrames) || landing.landingLagFrames < 0 || landing.landingLagFrames > 65535) {
      fail(`${id}:${moveName} landingLagFrames must be integer 0..65535`);
    }
    if (!Array.isArray(landing.autoCancelWindows)) fail(`${id}:${moveName} autoCancelWindows must be array`);
    let previousEnd = -1;
    for (const [index, window] of landing.autoCancelWindows.entries()) {
      if (!Number.isInteger(window.startFrame) || !Number.isInteger(window.endFrame)) fail(`${id}:${moveName} autocancel window ${index} frames must be integers`);
      if (window.startFrame < 0 || window.endFrame < window.startFrame) fail(`${id}:${moveName} autocancel window ${index} invalid range`);
      if (window.endFrame >= move.totalFrames) fail(`${id}:${moveName} autocancel window ${index} exceeds totalFrames ${move.totalFrames}`);
      if (window.startFrame <= previousEnd) fail(`${id}:${moveName} autocancel windows must be sorted and non-overlapping`);
      previousEnd = window.endFrame;
    }
  }
}
console.log(`Aerial landing policy validation PASS (${policies} authored policies).`);
