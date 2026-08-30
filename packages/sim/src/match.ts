import { fixed, type Fixed } from '../../deterministic-math/src/fixed.js';
import type { GrabActionDefinition, GrabActionInput } from '../../content/src/compileGrabActions.js';
import { beginAttack, stepCombatFrame, type AttackDefinition, type CombatantState, type CombatEvent } from './combat.js';
import { K1_MOVEMENT, stepFighterMovement, type MovementRules } from './movement.js';
import { createFighterState, createWorld } from './world.js';
import type { FighterState, SimInputFrame, WorldState } from './types.js';

export interface MatchInputFrame { frame: number; byFighterId: Readonly<Record<string, SimInputFrame>>; }
export interface GrabEvent { type: 'grab'; attackerId: string; targetId: string; }
export interface GrabReleaseEvent { type: 'grab-release'; attackerId: string; targetId: string; }
export interface PummelEvent { type: 'pummel'; attackerId: string; targetId: string; actionId: string; damageTenths: number; }
export interface ThrowEvent { type: 'throw'; attackerId: string; targetId: string; actionId: string; damageTenths: number; knockbackX: Fixed; knockbackY: Fixed; hitstunFrames: number; }
export type MatchEvent = CombatEvent | GrabEvent | GrabReleaseEvent | PummelEvent | ThrowEvent;
export interface MatchStepResult { state: WorldState; events: MatchEvent[]; }

const HURTBOX_RADIUS = fixed.fromRatio(3, 4);
const HURTBOX_OFFSET_Y = fixed.fromRatio(3, 2);
const GRAB_RANGE = fixed.fromRatio(8, 5);
const GRAB_VERTICAL_RANGE = fixed.fromRatio(3, 2);
const GRAB_HOLD_OFFSET = fixed.fromRatio(4, 5);
export const GRAB_MAX_HOLD_FRAMES = 90;

export function createTwoFighterMatch(seed: number): WorldState {
  const base = createWorld(seed);
  return { ...base, fighters: [createFighterState('fighter-a', fixed.fromRatio(-9, 10), 1), createFighterState('fighter-b', fixed.fromRatio(9, 10), -1)] };
}

function combatantFromFighter(fighter: FighterState): CombatantState {
  return {
    id: fighter.id, x: fighter.x, y: fighter.y, vx: fighter.vx, vy: fighter.vy, facing: fighter.facing,
    hurtboxRadius: HURTBOX_RADIUS, hurtboxOffsetY: HURTBOX_OFFSET_Y,
    percentTenths: fighter.percentTenths, hitlagFrames: fighter.hitlagFrames, hitstunFrames: fighter.hitstunFrames,
    invulnerableFrames: fighter.invulnerableFrames, attack: fighter.attack, shielding: fighter.shielding,
    shieldHealth: fighter.shieldHealth, shieldStunFrames: fighter.shieldStunFrames, shieldRegenDelayFrames: fighter.shieldRegenDelayFrames,
  };
}

function mergeCombat(fighter: FighterState, combatant: CombatantState): FighterState {
  const launched = combatant.vy > fixed.zero && (combatant.vx !== fighter.vx || combatant.vy !== fighter.vy);
  return {
    ...fighter, vx: combatant.vx, vy: combatant.vy, percentTenths: combatant.percentTenths,
    hitlagFrames: combatant.hitlagFrames, hitstunFrames: combatant.hitstunFrames, attack: combatant.attack,
    shielding: combatant.shielding, shieldHealth: combatant.shieldHealth, shieldStunFrames: combatant.shieldStunFrames,
    shieldRegenDelayFrames: combatant.shieldRegenDelayFrames,
    grounded: launched ? false : fighter.grounded, groundSurfaceId: launched ? null : fighter.groundSurfaceId,
    locomotion: launched ? 'airborne' : fighter.locomotion, locomotionFrame: launched ? 0 : fighter.locomotionFrame,
  };
}

function neutralInput(frame: number): SimInputFrame {
  return { frame, moveX: 0, moveY: 0, jumpPressed: false, jumpHeld: false, attackPressed: false, grabPressed: false, dodgePressed: false, shieldHeld: false };
}

function movementInputForDefense(input: SimInputFrame, fighter: FighterState): SimInputFrame {
  const wantsShield = input.shieldHeld && fighter.grounded && fighter.shieldHealth > 0 && fighter.hitstunFrames === 0;
  if (!wantsShield || input.dodgePressed || input.grabPressed) return input;
  return { ...input, moveX: 0, moveY: 0, jumpPressed: false, jumpHeld: false, attackPressed: false, grabPressed: false };
}

