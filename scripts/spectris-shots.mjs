// Visual proofs: title, helm line-up (+64px silhouette strip), and every stage at the
// default gameplay camera. Usage: node scripts/spectris-shots.mjs [title|lineup|stages ...] [--out dir]
import { mkdirSync } from 'node:fs';
import { openBrowser, serve } from './spectris-browser.mjs';

const args = process.argv.slice(2);
const outIndex = args.indexOf('--out');
const OUT = outIndex >= 0 ? args[outIndex + 1] : 'apps/spectris/proofs/art';
const wanted = new Set(args.filter((arg, i) => !arg.startsWith('--') && (outIndex < 0 || i !== outIndex + 1)));
const all = wanted.size === 0;
const STAGES = [
  'mirror-sanctum',
  'eclipse',
  'fault-screen',
  'stillwater',
  'bell-foundry',
  'skyreach',
  'hollow-throne',
  'unsworn',
  'pilgrimage',
];
mkdirSync(OUT, { recursive: true });

const server = await serve();
const { browser, page, errors } = await openBrowser();
const settle = (ms) => page.waitForTimeout(ms);
try {
  if (all || wanted.has('title')) {
    await page.goto(server.url);
    await settle(4000);
    await page.screenshot({ path: `${OUT}/title.png` });
    console.log('shot title');
  }
  if (all || wanted.has('lineup')) {
    for (const mode of ['', 'silhouette']) {
      await page.goto(`${server.url}lineup.html${mode ? '?silhouette' : ''}`);
      await settle(3500);
      await page.screenshot({ path: `${OUT}/lineup${mode ? '-silhouette' : ''}.png` });
    }
    console.log('shot lineup');
  }
  if (all || wanted.has('stages')) {
    await page.goto(server.url);
    await settle(1500);
    for (const stage of STAGES) {
      const format = stage === 'pilgrimage' ? 'momentum' : 'training';
      await page.evaluate(
        ([stageId, fmt]) => window.__spectris.configure({ stage: stageId, format: fmt, cpu: [0, 4], timer: 0 }),
        [stage, format],
      );
      await page.evaluate(() => window.__spectris.step(150));
      await settle(2600);
      await page.screenshot({ path: `${OUT}/stage-${stage}.png` });
      console.log(`shot ${stage}`);
    }
  }
} finally {
  if (errors.length) console.log('PAGE ERRORS', errors.slice(0, 5));
  await browser.close();
  server.close();
}
