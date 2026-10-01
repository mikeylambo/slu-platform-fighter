import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { StrainFractures } from './life.js';

const life = new StrainFractures({
  lives: 4,
  threshold: 1000,
  crackTiers: [250, 500, 1000, 1500],
  maxStrain: 9990,
  respawnFrames: 45,
  respawnIntangibility: 90,
});

describe('life-system: Strain + Fractures', () => {
  it('loses a life to blast zones or Shatter at the threshold', () => {
    assert.equal(life.losesLife({ damage: 0, lethal: false, outside: true }), true);
    assert.equal(life.losesLife({ damage: 999, lethal: true, outside: false }), false);
    assert.equal(life.losesLife({ damage: 1000, lethal: true, outside: false }), true);
    assert.equal(life.losesLife({ damage: 5000, lethal: false, outside: false }), false);
  });

  it('counts down lives, tiers cracks, clamps Strain', () => {
    assert.deepEqual(life.takeLife(1), { remaining: 0, eliminated: true });
    assert.equal(life.roundLost(0), true);
    assert.deepEqual(
      [0, 250, 600, 1200, 2000].map((strain) => life.damageTier(strain)),
      [0, 1, 2, 3, 4],
    );
    assert.equal(life.clampDamage(12000), 9990);
    assert.equal(life.respawn().intangibleFrames, 90);
  });
});
