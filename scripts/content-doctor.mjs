#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { access } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const checks = [];

function executable(name, args = ["--version"]) {
  const result = spawnSync(name, args, { encoding: "utf8" });
  const ok = result.status === 0;
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim().split("\n")[0] ?? "";
  checks.push({ name, ok, detail: output || (ok ? "available" : "not found") });
}

async function file(name, path) {
  try { await access(path); checks.push({ name, ok: true, detail: path }); }
  catch { checks.push({ name, ok: false, detail: `missing: ${path}` }); }
}

executable("node");
executable("npm");
executable(process.env.BLENDER ?? "blender");
await file("animation contract", join(root, "content", "animation-contract.json"));
await file("fighter schema", join(root, "content", "fighter.schema.json"));
await file("render schema", join(root, "content", "render.schema.json"));

for (const c of checks) console.log(`${c.ok ? "PASS" : "WARN"}  ${c.name}: ${c.detail}`);
const requiredFailures = checks.filter((c) => !c.ok && c.name !== (process.env.BLENDER ?? "blender"));
if (requiredFailures.length) process.exit(1);
console.log("Content doctor complete. Blender is required only for 3D asset certification, not kernel verification.");
