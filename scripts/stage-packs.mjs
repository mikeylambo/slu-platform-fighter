#!/usr/bin/env node
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const stagesRoot = join(root, 'stages');
const generatedPath = join(root, 'packages', 'content', 'src', 'generated', 'stageRegistry.ts');
const command = process.argv[2] ?? 'check';
const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const FIXED_MIN = 10_000;
const FIXED_MAX = 200_000_000;
const fail = (message) => { throw new Error(message); };
const assert = (value, message) => { if (!value) fail(message); };
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const json = async (path) => JSON.parse(await readFile(path, 'utf8'));

function fixed(value, label, { positive = false, zero = true } = {}) {
  assert(Number.isInteger(value), `${label} must be deterministic integer/fixed-point data`);
  if (positive) assert(value > 0, `${label} must be positive`);
  const magnitude = Math.abs(value);
  assert((zero && magnitude === 0) || (magnitude >= FIXED_MIN && magnitude <= FIXED_MAX), `${label}=${value} looks mis-scaled; geometry uses 1,000,000 fixed units per world unit`);
}

function uniqueIds(items, label) {
  const ids = new Set();
  for (const item of items) {
    assert(object(item) && typeof item.id === 'string' && item.id.length > 0, `${label} entry requires id`);
    assert(!ids.has(item.id), `${label} duplicates id ${item.id}`);
    ids.add(item.id);
  }
}

function rect(value, label) {
  assert(object(value), `${label} missing`);
  for (const key of ['left','right','bottom','top']) fixed(value[key], `${label}.${key}`);
  assert(value.left < value.right, `${label}.left must be < right`);
  assert(value.bottom < value.top, `${label}.bottom must be < top`);
}

function validateStage(stage, folder) {
  assert(object(stage), `${folder}: stage.json must be object`);
  assert(stage.schemaVersion === 1, `${folder}: schemaVersion must be 1`);
  assert(stage.id === folder && ID.test(stage.id), `${folder}: stage id must match folder`);
  assert(['draft','playable','certified','release'].includes(stage.status), `${folder}: invalid status`);
  assert(object(stage.identity) && stage.identity.displayName, `${folder}: identity.displayName missing`);

  assert(Array.isArray(stage.surfaces) && stage.surfaces.length > 0, `${folder}: surfaces required`);
  uniqueIds(stage.surfaces, `${folder}: surfaces`);
  for (const surface of stage.surfaces) {
    assert(['solid','one-way'].includes(surface.kind), `${folder}: surface ${surface.id} invalid kind`);
    fixed(surface.y, `${folder}: ${surface.id}.y`);
    fixed(surface.xMin, `${folder}: ${surface.id}.xMin`);
    fixed(surface.xMax, `${folder}: ${surface.id}.xMax`);
    assert(surface.xMin < surface.xMax, `${folder}: ${surface.id} xMin must be < xMax`);
  }

  assert(Array.isArray(stage.ledges), `${folder}: ledges must be array`);
  uniqueIds(stage.ledges, `${folder}: ledges`);
  for (const ledge of stage.ledges) {
    fixed(ledge.x, `${folder}: ledge ${ledge.id}.x`);
    fixed(ledge.y, `${folder}: ledge ${ledge.id}.y`);
    assert(ledge.inward === -1 || ledge.inward === 1, `${folder}: ledge ${ledge.id}.inward must be -1 or 1`);
  }

  assert(Array.isArray(stage.spawns) && stage.spawns.length >= 2, `${folder}: at least 2 spawns required`);
  uniqueIds(stage.spawns, `${folder}: spawns`);
  for (const spawn of stage.spawns) {
    fixed(spawn.x, `${folder}: spawn ${spawn.id}.x`);
    fixed(spawn.y, `${folder}: spawn ${spawn.id}.y`);
    assert(spawn.facing === -1 || spawn.facing === 1, `${folder}: spawn ${spawn.id}.facing must be -1 or 1`);
  }
  if (stage.status !== 'draft') assert(stage.spawns.length >= 4, `${folder}: publishable stage requires at least 4 player spawns`);

  rect(stage.blastZone, `${folder}: blastZone`);
  assert(object(stage.camera), `${folder}: camera missing`);
  rect(stage.camera.bounds, `${folder}: camera.bounds`);
  fixed(stage.camera.padding, `${folder}: camera.padding`, { positive: true, zero: false });
  fixed(stage.camera.minZoom, `${folder}: camera.minZoom`, { positive: true, zero: false });
  fixed(stage.camera.maxZoom, `${folder}: camera.maxZoom`, { positive: true, zero: false });
  assert(stage.camera.minZoom <= stage.camera.maxZoom, `${folder}: camera minZoom must be <= maxZoom`);
  assert(stage.blastZone.left < stage.camera.bounds.left && stage.blastZone.right > stage.camera.bounds.right, `${folder}: horizontal blast zone must contain camera bounds`);
  assert(stage.blastZone.bottom < stage.camera.bounds.bottom && stage.blastZone.top > stage.camera.bounds.top, `${folder}: vertical blast zone must contain camera bounds`);

  assert(Array.isArray(stage.movingPlatforms), `${folder}: movingPlatforms must be array`);
  uniqueIds(stage.movingPlatforms, `${folder}: movingPlatforms`);
  for (const platform of stage.movingPlatforms) {
    assert(['solid','one-way'].includes(platform.kind), `${folder}: moving platform ${platform.id} invalid kind`);
    fixed(platform.width, `${folder}: moving platform ${platform.id}.width`, { positive: true, zero: false });
    assert(Array.isArray(platform.path) && platform.path.length >= 2, `${folder}: moving platform ${platform.id} requires 2+ path points`);
    for (const [index, point] of platform.path.entries()) {
      fixed(point.x, `${folder}: moving platform ${platform.id}.path[${index}].x`);
      fixed(point.y, `${folder}: moving platform ${platform.id}.path[${index}].y`);
    }
    assert(Number.isInteger(platform.periodFrames) && platform.periodFrames >= 2, `${folder}: moving platform ${platform.id}.periodFrames invalid`);
    assert(Number.isInteger(platform.phaseFrames) && platform.phaseFrames >= 0, `${folder}: moving platform ${platform.id}.phaseFrames invalid`);
  }

  assert(Array.isArray(stage.hazards), `${folder}: hazards must be array`);
  uniqueIds(stage.hazards, `${folder}: hazards`);
  for (const hazard of stage.hazards) {
    assert(['damage','launch','ko'].includes(hazard.kind), `${folder}: hazard ${hazard.id} invalid kind`);
    fixed(hazard.x, `${folder}: hazard ${hazard.id}.x`);
    fixed(hazard.y, `${folder}: hazard ${hazard.id}.y`);
    fixed(hazard.radius, `${folder}: hazard ${hazard.id}.radius`, { positive: true, zero: false });
    for (const key of ['activeFrames','inactiveFrames','phaseFrames']) assert(Number.isInteger(hazard[key]) && hazard[key] >= (key === 'activeFrames' ? 1 : 0), `${folder}: hazard ${hazard.id}.${key} invalid`);
  }
  assert(object(stage.provenance) && Array.isArray(stage.provenance.assets), `${folder}: provenance missing`);
}

