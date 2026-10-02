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
    title: 'Duelist (v2 refined #01) — base Knight, Unsworn · drawn from the v2 sheet',
    body: [
      'M256 210 C318 210 354 250 356 300 L392 336 L352 352 L330 404 L256 470 L182 404 L160 352 L120 336 L156 300 C158 250 194 210 256 210 Z',
      // The great swept crescent: rises from the brow and hooks over to the right.
      'M200 244 C194 150 252 72 340 50 C384 40 424 62 444 100 C412 82 370 80 336 98 C298 122 286 172 298 222 Z',
    ],
    visor: ['M178 290 L248 334 L256 350 L264 334 L334 290 L338 306 L268 358 L256 378 L244 358 L174 306 Z'],
    side: [SIDE_BODY, 'M340 236 C312 150 230 72 118 58 C172 92 204 150 224 222 Z'],
  },
  sentinel: {
    title: 'Sentinel (v2 refined #02) — Iron · drawn from the v2 sheet',
    body: [
      'M256 198 L332 228 L354 302 L330 384 L256 452 L182 384 L158 302 L180 228 Z',
      'M243 206 L256 26 L269 206 Z',
      'M212 216 L220 92 L236 210 Z',
      mirror('M212 216 L220 92 L236 210 Z'),
      'M188 234 L182 146 L206 226 Z',
      mirror('M188 234 L182 146 L206 226 Z'),
      // Gold crescents flanking the crown (floating).
      'M146 304 C104 252 114 176 168 144 C148 190 150 244 174 286 Z',
      mirror('M146 304 C104 252 114 176 168 144 C148 190 150 244 174 286 Z'),
    ],
    visor: ['M188 300 L250 326 L256 340 L262 326 L324 300 L326 314 L264 346 L256 362 L248 346 L186 314 Z'],
    side: [SIDE_BODY, 'M262 180 L250 30 L280 30 L292 180 Z'],
  },
  reaper: {
    title: 'Reaper (v2 refined #03) — Ember · drawn from the v2 sheet',
    body: [
      'M256 214 C312 214 346 254 346 304 L334 380 L256 462 L178 380 L166 304 C166 254 200 214 256 214 Z',
      // Scythe crest sweeping back over the right shoulder.
      'M198 254 C178 144 262 58 384 46 C436 42 474 80 484 124 L456 110 L446 134 L420 108 L404 132 L382 112 C330 136 302 184 312 240 L290 214 L296 252 Z',
      // Flames on both flanks, larger on the left.
      mirror('M196 330 L150 304 L176 348 L144 360 L192 372 Z'),
      // Ragged flames licking off the left side.
      'M176 300 L118 262 L152 314 L104 324 L158 348 L120 380 L180 364 Z',
    ],
    visor: ['M184 300 L248 332 L248 350 L180 318 Z', mirror('M184 300 L248 332 L248 350 L180 318 Z')],
    side: [SIDE_BODY, 'M236 222 C200 130 150 70 70 56 C120 92 160 150 196 222 Z'],
  },
  herald: {
    title: 'Herald (v2 refined #04) — Stillness · drawn from the v2 sheet',
    body: [
      'M256 212 C312 212 346 252 346 302 L330 382 L256 452 L182 382 L166 302 C166 252 200 212 256 212 Z',
      // Spire with a crossbar, then the broken halo as two floating arcs.
      'M247 216 L256 24 L265 216 Z',
      'M218 112 L294 112 L294 126 L218 126 Z',
      'M148 262 C114 196 146 120 222 92 C180 130 164 192 182 252 Z',
      mirror('M148 262 C114 196 146 120 222 92 C180 130 164 192 182 252 Z'),
      // Broad pale wing-plates at the jaw.
      'M184 352 L84 318 L150 396 Z',
      mirror('M184 352 L84 318 L150 396 Z'),
    ],
    visor: ['M190 302 L250 330 L256 342 L262 330 L322 302 L324 316 L262 350 L256 364 L250 350 L188 316 Z'],
    side: [SIDE_BODY, 'M232 230 L196 40 L230 40 L262 214 Z'],
  },
  inquisitor: {
    title: 'Inquisitor (v2 refined #05) — Hunger · drawn from the v2 sheet',
    body: [
      'M256 118 L332 230 L350 322 L322 402 L256 462 L190 402 L162 322 L180 230 Z',
      'M249 124 L256 16 L263 124 Z',
      // Halo fragments and floating side blades.
      'M166 196 C154 140 196 98 240 88 C210 112 192 150 196 190 Z',
      mirror('M166 196 C154 140 196 98 240 88 C210 112 192 150 196 190 Z'),
      'M116 256 L138 196 L160 256 L138 330 Z',
      mirror('M116 256 L138 196 L160 256 L138 330 Z'),
    ],
    visor: ['M192 300 L250 326 L256 338 L262 326 L320 300 L322 314 L262 346 L256 360 L250 346 L190 314 Z'],
    side: [
      'M190 40 C270 120 372 176 376 284 L366 380 L330 452 L260 480 L196 440 L160 360 L148 280 C150 200 168 120 190 40 Z',
    ],
  },
  vanguard: {
    title: 'Vanguard (v2 refined #06) — Gale · drawn from the v2 sheet',
    body: [
      'M256 200 L326 226 L350 302 L322 392 L256 452 L190 392 L162 302 L186 226 Z',
      // Swept blade horns, the right one larger, both raking back.
      'M292 224 L444 54 L432 152 L362 238 L344 296 Z',
      'M218 224 L112 104 L144 204 L172 286 Z',
    ],
    visor: ['M184 292 L250 326 L256 340 L262 326 L328 292 L330 308 L262 350 L256 366 L250 350 L182 308 Z'],
    side: [SIDE_BODY, 'M220 230 C170 180 120 110 96 40 C150 100 200 150 260 196 Z'],
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
  'Interim silhouettes: the six refined helms are redrawn by eye from the v2 concept sheet (shared in chat, no file); the Glitch crest is authored from the GDD. Any file whose hash differs from this ledger is treated as a final render.';
writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2) + '\n');
console.log(`HELM SOURCES ${written.length} interim PNGs written to ${OUT}`);
