// Vigil proof: a scripted input run completes all ten lessons of the first-launch tutorial,
// with a screenshot captured at the start of every lesson.
import { mkdirSync, writeFileSync } from 'node:fs';
import { openBrowser, serve } from './spectris-browser.mjs';

const OUT = 'apps/spectris/proofs/vigil';
mkdirSync(OUT, { recursive: true });
const N = (frames, input = {}) => Array.from({ length: frames }, () => ({ ...input }));
const press = (input) => [{ ...input }];

/** Inputs for one attempt at a lesson, given the Knight's current state. */
function plan(lesson, s, attempt) {
  const toward = s.p2x > s.x ? 1000 : -1000;
  switch (lesson) {
    case 0:
      return [...N(36, { moveX: 1000 }), ...press({ jumpPressed: true, jumpHeld: true }), ...N(12, { jumpHeld: true })];
    case 1:
      return [
        ...press({ jumpPressed: true, jumpHeld: true }),
        ...N(10, { jumpHeld: true }),
        ...[0, 1, 2].flatMap(() => [
          ...N(3),
          ...press({ jumpPressed: true, jumpHeld: true }),
          ...N(10, { jumpHeld: true }),
        ]),
        ...N(40, { jumpHeld: true }),
      ];
    case 2:
      return [...press({ auxiliaryButtons: 1 }), ...N(10)];
    case 3: {
      // The reflection's staged Longreach lands on cycle frame 13; guard from frame 11 so the
      // hit meets the first (parry) frames. Decided frame by frame from the live cycle phase.
      const phase = (((s.elapsed - 1) % 100) + 100) % 100;
      if (!s.grounded) return N(1);
      return [{ shieldHeld: phase >= 11 && phase < 25 }];
    }
    case 4:
      return [...press({ auxiliaryButtons: 1 }), ...N(12), ...press({ dodgePressed: true }), ...N(8)];
    case 5:
      return Math.abs(s.p2x - s.x) > 1.8
        ? N(6, { moveX: toward })
        : [...press({ grabPressed: true }), ...N(9), ...N(6, { moveX: toward }), ...N(10)];
    case 6:
      return N(20);
    case 7:
      return s.stance !== 'wings'
        ? [...press({ auxiliaryButtons: 1 }), ...N(10)]
        : [...press({ specialPressed: true }), ...N(30), ...press({ specialPressed: true }), ...N(60)];
    case 8: {
      if (s.grounded && Math.abs(s.x) < 15.5 && attempt < 40) return N(4, { moveX: s.x >= 0 ? 1000 : -1000 });
      const home = s.x > 0 ? -1000 : 1000;
      return [
        ...N(4, { moveX: s.x >= 0 ? 1000 : -1000 }),
        ...press({ moveX: home, jumpPressed: true, jumpHeld: true }),
        ...N(14, { moveX: home, jumpHeld: true }),
        ...N(10, { moveX: home }),
      ];
    }
    case 9:
      return [...press({ specialPressed: true, shieldHeld: true }), ...N(10)];
    default:
      return N(10);
  }
}

const server = await serve();
const { browser, page, errors } = await openBrowser();
const lessons = [];
try {
  await page.goto(server.url);
  await page.waitForTimeout(1500);
  await page.click('#vigil');
  await page.evaluate(() => window.__spectris.pause());
  let lesson = 0;
  let attempt = 0;
  let started = Date.now();
  await page.waitForTimeout(1600);
  await page.screenshot({ path: `${OUT}/lesson-01.png` });
  while (lesson >= 0 && attempt < 1500) {
    const state = await page.evaluate(() => window.__spectris.vigil());
    if (state.lesson !== lesson) {
      lessons.push({ lesson: lesson + 1, attempts: attempt, seconds: (Date.now() - started) / 1000 });
      console.log(`VIGIL lesson ${lesson + 1} complete after ${attempt} attempts`);
      lesson = state.lesson;
      attempt = 0;
      started = Date.now();
      if (lesson < 0) break;
      await page.evaluate(() => window.__spectris.pause());
      await page.waitForTimeout(900);
      await page.screenshot({ path: `${OUT}/lesson-${String(lesson + 1).padStart(2, '0')}.png` });
      continue;
    }
    const inputs = plan(lesson, state, attempt);
    // Feed one frame at a time and stop as soon as the lesson changes, so every lesson
    // (even one finished instantly) gets its own screenshot.
    await page.evaluate((queue) => {
      const hooks = window.__spectris;
      const start = hooks.vigil().lesson;
      for (const input of queue) {
        hooks.script([input]);
        hooks.step(1);
        if (hooks.vigil().lesson !== start) break;
      }
    }, inputs);
    attempt++;
  }
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT}/complete.png` });
} finally {
  const report = { completed: lessons.length === 10, lessons, errors };
  writeFileSync(`${OUT}/run.json`, JSON.stringify(report, null, 2) + '\n');
  console.log(`VIGIL ${report.completed ? 'PASS' : 'FAIL'} ${lessons.length}/10 lessons`);
  await browser.close();
  server.close();
  if (!report.completed) process.exitCode = 1;
}
