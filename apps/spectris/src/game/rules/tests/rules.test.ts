import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { fixed as f } from '../../../../../../packages/deterministic-math/src/fixed.js';
import type { HitEvent } from '../../../../../../packages/sim/src/combat.js';
import { DUEL, LIFE } from '../../../content/rules/duel.js';
import { EVADES } from '../../../content/knight/defense.js';
import { SPECIALS, THROWS } from '../../../content/knight/specials.js';
import { OATH_EFFECTS } from '../../../content/rules/oaths.js';
import { bufferInput, clearBuffer } from '../input-buffer.js';
import {
  captureGuard,
  resolveGuardedHit,
  stepEvade,
  stepStagger,
  tickIntegrity,
  tryEvade,
  tryGuard,
} from '../defense.js';
import { holdVictim, stepGrabWindow, stepHolding, tickRegrab, tryGrab } from '../grab.js';
import { findClash, openClash, stepClashWindow } from '../clash.js';
import { gain, siphon, spend } from '../meter.js';
import { stepFeint, tryFeint } from '../feint.js';
import { detectDoubleKindle, kindleOnHit, parryWindow, tickBurn, tryKindle } from '../kindle.js';
import { absorbsHit, becomesHelpless, stepActiveSpecial, stepCleaveCharge, trySpecial } from '../specials/index.js';
import { applyHit, isShatterHit, takeFracture } from '../fractures.js';
import { blastRules, checkRoundEnd, tickClock } from '../rounds.js';
import { stepMomentumFracture } from '../momentum.js';
import { stageById } from '../../../content/stages/roster.js';
import { actorFor, duelFrame, IDS } from './fixtures.js';

const hitEvent = (attackId: string, damage: number, hitboxId = `${attackId}:0`): HitEvent =>
  ({ type: 'hit', attackerId: IDS[0], targetId: IDS[1], attackId, hitboxId, damageTenths: damage }) as HitEvent;

describe('input-buffer', () => {
  it('holds a special press for the buffer window, then drops it', () => {
    const frame = duelFrame();
    const k = frame.d.knights[IDS[0]]!;
    const pressed = bufferInput(k, { ...frame.inputs[IDS[0]]!, specialPressed: true }, 0, 3);
    assert.equal(pressed.specialPressed, true);
    const held = [1, 2, 3].map((n) => bufferInput(k, { ...frame.inputs[IDS[0]]!, frame: n }, n, 3));
    assert.deepEqual(
      held.map((input) => !!input.specialPressed),
      [true, true, false],
    );
    clearBuffer(k);
    assert.equal(k.buffered, null);
  });
});

describe('defense', () => {
  it('regenerates Integrity only after the regen delay', () => {
    const k = duelFrame().d.knights[IDS[0]]!;
    k.integrity = 5000;
    k.regen = 1;
    tickIntegrity(k);
    assert.equal(k.integrity, 5000);
    tickIntegrity(k);
    assert.equal(k.integrity, 5000 + DUEL.guard.regen);
  });

  it('spot dodge is intangible inside its authored window', () => {
    const frame = duelFrame();
    const actor = actorFor(frame, 0, { dodgePressed: true });
    assert.equal(tryEvade(actor), true);
    assert.equal(actor.k.evade, EVADES.spot.frames);
    const intangible: number[] = [];
    for (let elapsed = 1; elapsed <= EVADES.spot.frames; elapsed++) {
      actor.p.invulnerableFrames = 0;
      stepEvade(actor);
      if (actor.p.invulnerableFrames) intangible.push(elapsed);
    }
    assert.equal(intangible[0], EVADES.spot.intangibleFrom);
    assert.equal(intangible.at(-1), EVADES.spot.intangibleTo);
  });

  it('only Cape guards; release locks for the release window', () => {
    const frame = duelFrame();
    assert.equal(tryGuard(actorFor(frame, 0, { shieldHeld: true })), false);
    frame.w.fighters[0]!.definitionId = 'cape';
    const held = actorFor(frame, 0, { shieldHeld: true });
    assert.equal(tryGuard(held), true);
    assert.equal(held.k.guard, 1);
    const released = actorFor(frame, 0, {});
    assert.equal(tryGuard(released), true);
    assert.equal(released.k.guardRelease, DUEL.guard.release);
  });

  it('parries in the window and blocks with chip after it', () => {
    const frame = duelFrame();
    const defender = actorFor(frame, 1);
    defender.p.definitionId = 'cape';
    defender.k.guard = 2;
    defender.p.facing = -1;
    captureGuard(defender);
    const attacker = frame.w.fighters[0]!;
    const before = structuredClone(defender.p);
    assert.equal(
      resolveGuardedHit(
        frame,
        hitEvent('wings:forward-smash', 180),
        defender.p,
        attacker,
        before,
        OATH_EFFECTS.unsworn,
        'unsworn',
      ),
      true,
    );
    assert.equal(defender.k.parries, 1);
    assert.equal(defender.k.meter, DUEL.meter.parry);
    defender.k.guard = DUEL.guard.parry + 1;
    captureGuard(defender);
    resolveGuardedHit(
      frame,
      hitEvent('wings:forward-smash', 180),
      defender.p,
      attacker,
      before,
      OATH_EFFECTS.unsworn,
      'unsworn',
    );
    assert.equal(defender.k.integrity, DUEL.integrity.max - 180 * DUEL.guard.integrityPerTenth);
    assert.equal(defender.p.percentTenths, Math.round(180 * DUEL.guard.strainChip));
  });

  it('guard break stagger resets Integrity when it ends', () => {
    const frame = duelFrame();
    const actor = actorFor(frame, 0);
    actor.k.stagger = 1;
    actor.k.integrity = 0;
    stepStagger(actor);
    assert.equal(actor.k.integrity, DUEL.integrity.afterBreak);
  });
});

