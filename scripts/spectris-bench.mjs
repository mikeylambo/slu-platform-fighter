// Runs `?bench` in headless Chromium and saves the result to proofs/bench-<label>.json.
// Usage: node scripts/spectris-bench.mjs <label> [seconds]
import { writeFileSync } from 'node:fs';
import { openBrowser, serve } from './spectris-browser.mjs';

const label = process.argv[2] ?? 'run';
const seconds = Number(process.argv[3] ?? 10);
const server = await serve();
const { browser, page, errors } = await openBrowser();
try {
  await page.goto(`${server.url}?bench&seconds=${seconds}`);
  await page.waitForFunction(() => 'window' in globalThis && '__benchResult' in window, null, {
    timeout: seconds * 60 * 1000,
    polling: 1000,
  });
  const result = await page.evaluate(() => window.__benchResult);
  await page.screenshot({ path: `apps/spectris/proofs/bench-${label}.png` });
  const record = {
    label,
    seconds,
    renderer: 'Headless Chromium + SwiftShader (software): relative only',
    result,
    errors,
  };
  writeFileSync(`apps/spectris/proofs/bench-${label}.json`, JSON.stringify(record, null, 2) + '\n');
  console.log(JSON.stringify(record.result, null, 2));
} finally {
  await browser.close();
  server.close();
}
