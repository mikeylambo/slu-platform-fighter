import { remapButton, SemanticInputSampler, type InputProfile } from '../../input/src/profile.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`K29 input certification failure: ${message}`);
}

const profile: InputProfile = {
  id: 'cert-pad',
  buttons: { jump: ['A'], attack: ['X'], special: ['B'], grab: ['Y'], dodge: ['RB'], shield: ['LT', 'RT'] },
  axes: {
    moveX: { physicalAxis: 'LX', deadzone: 0.2 }, moveY: { physicalAxis: 'LY', deadzone: 0.2, invert: true },
    smashX: { physicalAxis: 'RX', deadzone: 0.25 }, smashY: { physicalAxis: 'RY', deadzone: 0.25, invert: true },
  },
};
const sampler = new SemanticInputSampler(profile);
sampler.sample({ sequence: 0, buttons: { A: false, X: false, RT: false }, axes: { LX: 0.1, LY: 0, RX: 0, RY: 0 } });
assert(sampler.diagnostics().semanticAxes.moveX === 0, 'deadzone must quantize small analogue drift to zero');
// A quick attack tap occurs entirely between two simulation-frame emits.
sampler.sample({ sequence: 1, buttons: { X: true, RT: true }, axes: { LX: 0.6, LY: -1, RX: 0.5, RY: 0 } });
sampler.sample({ sequence: 2, buttons: { X: false, RT: true }, axes: { LX: 0.6, LY: -1, RX: 0.5, RY: 0 } });
const frame0 = sampler.emitFrame(0);
assert(frame0.attackPressed === true, 'button edge between sim ticks must survive until semantic frame emission');
assert(frame0.shieldHeld === true, 'held input must reflect newest high-rate device sample');
assert(frame0.moveX > 0 && frame0.moveX <= 1000 && frame0.moveY === 1000, 'axes must quantize deterministically into integer semantic range with inversion');
assert(frame0.smashX > 0 && frame0.smashY === 0, 'right-stick equivalent must remain independent semantic axes');
const frame1 = sampler.emitFrame(1);
assert(frame1.attackPressed === false, 'consumed press edge must not repeat without a new physical edge');

const remapped = remapButton(profile, 'jump', ['LB']);
sampler.setProfile(remapped);
sampler.sample({ sequence: 3, buttons: { LB: true }, axes: { LX: 0, LY: 0, RX: 0, RY: 0 } });
const frame2 = sampler.emitFrame(2);
assert(frame2.jumpPressed && frame2.jumpHeld, 'runtime profile remapping must drive semantic input without simulation changes');
assert(Number.isInteger(frame0.moveX) && Number.isInteger(frame0.moveY) && Number.isInteger(frame0.smashX ?? 0), 'simulation-facing axes must always be integers');

console.log('K29 INPUT PASS — high-rate device samples accumulate button edges, quantize analogue axes, expose diagnostics and support runtime semantic remapping before the 60 Hz sim boundary.');
