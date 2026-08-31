import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const pilotId = process.argv[2] ?? 'riven-real';
const manifestPath = resolve('content', 'asset-pilots', `${pilotId}.json`);
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const response = await fetch(manifest.source.url, { headers: { 'user-agent': 'slu-platform-fighter-asset-pilot/1.0' } });
if (!response.ok) throw new Error(`asset pilot download failed ${response.status} ${response.statusText}`);
const bytes = new Uint8Array(await response.arrayBuffer());
if (bytes.byteLength < 20) throw new Error('GLB is too small');
const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
const magic = view.getUint32(0, true);
const version = view.getUint32(4, true);
const declaredLength = view.getUint32(8, true);
if (magic !== 0x46546c67) throw new Error(`invalid GLB magic 0x${magic.toString(16)}`);
if (version !== 2) throw new Error(`unsupported GLB version ${version}`);
if (declaredLength !== bytes.byteLength) throw new Error(`GLB length mismatch header=${declaredLength} actual=${bytes.byteLength}`);
let offset = 12;
let gltf = null;
while (offset + 8 <= bytes.byteLength) {
  const chunkLength = view.getUint32(offset, true);
  const chunkType = view.getUint32(offset + 4, true);
  offset += 8;
  if (offset + chunkLength > bytes.byteLength) throw new Error('GLB chunk exceeds file length');
  if (chunkType === 0x4e4f534a) {
    const jsonBytes = bytes.subarray(offset, offset + chunkLength);
    const text = new TextDecoder().decode(jsonBytes).replace(/\u0000+$/g, '').trim();
    gltf = JSON.parse(text);
  }
  offset += chunkLength;
}
if (!gltf) throw new Error('GLB JSON chunk missing');
const nodes = Array.isArray(gltf.nodes) ? gltf.nodes : [];
const meshes = Array.isArray(gltf.meshes) ? gltf.meshes : [];
const skins = Array.isArray(gltf.skins) ? gltf.skins : [];
const animations = Array.isArray(gltf.animations) ? gltf.animations : [];
const materials = Array.isArray(gltf.materials) ? gltf.materials : [];
const nodeNames = new Set(nodes.map((node) => node?.name).filter((name) => typeof name === 'string'));
for (const bone of manifest.expected.requiredBones ?? []) {
  if (!nodeNames.has(bone)) throw new Error(`required rig bone missing: ${bone}`);
}
if (meshes.length < (manifest.expected.minimumMeshes ?? 1)) throw new Error(`expected at least ${manifest.expected.minimumMeshes} mesh(es), found ${meshes.length}`);
if (skins.length < (manifest.expected.minimumSkins ?? 1)) throw new Error(`expected at least ${manifest.expected.minimumSkins} skin(s), found ${skins.length}`);
if (animations.length < (manifest.expected.minimumAnimations ?? 0)) throw new Error(`expected at least ${manifest.expected.minimumAnimations} animation(s), found ${animations.length}`);
if (manifest.source.declaredSizeBytes && manifest.source.declaredSizeBytes !== bytes.byteLength) throw new Error(`declared asset size ${manifest.source.declaredSizeBytes} != fetched ${bytes.byteLength}`);
const sha256 = createHash('sha256').update(bytes).digest('hex');
const animationNames = animations.map((entry, index) => entry?.name || `animation-${index}`);
const materialNames = materials.map((entry, index) => entry?.name || `material-${index}`);
const report = {
  pilotId: manifest.id,
  source: manifest.source.url,
  bytes: bytes.byteLength,
  sha256,
  glbVersion: version,
  nodes: nodes.length,
  meshes: meshes.length,
  skins: skins.length,
  materials: materialNames,
  animations: animationNames,
  requiredBonesVerified: manifest.expected.requiredBones,
  animationStatus: manifest.animationStatus,
  status: 'PASS',
};
console.log(JSON.stringify(report, null, 2));
console.log(`REAL ASSET PILOT PASS — ${manifest.id}: ${meshes.length} meshes, ${skins.length} skins, ${animations.length} animations, ${nodes.length} nodes.`);