describe('grab', () => {
  it('catches an opponent in reach and throws with the stance table', () => {
    const frame = duelFrame();
    frame.w.fighters[0]!.x = f.zero;
    frame.w.fighters[1]!.x = f.fromInt(2);
    const grabber = actorFor(frame, 0, { grabPressed: true });
    assert.equal(tryGrab(grabber), true);
    assert.equal(grabber.k.grab, DUEL.grab.startup);
    for (let n = 0; n < DUEL.grab.startup; n++) stepGrabWindow(actorFor(frame, 0));
    assert.equal(grabber.k.holding, IDS[1]);
    assert.equal(holdVictim(actorFor(frame, 1)), true);
    stepHolding(actorFor(frame, 0, { moveY: 1000 }));
    assert.equal(frame.w.fighters[1]!.percentTenths, THROWS.wings.up.damage);
    assert.equal(grabber.k.holding, null);
  });

  it('regrab memory expires after the regrab window', () => {
    const k = duelFrame().d.knights[IDS[0]]!;
    k.regrabs = 2;
    k.regrab = 1;
    tickRegrab(k);
    assert.equal(k.regrabs, 2);
    tickRegrab(k);
    assert.equal(k.regrabs, 0);
  });
});

describe('meter', () => {
  it('clamps, siphons, spends, and stops while Kindled', () => {
    const frame = duelFrame();
    const [a, b] = [frame.d.knights[IDS[0]]!, frame.d.knights[IDS[1]]!];
    gain(a, DUEL.meter.max * 2);
    assert.equal(a.meter, DUEL.meter.max);
    siphon(a, b, 400);
    assert.equal(b.meter, 400);
    assert.equal(spend(b, 500), false);
    assert.equal(spend(b, 400), true);
    b.soul.remaining = 10;
    gain(b, 100);
    assert.equal(b.meter, 0);
  });
});

describe('clash', () => {
  it('opens on close Strain clanks, resolves Parry over Press', () => {
    const frame = duelFrame();
    assert.ok(findClash([{ type: 'clank', attackAId: 'wings:jab', attackBId: 'wings:jab-3' } as never]));
    assert.equal(
      findClash([{ type: 'clank', attackAId: 'wings:jab', attackBId: 'wings:forward-smash' } as never]),
      undefined,
    );
    openClash(frame.d, frame.w.fighters);
    frame.inputs[IDS[1]] = { ...frame.inputs[IDS[1]]!, moveX: 1000 };
    for (let n = 0; n < DUEL.clash.window; n++) stepClashWindow(frame, IDS, () => null);
    // Player 2 faces left, so holding right is "away": Parry beats Player 1's default Press.
    assert.equal(frame.d.knights[IDS[1]]!.clashes, 1);
    assert.equal(frame.d.knights[IDS[0]]!.stagger, DUEL.clash.advantage);
  });
});

