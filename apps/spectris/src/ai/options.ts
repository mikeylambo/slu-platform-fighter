/**
 * Option scoring (considerations → utility) and execution plans (short input sequences).
 * Every option is scored from the same View; personality and level weighting happen in
 * `decide.ts`, never here.
 */
import { MOVES } from '../content/knight/moves/index.js';
import { DUEL } from '../content/rules/duel.js';
import { AI_INPUT, OPTIONS, THRESHOLD, type OptionId } from '../content/ai/options.js';
import type { PlanStep } from './mind.js';
import type { View } from './observe.js';

const FULL = AI_INPUT.full;

/** 1 inside [min, max], falling linearly to 0 over `soft` units outside. */
function band(value: number, range: [number, number] | undefined, soft = 1.2): number {
  if (!range) return 1;
  if (value < range[0]) return Math.max(0, 1 - (range[0] - value) / soft);
  if (value > range[1]) return Math.max(0, 1 - (value - range[1]) / soft);
  return 1;
}

/** Opponent's attack is still in start-up (a parry/evade window is coming). */
function threat(v: View): number {
  if (!v.opp.attack || v.dist > 5) return 0;
  const move = MOVES.get(v.opp.attack);
  if (!move) return 0.5;
  const first = move.strikes[0]?.start ?? 1;
  const until = first - 1 - v.opp.attackFrame;
  if (until < -2) return 0.2;
  return until <= 6 ? 1 : 0.6;
}

/** Defensive urgency: higher when this Knight can be Shattered. */
const danger = (v: View): number => (v.self.strain >= DUEL.threshold ? THRESHOLD.defense : 1);

const GROUND = new Set<OptionId>([
  'jab',
  'forward-tilt',
  'up-tilt',
  'down-tilt',
  'dash-attack',
  'forward-smash',
  'up-smash',
  'down-smash',
  'grab',
]);
const AERIAL = new Set<OptionId>(['neutral-air', 'forward-air', 'back-air', 'up-air', 'down-air']);

function attackScore(id: OptionId, v: View): number {
  const spec = OPTIONS[id];
  let score = spec.base * band(v.dist, spec.range) * band(v.dy, spec.height);
  if (v.opp.vulnerable) score *= 1.6;
  if (v.opp.evading) score *= 0.3;
  if (spec.finisher) score *= v.opp.strain >= DUEL.threshold ? THRESHOLD.finisher : THRESHOLD.early;
  if (GROUND.has(id) && !v.self.grounded) return 0;
  if (AERIAL.has(id) && v.self.grounded && v.dy < -0.5) score *= 0.4;
  if (id === 'back-air' && !v.self.grounded && v.self.facing === v.toward) score *= 0.25;
  if (id === 'forward-air' && !v.self.grounded && v.self.facing !== v.toward) score *= 0.25;
  if (v.opp.guarding && id !== 'grab') score *= 0.45;
  return score;
}

function specialScore(id: OptionId, v: View): number {
  const spec = OPTIONS[id];
  const cape = v.self.stance === 'cape';
  if (id === 'neutral-special') {
    // Wings: Blade Sling at range (or recall). Cape: Charged Cleave up close, armored.
    const range: [number, number] = cape ? [0.5, 2.8] : (spec.range ?? [3, 7]);
    const score = spec.base * band(v.dist, range) * band(v.dy, spec.height);
    return cape
      ? score * (v.opp.strain >= DUEL.threshold ? THRESHOLD.finisher * 0.6 : 1)
      : v.self.bladeOut
        ? 0.05
        : score;
  }
  if (id === 'side-special') {
    // Cape Veil Step crosses up through the opponent; Wings Gale Lunge closes distance.
    const range: [number, number] = cape ? [0.5, 3.5] : (spec.range ?? [2.5, 6]);
    return spec.base * band(v.dist, range) * band(v.dy, spec.height) * (v.opp.attack ? 1.4 : 1);
  }
  if (id === 'down-special') {
    if (cape) {
      const shatter = v.opp.strain >= DUEL.threshold ? THRESHOLD.finisher : 1;
      return spec.base * band(v.dist, spec.range) * (v.self.grounded ? shatter : 0.5) * (v.opp.attack ? 1.3 : 1);
    }
    return v.self.grounded ? 0 : spec.base * band(v.dist, [0, 2]) * band(v.dy, [-6, -1]);
  }
  // Up special is mostly a recovery tool; as an attack it is an anti-air.
  return spec.base * band(v.dist, spec.range) * band(v.dy, spec.height);
}

