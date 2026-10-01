import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  canGainMeter,
  feintCost,
  guardChip,
  ignite,
  isDoubleIgnite,
  notifyHit,
  requestFinisher,
  resolveDoubleIgnite,
  tickSoulfire,
  type SoulfirePack,
} from './soulfire.js';

const pack: SoulfirePack<{ hits: number }> = {
  duration: 3,
  activation: 1,
  cost: 100,
  guardChip: 2,
  freeFeints: true,
  finisher: { moveKey: 'finale' },
  doubleIgnite: 'clash',
  hooks: {
    onHit: (context) => {
      context.hits++;
    },
    onEnd: (context) => {
      context.hits = -1;
    },
  },
};

describe('soulfire', () => {
  it('ignites only with enough meter and runs out with onEnd', () => {
    assert.equal(ignite(pack, 99), null);
    const lit = ignite(pack, 150)!;
    assert.equal(lit.meter, 50);
    const context = { hits: 0 };
    let state = lit.state;
    for (let n = 0; n < 3; n++) state = tickSoulfire(state, pack, context);
    assert.equal(state.remaining, 0);
    assert.equal(context.hits, -1);
  });

  it('applies chip, feint, meter-gain rules and hooks only while active', () => {
    const state = ignite(pack, 100)!.state;
    assert.equal(guardChip(pack, state, 10), 20);
    assert.equal(feintCost(pack, state, 25), 0);
    assert.equal(canGainMeter(pack, state), false);
    const context = { hits: 0 };
    notifyHit(pack, state, context);
    assert.equal(context.hits, 1);
    const finisher = requestFinisher(pack, state)!;
    assert.equal(finisher.moveKey, 'finale');
    assert.equal(finisher.state.remaining, 0);
  });

  it('double ignition: winner keeps, tie cancels both', () => {
    const state = ignite(pack, 100)!.state;
    assert.equal(isDoubleIgnite([state, state]), true);
    const won = resolveDoubleIgnite('clash', [state, state], 1);
    assert.deepEqual(
      won.map((s) => s.remaining > 0),
      [false, true],
    );
    assert.ok(resolveDoubleIgnite('clash', [state, state], null).every((s) => s.remaining === 0));
  });
});