async function loadAll() {
  await mkdir(stagesRoot, { recursive: true });
  const dirs = (await readdir(stagesRoot, { withFileTypes: true })).filter((entry) => entry.isDirectory() && !entry.name.startsWith('.')).map((entry) => entry.name).sort();
  const stages = [];
  for (const id of dirs) {
    const stage = await json(join(stagesRoot, id, 'stage.json'));
    validateStage(stage, id);
    stages.push(stage);
  }
  return stages;
}

async function check() {
  const stages = await loadAll();
  for (const stage of stages) console.log(`${stage.id}: ${stage.status} | surfaces ${stage.surfaces.length} | ledges ${stage.ledges.length} | spawns ${stage.spawns.length} | moving ${stage.movingPlatforms.length} | hazards ${stage.hazards.length}`);
  console.log(`Stage pack validation PASS (${stages.length} stages).`);
}

async function build() {
  const stages = await loadAll();
  await mkdir(dirname(generatedPath), { recursive: true });
  const active = stages.filter((stage) => stage.status !== 'draft');
  const source = `/* Generated by scripts/stage-packs.mjs. Do not edit. */\nexport const ALL_STAGE_PACKS = ${JSON.stringify(stages, null, 2)} as const;\nexport const STAGE_IDS = ${JSON.stringify(active.map((stage) => stage.id), null, 2)} as const;\nexport const STAGE_PACKS = ${JSON.stringify(active, null, 2)} as const;\n`;
  await writeFile(generatedPath, source);
  console.log(`Generated stage registry: ${active.length}/${stages.length} publishable; ${stages.length} total available to labs/tooling.`);
}

if (command === 'check') await check();
else if (command === 'build') await build();
else fail('Commands: check | build');
