// Helm trace pipeline (GDD 10, continuation brief Step 3).
//
//   art/source/helm/<name>-front.png  black-on-white front silhouette; visor = holes
//   art/source/helm/<name>-side.png   optional side silhouette facing right (depth profile)
//   art/source/helm/helms.json        per-helm settings (trim line, bevel, crease)
//
// 1. Threshold and trace the front view to SVG paths (potrace).
// 2. Build Three.js shapes from the traced paths; outer contours become the helm, holes
//    become the visor.
// 3. Extrude with a bevel, subdivide, then shape depth from the side profile (fallback: a
//    domed depth curve) and round each row across its width.
// 4. Cut the visor as a separate emissive mesh recessed into the face.
// 5. Export public/art/helm/<name>.glb (meshes: helm, trim, visor) and register it in
//    public/art.manifest.json, flagged interim while the source is an interim silhouette.
//
// Usage: node scripts/spectris-trace-helm.mjs [name ...]   (default: every source present)
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import potrace from 'potrace';
import { PNG } from 'pngjs';
import * as THREE from 'three';
import { mergeVertices, toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const SOURCE = 'apps/spectris/art/source/helm';
const OUTPUT = 'apps/spectris/public/art/helm';
const MANIFEST = 'apps/spectris/public/art.manifest.json';
const DEFAULTS = {
  /** Normalized height (0 = chin, 1 = top) above which faces use the trim material. */
  trimAbove: 0.72,
  /** Depth used when no side view exists, as a fraction of helm height. */
  domeDepth: 0.62,
  /** Minimum relative depth at a row's outer edge (0 = knife edge, 1 = flat slab). */
  edgeDepth: 0.32,
  bevel: 0.018,
  creaseDegrees: 38,
  visorRecess: 0.012,
  maxEdge: 0.06,
};

// ---------------------------------------------------------------- raster helpers

function readPng(file) {
  return PNG.sync.read(readFileSync(file));
}

const isInk = (png, x, y) => {
  const i = (png.width * y + x) * 4;
  const luminance = 0.299 * png.data[i] + 0.587 * png.data[i + 1] + 0.114 * png.data[i + 2];
  return png.data[i + 3] > 127 && luminance < 128;
};

/** Per-row horizontal extent of ink, plus the overall bounding box. */
function rowSpans(png) {
  const rows = new Array(png.height).fill(null);
  let top = png.height;
  let bottom = -1;
  for (let y = 0; y < png.height; y++) {
    let min = -1;
    let max = -1;
    for (let x = 0; x < png.width; x++) {
      if (!isInk(png, x, y)) continue;
      if (min < 0) min = x;
      max = x;
    }
    if (min >= 0) {
      rows[y] = [min, max + 1];
      top = Math.min(top, y);
      bottom = Math.max(bottom, y + 1);
    }
  }
  if (bottom < 0) throw Error('Source image has no ink');
  return { rows, top, bottom };
}

/** Looks up a row span at normalized height v (0 = bottom, 1 = top), nearest filled row. */
function spanAt(spans, v) {
  const height = spans.bottom - spans.top;
  const row = Math.round(spans.bottom - 1 - v * (height - 1));
  for (let offset = 0; offset < height; offset++) {
    for (const candidate of [row - offset, row + offset]) {
      const span = spans.rows[candidate];
      if (span) return span;
    }
  }
  return [0, 1];
}

// ---------------------------------------------------------------- tracing

function trace(file) {
  return new Promise((resolve, reject) => {
    const tracer = new potrace.Potrace();
    tracer.setParameters({ threshold: 128, turdSize: 16, optTolerance: 0.3, alphaMax: 1 });
    tracer.loadImage(file, (error) => {
      if (error) reject(error);
      else resolve(tracer.getPathTag());
    });
  });
}

/** Parses potrace's absolute M/L/C/Z path data into a ShapePath (y flipped, normalized). */
function parsePath(tag, normalize) {
  const d = tag.match(/ d="([^"]+)"/)[1];
  const tokens = d.match(/[MLCZ]|-?\d*\.?\d+(?:e-?\d+)?/g);
  const shapePath = new THREE.ShapePath();
  let command = '';
  let i = 0;
  const point = () => {
    const x = Number(tokens[i++]);
    const y = Number(tokens[i++]);
    return normalize(x, y);
  };
  while (i < tokens.length) {
    if (/[MLCZ]/.test(tokens[i])) command = tokens[i++];
    if (command === 'M') {
      const [x, y] = point();
      shapePath.moveTo(x, y);
      command = 'L';
    } else if (command === 'L') {
      const [x, y] = point();
      shapePath.lineTo(x, y);
    } else if (command === 'C') {
      const [x1, y1] = point();
      const [x2, y2] = point();
      const [x, y] = point();
      shapePath.bezierCurveTo(x1, y1, x2, y2, x, y);
    } else if (command === 'Z') {
      command = '';
    } else {
      throw Error(`Unexpected path token ${tokens[i]}`);
    }
  }
  return shapePath;
}

