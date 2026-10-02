/**
 * What a CPU sees: its own state now, and the opponent as they were `reaction` frames ago.
 */
import { fixed as f } from '../../../../packages/deterministic-math/src/fixed.js';
import type { FighterState, WorldState } from '../../../../packages/sim/src/types.js';
import { gameData } from '../game/session.js';
import type { DuelKnight, DuelState } from '../game/rules/state.js';
import { stageById } from '../content/stages/roster.js';
import { MIND } from '../content/ai/levels.js';
import { FLAG, type Snapshot } from './mind.js';
import { MOVES } from '../content/knight/moves/index.js';

/** The attack's hitboxes are spent and it is still recovering: a whiff to punish. */
function recovering(attack: string, frame: number): boolean {
  const move = MOVES.get(attack);
  if (!move) return false;
  const last = Math.max(...move.strikes.map((strike) => strike.start + strike.active - 1));
  return frame >= last && frame < move.faf - 1;
}

export interface View {
  frame: number;
  slot: number;
  dx: number;
  dy: number;
  dist: number;
  /** Direction from self toward the opponent (-1 or 1). */
  toward: -1 | 1;
  half: number;
  /** Momentum: +1/-1 when this Knight holds right of way (its march direction), else 0. */
  goal: number;
  self: {
    x: number;
    y: number;
    vx: number;
    grounded: boolean;
    offstage: boolean;
    sideUsed: boolean;
    stance: 'wings' | 'cape';
    switchedAirborne: boolean;
    gliding: boolean;
    glideUsed: boolean;
    facing: -1 | 1;
    meter: number;
    strain: number;
    jumps: number;
    helpless: boolean;
    holding: boolean;
    pummelReady: boolean;
    busy: boolean;
    hitstun: boolean;
    kindled: boolean;
    bladeOut: boolean;
    edgeDistance: number;
  };
  opp: {
    x: number;
    y: number;
    vy: number;
    strain: number;
    attack: string;
    attackFrame: number;
    grounded: boolean;
    offstage: boolean;
    guarding: boolean;
    grabbing: boolean;
    vulnerable: boolean;
    evading: boolean;
  };
}

const OFFSTAGE_MARGIN = 0.4;

function flagsOf(p: FighterState, k: DuelKnight, half: number): number {
  const x = Math.abs(f.toNumber(p.x));
  let flags = 0;
  if (p.grounded) flags |= FLAG.grounded;
  if (k.guard > 0) flags |= FLAG.guarding;
  if (k.grab > 0) flags |= FLAG.grabbing;
  if (k.holding) flags |= FLAG.holding;
  if (p.hitstunFrames > 0) flags |= FLAG.hitstun;
  if (x > half + OFFSTAGE_MARGIN || p.y < 0) flags |= FLAG.offstage;
  if (k.evade > 0) flags |= FLAG.evading;
  if (p.landingLagFrames > 0) flags |= FLAG.landingLag;
  if (k.helpless) flags |= FLAG.helpless;
  return flags;
}

/** Records the opponent's present state; call once per frame. */
export function remember(w: WorldState, d: DuelState, slot: number): void {
  const p = w.fighters[slot]!;
  const t = w.fighters[1 - slot]!;
  const mind = d.knights[p.id]!.mind;
  const half = stageById(d.options.stage).width / 10;
  const attack = t.attack?.attackId ?? '';
  const snapshot: Snapshot = [t.x, t.y, t.vy, attack, t.attack?.frame ?? 0, flagsOf(t, d.knights[t.id]!, half)];
  mind.history.push(snapshot);
  if (mind.history.length > MIND.history) mind.history.shift();
}

export function observe(w: WorldState, d: DuelState, slot: number, reaction: number): View {
  const p = w.fighters[slot]!;
  const t = w.fighters[1 - slot]!;
  const k = d.knights[p.id]!;
  const half = stageById(d.options.stage).width / 10;
  const history = k.mind.history;
  const [ox, oy, ovy, attack, attackFrame, flags] = history[Math.max(0, history.length - 1 - reaction)]!;
  const x = f.toNumber(p.x);
  const y = f.toNumber(p.y);
  const oppX = f.toNumber(ox as never);
  const oppY = f.toNumber(oy as never);
  const dx = oppX - x;
  const dy = oppY - y;
  const session = gameData(w).knights[p.id]!;
  const stance = session.stance;
  const selfFlags = flagsOf(p, k, half);
  return {
    frame: w.frame,
    slot,
    dx,
    dy,
    dist: Math.abs(dx),
    toward: dx >= 0 ? 1 : -1,
    half,
    goal: d.options.format === 'momentum' && d.rightOfWay === p.id ? (slot === 0 ? 1 : -1) : 0,
    self: {
      x,
      y,
      vx: f.toNumber(p.vx),
      grounded: p.grounded,
      sideUsed: k.sideUses > 0,
      offstage: (selfFlags & FLAG.offstage) !== 0,
      stance: stance.id === 'cape' ? 'cape' : 'wings',
      switchedAirborne: stance.switchedAirborne,
      gliding: session.gliding,
      glideUsed: session.glideUsed,
      facing: p.facing,
      meter: k.meter,
      strain: p.percentTenths,
      jumps: p.jumpsRemaining,
      helpless: k.helpless,
      holding: !!k.holding,
      pummelReady: k.pummel === 0,
      busy: !!p.attack || k.lock > 0 || k.evade > 0 || p.landingLagFrames > 0 || stance.unfurl > 0,
      hitstun: p.hitstunFrames > 0,
      kindled: k.soul.remaining > 0,
      bladeOut: !!k.blade,
      edgeDistance: half - Math.abs(x),
    },
    opp: {
      x: oppX,
      y: oppY,
      vy: f.toNumber(ovy as never),
      strain: t.percentTenths,
      attack,
      attackFrame,
      grounded: (flags & FLAG.grounded) !== 0,
      offstage: (flags & FLAG.offstage) !== 0,
      guarding: (flags & FLAG.guarding) !== 0,
      grabbing: (flags & FLAG.grabbing) !== 0,
      vulnerable: (flags & (FLAG.hitstun | FLAG.landingLag | FLAG.helpless)) !== 0 || recovering(attack, attackFrame),
      evading: (flags & FLAG.evading) !== 0,
    },
  };
}