/** Utility of every option before personality, level and adaptation weighting. */
export function score(id: OptionId, v: View, preference: { wings: number; cape: number }): number {
  const spec = OPTIONS[id];
  const s = v.self;
  if (s.offstage) {
    // Offstage: recover, unless still chasing a recoverer with jumps in hand.
    if (id === 'chase') return v.opp.offstage && s.jumps >= 1 && !s.helpless ? spec.base * 2 : 0;
    return id === 'recover' ? spec.base : 0;
  }
  if (id === 'recover') return 0;
  if (s.holding) return id === 'pummel' ? (s.pummelReady ? spec.base : 0) : id === 'throw' ? spec.base : 0;
  if (id === 'pummel' || id === 'throw') return 0;
  if (v.opp.offstage && !s.offstage) {
    if (id === 'edgeguard') return spec.base;
    // Chasing offstage needs jumps to come back with.
    if (id === 'chase') return spec.base * (s.jumps >= 2 ? 1 : 0.2);
    return id === 'wait' ? 0.2 : 0;
  }
  if (id === 'edgeguard' || id === 'chase') return 0;
  switch (id) {
    case 'approach': {
      // At the threshold, close in only to punish; otherwise hold just outside their reach.
      const careful = s.strain >= DUEL.threshold && !v.opp.vulnerable;
      const gap = careful ? AI_INPUT.thresholdSpacing : 1.6;
      return spec.base * Math.min(1, Math.max(0, v.dist - gap) / 5) * (v.opp.vulnerable ? 1.8 : 1);
    }
    case 'retreat':
      return (
        spec.base *
        (s.strain > 800 && v.dist < AI_INPUT.thresholdSpacing ? 2.5 : 1) *
        (v.opp.attack ? 1.5 : 1) *
        danger(v)
      );
    case 'wait':
      return spec.base;
    case 'jump':
      return spec.base * band(v.dy, spec.height) * (s.jumps > 0 || s.grounded ? 1 : 0);
    case 'guard':
      return s.stance === 'cape' ? spec.base * threat(v) * 2.4 * danger(v) : 0;
    case 'evade':
      return s.stance === 'wings' ? (spec.base * threat(v) * 2 + (v.opp.grabbing ? 0.4 : 0)) * danger(v) : 0;
    case 'stance': {
      if (!s.grounded && s.switchedAirborne) return 0;
      const other = s.stance === 'wings' ? preference.cape : preference.wings;
      const current = s.stance === 'wings' ? preference.wings : preference.cape;
      return spec.base * Math.max(0, other / current - 1) * (v.dist > 3 ? 1.5 : 0.4);
    }
    case 'feint':
      return s.meter >= DUEL.meter.feint || s.kindled ? spec.base * band(v.dist, spec.range) : 0;
    case 'kindle':
      return s.meter >= DUEL.meter.max && !s.kindled ? spec.base * (v.opp.strain >= 700 ? 1.6 : 1) : 0;
    case 'grab':
      return attackScore(id, v) * (v.opp.guarding ? 2.2 : 1);
    case 'neutral-special':
    case 'side-special':
    case 'up-special':
    case 'down-special':
      return specialScore(id, v);
    default:
      return attackScore(id, v);
  }
}

// ---------------------------------------------------------------- plans

const step = (frames: number, input: PlanStep['input']): PlanStep => ({ frames, input });

