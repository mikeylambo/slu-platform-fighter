#!/usr/bin/env node
import { access, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fightersRoot = join(root, "fighters");
const contractPath = join(root, "content", "animation-contract.json");
const generatedPath = join(root, "packages", "content", "src", "generated", "fighterRegistry.ts");
const cmd = process.argv[2] ?? "check";
const args = process.argv.slice(3);
const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const COLOR = /^#[0-9a-fA-F]{6}$/;
const FIXED_MIN_GEOMETRY = 10_000;
const FIXED_MAX_GEOMETRY = 20_000_000;
const GRAB_ACTIONS = new Set(["pummel","forward-throw","back-throw","up-throw","down-throw"]);
const fail = (m) => { throw new Error(m); };
const assert = (v, m) => { if (!v) fail(m); };
const object = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const json = async (p) => JSON.parse(await readFile(p, "utf8"));

async function directories() {
  await mkdir(fightersRoot, { recursive: true });
  return (await readdir(fightersRoot, { withFileTypes: true }))
    .filter((e) => e.isDirectory() && !e.name.startsWith("."))
    .map((e) => e.name).sort();
}

function plausibleFixedGeometry(value) {
  const magnitude = Math.abs(value);
  return magnitude === 0 || (magnitude >= FIXED_MIN_GEOMETRY && magnitude <= FIXED_MAX_GEOMETRY);
}

function integerFields(data, keys, message) {
  assert(object(data), `${message} requires data`);
  for (const key of keys) assert(Number.isInteger(data[key]), `${message} ${key} must be integer`);
}

function validateHitboxData(data, id, moveName, frame) {
  const prefix = `${id}: ${moveName} frame ${frame} hitbox`;
  integerFields(data, ["offsetX","offsetY","radius","damageTenths","baseKnockback","growthPer100Percent","directionX","directionY","hitlagFrames","hitstunFrames"], prefix);
  assert(typeof data.id === "string" && data.id, `${prefix} id missing`);
  for (const key of ["offsetX","offsetY","radius"]) assert(plausibleFixedGeometry(data[key]), `${prefix} ${key}=${data[key]} looks mis-scaled; geometry uses 1,000,000 fixed units per world unit`);
  assert(data.radius > 0, `${prefix} radius must be positive`);
  assert(data.baseKnockback >= 0 && data.growthPer100Percent >= 0, `${prefix} knockback cannot be negative`);
  assert(data.damageTenths >= 0, `${prefix} damage cannot be negative`);
  assert(data.hitlagFrames >= 0 && data.hitstunFrames >= 0, `${prefix} timing cannot be negative`);
}

function validateGrabDamage(data, id, moveName, frame) {
  const prefix = `${id}: ${moveName} frame ${frame} grab_damage`;
  integerFields(data, ["damageTenths","hitlagFrames"], prefix);
  assert(data.damageTenths >= 0 && data.hitlagFrames >= 0, `${prefix} values cannot be negative`);
}

function validateThrowRelease(data, id, moveName, frame) {
  const prefix = `${id}: ${moveName} frame ${frame} throw_release`;
  integerFields(data, ["damageTenths","baseKnockback","growthPer100Percent","directionX","directionY","hitstunFrames"], prefix);
  assert(data.damageTenths >= 0 && data.baseKnockback >= 0 && data.growthPer100Percent >= 0 && data.hitstunFrames >= 0, `${prefix} damage/knockback/timing cannot be negative`);
  assert(data.directionX !== 0 || data.directionY !== 0, `${prefix} launch direction cannot be zero vector`);
}

function validateFighter(f, id) {
  assert(object(f), `${id}: fighter.json must be an object`);
  assert(f.schemaVersion === 1, `${id}: schemaVersion must be 1`);
  assert(["draft","playable","certified","release"].includes(f.status), `${id}: invalid status`);
  assert(f.id === id && ID.test(f.id), `${id}: fighter id must match folder`);
  assert(typeof f.rigProfile === "string" && ID.test(f.rigProfile), `${id}: invalid rigProfile`);
  assert(object(f.identity) && f.identity.displayName, `${id}: identity.displayName missing`);
  assert(object(f.attributes), `${id}: attributes missing`);
  for (const k of ["weight","hurtboxWidth","hurtboxHeight"]) assert(Number.isInteger(f.attributes[k]) && f.attributes[k] > 0, `${id}: invalid attributes.${k}`);
  for (const k of ["hurtboxWidth","hurtboxHeight"]) assert(plausibleFixedGeometry(f.attributes[k]), `${id}: attributes.${k}=${f.attributes[k]} looks mis-scaled`);
  assert(object(f.movement), `${id}: movement missing`);
  for (const [k,v] of Object.entries(f.movement)) assert(Number.isInteger(v), `${id}: movement.${k} must be deterministic integer/fixed-point data`);
  assert(object(f.moves), `${id}: moves missing`);
  const usedGrabActions = new Set();
  for (const [name, move] of Object.entries(f.moves)) {
    assert(object(move) && typeof move.animationRole === "string" && move.animationRole, `${id}: ${name}.animationRole missing`);
    assert(Number.isInteger(move.totalFrames) && move.totalFrames > 0, `${id}: ${name}.totalFrames must be positive integer`);
    assert(Array.isArray(move.timeline), `${id}: ${name}.timeline missing`);
    if (move.grabAction !== undefined) {
      assert(GRAB_ACTIONS.has(move.grabAction), `${id}: ${name}.grabAction invalid`);
      assert(!usedGrabActions.has(move.grabAction), `${id}: duplicate grabAction ${move.grabAction}`);
      usedGrabActions.add(move.grabAction);
    }
    let last = -1;
    const activeHitboxes = new Set();
    let grabDamageCount = 0;
    let throwReleaseCount = 0;
    for (const event of move.timeline) {
      assert(Number.isInteger(event.frame) && event.frame >= last, `${id}: ${name} timeline frames must be nondecreasing integers`);
      assert(event.frame < move.totalFrames, `${id}: ${name} event frame ${event.frame} exceeds totalFrames ${move.totalFrames}`);
      assert(typeof event.type === "string", `${id}: ${name} event type missing`);
      last = event.frame;
      if (event.type === "hitbox_on") {
        validateHitboxData(event.data, id, name, event.frame);
        assert(!activeHitboxes.has(event.data.id), `${id}: ${name} hitbox ${event.data.id} activated twice without hitbox_off`);
        activeHitboxes.add(event.data.id);
      } else if (event.type === "hitbox_off") {
        assert(object(event.data) && typeof event.data.id === "string", `${id}: ${name} hitbox_off requires data.id`);
        assert(activeHitboxes.has(event.data.id), `${id}: ${name} hitbox_off references inactive ${event.data.id}`);
        activeHitboxes.delete(event.data.id);
      } else if (event.type === "grab_damage") {
        grabDamageCount += 1;
        validateGrabDamage(event.data, id, name, event.frame);
      } else if (event.type === "throw_release") {
        throwReleaseCount += 1;
        validateThrowRelease(event.data, id, name, event.frame);
      }
    }
    assert(activeHitboxes.size === 0, `${id}: ${name} leaves hitboxes active at move end: ${[...activeHitboxes].join(", ")}`);
    if (move.grabAction === "pummel") {
      assert(grabDamageCount === 1 && throwReleaseCount === 0, `${id}: ${name} pummel requires exactly one grab_damage and no throw_release`);
    } else if (move.grabAction !== undefined) {
      assert(throwReleaseCount === 1 && grabDamageCount === 0, `${id}: ${name} throw requires exactly one throw_release and no grab_damage`);
    } else {
      assert(grabDamageCount === 0 && throwReleaseCount === 0, `${id}: ${name} uses grab timeline events without grabAction`);
    }
  }
  assert(Array.isArray(f.ownedEntities), `${id}: ownedEntities must be array`);
  assert(object(f.palettes), `${id}: palettes missing`);
  for (const [name,p] of Object.entries(f.palettes)) for (const k of ["primary","secondary","accent","skin","hair","metal","energy"]) assert(COLOR.test(p[k] ?? ""), `${id}: palette ${name}.${k} invalid`);
  assert(object(f.provenance) && Array.isArray(f.provenance.assets), `${id}: provenance missing`);
}

function validateRender(r, f, contract, id) {
  assert(object(r), `${id}: render.json must be an object`);
  assert(r.schemaVersion === 1 && r.fighterId === id, `${id}: render identity mismatch`);
  assert(r.kind === "3d" && r.rigProfile === f.rigProfile, `${id}: render must use 3d/${f.rigProfile}`);
  assert(typeof r.model === "string" && typeof r.armature === "string", `${id}: model/armature missing`);
  assert(Number.isFinite(r.scale) && r.scale > 0, `${id}: invalid render scale`);
  assert(object(r.materials), `${id}: semantic material map missing`);
  assert(object(r.animations), `${id}: animations missing`);
  const allowed = new Set(contract.grades);
  const publication = new Set(contract.publicationRules[f.status] ?? contract.grades);
  const missing = [];
  const blocked = [];
  const gradeCounts = Object.fromEntries(contract.grades.map((g) => [g, 0]));
  for (const role of contract.roles) {
    const a = r.animations[role];
    if (!a) { missing.push(role); continue; }
    assert(allowed.has(a.grade), `${id}: ${role} has invalid grade ${a.grade}`);
    assert(typeof a.clip === "string", `${id}: ${role}.clip missing`);
    gradeCounts[a.grade]++;
    if (!publication.has(a.grade)) blocked.push(`${role}:${a.grade}`);
  }
  if (f.status !== "draft") assert(missing.length === 0, `${id}: ${missing.length} animation roles missing: ${missing.join(", ")}`);
  assert(blocked.length === 0, `${id}: ${f.status} status disallows animation grades: ${blocked.join(", ")}`);
  assert(Array.isArray(r.sources), `${id}: render sources missing`);
  return { gradeCounts, missing };
}

async function loadAll() {
  const contract = await json(contractPath);
  const out = [];
  for (const id of await directories()) {
    const base = join(fightersRoot, id);
    const fighter = await json(join(base, "fighter.json"));
    const render = await json(join(base, "render.json"));
    validateFighter(fighter, id);
    const report = validateRender(render, fighter, contract, id);
    out.push({ id, fighter, render, report });
  }
  return out;
}

async function scaffold() {
  const id = args[0];
  assert(id && ID.test(id), "Usage: npm run fighter:new -- <fighter-id>");
  const dir = join(fightersRoot, id);
  try { await access(dir); fail(`fighter ${id} already exists`); } catch (e) { if (e.message?.includes("already exists")) throw e; }
  await mkdir(dir, { recursive: true });
  const displayName = id.split("-").map((p) => p[0].toUpperCase()+p.slice(1)).join(" ");
  const fighter = {
    "$schema": "../../content/fighter.schema.json", schemaVersion: 1, status: "draft", id,
    identity: { displayName, archetype: "TBD", playstyle: "TBD" }, rigProfile: "slu-humanoid-v1",
    attributes: { weight: 100000, hurtboxWidth: 800000, hurtboxHeight: 1800000 }, movement: {}, moves: {}, ownedEntities: [],
    palettes: { "00": { primary: "#808080", secondary: "#D0D0D0", accent: "#FFFFFF", skin: "#B0B0B0", hair: "#404040", metal: "#A0A0A0", energy: "#80C0FF" } },
    provenance: { code: "Original SLU fighter definition", assets: [] }
  };
  const contract = await json(contractPath);
  const render = {
    "$schema": "../../content/render.schema.json", schemaVersion: 1, fighterId: id, kind: "3d", model: "assets/model.glb", armature: "Armature", rigProfile: "slu-humanoid-v1", scale: 1, facing: "right",
    materials: { primary: "Primary", secondary: "Secondary", accent: "Accent", skin: "Skin", hair: "Hair", metal: "Metal", energy: "Energy" }, sockets: {},
    animations: Object.fromEntries(contract.roles.map((role) => [role, { clip: "", grade: "author_required" }])), sources: []
  };
  await writeFile(join(dir, "fighter.json"), JSON.stringify(fighter, null, 2)+"\n");
  await writeFile(join(dir, "render.json"), JSON.stringify(render, null, 2)+"\n");
  console.log(`Created fighters/${id} as draft (${contract.roles.length} animation roles).`);
}

async function build() {
  const packs = await loadAll();
  await mkdir(dirname(generatedPath), { recursive: true });
  const active = packs.filter((p) => p.fighter.status !== "draft");
  const text = `/* Generated by scripts/fighter-packs.mjs. Do not edit. */\nexport const ALL_FIGHTER_PACKS = ${JSON.stringify(packs.map(p=>p.fighter), null, 2)} as const;\nexport const FIGHTER_IDS = ${JSON.stringify(active.map(p=>p.id), null, 2)} as const;\nexport const FIGHTER_PACKS = ${JSON.stringify(active.map(p=>p.fighter), null, 2)} as const;\n`;
  await writeFile(generatedPath, text);
  console.log(`Generated registry: ${active.length}/${packs.length} publishable; ${packs.length} total available to labs/tooling.`);
}

async function check() {
  const packs = await loadAll();
  for (const p of packs) console.log(`${p.id}: ${p.fighter.status} | moves ${Object.keys(p.fighter.moves).length} | animations ${JSON.stringify(p.report.gradeCounts)}${p.report.missing.length ? ` | missing ${p.report.missing.length}` : ""}`);
  console.log(`Fighter pack validation PASS (${packs.length} packs).`);
}

if (cmd === "new") await scaffold();
else if (cmd === "build") await build();
else if (cmd === "check") await check();
else fail("Commands: new | build | check");