#!/usr/bin/env node
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

const fightersRoot = resolve('fighters');
const reportsRoot = resolve('reports');
const requested = process.argv[2] ?? '--all';

async function readJson(path) { return JSON.parse(await readFile(path, 'utf8')); }
function framesOf(move, type) { return move.timeline.filter((event) => event.type === type).map((event) => event.frame).sort((a, b) => a - b); }

function hitboxWindows(move) {
  const open = new Map();
  const windows = [];
  for (const event of move.timeline) {
    if (event.type === 'hitbox_on') {
      const id = event.data?.id ?? 'unnamed';
      open.set(id, event.frame);
    } else if (event.type === 'hitbox_off') {
      const id = event.data?.id ?? 'unnamed';
      const startFrame = open.get(id);
      if (startFrame !== undefined) {
        windows.push({ id, startFrame, endFrame: event.frame - 1 });
        open.delete(id);
      }
    }
  }
  return windows.sort((a, b) => a.startFrame - b.startFrame || a.id.localeCompare(b.id));
}

function analyzeMove(name, move) {
  const hitboxes = hitboxWindows(move);
  const firstActive = hitboxes.length ? Math.min(...hitboxes.map((entry) => entry.startFrame)) : null;
  const lastActive = hitboxes.length ? Math.max(...hitboxes.map((entry) => entry.endFrame)) : null;
  const eventSummary = {};
  for (const event of move.timeline) eventSummary[event.type] = (eventSummary[event.type] ?? 0) + 1;
  return {
    name,
    animationRole: move.animationRole,
    grabAction: move.grabAction ?? null,
    totalFrames: move.totalFrames,
    startupFrames: firstActive,
    firstActiveFrame: firstActive,
    lastActiveFrame: lastActive,
    recoveryFrames: lastActive === null ? null : Math.max(0, move.totalFrames - lastActive - 1),
    hitboxes,
    landing: move.landing ?? null,
    movementEvents: move.timeline.filter((event) => event.type === 'impulse' || event.type === 'velocity').map((event) => ({ frame: event.frame, type: event.type, data: event.data ?? {} })),
    invulnerability: { on: framesOf(move, 'invuln_on'), off: framesOf(move, 'invuln_off') },
    armor: { on: framesOf(move, 'armor_on'), off: framesOf(move, 'armor_off') },
    cancels: { on: framesOf(move, 'cancel_on'), off: framesOf(move, 'cancel_off') },
    entitySpawns: move.timeline.filter((event) => event.type === 'entity_spawn').map((event) => ({ frame: event.frame, data: event.data ?? {} })),
    eventSummary,
  };
}

async function analyzeFighter(id) {
  const pack = await readJson(join(fightersRoot, id, 'fighter.json'));
  return {
    schemaVersion: 1,
    fighterId: pack.id,
    displayName: pack.identity?.displayName ?? pack.id,
    status: pack.status,
    generatedFrom: `fighters/${id}/fighter.json`,
    moves: Object.entries(pack.moves ?? {}).sort(([a], [b]) => a.localeCompare(b)).map(([name, move]) => analyzeMove(name, move)),
  };
}

const dirs = (await readdir(fightersRoot, { withFileTypes: true })).filter((entry) => entry.isDirectory() && !entry.name.startsWith('.')).map((entry) => entry.name).sort();
const ids = requested === '--all' ? dirs : [requested];
for (const id of ids) if (!dirs.includes(id)) throw new Error(`Unknown fighter ${id}`);
const reports = [];
for (const id of ids) {
  const report = await analyzeFighter(id);
  reports.push(report);
  const output = join(fightersRoot, id, 'frame-data.generated.json');
  await writeFile(output, JSON.stringify(report, null, 2) + '\n');
  const withHitboxes = report.moves.filter((move) => move.hitboxes.length > 0).length;
  const withLanding = report.moves.filter((move) => move.landing !== null).length;
  console.log(`${id}: ${report.moves.length} moves | ${withHitboxes} hitbox-authored | ${withLanding} landing-authored -> ${output}`);
}
if (requested === '--all') {
  await mkdir(reportsRoot, { recursive: true });
  const output = join(reportsRoot, 'roster-frame-data.json');
  await writeFile(output, JSON.stringify({ schemaVersion: 1, fighters: reports }, null, 2) + '\n');
  console.log(`Roster frame data -> ${output}`);
}
