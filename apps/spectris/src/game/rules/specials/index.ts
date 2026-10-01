import type { FighterState } from '../../../../../../packages/sim/src/types.js';
import { SPECIALS } from '../../../content/knight/specials.js';
import { kindleAbsorbs, kindleArmorsMove } from '../kindle.js';
import { neutral } from '../../session.js';
import { moveKey, setAttack, type Actor, type DuelKnight } from '../state.js';
import { anchorAbsorbs, anchorArmors, landAnchorPlunge, startAnchor, stepAnchorPlunge } from './anchor.js';
import { ascendLeavesHelpless, startAscend } from './ascend.js';
import { pressSling, stepBlade, stepSlingAttack, tryPunch } from './blade-sling.js';
import { cleaveAbsorbs, cleaveArmors, startCleaveCharge, stepCleaveCharge } from './charged-cleave.js';
import { stepGaleLunge, tryGaleLunge } from './gale-lunge.js';
import { riftLeavesHelpless, stepRift, tryRift } from './rift.js';
import { startStoop, stepStoop } from './stoop.js';
import { startVeilStep, stepVeilStep } from './veil-step.js';
import type { Oath } from '../../../content/rules/duel.js';
import type { OathEffects } from '../../../content/rules/oaths.js';

export { stepBlade, stepCleaveCharge, tryPunch, landAnchorPlunge };

/** Special press: choose the special by stance and stick direction (GDD 3.8). */
export function trySpecial(actor: Actor): boolean {
  const { raw, k, p, frame } = actor;
  if (!raw.specialPressed) {
    return false;
  }
  k.aim = [Math.sign(raw.moveX), Math.sign(raw.moveY) || (!raw.moveX ? 1 : 0)];
  k.emerge = false;
  const up = raw.moveY > SPECIALS.aimThreshold;
  const down = raw.moveY < -SPECIALS.aimThreshold;
  const side = Math.abs(raw.moveX) > SPECIALS.aimThreshold && !up && !down;
  if (p.definitionId === 'wings') {
    wingsSpecial(actor, up, down, side);
  } else {
    capeSpecial(actor, up, down, side);
  }
  // Specials keep horizontal drift and nothing else this frame.
  frame.inputs[p.id] = { ...neutral(frame.w.frame), moveX: raw.moveX };
  return true;
}

function wingsSpecial(actor: Actor, up: boolean, down: boolean, side: boolean): void {
  if (up) {
    startAscend(actor);
  } else if (down) {
    startStoop(actor);
  } else if (side) {
    tryGaleLunge(actor);
  } else {
    pressSling(actor);
  }
}

function capeSpecial(actor: Actor, up: boolean, down: boolean, side: boolean): void {
  if (up && tryRift(actor)) {
    return;
  }
  if (down) {
    startAnchor(actor);
  } else if (side) {
    startVeilStep(actor);
  } else {
    // Neutral — and an up input with Rift spent — charges Cleave.
    startCleaveCharge(actor);
  }
}

/** A glide attack is available at any point in the glide and ends it. */
export function tryGlideAttack(actor: Actor): boolean {
  const { g, raw, p, frame } = actor;
  if (!g.gliding || !raw.attackPressed) {
    return false;
  }
  setAttack(p, 'glide-attack');
  frame.inputs[p.id]!.attackPressed = false;
  return true;
}

/** Per-frame behaviour of the special the Knight is currently performing. */
export function stepActiveSpecial(actor: Actor): void {
  const { k, p, raw, oath } = actor;
  if (!p.attack) {
    return;
  }
  const key = moveKey(p.attack.attackId);
  const attackFrame = p.attack.frame;
  k.lastMove = p.attack.attackId;
  if (key === 'sling') {
    stepSlingAttack(actor, attackFrame);
  }
  if (key === 'gale') {
    stepGaleLunge(actor, attackFrame);
  }
  if (key === 'veil') {
    stepVeilStep(actor, attackFrame);
  }
  if (key === 'rift') {
    stepRift(actor, attackFrame);
  }
  if ((key === 'veil' || key === 'rift') && raw.attackPressed) {
    k.emerge = true;
  }
  const emergeFrame = key === 'veil' ? SPECIALS.veil.emerge : key === 'rift' ? SPECIALS.rift.emerge : -1;
  if (attackFrame === emergeFrame && k.emerge) {
    setAttack(p, `${key}-cut`);
  }
  if (key === 'stoop') {
    stepStoop(actor, attackFrame);
  }
  if (key === 'anchor-air') {
    stepAnchorPlunge(actor);
  }
  if (moveIgnoresHitstun(k, oath, actor.effects, key, attackFrame)) {
    p.hitstunFrames = 0;
  }
}

/** Armored moves clear hitstun every frame they are active. */
function moveIgnoresHitstun(
  k: DuelKnight,
  oath: Oath,
  effects: OathEffects,
  key: string,
  attackFrame: number,
): boolean {
  return (
    anchorArmors(key, attackFrame) ||
    cleaveArmors(key) ||
    (effects.slingArmor && key === 'sling') ||
    kindleArmorsMove(k, oath, key)
  );
}

/** True when the defender's current move absorbs this hit (armor): position and move are kept. */
export function absorbsHit(
  k: DuelKnight,
  oath: Oath,
  effects: OathEffects,
  old: FighterState,
  damage: number,
): boolean {
  const key = old.attack ? moveKey(old.attack.attackId) : undefined;
  const attackFrame = old.attack?.frame ?? 0;
  return (
    anchorAbsorbs(key, attackFrame) ||
    cleaveAbsorbs(key, damage) ||
    (effects.slingArmor && key === 'sling') ||
    kindleAbsorbs(k, oath, key, damage)
  );
}

/** After PF movement: Ascend and Rift that ended in the air leave the Knight helpless. */
export function becomesHelpless(p: FighterState, old: FighterState, effects: OathEffects): boolean {
  if (!old.attack || p.attack || p.grounded || p.hitstunFrames !== 0) {
    return false;
  }
  return ascendLeavesHelpless(old, effects.ascendHelpless) || riftLeavesHelpless(old);
}