describe('feint', () => {
  it('spends meter, and holding commits a real ghost', () => {
    const frame = duelFrame();
    frame.d.knights[IDS[0]]!.meter = DUEL.meter.feint;
    const actor = actorFor(frame, 0, { specialPressed: true, attackPressed: true });
    assert.equal(tryFeint(actor), true);
    assert.equal(actor.k.meter, 0);
    for (let n = 0; n < DUEL.feint.commit; n++)
      stepFeint(actorFor(frame, 0, { specialPressed: true, auxiliaryButtons: 6 }));
    assert.equal(actor.k.ghost?.real, true);
  });
});

describe('kindle', () => {
  it('ignites at full meter and the second press fires the finisher', () => {
    const frame = duelFrame();
    frame.d.knights[IDS[0]]!.meter = DUEL.meter.max;
    const actor = actorFor(frame, 0, { specialPressed: true, shieldHeld: true });
    tryKindle(actor);
    assert.ok(actor.k.soul.remaining > 0);
    tryKindle(actorFor(frame, 0, { specialPressed: true, shieldHeld: true }));
    assert.equal(actor.p.attack?.attackId, 'wings:kindle-finisher');
  });

  it('Ember burns, Hunger drains, Stillness widens parry', () => {
    const frame = duelFrame({ oaths: ['ember', 'hunger'] });
    const [a, b] = [frame.d.knights[IDS[0]]!, frame.d.knights[IDS[1]]!];
    a.soul.remaining = 10;
    kindleOnHit(a, b, 'ember');
    assert.equal(b.burn, OATH_EFFECTS.ember.kindle.burnFrames);
    b.burn = 1;
    tickBurn(actorFor(frame, 1));
    assert.equal(frame.w.fighters[1]!.percentTenths, OATH_EFFECTS.ember.kindle.burnStrain);
    b.meter = 1000;
    kindleOnHit(a, b, 'hunger');
    assert.equal(b.meter, 1000 - OATH_EFFECTS.hunger.kindle.hitDrain);
    assert.equal(parryWindow(a, 'stillness'), OATH_EFFECTS.stillness.kindle.parryWindow);
    assert.equal(parryWindow(a, 'unsworn'), DUEL.guard.parry);
  });

  it('detects a double Kindle once', () => {
    const frame = duelFrame();
    for (const id of IDS) frame.d.knights[id]!.soul.remaining = 5;
    assert.equal(detectDoubleKindle(frame, frame.w.fighters), true);
    assert.equal(detectDoubleKindle(frame, frame.w.fighters), false);
  });
});

describe('specials', () => {
  it('maps stance and direction to the GDD specials', () => {
    const cases: [string, number, number, string | null][] = [
      ['wings', 0, 1000, 'wings:ascend'],
      ['wings', 0, -1000, 'wings:stoop'],
      ['wings', 1000, 0, 'wings:gale'],
      ['wings', 0, 0, 'wings:sling'],
      ['cape', 0, 1000, 'cape:rift'],
      ['cape', 0, -1000, 'cape:anchor'],
      ['cape', 1000, 0, 'cape:veil'],
      ['cape', 0, 0, null],
    ];
    for (const [stance, moveX, moveY, expected] of cases) {
      const frame = duelFrame();
      frame.w.fighters[0]!.definitionId = stance;
      const actor = actorFor(frame, 0, { specialPressed: true, moveX, moveY });
      trySpecial(actor);
      assert.equal(actor.p.attack?.attackId ?? null, expected, `${stance} ${moveX},${moveY}`);
      if (!expected) assert.equal(actor.k.charging, true);
    }
  });

  it('Cleave charge tiers out and Ember charges twice as fast', () => {
    for (const oath of ['unsworn', 'ember'] as const) {
      const frame = duelFrame({ oaths: [oath, 'unsworn'] });
      frame.w.fighters[0]!.definitionId = 'cape';
      const actor = actorFor(frame, 0);
      actor.k.charging = true;
      let frames = 0;
      while (actor.k.charging) {
        stepCleaveCharge(actorFor(frame, 0, { auxiliaryButtons: 4 }));
        frames++;
      }
      assert.equal(actor.p.attack?.attackId, 'cape:cleave-full');
      assert.equal(frames, DUEL.special.charge / OATH_EFFECTS[oath].cleaveChargeRate);
    }
  });

  it('Rift teleports on its frame along the aim', () => {
    const frame = duelFrame();
    const actor = actorFor(frame, 0);
    actor.p.definitionId = 'cape';
    actor.p.attack = { attackId: 'cape:rift', frame: SPECIALS.rift.teleport, hitTargets: [] };
    actor.k.aim = [1, 0];
    const x = actor.p.x;
    stepActiveSpecial(actor);
    assert.equal(actor.p.x - x, f.fromRatio(SPECIALS.rift.straight, SPECIALS.rift.distanceDivisor));
  });

  it('armor: grounded Anchor absorbs early hits, Ascend leaves helpless (not Gale)', () => {
    const frame = duelFrame();
    const old = structuredClone(frame.w.fighters[0]!);
    old.attack = { attackId: 'cape:anchor', frame: 2, hitTargets: [] };
    assert.equal(absorbsHit(frame.d.knights[IDS[0]]!, 'unsworn', OATH_EFFECTS.unsworn, old, 200), true);
    old.attack = { attackId: 'wings:ascend', frame: 30, hitTargets: [] };
    const now = structuredClone(frame.w.fighters[0]!);
    now.attack = null;
    now.grounded = false;
    assert.equal(becomesHelpless(now, old, OATH_EFFECTS.unsworn), true);
    assert.equal(becomesHelpless(now, old, OATH_EFFECTS.gale), false);
  });
});