/** Even-odd point-in-polygon test. */
function inside(point, polygon) {
  let hit = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [a, b] = [polygon[i], polygon[j]];
    if (a.y > point.y !== b.y > point.y && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) hit = !hit;
  }
  return hit;
}

/**
 * Potrace emits every contour with the same winding (even-odd fill), so holes are found by
 * nesting: a contour inside an odd number of others is a hole of its innermost container.
 */
function shapesFromContours(shapePath) {
  const contours = shapePath.subPaths.map((subPath) => ({ path: subPath, points: subPath.getPoints(12) }));
  for (const contour of contours) {
    contour.parents = contours.filter((other) => other !== contour && inside(contour.points[0], other.points));
  }
  const shapes = [];
  for (const contour of contours.filter((c) => c.parents.length % 2 === 0)) {
    const shape = new THREE.Shape(contour.points);
    shape.holes = contours
      .filter((c) => c.parents.length === contour.parents.length + 1 && c.parents.includes(contour))
      .map((c) => new THREE.Path(c.points));
    shapes.push(shape);
  }
  return shapes;
}

// ---------------------------------------------------------------- geometry

/** Splits triangles until no edge exceeds maxEdge, so caps can curve smoothly. */
function subdivide(geometry, maxEdge) {
  const source = (geometry.index ? geometry.toNonIndexed() : geometry).getAttribute('position');
  const out = [];
  const stack = [];
  for (let i = 0; i < source.count; i += 3) {
    stack.push([0, 1, 2].map((k) => new THREE.Vector3().fromBufferAttribute(source, i + k)));
  }
  while (stack.length) {
    const [a, b, c] = stack.pop();
    const edges = [
      [a.distanceTo(b), 0],
      [b.distanceTo(c), 1],
      [c.distanceTo(a), 2],
    ].sort((p, q) => q[0] - p[0]);
    if (edges[0][0] <= maxEdge) {
      out.push(a, b, c);
      continue;
    }
    const [p, q, r] = [
      [a, b, c],
      [b, c, a],
      [c, a, b],
    ][edges[0][1]];
    const mid = p.clone().lerp(q, 0.5);
    stack.push([p, mid, r], [mid, q, r]);
  }
  const result = new THREE.BufferGeometry();
  result.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(
      out.flatMap((v) => [v.x, v.y, v.z]),
      3,
    ),
  );
  return result;
}

/**
 * Depth model: for a point (x, v) returns the front and back surface z. Depth comes from
 * the side silhouette row (or a dome), and each row is rounded across its width so the
 * helm reads as a solid with a crisp edge rather than a slab.
 */
function depthModel(front, side, scale, settings) {
  return (x, v) => {
    const [left, right] = spanAt(front, v).map((value) => (value - front.center) * scale);
    const half = Math.max(1e-4, (right - left) / 2);
    const across = Math.min(1, Math.abs(x - (left + right) / 2) / half);
    const round = settings.edgeDepth + (1 - settings.edgeDepth) * Math.sqrt(Math.max(0, 1 - across * across));
    let back;
    let forward;
    if (side) {
      const [sb, sf] = spanAt(side.spans, v).map((value) => (value - side.center) * side.scale);
      back = sb;
      forward = sf;
    } else {
      const dome = Math.sqrt(Math.max(0, 1 - (2 * v - 1) ** 2));
      forward = (settings.domeDepth / 2) * (0.35 + 0.65 * dome);
      back = -forward;
    }
    const middle = (back + forward) / 2;
    const extent = ((forward - back) / 2) * round;
    return { front: middle + extent, back: middle - extent };
  };
}

function buildHelm(shapes, depth, settings) {
  const geometry = new THREE.ExtrudeGeometry(shapes, {
    // Depth is remapped from the side profile afterwards; keep walls short so only caps subdivide.
    depth: 0.01,
    curveSegments: 10,
    bevelEnabled: true,
    bevelThickness: settings.bevel,
    bevelSize: settings.bevel,
    bevelSegments: 2,
  });
  geometry.computeBoundingBox();
  const { min, max } = geometry.boundingBox;
  const dense = subdivide(geometry, settings.maxEdge);
  const position = dense.getAttribute('position');
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const v = position.getY(i);
    const t = (position.getZ(i) - min.z) / (max.z - min.z);
    const { front, back } = depth(x, v);
    position.setZ(i, back + (front - back) * t);
  }
  return dense;
}

