// Two-tab online test: two pages in one browser meet on a room code (same-browser
// BroadcastChannel signaling, `?signal=local`), connect over WebRTC, and play with rollback.
// Passes when both peers advance past the target frame with zero state-hash desyncs.
import { writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { serve } from './spectris-browser.mjs';

const TARGET = Number(process.argv[2] ?? 600);
const server = await serve();
const browser = await chromium.launch({
  executablePath: process.env.SPECTRIS_CHROMIUM ?? '/opt/pw-browsers/chromium',
  args: [
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--disable-features=WebRtcHideLocalIpsWithMdns',
    '--allow-loopback-in-peer-connection',
  ],
});
const context = await browser.newContext({ viewport: { width: 960, height: 600 } });
const [host, guest] = [await context.newPage(), await context.newPage()];
const errors = [];
for (const page of [host, guest]) page.on('pageerror', (error) => errors.push(String(error)));
const report = {
  target: TARGET,
  transport: 'BroadcastChannel signaling + real RTCPeerConnection (same browser)',
  errors,
};
try {
  for (const page of [host, guest]) {
    await page.goto(`${server.url}?signal=local`);
    await page.waitForTimeout(1200);
    await page.click('#online');
  }
  await host.click('#room-host');
  await host.waitForFunction(() => (document.querySelector('#room-display')?.textContent ?? '').length > 0);
  const code = await host.textContent('#room-display');
  report.room = code;
  await guest.fill('#room-code', code);
  await guest.click('#room-join');
  await host.waitForFunction(() => window.__spectris.online()?.ready === true, null, { timeout: 30000 });
  await guest.waitForFunction(() => window.__spectris.online()?.ready === true, null, { timeout: 30000 });
  // Host walks and attacks while the guest jumps, so both inputs travel and roll back.
  await host.keyboard.down('KeyD');
  await guest.keyboard.down('KeyA');
  const press = async (page, key) => {
    await page.keyboard.down(key);
    await page.waitForTimeout(60);
    await page.keyboard.up(key);
  };
  const started = Date.now();
  while (Date.now() - started < 240000) {
    await press(host, 'KeyJ');
    await press(guest, 'Space');
    const frames = await Promise.all(
      [host, guest].map((page) => page.evaluate(() => window.__spectris.online()?.frame ?? 0)),
    );
    if (Math.min(...frames) >= TARGET) break;
  }
  report.host = await host.evaluate(() => window.__spectris.online());
  report.guest = await guest.evaluate(() => window.__spectris.online());
  await host.screenshot({ path: 'apps/spectris/proofs/online-host.png' });
  await guest.screenshot({ path: 'apps/spectris/proofs/online-guest.png' });
  report.pass =
    report.host.frame >= TARGET &&
    report.guest.frame >= TARGET &&
    report.host.desyncs === 0 &&
    report.guest.desyncs === 0;
} catch (error) {
  report.error = String(error);
  report.host = await host.evaluate(() => window.__spectris.online()).catch(() => null);
  report.guest = await guest.evaluate(() => window.__spectris.online()).catch(() => null);
  report.pass = false;
} finally {
  writeFileSync('apps/spectris/proofs/online-two-tab.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
  server.close();
  if (!report.pass) process.exitCode = 1;
}