function abs(value: Fixed): Fixed { return value < fixed.zero ? fixed.sub(fixed.zero, value) : value; }

function eligibleGrabTarget(attacker: FighterState, target: FighterState): boolean {
  if (attacker.id === target.id || target.grabbedById !== null || target.grabTargetId !== null) return false;
  if (target.invulnerableFrames > 0 || target.hitstunFrames > 0) return false;
  const dx = fixed.sub(target.x, attacker.x);
  if ((attacker.facing === 1 && dx < fixed.zero) || (attacker.facing === -1 && dx > fixed.zero)) return false;
  return abs(dx) <= GRAB_RANGE && abs(fixed.sub(target.y, attacker.y)) <= GRAB_VERTICAL_RANGE;
}

function resolveGrabAttempts(fightersInput: FighterState[], inputs: Readonly<Record<string, SimInputFrame>>): { fighters: FighterState[]; events: GrabEvent[] } {
  const fighters = fightersInput.map((fighter) => ({ ...fighter }));
  const events: GrabEvent[] = [];
  for (const attacker of [...fighters].sort((a, b) => a.id.localeCompare(b.id))) {
    const input = inputs[attacker.id];
    if (!input?.grabPressed || attacker.grabTargetId !== null || attacker.grabbedById !== null) continue;
    if (attacker.hitstunFrames > 0 || attacker.hitlagFrames > 0 || attacker.invulnerableFrames > 0 || attacker.attack !== null) continue;
    const candidates = fighters.filter((target) => eligibleGrabTarget(attacker, target)).sort((a, b) => {
      const da = abs(fixed.sub(a.x, attacker.x)); const db = abs(fixed.sub(b.x, attacker.x));
      return da === db ? a.id.localeCompare(b.id) : da - db;
    });
    const target = candidates[0]; if (!target) continue;
    const attackerIndex = fighters.findIndex((entry) => entry.id === attacker.id);
    const targetIndex = fighters.findIndex((entry) => entry.id === target.id);
    if (attackerIndex < 0 || targetIndex < 0) continue;
    const heldX = fixed.add(attacker.x, fixed.mul(GRAB_HOLD_OFFSET, fixed.fromInt(attacker.facing)));
    fighters[attackerIndex] = { ...attacker, grabTargetId: target.id, grabFrames: 0, grabAction: null, shielding: false, attack: null, vx: fixed.zero };
    fighters[targetIndex] = {
      ...target, x: heldX, y: attacker.y, vx: fixed.zero, vy: fixed.zero, grabbedById: attacker.id, grabFrames: 0,
      grabAction: null, shielding: false, shieldStunFrames: 0, attack: null, locomotion: 'grabbed', locomotionFrame: 0,
      grounded: attacker.grounded, groundSurfaceId: attacker.groundSurfaceId,
    };
    events.push({ type: 'grab', attackerId: attacker.id, targetId: target.id });
  }
  return { fighters, events };
}

function maintainGrabRelationships(fightersInput: FighterState[]): { fighters: FighterState[]; events: GrabReleaseEvent[] } {
  const fighters = fightersInput.map((fighter) => ({ ...fighter }));
  const events: GrabReleaseEvent[] = [];
  for (const captor of [...fighters].sort((a, b) => a.id.localeCompare(b.id))) {
    if (captor.grabTargetId === null) continue;
    const captive = fighters.find((fighter) => fighter.id === captor.grabTargetId);
    const captorIndex = fighters.findIndex((fighter) => fighter.id === captor.id);
    if (captorIndex < 0) continue;
    if (!captive || captive.grabbedById !== captor.id) {
      fighters[captorIndex] = { ...captor, grabTargetId: null, grabFrames: 0, grabAction: null };
      continue;
    }
    const captiveIndex = fighters.findIndex((fighter) => fighter.id === captive.id);
    if (captiveIndex < 0) continue;
    const nextFrames = captor.grabFrames + 1;
    if (nextFrames >= GRAB_MAX_HOLD_FRAMES && captor.grabAction === null) {
      fighters[captorIndex] = { ...captor, grabTargetId: null, grabFrames: 0, grabAction: null };
      fighters[captiveIndex] = { ...captive, grabbedById: null, grabFrames: 0, grabAction: null, locomotion: captive.grounded ? 'idle' : 'airborne', locomotionFrame: 0 };
      events.push({ type: 'grab-release', attackerId: captor.id, targetId: captive.id });
      continue;
    }
    const heldX = fixed.add(captor.x, fixed.mul(GRAB_HOLD_OFFSET, fixed.fromInt(captor.facing)));
    fighters[captorIndex] = { ...captor, grabFrames: nextFrames };
    fighters[captiveIndex] = {
      ...captive, x: heldX, y: captor.y, vx: fixed.zero, vy: fixed.zero, grabbedById: captor.id, grabFrames: nextFrames,
      shielding: false, attack: null, grabAction: null, locomotion: 'grabbed', locomotionFrame: nextFrames,
      grounded: captor.grounded, groundSurfaceId: captor.groundSurfaceId,
    };
  }
  return { fighters, events };
}

