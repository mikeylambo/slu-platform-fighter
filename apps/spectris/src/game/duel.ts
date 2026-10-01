/**
 * Spectris duel orchestration. Every rule lives in `game/rules/`; this file only
 * decides the order in which they run each frame:
 *
 *   1. Phase gates: match over, between rounds, clash window.
 *   2. Clock, Sudden Death, and blast zones.
 *   3. Per-Knight pre-simulation pass (buffer, timers, defense, grabs, actions, specials).
 *   4. PF simulation step (movement, hitboxes, blast zones) via the session adapter.
 *   5. Post-simulation pass (projectiles, ghosts, helplessness) and hit resolution.
 *   6. Shatters, Fractures, Momentum, and round end.
 */
import type { MatchEvent, MatchInputFrame } from '../../../../packages/sim/src/match.js';
import type { HitEvent } from '../../../../packages/sim/src/combat.js';
import type { FighterState, SimInputFrame, WorldState } from '../../../../packages/sim/src/types.js';
import { gameData, IDS, neutral, stepSession } from './session.js';
import { registerDuelMoves } from '../content/knight/moves/special.js';
import { PHYSICS } from '../content/knight/physics.js';
import { DEFAULT_OPTIONS } from '../content/rules/duel.js';
import { stageById, surfaces } from '../content/stages/roster.js';
import { aiInput, cpuClashChoice } from '../ai/scripted.js';
import { clearBuffer } from './rules/input-buffer.js';
import { makeActor } from './rules/actor.js';
import {
  captureGuard,
  dropGuardOutsideCape,
  holdGuardRelease,
  holdRiposteGuard,
  resolveGuardedHit,
  stepEvade,
  stepStagger,
  tickGuardRelease,
  tickIntegrity,
  tryEvade,
  tryGuard,
} from './rules/defense.js';
import { holdVictim, stepGrabWindow, stepHolding, tickPummel, tickRegrab, tryGrab } from './rules/grab.js';
import { cancelClashedHits, findClash, openClash, openClashFromClank, stepClashWindow } from './rules/clash.js';
import { stepFeint, stepGhost, tryFeint } from './rules/feint.js';
import { detectDoubleKindle, holdActivation, tickBurn, tickKindle, tryKindle } from './rules/kindle.js';
import {
  absorbsHit,
  becomesHelpless,
  landAnchorPlunge,
  stepActiveSpecial,
  stepBlade,
  stepCleaveCharge,
  tryGlideAttack,
  tryPunch,
  trySpecial,
} from './rules/specials/index.js';
import { applyHit, shatter, takeFracture } from './rules/fractures.js';
import { blastRules, checkRoundEnd, stepRoundEnd, tickClock } from './rules/rounds.js';
import { stepMomentumFracture } from './rules/momentum.js';
import { applyStanceLock, stripStanceInput } from './rules/training.js';
import { cancelOnHitstun, isFree, refreshRecovery, stepHelpless, stepLock } from './rules/recovery.js';
import { settleFlash, tryFlashUnfurl } from './rules/stance.js';
import { duelData, effectsOf, save, type Actor, type DuelState, type Frame } from './rules/state.js';

export { createDuel, DEFAULT_DUEL } from './rules/setup.js';
export { duelData } from './rules/state.js';
export type { DuelKnight, DuelOptions, DuelState } from './rules/state.js';

registerDuelMoves();

type StepResult = { state: WorldState; events: MatchEvent[] };

/** Advances one duel frame. Pure: the input world is not mutated. */
export function stepDuel(original: WorldState, bundle: MatchInputFrame): StepResult {
  const w = structuredClone(original);
  const d = duelData(w);
  if (!d) {
    return stepSession(w, bundle);
  }
  d.events = [];
  if (d.phase === 'over') {
    return idle(w, d);
  }
  if (d.phase === 'round-end') {
    return stepRoundEnd(w, d, bundle, IDS);
  }
  applyStanceLock(w, d);
  const inputs = readInputs(w, d, bundle);
  stripStanceInput(d, inputs);
  const samples = Object.fromEntries(Object.entries(inputs).map(([id, input]) => [id, { ...input }]));
  const frame: Frame = { w, d, inputs, samples, guards: new Map(), immediate: [], shatterTargets: new Set() };
  if (d.clash > 0) {
    stepClashWindow(frame, IDS, (slot) => (d.options.cpu[slot] ? cpuClashChoice(w, slot) : null));
    return idle(w, d);
  }
  const stage = stageById(d.options.stage);
  w.surfaces = surfaces(stage, w.frame);
  tickClock(w, d);
  const rules = blastRules(d, stage);
  for (const [index, p] of w.fighters.entries()) {
    preSimulation(frame, index, p);
  }
  if (detectDoubleKindle(frame, w.fighters)) {
    openClash(d, w.fighters);
  }
  writeSessionModifiers(w, d);
  save(w, d);
  const before = structuredClone(w);
  const result = stepSession(w, { frame: w.frame, byFighterId: frame.inputs }, rules);
  const next = result.state;
  const events: MatchEvent[] = [...frame.immediate, ...result.events];
  const after: Frame = { ...frame, w: next };
  for (const [index, p] of next.fighters.entries()) {
    postSimulation(after, index, p, before.fighters[index]!, events);
  }
  resolveHits(after, before, events);
  for (const p of next.fighters) {
    if (frame.shatterTargets.has(p.id)) {
      shatter(after, p, rules, events);
    }
  }
  for (const event of events) {
    if (event.type === 'ko') {
      const p = next.fighters.find((fighter) => fighter.id === event.fighterId)!;
      takeFracture(d, p);
      stepMomentumFracture(next, d, p, IDS);
    }
  }
  checkRoundEnd(next, d, IDS);
  save(next, d);
  return { state: next, events };
}