function directionFor(id: OptionId, v: View): { moveX: number; moveY: number } {
  const toward = v.toward * FULL;
  switch (id) {
    case 'forward-tilt':
    case 'side-special':
      return { moveX: toward, moveY: 0 };
    case 'up-tilt':
    case 'up-air':
    case 'up-special':
      return { moveX: 0, moveY: FULL };
    case 'down-tilt':
    case 'down-air':
    case 'down-special':
      return { moveX: 0, moveY: -FULL };
    case 'forward-air':
      return { moveX: v.self.facing * FULL, moveY: 0 };
    case 'back-air':
      return { moveX: -v.self.facing * FULL, moveY: 0 };
    default:
      return { moveX: 0, moveY: 0 };
  }
}

/**
 * Survival recovery: jump early (always while drifting away), Gale Lunge back when far out,
 * glide home in Wings, and the up special toward the ledge as the last resort.
 */
function recoverPlan(v: View): PlanStep[] {
  const s = v.self;
  const home = s.x > 0 ? -FULL : FULL;
  if (s.helpless) return [step(4, { moveX: home })];
  const drifting = s.vx * Math.sign(s.x) > 0.05;
  const far = -s.edgeDistance;
  if (s.jumps > 0 && (s.y < AI_INPUT.recoveryJumpHeight || drifting || far > AI_INPUT.recoveryJumpDistance)) {
    return [step(1, { moveX: home, jumpPressed: true, jumpHeld: true }), step(5, { moveX: home, jumpHeld: true })];
  }
  if (s.stance === 'wings' && !s.sideUsed && far > AI_INPUT.recoveryLungeDistance && s.y > -1) {
    return [step(1, { moveX: home, specialPressed: true }), step(3, { moveX: home })];
  }
  if (s.jumps === 0 && s.stance === 'cape' && !s.switchedAirborne) {
    // Cape has no glide: switch to Wings to glide home.
    return [step(1, { moveX: home, auxiliaryButtons: 1 }), step(3, { moveX: home })];
  }
  const nearLedge = far < AI_INPUT.recoveryReach;
  if (s.jumps === 0 && s.stance === 'wings' && (s.gliding || !s.glideUsed) && !(nearLedge && s.y < 0)) {
    // Glide home: climb when low, dive when high to keep speed.
    const pitch = s.y < AI_INPUT.glideLow ? AI_INPUT.glideClimb : s.y > AI_INPUT.glideHigh ? -AI_INPUT.glideClimb : 0;
    return [step(4, { moveX: home, moveY: pitch, jumpHeld: true })];
  }
  if (s.jumps === 0 && nearLedge && s.y < AI_INPUT.recoverySpecialHeight) {
    return [step(1, { moveX: home, moveY: FULL, specialPressed: true }), step(3, { moveX: home })];
  }
  return [step(4, { moveX: home })];
}

/** Edge-guard: walk to the ledge, then jump out and swat when the recoverer is in reach. */
function edgeguardPlan(v: View): PlanStep[] {
  const edgeSide = v.opp.x > 0 ? 1 : -1;
  const toEdge = edgeSide * v.half - v.self.x;
  if (Math.abs(toEdge) > AI_INPUT.edgeStop && v.self.grounded) return [step(4, { moveX: Math.sign(toEdge) * FULL })];
  if (v.dist < 3.2 && Math.abs(v.dy) < 3) {
    const id: OptionId =
      v.dy > 1.2 ? 'up-air' : v.dy < -1.2 ? 'down-air' : v.self.facing === v.toward ? 'forward-air' : 'back-air';
    if (v.self.grounded)
      return [step(1, { jumpPressed: true, jumpHeld: true, moveX: v.toward * FULL }), step(3, { jumpHeld: true })];
    return [step(1, { attackPressed: true, ...directionFor(id, v) }), step(3, {})];
  }
  return [step(4, {})];
}

/** Chase: leave the stage after the recoverer and meet them with an aerial. */
function chasePlan(v: View): PlanStep[] {
  const toward = v.toward * FULL;
  if (v.dist < 3 && Math.abs(v.dy) < 2.5 && !v.self.grounded) {
    const id: OptionId =
      v.dy > 1.2 ? 'up-air' : v.dy < -1.2 ? 'down-air' : v.self.facing === v.toward ? 'forward-air' : 'back-air';
    return [step(1, { attackPressed: true, ...directionFor(id, v) }), step(3, { moveX: toward })];
  }
  if (v.self.grounded || (v.dy > 1 && v.self.jumps >= 2)) {
    return [step(1, { jumpPressed: true, jumpHeld: true, moveX: toward }), step(3, { jumpHeld: true, moveX: toward })];
  }
  return [step(4, { moveX: toward })];
}