function chooseGrabAction(input: SimInputFrame, facing: -1 | 1): GrabActionInput {
  if (input.moveY >= 500) return 'up-throw';
  if (input.moveY <= -500) return 'down-throw';
  const relativeX = input.moveX * facing;
  if (relativeX >= 500) return 'forward-throw';
  if (relativeX <= -500) return 'back-throw';
  return 'pummel';
}

function normalizedThrowDirection(definition: Extract<GrabActionDefinition, { kind: 'throw' }>, facing: -1 | 1): { x: Fixed; y: Fixed } {
  const rawX = definition.directionX * facing;
  const rawY = definition.directionY;
  const magnitude = Math.max(Math.abs(rawX), Math.abs(rawY), 1);
  return { x: fixed.fromRatio(rawX, magnitude), y: fixed.fromRatio(rawY, magnitude) };
}

function stepGrabActions(
  fightersInput: FighterState[],
  inputs: Readonly<Record<string, SimInputFrame>>,
  definitions: ReadonlyMap<GrabActionInput, GrabActionDefinition>,
): { fighters: FighterState[]; events: (PummelEvent | ThrowEvent)[] } {
  const fighters: FighterState[] = fightersInput.map((fighter) => ({ ...fighter, grabAction: fighter.grabAction ? { ...fighter.grabAction } : null }));
  const events: (PummelEvent | ThrowEvent)[] = [];
  const byId = new Map([...definitions.values()].map((definition) => [definition.id, definition] as const));

  for (const initialCaptor of [...fighters].sort((a, b) => a.id.localeCompare(b.id))) {
    if (initialCaptor.grabTargetId === null) continue;
    const captorIndex = fighters.findIndex((fighter) => fighter.id === initialCaptor.id);
    if (captorIndex < 0) continue;
    const indexedCaptor = fighters[captorIndex];
    if (!indexedCaptor) continue;
    let captor: FighterState = indexedCaptor;
    const captiveIndex = fighters.findIndex((fighter) => fighter.id === captor.grabTargetId);
    if (captiveIndex < 0) continue;
    const indexedCaptive = fighters[captiveIndex];
    if (!indexedCaptive || indexedCaptive.grabbedById !== captor.id) continue;
    let captive: FighterState = indexedCaptive;
    const input = inputs[captor.id] ?? neutralInput(0);

    if (captor.grabAction === null && input.attackPressed) {
      const selected = definitions.get(chooseGrabAction(input, captor.facing));
      if (selected) captor = { ...captor, grabAction: { actionId: selected.id, frame: 0 } };
    }
    if (captor.grabAction === null) { fighters[captorIndex] = captor; continue; }

    const definition = byId.get(captor.grabAction.actionId);
    if (!definition) throw new Error(`missing grab action definition ${captor.grabAction.actionId}`);
    const actionFrame = captor.grabAction.frame;

    if (definition.kind === 'pummel' && actionFrame === definition.eventFrame) {
      captive = { ...captive, percentTenths: captive.percentTenths + definition.damageTenths, hitlagFrames: Math.max(captive.hitlagFrames, definition.hitlagFrames) };
      captor = { ...captor, hitlagFrames: Math.max(captor.hitlagFrames, definition.hitlagFrames) };
      events.push({ type: 'pummel', attackerId: captor.id, targetId: captive.id, actionId: definition.id, damageTenths: definition.damageTenths });
    }

    if (definition.kind === 'throw' && actionFrame === definition.releaseFrame) {
      const postPercent = captive.percentTenths + definition.damageTenths;
      const magnitude = fixed.add(definition.baseKnockback, fixed.mul(definition.growthPer100Percent, fixed.fromRatio(postPercent, 1000)));
      const direction = normalizedThrowDirection(definition, captor.facing);
      const knockbackX = fixed.mul(direction.x, magnitude);
      const knockbackY = fixed.mul(direction.y, magnitude);
      captive = {
        ...captive, percentTenths: postPercent, vx: knockbackX, vy: knockbackY,
        hitstunFrames: Math.max(captive.hitstunFrames, definition.hitstunFrames), grabbedById: null, grabFrames: 0,
        locomotion: 'airborne', locomotionFrame: 0, grounded: false, groundSurfaceId: null,
      };
      captor = { ...captor, grabTargetId: null, grabFrames: 0, grabAction: null };
      fighters[captorIndex] = captor; fighters[captiveIndex] = captive;
      events.push({ type: 'throw', attackerId: captor.id, targetId: captive.id, actionId: definition.id, damageTenths: definition.damageTenths, knockbackX, knockbackY, hitstunFrames: definition.hitstunFrames });
      continue;
    }

    const nextFrame = actionFrame + 1;
    captor = { ...captor, grabAction: nextFrame >= definition.totalFrames ? null : { actionId: definition.id, frame: nextFrame } };
    fighters[captorIndex] = captor;
    fighters[captiveIndex] = captive;
  }
  return { fighters, events };
}