/** Frames where only the clock advances (match over, clash freeze). */
function idle(w: WorldState, d: DuelState): StepResult {
  w.frame++;
  save(w, d);
  return { state: w, events: [] };
}

function readInputs(w: WorldState, d: DuelState, bundle: MatchInputFrame): Record<string, SimInputFrame> {
  const inputs: Record<string, SimInputFrame> = {};
  for (const [index, p] of w.fighters.entries()) {
    if (d.options.cpu[index]) {
      inputs[p.id] = aiInput(w, d, index);
    } else {
      inputs[p.id] = { ...(bundle.byFighterId[p.id] ?? neutral(w.frame)) };
    }
  }
  return inputs;
}

/** Everything a Knight does before PF moves the world this frame. Order is behaviour. */
function preSimulation(frame: Frame, index: number, p: FighterState): void {
  const actor = makeActor(frame, index, p);
  const { k } = actor;
  tickKindle(k);
  tickIntegrity(k);
  tickRegrab(k);
  refreshRecovery(actor);
  tickBurn(actor);
  cancelOnHitstun(actor);
  dropGuardOutsideCape(actor);
  k.flash = false;
  const free = isFree(actor);
  holdActivation(actor);
  tickGuardRelease(k);
  tickPummel(k);
  stepStagger(actor);
  stepLock(actor);
  stepHelpless(actor);
  stepEvade(actor);
  stepHolding(actor);
  if (holdVictim(actor)) {
    return;
  }
  stepGrabWindow(actor);
  if (free && !p.attack && !k.holding && !k.heldBy && !k.evade) {
    chooseAction(actor);
  }
  holdGuardRelease(actor);
  holdRiposteGuard(actor);
  captureGuard(actor);
  stepCleaveCharge(actor);
  stepFeint(actor);
  stepActiveSpecial(actor);
}

/** A free Knight's action, in priority order, then an optional Flash Unfurl. */
function chooseAction(actor: Actor): void {
  clearBuffer(actor.k);
  const actions = [tryKindle, tryFeint, tryGrab, tryEvade, tryGuard, trySpecial, tryGlideAttack, tryPunch];
  actions.some((action) => action(actor));
  tryFlashUnfurl(actor);
}

/** Kindle modifiers the session adapter reads (extra jumps, glide length, buffer window). */
function writeSessionModifiers(w: WorldState, d: DuelState): void {
  const data = gameData(w);
  data.modifiers = Object.fromEntries(
    w.fighters.map((p, index) => {
      const kindle = effectsOf(d.options.oaths[index]!).kindle;
      const kindled = d.knights[p.id]!.soul.remaining > 0;
      const modifier = {
        extraJumps: kindled ? kindle.extraJumps : 0,
        glideDuration: kindled && kindle.glideDuration ? kindle.glideDuration : PHYSICS.glide.duration,
        buffer: d.options.buffer ?? DEFAULT_OPTIONS.buffer,
      };
      return [p.id, modifier];
    }),
  );
  for (const p of w.fighters) {
    const k = d.knights[p.id]!;
    if (k.lock || k.stagger || k.evade || k.guard || k.heldBy) {
      data.knights[p.id]!.bufferedMove = null;
      data.knights[p.id]!.bufferFrames = 0;
    }
  }
  w.extensionState = JSON.stringify({ ...data, duel: d });
}

/** After PF moves the world: flash settle, Anchor landing, helplessness, blade, ghosts. */
function postSimulation(frame: Frame, index: number, p: FighterState, old: FighterState, events: MatchEvent[]): void {
  const { w, d } = frame;
  const k = d.knights[p.id]!;
  const t = w.fighters[1 - index]!;
  const effects = effectsOf(d.options.oaths[index]!);
  settleFlash(w, p, k);
  landAnchorPlunge(p, old, effects.anchorMove);
  if (becomesHelpless(p, old, effects)) {
    k.helpless = true;
  }
  stepBlade(w, d, p, t, k, effects, events);
  stepGhost(w, p, t, k, events);
}

/** Resolves PF hit and clank events against guard, armor, clash, and the life system. */
function resolveHits(frame: Frame, before: WorldState, events: MatchEvent[]): void {
  const { w } = frame;
  const clashed = findClash(events);
  if (clashed) {
    cancelClashedHits(w.fighters, before.fighters);
  }
  for (const event of events) {
    if (event.type === 'hit') {
      if (!clashed) {
        resolveHit(frame, before, event);
      }
    } else if (event.type === 'clank') {
      openClashFromClank(frame, event.attackAId, event.attackBId);
    }
  }
}

function resolveHit(frame: Frame, before: WorldState, hit: HitEvent): void {
  const { w, d } = frame;
  const target = w.fighters.find((fighter) => fighter.id === hit.targetId)!;
  const attacker = w.fighters.find((fighter) => fighter.id === hit.attackerId)!;
  const old = before.fighters.find((fighter) => fighter.id === target.id)!;
  const targetOath = d.options.oaths[IDS.indexOf(target.id as (typeof IDS)[number])]!;
  const attackerOath = d.options.oaths[IDS.indexOf(attacker.id as (typeof IDS)[number])]!;
  const targetEffects = effectsOf(targetOath);
  if (resolveGuardedHit(frame, hit, target, attacker, old, targetEffects, attackerOath)) {
    return;
  }
  const k = d.knights[target.id]!;
  if (absorbsHit(k, targetOath, targetEffects, old, hit.damageTenths)) {
    target.hitstunFrames = 0;
    target.vx = old.vx;
    target.vy = old.vy;
    target.attack = old.attack;
  }
  applyHit(frame, hit, target, attacker, old, attackerOath);
}
