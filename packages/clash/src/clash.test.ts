import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  clashOutcomes,
  detectClash,
  readClashChoice,
  resolveClash,
  tickClashWindow,
  type ClashRules,
} from './clash.js';

const rules: ClashRules = {
  strainGap: 2,
  window: 2,
  advantage: 20,
  winnerMeter: 15,
  loserMeter: 5,
  loserChip: 15,
  defaultChoice: 'press',
  stickThreshold: 400,
};

describe('clash', () => {
  it('detects clashes within the Strain gap and heavier wins beyond it', () => {
    assert.deepEqual(detectClash(10, 12, rules), { kind: 'clash' });
    assert.deepEqual(detectClash(10, 18, rules), { kind: 'heavier', winner: 1 });
  });

  it('resolves the rock-paper-scissors triangle', () => {
    assert.equal(resolveClash('parry', 'press'), 0);
    assert.equal(resolveClash('press', 'slip'), 0);
    assert.equal(resolveClash('slip', 'parry'), 0);
    assert.equal(resolveClash('press', 'parry'), 1);
    assert.equal(resolveClash('slip', 'slip'), null);
  });

  it('reads choices relative to facing and pays outcomes', () => {
    assert.equal(readClashChoice({ moveX: 1000, moveY: 0 }, -1, 'press', rules), 'parry');
    assert.equal(readClashChoice({ moveX: 0, moveY: -1000 }, 1, 'press', rules), 'slip');
    assert.equal(readClashChoice({ moveX: 0, moveY: 0 }, 1, 'parry', rules), 'parry');
    const [a, b] = clashOutcomes(0, rules);
    assert.equal(a.meter, 15);
    assert.equal(b.stagger, 20);
    assert.equal(b.chip, 15);
    const window = { remaining: 2 };
    assert.equal(tickClashWindow(window), false);
    assert.equal(tickClashWindow(window), true);
  });
});
