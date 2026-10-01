// Interim helm sources for the trace pipeline.
//
// Michael's v2 concept sheet was not delivered with the continuation brief, so these
// black-on-white silhouettes are authored from the GDD descriptions (section 5 and the
// refined-concept names). Front views draw the visor as a hole; side views face right.
// They are written to art/source/helm/<name>-front.png / -side.png and fingerprinted in
// interim.json. Dropping in a real render (any file whose hash differs) replaces an
// interim source with zero code changes: rerun `npm run spectris:helms`.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';

const OUT = 'apps/spectris/art/source/helm';
const SIZE = 512;

const mirror = (path) =>
  path.replace(/(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g, (_, x, y) => `${SIZE - Number(x)} ${y}`);

/** Radiant crown: spikes on an arc (Herald). */
function rays(cx, cy, inner, outer, from, to, count) {
  const points = [];
  for (let i = 0; i <= count * 2; i++) {
    const angle = ((from + ((to - from) * i) / (count * 2)) * Math.PI) / 180;
    const radius = i % 2 ? outer : inner;
    points.push(`${(cx + Math.cos(angle) * radius).toFixed(1)} ${(cy + Math.sin(angle) * radius).toFixed(1)}`);
  }
  return `M${cx} ${cy} L${points.join(' L')} Z`;
}

const rect = (x, y, w, h) => `M${x} ${y} L${x + w} ${y} L${x + w} ${y + h} L${x} ${y + h} Z`;

const SIDE_BODY =
  'M256 168 C332 168 372 222 372 292 L366 362 L344 418 L300 470 L236 476 L190 430 L160 368 L148 292 C148 222 188 168 256 168 Z';

/** Each helm: black silhouette paths, white visor (hole) paths, and a side profile. */
const HELMS = {
  duelist: {
    title: 'Duelist (v2 #01) — base Knight, Unsworn',
    body: [
      'M256 166 C322 166 364 212 366 276 L388 318 L360 340 L340 398 L256 482 L172 398 L152 340 L124 318 L146 276 C148 212 190 166 256 166 Z',
      // Swept flame-crest blade, flicking to the right.
      'M224 228 C218 150 242 84 302 18 C294 72 306 104 334 84 C322 140 308 182 290 228 Z',
    ],
    visor: ['M176 266 L248 316 L256 334 L264 316 L336 266 L340 284 L268 342 L256 364 L244 342 L172 284 Z'],
    side: [
      SIDE_BODY,
      'M340 236 C300 150 240 92 140 38 C196 100 214 148 236 184 C206 176 184 180 164 196 C196 204 222 222 240 246 Z',
    ],
  },
  sentinel: {
    title: 'Sentinel (v2 #02) — Iron',
    body: [
      'M138 150 L374 150 L386 262 L378 382 L332 452 L256 476 L180 452 L134 382 L126 262 Z',
      rect(140, 78, 34, 80),
      rect(188, 104, 34, 54),
      rect(239, 64, 34, 94),
      rect(290, 104, 34, 54),
      rect(338, 78, 34, 80),
    ],
    visor: ['M166 262 L346 262 L346 292 L272 292 L272 386 L240 386 L240 292 L166 292 Z'],
    side: ['M140 160 L376 160 L384 280 L370 400 L320 466 L230 478 L170 430 L142 340 Z', rect(150, 80, 220, 90)],
  },
  reaper: {
    title: 'Reaper (v2 #03) — Ember',
    body: [
      'M256 190 C310 190 342 230 344 290 L334 370 L300 430 L256 472 L212 430 L178 370 L168 290 C170 230 202 190 256 190 Z',
      'M194 236 C138 214 96 160 86 56 C112 112 138 136 176 140 C152 154 166 186 222 204 Z',
      mirror('M194 236 C138 214 96 160 86 56 C112 112 138 136 176 140 C152 154 166 186 222 204 Z'),
    ],
    visor: ['M190 286 L248 312 L248 330 L186 304 Z', mirror('M190 286 L248 312 L248 330 L186 304 Z')],
    side: [SIDE_BODY, 'M232 214 C176 194 132 142 118 52 C150 108 196 140 262 176 Z'],
  },
  herald: {
    title: 'Herald (v2 #04) — Stillness',
    body: [
      'M256 170 C326 170 358 220 358 290 C358 370 316 440 256 472 C196 440 154 370 154 290 C154 220 186 170 256 170 Z',
      rays(256, 262, 146, 236, 204, 336, 7),
    ],
    visor: ['M178 294 Q256 318 334 294 L334 312 Q256 336 178 312 Z'],
    side: [SIDE_BODY, 'M196 236 L150 52 L214 48 L262 210 Z'],
  },
  inquisitor: {
    title: 'Inquisitor (v2 #05) — Hunger',
    body: [
      'M256 34 C304 120 364 172 374 262 L372 382 L332 452 L256 482 L180 452 L140 382 L138 262 C148 172 208 120 256 34 Z',
    ],
    visor: [rect(246, 246, 20, 120), rect(200, 278, 112, 16)],
    side: [
      'M190 40 C270 120 372 176 376 284 L366 380 L330 452 L260 480 L196 440 L160 360 L148 280 C150 200 168 120 190 40 Z',
    ],
  },
  vanguard: {
    title: 'Vanguard (v2 #06) — Gale',
    body: [
      'M256 176 C318 176 352 222 352 286 L344 370 L304 436 L256 468 L208 436 L168 370 L160 286 C160 222 194 176 256 176 Z',
      'M174 254 C120 232 76 178 52 100 C92 134 116 146 140 146 C118 126 108 104 106 80 C142 124 174 168 204 214 Z',
      mirror(
        'M174 254 C120 232 76 178 52 100 C92 134 116 146 140 146 C118 126 108 104 106 80 C142 124 174 168 204 214 Z',
      ),
      'M244 182 L256 112 L268 182 Z',
    ],
    visor: ['M182 280 L256 302 L330 280 L330 298 L256 322 L182 298 Z'],
    side: [SIDE_BODY, 'M206 236 C152 206 108 154 82 84 C138 128 186 158 250 190 Z'],
  },
  glitch: {
    title: 'Glitch crest (to be designed from v2 #14/#23) — Static',
    body: [
      'M256 170 C318 170 356 214 358 280 L352 360 L316 424 L256 472 L196 424 L160 360 L154 280 C156 214 194 170 256 170 Z',
      rect(236, 128, 42, 48),
      rect(250, 94, 46, 40),
      rect(226, 62, 38, 38),
      rect(258, 30, 30, 36),
      rect(210, 108, 26, 26),
      rect(352, 246, 26, 22),
      rect(136, 312, 22, 24),
    ],
    visor: [rect(180, 274, 54, 18), rect(240, 284, 34, 18), rect(280, 270, 54, 18)],
    side: [SIDE_BODY, rect(230, 90, 60, 90), rect(200, 50, 50, 50), rect(250, 30, 30, 30)],
  },
};

function svg(paths, holes = []) {
  const black = paths.map((d) => `<path d="${d}" fill="#000"/>`).join('');
  const white = holes.map((d) => `<path d="${d}" fill="#fff"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}"><rect width="${SIZE}" height="${SIZE}" fill="#fff"/>${black}${white}</svg>`;
}

const sha = (buffer) => createHash('sha256').update(buffer).digest('hex');

mkdirSync(OUT, { recursive: true });
const ledgerPath = `${OUT}/interim.json`;
const ledger = existsSync(ledgerPath) ? JSON.parse(readFileSync(ledgerPath, 'utf8')) : { files: {} };
const written = [];
for (const [name, helm] of Object.entries(HELMS)) {
  for (const [view, source] of [
    ['front', svg(helm.body, helm.visor)],
    ['side', svg(helm.side)],
  ]) {
    const file = `${OUT}/${name}-${view}.png`;
    const replaced = existsSync(file) && ledger.files[file] && sha(readFileSync(file)) !== ledger.files[file];
    if (replaced) {
      console.log(`keep ${file} (final render supplied)`);
      continue;
    }
    const png = new Resvg(source, { fitTo: { mode: 'width', value: SIZE } }).render().asPng();
    writeFileSync(file, png);
    ledger.files[file] = sha(png);
    written.push(file);
  }
  ledger.titles = { ...ledger.titles, [name]: helm.title };
}
ledger.note =
  'Interim silhouettes authored from GDD descriptions; the v2 concept sheet was not delivered. Any file whose hash differs from this ledger is treated as a final render.';
writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2) + '\n');
console.log(`HELM SOURCES ${written.length} interim PNGs written to ${OUT}`);