function buildVisor(shapes, depth, settings) {
  const holes = shapes.flatMap((shape) => shape.holes.map((hole) => new THREE.Shape(hole.getPoints(12))));
  if (!holes.length) return null;
  const geometry = new THREE.ShapeGeometry(holes, 12);
  const dense = subdivide(geometry, settings.maxEdge);
  const position = dense.getAttribute('position');
  for (let i = 0; i < position.count; i++) {
    position.setZ(i, depth(position.getX(i), position.getY(i)).front - settings.visorRecess);
  }
  return dense;
}

/** Splits a geometry into faces below/above the trim line (by triangle centroid). */
function splitTrim(geometry, trimAbove) {
  const position = geometry.getAttribute('position');
  const lower = [];
  const upper = [];
  for (let i = 0; i < position.count; i += 3) {
    const triangle = [];
    let centroid = 0;
    for (let k = 0; k < 3; k++) {
      triangle.push(position.getX(i + k), position.getY(i + k), position.getZ(i + k));
      centroid += position.getY(i + k) / 3;
    }
    (centroid > trimAbove ? upper : lower).push(...triangle);
  }
  const make = (values) => {
    const result = new THREE.BufferGeometry();
    result.setAttribute('position', new THREE.Float32BufferAttribute(values, 3));
    return result;
  };
  return { armor: make(lower), trim: make(upper) };
}

// ---------------------------------------------------------------- GLB writer

/** Minimal glTF 2.0 binary writer: indexed meshes with POSITION + NORMAL. */
function writeGlb(meshes) {
  const chunks = [];
  const accessors = [];
  const bufferViews = [];
  const gltfMeshes = [];
  const nodes = [];
  let offset = 0;
  const materials = meshes.map((mesh) => mesh.material);
  const align = () => {
    const padding = (4 - (offset % 4)) % 4;
    if (padding) {
      chunks.push(Buffer.alloc(padding));
      offset += padding;
    }
  };
  meshes.forEach((mesh, index) => {
    const geometry = mergeVertices(mesh.geometry, 1e-5);
    mesh = { ...mesh, geometry };
    const attributes = {};
    for (const [semantic, name] of [
      ['POSITION', 'position'],
      ['NORMAL', 'normal'],
    ]) {
      const array = new Float32Array(mesh.geometry.getAttribute(name).array);
      const bytes = Buffer.from(array.buffer);
      bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: bytes.length, target: 34962 });
      const accessor = {
        bufferView: bufferViews.length - 1,
        componentType: 5126,
        count: array.length / 3,
        type: 'VEC3',
      };
      if (semantic === 'POSITION') {
        const min = [Infinity, Infinity, Infinity];
        const max = [-Infinity, -Infinity, -Infinity];
        for (let i = 0; i < array.length; i++) {
          min[i % 3] = Math.min(min[i % 3], array[i]);
          max[i % 3] = Math.max(max[i % 3], array[i]);
        }
        Object.assign(accessor, { min, max });
      }
      accessors.push(accessor);
      attributes[semantic] = accessors.length - 1;
      chunks.push(bytes);
      offset += bytes.length;
    }
    const indices = geometry.index.array;
    const wide = geometry.getAttribute('position').count > 65535;
    const indexArray = wide ? new Uint32Array(indices) : new Uint16Array(indices);
    const indexBytes = Buffer.from(indexArray.buffer);
    bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: indexBytes.length, target: 34963 });
    accessors.push({
      bufferView: bufferViews.length - 1,
      componentType: wide ? 5125 : 5123,
      count: indexArray.length,
      type: 'SCALAR',
    });
    chunks.push(indexBytes);
    offset += indexBytes.length;
    align();
    gltfMeshes.push({ name: mesh.name, primitives: [{ attributes, indices: accessors.length - 1, material: index }] });
    nodes.push({ name: mesh.name, mesh: index });
  });
  const binary = Buffer.concat(chunks);
  const json = {
    asset: { version: '2.0', generator: 'spectris-trace-helm' },
    scene: 0,
    scenes: [{ nodes: nodes.map((_, i) => i) }],
    nodes,
    meshes: gltfMeshes,
    materials,
    accessors,
    bufferViews,
    buffers: [{ byteLength: binary.length }],
  };
  const pad = (buffer, fill) => Buffer.concat([buffer, Buffer.alloc((4 - (buffer.length % 4)) % 4, fill)]);
  const jsonChunk = pad(Buffer.from(JSON.stringify(json)), 0x20);
  const binChunk = pad(binary, 0);
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + jsonChunk.length + 8 + binChunk.length, 8);
  const chunkHeader = (length, type) => {
    const buffer = Buffer.alloc(8);
    buffer.writeUInt32LE(length, 0);
    buffer.writeUInt32LE(type, 4);
    return buffer;
  };
  return Buffer.concat([
    header,
    chunkHeader(jsonChunk.length, 0x4e4f534a),
    jsonChunk,
    chunkHeader(binChunk.length, 0x004e4942),
    binChunk,
  ]);
}

