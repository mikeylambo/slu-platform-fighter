// Composes Step 3 proof images from the line-up screenshots:
//   duelist-side-by-side.png  interim Duelist source | in-game Duelist | in-game silhouette
//   helm-strip-64.png         every Oath Knight at 64 px tall, colour row + solid silhouette row
// Run after `node scripts/spectris-shots.mjs lineup`.
import { readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';

const DIR = 'apps/spectris/proofs/art';
const COUNT = 7;
const read = (file) => PNG.sync.read(readFileSync(file));

function crop(png, x0, y0, width, height) {
  const out = new PNG({ width, height });
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const source = ((y0 + y) * png.width + (x0 + x)) * 4;
      const target = (y * width + x) * 4;
      png.data.copy(out.data, target, source, source + 4);
    }
  }
  return out;
}

/** Area-average resize (box filter), good for honest downscaling. */
function resize(png, width, height) {
  const out = new PNG({ width, height });
  const sx = png.width / width;
  const sy = png.height / height;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const sum = [0, 0, 0, 0];
      let n = 0;
      for (let yy = Math.floor(y * sy); yy < Math.min(png.height, Math.ceil((y + 1) * sy)); yy++) {
        for (let xx = Math.floor(x * sx); xx < Math.min(png.width, Math.ceil((x + 1) * sx)); xx++) {
          const i = (yy * png.width + xx) * 4;
          for (let c = 0; c < 4; c++) sum[c] += png.data[i + c];
          n++;
        }
      }
      for (let c = 0; c < 4; c++) out.data[(y * width + x) * 4 + c] = Math.round(sum[c] / Math.max(1, n));
    }
  }
  return out;
}

function blank(width, height, rgb) {
  const out = new PNG({ width, height });
  for (let i = 0; i < width * height; i++) out.data.set([...rgb, 255], i * 4);
  return out;
}

function paste(target, source, x0, y0) {
  for (let y = 0; y < source.height; y++) {
    for (let x = 0; x < source.width; x++) {
      const s = (y * source.width + x) * 4;
      const t = ((y0 + y) * target.width + (x0 + x)) * 4;
      source.data.copy(target.data, t, s, s + 4);
    }
  }
}

/** Bounding box of pixels that differ from the background colour. */
function bounds(png, background, x0 = 0, x1 = png.width) {
  let top = png.height;
  let bottom = 0;
  let left = x1;
  let right = x0;
  for (let y = 0; y < png.height; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * png.width + x) * 4;
      const distance =
        Math.abs(png.data[i] - background[0]) +
        Math.abs(png.data[i + 1] - background[1]) +
        Math.abs(png.data[i + 2] - background[2]);
      if (distance > 40) {
        top = Math.min(top, y);
        bottom = Math.max(bottom, y + 1);
        left = Math.min(left, x);
        right = Math.max(right, x + 1);
      }
    }
  }
  return { left, right, top, bottom };
}

const colour = read(`${DIR}/lineup.png`);
const solid = read(`${DIR}/lineup-silhouette.png`);
const cell = colour.width / COUNT;
const cells = [];
for (let i = 0; i < COUNT; i++) {
  const box = bounds(solid, [255, 255, 255], Math.round(i * cell), Math.round((i + 1) * cell));
  cells.push(box);
}
const top = Math.min(...cells.map((c) => c.top));
const bottom = Math.max(...cells.map((c) => c.bottom));
const knight = (png, box) => crop(png, box.left, top, box.right - box.left, bottom - top);

// 64 px strip: colour row over a solid-silhouette row, each Knight scaled to exactly 64 px tall.
const height = 64;
const scaled = (png, box) => {
  const piece = knight(png, box);
  return resize(piece, Math.max(1, Math.round((piece.width * height) / piece.height)), height);
};
const colourRow = cells.map((box) => scaled(colour, box));
const solidRow = cells.map((box) => scaled(solid, box));
const gap = 14;
const stripWidth = colourRow.reduce((sum, png) => sum + png.width + gap, gap);
const strip = blank(stripWidth, height * 2 + gap * 3, [217, 222, 226]);
let x = gap;
colourRow.forEach((png, i) => {
  paste(strip, png, x, gap);
  paste(strip, solidRow[i], x, height + gap * 2);
  x += png.width + gap;
});
writeFileSync(`${DIR}/helm-strip-64.png`, PNG.sync.write(strip));

// Side-by-side: interim Duelist source | in-game Duelist (title pose) | in-game silhouette.
const panel = 420;
const source = read('apps/spectris/art/source/helm/duelist-front.png');
const sourceBox = bounds(source, [255, 255, 255]);
const fit = (png) => {
  const scale = Math.min((panel - 40) / png.width, (panel - 40) / png.height);
  return resize(png, Math.round(png.width * scale), Math.round(png.height * scale));
};
const panels = [
  fit(crop(source, sourceBox.left, sourceBox.top, sourceBox.right - sourceBox.left, sourceBox.bottom - sourceBox.top)),
  fit(knight(colour, cells[0])),
  fit(knight(solid, cells[0])),
];
const side = blank(panel * 3, panel, [217, 222, 226]);
panels.forEach((png, i) =>
  paste(side, png, i * panel + Math.round((panel - png.width) / 2), Math.round((panel - png.height) / 2)),
);
writeFileSync(`${DIR}/duelist-side-by-side.png`, PNG.sync.write(side));
console.log(`ART PROOFS: helm-strip-64.png (${strip.width}x${strip.height}), duelist-side-by-side.png`);
