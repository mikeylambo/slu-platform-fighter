import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  flashStance,
  parseStanceMoveId,
  requestStance,
  StanceMoveTable,
  tickStance,
  type StanceRules,
} from './stance.js';

const rules: StanceRules = { ids: ['wings', 'cape'], unfurlFrames: 6, airborneSwitches: 'once' };

describe('stance', () => {
  it('switches with an unfurl window and once per airborne stint', () => {
    const state = { id: 'wings', unfurl: 0, switchedAirborne: false };
    const switched = requestStance(state, rules, true);
    assert.deepEqual(switched, { id: 'cape', unfurl: 6, switchedAirborne: true });
    const settled = flashStance(switched);
    assert.equal(requestStance(settled, rules, true), settled);
    assert.equal(tickStance(settled, true).switchedAirborne, false);
  });

  it('looks moves up per stance', () => {
    const table = new StanceMoveTable<string>(['wings', 'cape']);
    table.setShared('jab', 'Gauntlet Flurry');
    table.set('wings', 'forward-air', 'Tri-Lunge');
    table.set('cape', 'forward-air', 'Cleave');
    assert.equal(table.lookup('cape', 'forward-air'), 'Cleave');
    assert.equal(table.lookup('wings', 'jab'), 'Gauntlet Flurry');
    assert.deepEqual(table.keys('cape').sort(), ['forward-air', 'jab']);
    assert.deepEqual(parseStanceMoveId('wings:sling'), { stance: 'wings', move: 'sling' });
  });
});
