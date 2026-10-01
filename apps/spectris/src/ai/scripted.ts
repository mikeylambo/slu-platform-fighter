// Scripted CPU (pre-Step 4). Kept verbatim for the behaviour-preserving refactor; replaced by
// the utility AI in Step 4.
import { fixed as f, type Fixed } from '../../../../packages/deterministic-math/src/fixed.js';
import type { WorldState, SimInputFrame } from '../../../../packages/sim/src/types.js';
import type { ClashChoice } from '../../../../packages/clash/src/clash.js';
import { gameData, neutral } from '../game/session.js';
import { DUEL as R } from '../content/rules/duel.js';
import { stageById } from '../content/stages/roster.js';
import type { DuelState } from '../game/rules/state.js';
export function aiInput(w: WorldState, d: DuelState, index: number): SimInputFrame {
  const p = w.fighters[index]!,
    t = w.fighters[1 - index]!,
    k = d.knights[p.id]!,
    level = d.options.cpu[index]!;
  k.history.push({ x: t.x, y: t.y, attack: !!t.attack });
  if (k.history.length > 32) k.history.shift();
  const observed = k.history[Math.max(0, k.history.length - (32 - level * 3))]!,
    dx = f.toNumber((observed.x - p.x) as Fixed),
    dy = f.toNumber((observed.y - p.y) as Fixed),
    x = f.toNumber(p.x),
    y = f.toNumber(p.y),
    half = stageById(d.options.stage).width / 10;
  if (w.frame % R.ai.decision === 0) {
    const personality = d.options.oaths[index]!;
    const n = (Math.imul(w.frame + index * 71 + w.seed, 1664525) >>> 0) % 100;
    const off = Math.abs(x) > half - 1,
      stance = gameData(w).knights[p.id]!.stance.id;
    const input = {
      ...neutral(w.frame),
      moveX: Math.abs(dx) > 1.8 ? (dx > 0 ? 1000 : -1000) : 0,
      moveY: dy > 2 ? 900 : dy < -2 ? -900 : 0,
    };
    if (off) {
      input.moveX = x > 0 ? -1000 : 1000;
      input.jumpPressed = p.jumpsRemaining > 0 && y < (level >= 7 ? 1 : 5);
      input.jumpHeld = true;
      input.specialPressed = p.jumpsRemaining === 0 && y < (level >= 7 ? 0 : 2);
      input.moveY = 1000;
      if (stance === 'cape' && !gameData(w).knights[p.id]!.stance.switchedAirborne) input.auxiliaryButtons = 1;
    } else if ((p.grounded || p.jumpsRemaining > 0) && dy > 3) {
      input.jumpPressed = true;
      input.jumpHeld = true;
    }
    const ready = w.frame % (36 - level * 3) < 4;
    if (!off && ready) {
      input.attackPressed = Math.abs(dx) < 4.5 && Math.abs(dy) < 3 && n < 50 + level * 5;
      if (t.percentTenths >= 1000 && p.grounded && Math.abs(dx) < 5 && (level >= 5 || n < level * 6)) {
        input.attackPressed = true;
        if (Math.abs(dx) < 2.5) input.smashY = 1000;
        else input.smashX = dx > 0 ? 1000 : -1000;
      }
      if (Math.abs(dx) < 2.4 && n < 15 + level) {
        input.grabPressed = true;
        input.attackPressed = false;
      }
      if (n > 70 && Math.abs(dx) > 3) {
        input.specialPressed = true;
        input.moveY = 0;
      }
      if (observed.attack && Math.abs(dx) < 5 && level >= 4 && n < level * 9) {
        input.shieldHeld = true;
        input.dodgePressed = true;
        if (stance === 'wings' && n < 30) input.auxiliaryButtons = 1;
      }
      if (k.meter === R.meter.max) {
        input.specialPressed = true;
        input.shieldHeld = true;
      }
      if (k.holding) {
        input.moveX = dx > 0 ? 1000 : -1000;
        input.moveY = t.percentTenths < 500 ? 1000 : 0;
        input.attackPressed = n < 35;
      }
      // Personality changes utility weights, never the opponent's hidden future input.
      if (personality === 'hunger' && Math.abs(dx) < 2.4) {
        input.grabPressed = true;
        input.attackPressed = false;
      }
      if (personality === 'stillness' && observed.attack && Math.abs(dx) < 5) {
        input.shieldHeld = true;
        input.dodgePressed = true;
        input.attackPressed = false;
        if (stance === 'wings') input.auxiliaryButtons = 1;
      }
      if (personality === 'iron' && Math.abs(dx) < 4 && n > 45) {
        input.specialPressed = true;
        input.moveY = -1000;
        if (stance === 'wings') input.auxiliaryButtons = 1;
      }
      if (personality === 'static' && k.meter >= 2500 && n > 60) {
        input.specialPressed = true;
        input.attackPressed = true;
        input.auxiliaryButtons = 6;
      }
      if (personality === 'ember' && Math.abs(dx) > 2 && n > 50) {
        input.specialPressed = true;
        input.moveX = dx > 0 ? 1000 : -1000;
      }
      if (personality === 'gale' && !t.grounded && dy > 0 && p.jumpsRemaining > 0) {
        input.jumpPressed = true;
        input.jumpHeld = true;
      }
      if (
        personality === 'unsworn' &&
        level === 9 &&
        k.history.filter((v) => v.attack).length > 10 &&
        Math.abs(dx) < 4 &&
        n < 25
      ) {
        input.shieldHeld = true;
        input.dodgePressed = true;
        if (stance === 'wings') input.auxiliaryButtons = 1;
      }
      if (!off && level >= 6 && Math.abs(dx) < 4 && Math.abs(dy) < 3) {
        input.attackPressed = true;
        if (Math.abs(dx) < 2.5) {
          input.moveY = 1000;
          input.grabPressed = false;
          input.shieldHeld = false;
          input.dodgePressed = false;
        }
        if (!p.attack) input.moveX = dx >= 0 ? 400 : -400;
        if (t.percentTenths >= 1000) {
          input.shieldHeld = false;
          input.dodgePressed = false;
          if (Math.abs(dx) < 2.5) input.smashY = 1000;
          else input.smashX = dx > 0 ? 1000 : -1000;
          input.attackPressed = true;
          input.grabPressed = false;
        }
      }
    }
    if (p.hitstunFrames > 0 && level >= 6) {
      input.moveX = x > 0 ? -1000 : 1000;
      input.moveY = 1000;
      input.dodgePressed = y < 3;
    }
    k.ai = input;
  }
  return {
    ...k.ai,
    frame: w.frame,
    attackPressed: !!k.ai.attackPressed && w.frame % 4 === 0,
    specialPressed: !!k.ai.specialPressed && w.frame % 4 === 0,
    grabPressed: !!k.ai.grabPressed && w.frame % 4 === 0,
    jumpPressed: k.ai.jumpPressed && w.frame % 4 === 0,
    dodgePressed: k.ai.dodgePressed && w.frame % 4 === 0,
    auxiliaryButtons: w.frame % 4 === 0 ? (k.ai.auxiliaryButtons ?? 0) : 0,
  };
}

/** CPU clash choice: a deterministic rotation through the three options. */
export function cpuClashChoice(w: WorldState, slot: number): ClashChoice {
  return (['press', 'parry', 'slip'] as const)[((w.frame >> 2) + w.seed + slot * 7) % 3]!;
}