export function stepMatchWorld(
  state: WorldState,
  matchInput: MatchInputFrame,
  attacks: ReadonlyMap<string, AttackDefinition>,
  defaultAttackId: string,
  movementRules: MovementRules = K1_MOVEMENT,
  grabActions: ReadonlyMap<GrabActionInput, GrabActionDefinition> = new Map(),
): MatchStepResult {
  if (matchInput.frame !== state.frame) throw new Error(`match input frame ${matchInput.frame} does not match world frame ${state.frame}`);
  const canonicalInputs: Record<string, SimInputFrame> = {};
  for (const fighter of state.fighters) {
    const input = matchInput.byFighterId[fighter.id] ?? neutralInput(state.frame);
    if (input.frame !== state.frame) throw new Error(`${fighter.id} input frame ${input.frame} does not match world frame ${state.frame}`);
    canonicalInputs[fighter.id] = input;
  }

  const moved = [...state.fighters].sort((a, b) => a.id.localeCompare(b.id)).map((fighter) => {
    const input = canonicalInputs[fighter.id] ?? neutralInput(state.frame);
    if (fighter.grabbedById !== null || fighter.hitlagFrames > 0) return fighter;
    if (fighter.hitstunFrames > 0) return { ...fighter, shielding: false };
    const movementInput = movementInputForDefense(input, fighter);
    let next = fighter.grabTargetId !== null
      ? { ...fighter, vx: fixed.zero, shielding: false, attack: null }
      : stepFighterMovement(fighter, movementInput, state.surfaces, state.ledges, movementRules);
    const canShield = input.shieldHeld && next.grounded && next.shieldHealth > 0 && next.hitstunFrames === 0 && !input.dodgePressed && !input.grabPressed && next.grabTargetId === null;
    next = { ...next, shielding: canShield };
    if (input.attackPressed && next.attack === null && next.hitstunFrames === 0 && next.invulnerableFrames === 0 && !next.shielding && next.shieldStunFrames === 0 && next.grabTargetId === null) {
      const started = beginAttack(combatantFromFighter(next), defaultAttackId); next = { ...next, attack: started.attack };
    }
    return next;
  });

  const grabbed = resolveGrabAttempts(moved, canonicalInputs);
  const combatEligible = grabbed.fighters.map((fighter) => fighter.grabbedById !== null ? { ...fighter, invulnerableFrames: Math.max(1, fighter.invulnerableFrames) } : fighter);
  const combat = stepCombatFrame(combatEligible.map(combatantFromFighter), attacks);
  const combatById = new Map(combat.combatants.map((entry) => [entry.id, entry] as const));
  const combatMerged = grabbed.fighters.map((fighter) => {
    const resolved = combatById.get(fighter.id); if (!resolved) throw new Error(`combat resolution lost fighter ${fighter.id}`);
    return mergeCombat(fighter, resolved);
  });
  const maintained = maintainGrabRelationships(combatMerged);
  const grabActionResult = stepGrabActions(maintained.fighters, canonicalInputs, grabActions);

  return {
    state: { frame: state.frame + 1, seed: state.seed, fighters: grabActionResult.fighters, surfaces: state.surfaces, ledges: state.ledges },
    events: [...grabbed.events, ...combat.events, ...maintained.events, ...grabActionResult.events],
  };
}