describe('fractures', () => {
  it('Shatter needs pre-hit Strain at the threshold; Cape Fair only on the sweetspot', () => {
    assert.equal(isShatterHit(hitEvent('cape:forward-air', 150, 'cape:forward-air:0')), true);
    assert.equal(isShatterHit(hitEvent('cape:forward-air', 120, 'cape:forward-air:1')), false);
    const frame = duelFrame();
    const [a, t] = frame.w.fighters as [never, never];
    const before = structuredClone(frame.w.fighters[1]!);
    before.percentTenths = LIFE.threshold - 1;
    applyHit(frame, hitEvent('wings:forward-smash', 180), t, a, before, 'unsworn');
    assert.equal(frame.shatterTargets.size, 0);
    before.percentTenths = LIFE.threshold;
    applyHit(frame, hitEvent('wings:forward-smash', 180), t, a, before, 'unsworn');
    assert.equal(frame.shatterTargets.has(IDS[1]), true);
  });

  it('a Fracture keeps meter and stats, resets the rest', () => {
    const frame = duelFrame();
    const k = frame.d.knights[IDS[1]]!;
    k.meter = 3000;
    k.integrity = 10;
    takeFracture(frame.d, frame.w.fighters[1]!);
    assert.equal(frame.d.knights[IDS[1]]!.meter, 3000);
    assert.equal(frame.d.knights[IDS[1]]!.integrity, DUEL.integrity.max);
    assert.equal(frame.d.knights[IDS[1]]!.fractures, 1);
  });
});

describe('rounds', () => {
  it('timeout enters Sudden Death and blast zones shrink', () => {
    const frame = duelFrame({ timer: 1, format: 'rounds' });
    tickClock(frame.w, frame.d);
    assert.equal(frame.d.sudden, true);
    const stage = stageById('mirror-sanctum');
    const full = blastRules({ ...frame.d, sudden: false }, stage);
    frame.d.suddenFrames = DUEL.blast.shrinkInterval * 10;
    assert.ok(blastRules(frame.d, stage).blastRight < full.blastRight);
  });

  it('best-of-three ends on the second round win', () => {
    const frame = duelFrame({ format: 'rounds', bestOf: 3 });
    frame.w.fighters[1]!.eliminated = true;
    checkRoundEnd(frame.w, frame.d, IDS);
    assert.equal(frame.d.phase, 'round-end');
    frame.d.phase = 'fight';
    checkRoundEnd(frame.w, frame.d, IDS);
    assert.equal(frame.d.phase, 'over');
    assert.equal(frame.d.winner, IDS[0]);
  });
});

describe('momentum', () => {
  it('each Fracture moves right of way; five screens win', () => {
    const frame = duelFrame({ format: 'momentum', stage: 'pilgrimage' });
    for (let n = 0; n < DUEL.momentum.screens; n++) stepMomentumFracture(frame.w, frame.d, frame.w.fighters[1]!, IDS);
    assert.equal(frame.d.phase, 'over');
    assert.equal(frame.d.winner, IDS[0]);
  });
});
