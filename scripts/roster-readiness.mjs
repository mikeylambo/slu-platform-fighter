#!/usr/bin/env node
import { access, readFile, readdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fightersRoot = join(root, 'fighters');
const contract = JSON.parse(await readFile(join(root, 'content', 'animation-contract.json'), 'utf8'));
const standardMoves = [
  'jab', 'dash-attack',
  'forward-tilt', 'up-tilt', 'down-tilt',
  'forward-smash', 'up-smash', 'down-smash',
  'neutral-air', 'forward-air', 'back-air', 'up-air', 'down-air',
  'neutral-special', 'side-special', 'up-special', 'down-special',
];
const grabActions = ['pummel', 'forward-throw', 'back-throw', 'up-throw', 'down-throw'];

async function exists(path) { try { await access(path); return true; } catch { return false; } }
async function json(path) { return JSON.parse(await readFile(path, 'utf8')); }
function pct(done, total) { return total === 0 ? '100%' : `${Math.round((done / total) * 100)}%`; }

const dirs = (await readdir(fightersRoot, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
  .map((entry) => entry.name)
  .sort();

const rows = [];
for (const id of dirs) {
  const base = join(fightersRoot, id);
  const fighter = await json(join(base, 'fighter.json'));
  const render = await json(join(base, 'render.json'));
  const moveNames = new Set(Object.keys(fighter.moves ?? {}));
  const missingStandardMoves = standardMoves.filter((name) => !moveNames.has(name));
  const authoredGrabActions = new Set(Object.values(fighter.moves ?? {}).map((move) => move.grabAction).filter(Boolean));
  const missingGrabActions = grabActions.filter((name) => !authoredGrabActions.has(name));
  const animationRoles = contract.roles;
  const boundAnimations = animationRoles.filter((role) => {
    const binding = render.animations?.[role];
    return binding && typeof binding.clip === 'string' && binding.clip.trim().length > 0 && binding.grade !== 'author_required';
  });
  const modelPath = join(base, render.model ?? 'assets/model.glb');
  const modelPresent = await exists(modelPath);
  const entityPackPresent = await exists(join(base, 'entities.json'));
  const ownedEntities = fighter.ownedEntities ?? [];
  const entityContractReady = ownedEntities.length === 0 || entityPackPresent;
  const gameplayReady = missingStandardMoves.length === 0 && missingGrabActions.length === 0;
  const animationReady = boundAnimations.length === animationRoles.length;
  const assetReady = modelPresent && animationReady;
  rows.push({
    id,
    displayName: fighter.identity?.displayName ?? id,
    status: fighter.status,
    gameplayReady,
    standardMoveCount: standardMoves.length - missingStandardMoves.length,
    missingStandardMoves,
    grabActionCount: grabActions.length - missingGrabActions.length,
    missingGrabActions,
    ownedEntityCount: ownedEntities.length,
    entityContractReady,
    modelPresent,
    animationBoundCount: boundAnimations.length,
    animationRoleCount: animationRoles.length,
    animationReady,
    assetReady,
  });
}

console.log('SLU PLATFORM FIGHTER — ROSTER READINESS');
console.log('');
for (const row of rows) {
  const engine = row.gameplayReady && row.entityContractReady ? 'ENGINE READY' : 'ENGINE TODO';
  const assets = row.assetReady ? 'ASSET READY' : 'ASSET TODO';
  console.log(`${row.id.padEnd(24)} ${row.status.padEnd(9)} ${engine.padEnd(12)} ${assets}`);
  console.log(`  moves ${row.standardMoveCount}/${standardMoves.length} + grabs ${row.grabActionCount}/${grabActions.length} | model ${row.modelPresent ? 'yes' : 'NO'} | animations ${row.animationBoundCount}/${row.animationRoleCount} (${pct(row.animationBoundCount, row.animationRoleCount)}) | owned entities ${row.ownedEntityCount}${row.entityContractReady ? '' : ' [missing entities.json]'}`);
  if (row.missingStandardMoves.length) console.log(`  missing moves: ${row.missingStandardMoves.join(', ')}`);
  if (row.missingGrabActions.length) console.log(`  missing grabs: ${row.missingGrabActions.join(', ')}`);
}

const engineReady = rows.filter((row) => row.gameplayReady && row.entityContractReady).length;
const assetReady = rows.filter((row) => row.assetReady).length;
console.log('');
console.log(`Roster: ${rows.length} fighters | engine-ready ${engineReady}/${rows.length} | model+animation-ready ${assetReady}/${rows.length}`);
console.log('ENGINE READY means the standard gameplay/grab/entity content envelope is complete. ASSET READY means the model exists and every semantic animation role is bound to a non-placeholder clip.');