// ---------------------------------------------------------------- pipeline

const sha = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');

async function traceHelm(name, config, ledger) {
  const frontFile = `${SOURCE}/${name}-front.png`;
  const sideFile = `${SOURCE}/${name}-side.png`;
  const settings = { ...DEFAULTS, ...(config[name] ?? {}) };
  const front = rowSpans(readPng(frontFile));
  const height = front.bottom - front.top;
  const scale = 1 / height;
  let minX = Infinity;
  let maxX = -Infinity;
  for (const span of front.rows) {
    if (!span) continue;
    minX = Math.min(minX, span[0]);
    maxX = Math.max(maxX, span[1]);
  }
  front.center = (minX + maxX) / 2;
  const normalize = (x, y) => [(x - front.center) * scale, (front.bottom - y) * scale];
  let side = null;
  if (existsSync(sideFile)) {
    const spans = rowSpans(readPng(sideFile));
    let back = Infinity;
    let forward = -Infinity;
    for (const span of spans.rows) {
      if (!span) continue;
      back = Math.min(back, span[0]);
      forward = Math.max(forward, span[1]);
    }
    side = { spans, center: (back + forward) / 2, scale: 1 / (spans.bottom - spans.top) };
  }
  const tag = await trace(frontFile);
  const shapes = shapesFromContours(parsePath(tag, normalize));
  const depth = depthModel(front, side, scale, settings);
  const helm = buildHelm(shapes, depth, settings);
  const { armor, trim } = splitTrim(helm, settings.trimAbove);
  const visor = buildVisor(shapes, depth, settings);
  const crease = (settings.creaseDegrees * Math.PI) / 180;
  const meshes = [
    {
      name: 'helm',
      geometry: toCreasedNormals(armor, crease),
      material: {
        name: 'armor',
        pbrMetallicRoughness: { baseColorFactor: [0.05, 0.06, 0.08, 1], metallicFactor: 0.6, roughnessFactor: 0.25 },
      },
    },
    {
      name: 'trim',
      geometry: toCreasedNormals(trim, crease),
      material: {
        name: 'trim',
        pbrMetallicRoughness: { baseColorFactor: [0.8, 0.6, 0.25, 1], metallicFactor: 1, roughnessFactor: 0.3 },
      },
    },
  ];
  if (visor) {
    meshes.push({
      name: 'visor',
      geometry: toCreasedNormals(visor, Math.PI),
      material: { name: 'visor', emissiveFactor: [1, 1, 1], pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1] } },
    });
  }
  const glb = writeGlb(meshes.filter((mesh) => mesh.geometry.getAttribute('position').count > 0));
  mkdirSync(OUTPUT, { recursive: true });
  writeFileSync(`${OUTPUT}/${name}.glb`, glb);
  const interim = [frontFile, sideFile].some((file) => existsSync(file) && ledger.files?.[file] === sha(file));
  const triangles = meshes.reduce((sum, mesh) => sum + mesh.geometry.getAttribute('position').count / 3, 0);
  return {
    name,
    file: `art/helm/${name}.glb`,
    interim,
    side: !!side,
    triangles,
    bytes: glb.length,
    shapes: shapes.length,
    visorHoles: shapes.reduce((n, s) => n + s.holes.length, 0),
  };
}

async function main() {
  const requested = process.argv.slice(2);
  const available = readdirSync(SOURCE)
    .filter((file) => file.endsWith('-front.png'))
    .map((file) => file.replace('-front.png', ''));
  const names = requested.length ? requested : available;
  const config = existsSync(`${SOURCE}/helms.json`) ? JSON.parse(readFileSync(`${SOURCE}/helms.json`, 'utf8')) : {};
  const ledger = existsSync(`${SOURCE}/interim.json`) ? JSON.parse(readFileSync(`${SOURCE}/interim.json`, 'utf8')) : {};
  const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
  manifest.helms = manifest.helms ?? {};
  for (const name of names) {
    const result = await traceHelm(name, config, ledger);
    manifest.pieces[`helm/${name}`] = result.file;
    manifest.helms[name] = { interim: result.interim, sideProfile: result.side, triangles: result.triangles };
    console.log(
      `HELM ${name}: ${result.triangles} tris, ${(result.bytes / 1024).toFixed(0)} KB, ${result.visorHoles} visor cut(s)${result.side ? ', side profile' : ', dome fallback'}${result.interim ? ' [interim]' : ''}`,
    );
  }
  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`TRACE PASS ${names.length} helm(s) exported to ${path.relative('.', OUTPUT)}`);
}

await main();