/** Input plan for the chosen option. */
export function plan(id: OptionId, v: View, holdFeint: boolean): PlanStep[] {
  const toward = v.toward * FULL;
  switch (id) {
    case 'approach':
      return [step(4, { moveX: toward })];
    case 'retreat':
      return [step(4, { moveX: -toward })];
    case 'wait':
      return [step(4, {})];
    case 'jump':
      return [
        step(1, { jumpPressed: true, jumpHeld: true, moveX: toward }),
        step(5, { jumpHeld: true, moveX: toward }),
      ];
    case 'guard':
      return [step(AI_INPUT.guardHold, { shieldHeld: true })];
    case 'evade': {
      // Roll away from the opponent unless that heads off the stage; air dodges drift home.
      const away = -toward;
      const unsafe = Math.sign(away) === Math.sign(v.self.x) && v.self.edgeDistance < AI_INPUT.thresholdSpacing;
      const direction = !v.self.grounded ? -Math.sign(v.self.x) * FULL : v.opp.grabbing || unsafe ? 0 : away;
      return [step(1, { dodgePressed: true, shieldHeld: true, moveX: direction }), step(3, {})];
    }
    case 'grab':
      return [step(1, { grabPressed: true }), step(3, {})];
    case 'pummel':
      return [step(1, { attackPressed: true }), step(3, {})];
    case 'throw': {
      const killing = v.opp.strain >= DUEL.threshold * 0.8;
      const input = killing
        ? { moveX: -v.self.facing * FULL }
        : v.opp.strain < 500
          ? { moveY: FULL }
          : { moveX: v.self.facing * FULL };
      return [step(2, input), step(2, {})];
    }
    case 'stance':
      return [step(1, { auxiliaryButtons: 1 }), step(3, {})];
    case 'feint': {
      const hold = holdFeint
        ? { specialPressed: true, attackPressed: true, auxiliaryButtons: 6 }
        : { specialPressed: true, attackPressed: true };
      return [step(1, hold), step(holdFeint ? AI_INPUT.feintHold : 3, holdFeint ? { auxiliaryButtons: 6 } : {})];
    }
    case 'kindle':
      return [step(1, { specialPressed: true, shieldHeld: true }), step(3, {})];
    case 'recover':
      return recoverPlan(v);
    case 'edgeguard':
      return edgeguardPlan(v);
    case 'chase':
      return chasePlan(v);
    case 'forward-smash':
      return [step(1, { attackPressed: true, smashX: toward }), step(3, {})];
    case 'up-smash':
      return [step(1, { attackPressed: true, smashY: FULL }), step(3, {})];
    case 'down-smash':
      return [step(1, { attackPressed: true, smashY: -FULL }), step(3, {})];
    case 'dash-attack':
      return [step(3, { moveX: toward }), step(1, { attackPressed: true, moveX: toward }), step(2, {})];
    case 'neutral-special':
    case 'side-special':
    case 'up-special':
    case 'down-special': {
      const hold = id === 'neutral-special' && v.self.stance === 'cape' ? { auxiliaryButtons: 4 } : {};
      return [
        step(1, { specialPressed: true, ...directionFor(id, v), ...hold }),
        step(id === 'neutral-special' ? 12 : 3, hold),
      ];
    }
    default: {
      const direction = directionFor(id, v);
      if (AERIAL.has(id) && v.self.grounded) {
        return [
          step(1, { jumpPressed: true, jumpHeld: true, moveX: toward }),
          step(AI_INPUT.aerialRise, { jumpHeld: true, moveX: toward }),
          step(1, { attackPressed: true, ...direction }),
          step(2, {}),
        ];
      }
      return [step(1, { attackPressed: true, ...direction }), step(3, {})];
    }
  }
}
