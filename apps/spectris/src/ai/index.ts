/**
 * Utility AI (GDD 9). Each decision tick a CPU scores every option from what it can see,
 * weights the scores by its Fracture personality (content/ai/personalities.ts) and level
 * (content/ai/levels.ts), adapts toward counters if it is the Unsworn, then runs the chosen
 * option's short input plan. Deterministic: all randomness is a hash of seed, frame and slot,
 * and all memory lives in the duel state.
 */
import type { SimInputFrame, WorldState } from '../../../../packages/sim/src/types.js';
import { CLASH_CHOICES, type ClashChoice } from '../../../../packages/clash/src/clash.js';
import { neutral } from '../game/session.js';
import type { DuelState } from '../game/rules/state.js';
import { LEVELS, MIND } from '../content/ai/levels.js';
import { COUNTERS, PERSONALITIES } from '../content/ai/personalities.js';
import { AI_INPUT, OPTION_IDS, OPTIONS, type OptionId } from '../content/ai/options.js';
import { MOVES } from '../content/knight/moves/index.js';
import { PHYSICS } from '../content/knight/physics.js';
import type { Mind } from './mind.js';
import { observe, remember, type View } from './observe.js';
import { plan, score } from './options.js';

/** Deterministic hash in [0, 1). */
function chance(seed: number, frame: number, slot: number, salt: number): number {
  let h =
    Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b) ^
    Math.imul(frame + 1, 0xc2b2ae35) ^
    Math.imul(slot + 7, 0x27d4eb2f) ^
    salt;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}

function categoryOf(attackId: string): string {
  const key = attackId.split(':')[1] ?? '';
  if (key.endsWith('-air')) return 'aerial';
  if (key.endsWith('smash')) return 'smash';
  if (MOVES.get(attackId) && /sling|gale|veil|rift|ascend|stoop|anchor|cleave|riposte/.test(key)) return 'special';
  return 'ground';
}

/** Unsworn: count what the opponent does, from what the CPU has seen (delayed). */
function study(mind: Mind, v: View): void {
  const tag = v.opp.attack
    ? `${v.opp.attack}`
    : v.opp.grabbing
      ? 'grab'
      : v.opp.guarding || v.opp.evading
        ? 'defense'
        : '';
  if (!tag || tag === mind.lastSeen) {
    if (!tag) mind.lastSeen = '';
    return;
  }
  mind.lastSeen = tag;
  const category = tag === 'grab' || tag === 'defense' ? tag : categoryOf(tag);
  mind.seen[category] = (mind.seen[category] ?? 0) + 1;
}

function adaptation(mind: Mind, id: OptionId): number {
  const entries = Object.entries(mind.seen);
  const total = entries.reduce((sum, [, count]) => sum + count, 0);
  if (total < MIND.adaptAfter) return 1;
  const [favourite, count] = entries.reduce((best, entry) => (entry[1] > best[1] ? entry : best));
  return COUNTERS[favourite]?.includes(id) ? 1 + (MIND.adaptBoost * count) / total : 1;
}

function decide(w: WorldState, d: DuelState, slot: number): void {
  const p = w.fighters[slot]!;
  const k = d.knights[p.id]!;
  const level = LEVELS[d.options.cpu[slot]!]!;
  const oath = d.options.oaths[slot]!;
  const personality = PERSONALITIES[oath];
  const v = observe(w, d, slot, level.reaction);
  const mind = k.mind;
  if (oath === 'unsworn') study(mind, v);
  const roll = (salt: number) => chance(w.seed, w.frame, slot, salt);
  let best: OptionId = 'wait';
  let bestScore = -Infinity;
  // Hesitation is a level trait, scaled by how much the personality likes to wait.
  const hesitating = !v.self.offstage && roll(1) < level.hesitation * (personality.weights.wait ?? 1);
  for (const [index, id] of OPTION_IDS.entries()) {
    if (level.locked.includes(id)) continue;
    if (hesitating && id !== 'wait') continue;
    const weight = personality.weights[id] ?? 1;
    const utility = score(id, v, personality.stance) * weight * (oath === 'unsworn' ? adaptation(mind, id) : 1);
    if (utility <= 0 && id !== 'wait') continue;
    const total = utility + roll(index + 17) * level.noise * (OPTIONS[id].base > 1 ? 0 : 1);
    if (total > bestScore) {
      bestScore = total;
      best = id;
    }
  }
  mind.option = best;
  mind.plan = plan(best, v, roll(3) < 0.5);
  mind.used[best] = (mind.used[best] ?? 0) + 1;
}

