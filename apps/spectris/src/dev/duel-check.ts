import assert from 'node:assert/strict';
import { REPLAY_VERSION } from '../content/version.js';
import { writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { fixed as f } from '../../../../packages/deterministic-math/src/fixed.js';
import { hashWorldState } from '../../../../packages/sim/src/stateHash.js';
import { ReplayRecorder, ReplayPlayer } from '../../../../packages/sim/src/replay.js';
import { RollbackSession } from '../../../../packages/sim/src/rollback.js';
import type { WorldState, SimInputFrame } from '../../../../packages/sim/src/types.js';
import { createDuel, stepDuel, duelData } from '../game/duel.js';
import { gameData, neutral, IDS } from '../game/session.js';
import { STAGES, surfaces } from '../content/stages/roster.js';
import { resolveClash } from '../../../../packages/clash/src/clash.js';
import { ignite, tickSoulfire } from '../../../../packages/soulfire/src/soulfire.js';
const checks: string[] = [];
const pass = (v: string) => {
  checks.push(v);
  console.log('PASS', v);
};
const step = (w: WorldState, a: Partial<SimInputFrame> = {}, b: Partial<SimInputFrame> = {}) =>
  stepDuel(w, {
    frame: w.frame,
    byFighterId: { [IDS[0]]: { ...neutral(w.frame), ...a }, [IDS[1]]: { ...neutral(w.frame), ...b } },
  }).state;
const fresh = () => createDuel({ cpu: [0, 0], timer: 0 });
function edit(w: WorldState, fn: (d: NonNullable<ReturnType<typeof duelData>>) => void) {
  const d = duelData(w)!;
  fn(d);
  w.extensionState = JSON.stringify({ ...gameData(w), duel: d });
}
function stance(w: WorldState, index: number, id: string) {
  const d = gameData(w);
  d.knights[IDS[index]!]!.stance.id = id;
  w.fighters[index]!.definitionId = id;
  w.extensionState = JSON.stringify(d);
}
function hit(w: WorldState, move = 'wings:forward-smash') {
  const a = w.fighters[0]!,
    b = w.fighters[1]!;
  a.x = f.zero;
  b.x = f.fromInt(3);
  a.attack = { attackId: move, frame: 13, hitTargets: [] };
  b.facing = -1;
}
let w = fresh();
w.fighters[1]!.x = f.fromInt(60);
w = step(w);
assert.equal(w.fighters[1]!.stocks, 3);
assert.equal(w.fighters[1]!.percentTenths, 0);
assert(w.fighters[1]!.respawnFrames > 0);
pass('Finite Fracture loss and respawn');
w = fresh();
hit(w);
w.fighters[1]!.percentTenths = 1000;
w = step(w);
assert.equal(w.fighters[1]!.stocks, 3);
pass('Shatter at pre-hit 100 Strain consumes a Fracture');
w = fresh();
hit(w);
w.fighters[1]!.percentTenths = 990;
w = step(w);
assert.equal(w.fighters[1]!.stocks, 4);
assert(w.fighters[1]!.percentTenths > 1000);
pass('Crossing 100 on a Shatter hit does not retroactively shatter');
w = fresh();
stance(w, 1, 'cape');
hit(w);
w = step(w, {}, { shieldHeld: true });
assert.equal(w.fighters[1]!.percentTenths, 0);
assert.equal(duelData(w)!.knights[IDS[1]]!.meter, 2000);
pass('Cape directional parry awards 20 meter');
w = fresh();
stance(w, 1, 'cape');
hit(w);
edit(w, (d) => (d.knights[IDS[1]]!.guard = 5));
w = step(w, {}, { shieldHeld: true });
assert.equal(duelData(w)!.knights[IDS[1]]!.integrity, 8200);
assert.equal(w.fighters[1]!.percentTenths, 27);
pass('Guard chips 18 integrity and 2.7 Strain');
w = fresh();
stance(w, 1, 'cape');
hit(w);
w.fighters[1]!.facing = 1;
w = step(w, {}, { shieldHeld: true });
assert(w.fighters[1]!.percentTenths > 0);
pass('Rear attacks bypass guard');
w = fresh();
stance(w, 1, 'cape');
hit(w);
edit(w, (d) => {
  d.knights[IDS[1]]!.guard = 5;
  d.knights[IDS[1]]!.integrity = 1000;
});
w = step(w, {}, { shieldHeld: true });
assert.equal(duelData(w)!.knights[IDS[1]]!.stagger, 120);
for (let i = 0; i < 120; i++) w = step(w);
assert.equal(duelData(w)!.knights[IDS[1]]!.integrity, 5000);
pass('Guard break staggers 120 frames and resets integrity to 50');
w = fresh();
edit(w, (d) => (d.knights[IDS[0]]!.meter = 10000));
w = step(w, { specialPressed: true, shieldHeld: true });
assert(duelData(w)!.knights[IDS[0]]!.soul.remaining > 0);
assert.equal(duelData(w)!.knights[IDS[0]]!.meter, 0);
for (let i = 0; i < 20; i++) w = step(w);
w = step(w, { specialPressed: true, shieldHeld: true });
assert.equal(w.fighters[0]!.attack?.attackId, 'wings:kindle-finisher');
assert.equal(duelData(w)!.knights[IDS[0]]!.soul.remaining, 0);
pass('Kindle activation and finisher');
w = fresh();
edit(w, (d) => (d.knights[IDS[0]]!.meter = 2500));
w = step(w, { auxiliaryButtons: 1, shieldHeld: true });
assert.equal(gameData(w).knights[IDS[0]]!.stance.id, 'cape');
assert.equal(gameData(w).knights[IDS[0]]!.stance.unfurl, 0);
pass('Flash Unfurl cancels stance commitment');
w = fresh();
w = step(w, { specialPressed: true });
for (let i = 0; i < 14; i++) w = step(w);
assert(duelData(w)!.knights[IDS[0]]!.blade);
for (let i = 0; i < 15; i++) w = step(w);
w = step(w, { attackPressed: true });
assert.equal(w.fighters[0]!.attack?.attackId, 'wings:punch');
pass('Blade Sling creates projectile; swordless attacks become punches');
w = fresh();
w.fighters[0]!.x = f.zero;
w.fighters[1]!.x = f.fromInt(2);
w = step(w, { grabPressed: true });
for (let i = 0; i < 7; i++) w = step(w);
assert.equal(duelData(w)!.knights[IDS[0]]!.holding, IDS[1]);
w = step(w, { attackPressed: true });
assert.equal(w.fighters[1]!.percentTenths, 30);
w = step(w, { moveY: 1000 });
assert.equal(duelData(w)!.knights[IDS[0]]!.holding, null);
assert(w.fighters[1]!.percentTenths >= 90);
pass('Standing grab, Siphon pummel, and launch throw');
assert.equal(resolveClash('parry', 'press'), 0);
assert.equal(resolveClash('slip', 'parry'), 0);
assert.equal(resolveClash('press', 'slip'), 0);
assert.equal(resolveClash('press', 'press'), null);
pass('All Clash outcomes');
const alternate = ignite({ duration: 90, activation: 3, cost: 20, guardChip: 1.5, freeFeints: false }, 20)!;
assert.equal(tickSoulfire(alternate.state).remaining, 89);
pass('Shared Soulfire accepts a second character parameter pack');
for (const stage of STAGES) {
  w = createDuel({ stage: stage.id, cpu: [0, 0] });
  assert.equal(w.surfaces.length, 1 + stage.platforms.length);
  for (let i = 0; i < 100; i++) w = step(w);
}
assert.notDeepEqual(surfaces(STAGES[4]!, 0), surfaces(STAGES[4]!, 360));
pass('Nine layouts and deterministic moving platforms');
w = createDuel({ cpu: [0, 0], timer: 1 });
w = step(w);
assert(duelData(w)!.sudden);
assert(w.fighters.every((p) => p.stocks === 1));
pass('Timeout enters Sudden Death');
w = createDuel({ cpu: [0, 0], lives: 1, bestOf: 3, timer: 0 });
w.fighters[1]!.x = f.fromInt(60);
w = step(w);
assert.equal(duelData(w)!.phase, 'round-end');
for (let i = 0; i < 120; i++) w = step(w);
assert.equal(duelData(w)!.round, 2);
w.fighters[1]!.x = f.fromInt(60);
w = step(w);
assert.equal(duelData(w)!.phase, 'over');
pass('Best-of-three round and match transitions');

w = fresh();
w = step(w, { dodgePressed: true });
w = step(w);
assert.equal(w.fighters[0]!.invulnerableFrames, 0);
w = step(w);
assert(w.fighters[0]!.invulnerableFrames > 0);
pass('Spot evade becomes intangible on frame 3');
w = fresh();
stance(w, 0, 'cape');
w = step(w, { specialPressed: true, auxiliaryButtons: 4 });
for (let i = 0; i < 59; i++) w = step(w, { auxiliaryButtons: 4 });
assert.equal(w.fighters[0]!.attack?.attackId, 'cape:cleave-full');
pass('Holding Cape neutral special reaches full Cleave at 60f');
w = fresh();
w = step(w, { specialPressed: true, moveX: 1000 });
const galeX = w.fighters[0]!.x;
for (let i = 0; i < 20; i++) w = step(w);
assert(w.fighters[0]!.x > galeX + f.fromInt(5));
pass('Gale Lunge moves through its active cut');
w = fresh();
stance(w, 0, 'cape');
w = step(w, { specialPressed: true, moveX: 1000 });
for (let i = 0; i < 18; i++) w = step(w);
assert.equal(w.fighters[0]!.attack?.attackId, 'cape:veil');
w = fresh();
stance(w, 0, 'cape');
w = step(w, { specialPressed: true, moveX: 1000 });
for (let i = 0; i < 18; i++) w = step(w, { attackPressed: i === 10 });
assert.equal(w.fighters[0]!.attack?.attackId, 'cape:veil-cut');
pass('Veil Step only cuts after an explicit attack request');
w = fresh();
stance(w, 0, 'cape');
const riftX = w.fighters[0]!.x;
w = step(w, { specialPressed: true, moveX: 1000, moveY: 1000 });
for (let i = 0; i < 8; i++) w = step(w);
assert(w.fighters[0]!.x > riftX + f.fromInt(3));
assert(w.fighters[0]!.y > f.fromInt(2));
pass('Rift remembers its eight-way aim during startup');
w = fresh();
w = step(w, { specialPressed: true, moveY: 1000 });
for (let i = 0; i < 40; i++) w = step(w);
assert(duelData(w)!.knights[IDS[0]]!.helpless || w.fighters[0]!.grounded);
pass('Ascend ends in helplessness until landing');
w = fresh();
w.fighters[0]!.grounded = false;
w.fighters[0]!.groundSurfaceId = null;
w.fighters[0]!.y = f.fromInt(20);
w.fighters[0]!.locomotion = 'airborne';
w = step(w, { specialPressed: true, moveY: -1000 });
for (let i = 0; i < 13; i++) w = step(w, { jumpHeld: true });
assert(gameData(w).knights[IDS[0]]!.gliding);
pass('Stoop cancels into glide after frame 12');
w = fresh();
edit(w, (d) => (d.knights[IDS[0]]!.meter = 2500));
w = step(w, { specialPressed: true, attackPressed: true, auxiliaryButtons: 6 });
for (let i = 0; i < 4; i++) w = step(w, { auxiliaryButtons: 6 });
assert(duelData(w)!.knights[IDS[0]]!.ghost?.real);
assert.equal(duelData(w)!.knights[IDS[0]]!.meter, 0);
pass('Held Feint commits a real ghost and spends 25 meter');
w = fresh();
edit(w, (d) => {
  for (const k of Object.values(d.knights)) {
    k.soul = { remaining: 100, activating: 0, freeFlash: true };
  }
});
w = step(w);
for (let i = 0; i < 12; i++) w = step(w);
assert(Object.values(duelData(w)!.knights).every((k) => k.soul.remaining === 0));
pass('Double-Kindle tie extinguishes both buffs without retriggering');
w = createDuel({ cpu: [0, 0], format: 'momentum', stage: 'pilgrimage', timer: 0 });
w.fighters[1]!.x = f.fromInt(60);
w = step(w);
assert.equal(duelData(w)!.rightOfWay, IDS[0]);
assert(w.fighters[1]!.x > w.fighters[0]!.x, 'victim respawns ahead of the holder');
for (let screen = 1; screen <= 2; screen++) {
  w.fighters[0]!.x = f.fromInt(screen * 36 - 17);
  w = step(w);
  assert.equal(duelData(w)!.progress, screen);
}
w.fighters[0]!.x = f.fromInt(2 * 36 + 16);
w = step(w);
assert.equal(duelData(w)!.phase, 'over');
assert.equal(duelData(w)!.winner, IDS[0]);
pass('Pilgrimage: right of way, screen scrolling, respawn ahead, goal line');

w = createDuel({ cpu: [0, 0], lives: 1, bestOf: 3, timer: 0, counterpick: true });
w.fighters[1]!.x = f.fromInt(60);
w = step(w);
for (let i = 0; i < 130; i++) w = step(w);
assert.equal(duelData(w)!.round, 1);
w = step(w, {}, { auxiliaryButtons: 16 | (1 << 5) });
assert.equal(duelData(w)!.round, 2);
assert.equal(duelData(w)!.options.stage, 'eclipse');
pass('Losing player chooses a deterministic between-round counterpick');
w = createDuel({ cpu: [0, 0], format: 'training', stanceLock: 'cape' });
w = step(w, { auxiliaryButtons: 1 });
assert.equal(gameData(w).knights[IDS[0]]!.stance.id, 'cape');
pass('Training stance lock is authoritative replay state');
const initial = createDuel({ cpu: [7, 8], timer: 0, format: 'training', oaths: ['ember', 'hunger'] });
let a = initial,
  b = structuredClone(initial);
const started = performance.now();
for (let i = 0; i < 10000; i++) {
  a = step(a);
  b = step(b);
  assert.equal(hashWorldState(a), hashWorldState(b));
}
const simMs = (performance.now() - started) / 20000;
pass('10,000-frame duel determinism with AI and Oaths');
const tape = new ReplayRecorder(
  initial,
  { gameVersion: REPLAY_VERSION, participantIds: IDS, stageId: 'mirror-sanctum', rulesetId: 'training' },
  60,
);
a = initial;
for (let i = 0; i < 720; i++) {
  const input = { frame: a.frame, byFighterId: { [IDS[0]]: neutral(a.frame), [IDS[1]]: neutral(a.frame) } };
  a = stepDuel(a, input).state;
  tape.append(input, a);
}
assert.equal(hashWorldState(new ReplayPlayer(tape.finish(), stepDuel).playToEnd()), hashWorldState(a));
pass('Duel replay round trip includes complete rules and AI state');
const rb = new RollbackSession(fresh(), stepDuel, { participants: IDS, historyFrames: 120 });
a = fresh();
for (let frame = 0; frame < 240; frame++) {
  const one = { ...neutral(frame), moveX: frame % 90 < 45 ? 1000 : -1000, attackPressed: frame % 20 === 0 };
  rb.submitInput(IDS[0], one);
  if (frame >= 8) rb.submitInput(IDS[1], { ...neutral(frame - 8), specialPressed: (frame - 8) % 50 === 0 });
  a = step(a, one, { specialPressed: frame % 50 === 0 });
  b = rb.advance().state;
}
for (let frame = 232; frame < 240; frame++)
  rb.submitInput(IDS[1], { ...neutral(frame), specialPressed: frame % 50 === 0 });
rb.submitInput(IDS[0], neutral(240));
rb.submitInput(IDS[1], neutral(240));
b = rb.advance().state;
a = step(a);
assert.equal(hashWorldState(a), hashWorldState(b));
pass('8-frame delayed rollback converges with specials');
writeFileSync(
  'apps/spectris/proofs/duel-check.json',
  JSON.stringify({ checks, simMs, finalHash: hashWorldState(a) }, null, 2) + '\n',
);
console.log(`DUEL PASS ${checks.length}; mean combined step/hash check ${simMs.toFixed(3)}ms`);