/** Launched: survival DI toward the stage and up; tech near the ground. */
function reactToHit(w: WorldState, d: DuelState, slot: number): SimInputFrame | null {
  const p = w.fighters[slot]!;
  if (p.hitstunFrames <= 0) return null;
  const level = LEVELS[d.options.cpu[slot]!]!;
  const k = d.knights[p.id]!;
  k.mind.plan = [];
  const launch = p.lastHitFrame;
  const di = chance(w.seed, launch, slot, 101) < level.di;
  const tech = chance(w.seed, launch, slot, 202) < level.tech;
  const home = p.x > 0 ? -AI_INPUT.full : AI_INPUT.full;
  return {
    ...neutral(w.frame),
    moveX: di ? home : 0,
    moveY: di ? AI_INPUT.full : 0,
    dodgePressed: tech && p.y < 3 * 1e6 && p.vy < 0 && w.frame % 4 === 0,
  };
}

/** Ground deceleration in world units per frame² (traction), for stopping-distance checks. */
const TRACTION = PHYSICS.traction / PHYSICS.unitsPerWorld;

/**
 * Grounded CPUs never slide off the ledge by accident: with Brawl-like traction a dash
 * carries several units, so brake toward centre whenever the stopping point is past the
 * safety margin. Edge-guards leave the stage only by jumping.
 */
function keepOnStage(input: SimInputFrame, v: View): void {
  const s = v.self;
  if (!s.grounded || input.jumpPressed) return;
  const outward = Math.sign(s.x);
  const speedOut = s.vx * outward;
  const stopping = speedOut > 0 ? (speedOut * speedOut) / (2 * TRACTION) : 0;
  if (s.edgeDistance - stopping < AI_INPUT.ledgeMargin && input.moveX * outward >= 0) {
    input.moveX = speedOut > 0 ? -outward * AI_INPUT.full : 0;
  }
}

export function aiInput(w: WorldState, d: DuelState, slot: number): SimInputFrame {
  const p = w.fighters[slot]!;
  const mind = d.knights[p.id]!.mind;
  remember(w, d, slot);
  const hit = reactToHit(w, d, slot);
  if (hit) {
    mind.input = hit;
    return hit;
  }
  const now = observe(w, d, slot, 0);
  // A chaser is offstage on purpose until it runs low on jumps.
  const chasing = mind.option === 'chase' && now.self.jumps >= 1 && !now.self.helpless;
  const offstageEmergency = mind.option !== 'recover' && now.self.offstage && !chasing;
  const ready = !now.self.busy || now.self.offstage;
  if ((!mind.plan.length && ready && w.frame % MIND.decision === 0) || offstageEmergency) decide(w, d, slot);
  const current = mind.plan[0];
  const input: SimInputFrame = current ? { ...neutral(w.frame), ...current.input, frame: w.frame } : neutral(w.frame);
  keepOnStage(input, now);
  if (current && --current.frames <= 0) mind.plan.shift();
  mind.input = input;
  return input;
}

/** CPU clash choice: a deterministic pick, weighted toward Parry at high levels. */
export function cpuClashChoice(w: WorldState, slot: number): ClashChoice {
  return CLASH_CHOICES[Math.floor(chance(w.seed, w.frame >> 2, slot, 303) * CLASH_CHOICES.length)]!;
}
