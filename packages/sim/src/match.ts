import { fixed } from '../../deterministic-math/src/fixed.js';
import { beginAttack, stepCombatFrame, type AttackDefinition, type CombatantState, type HitEvent } from './combat.js';
import { K1_MOVEMENT, stepFighterMovement, type MovementRules } from './movement.js';
import { createFighterState, createWorld } from './world.js';
import type { FighterState, SimInputFrame, WorldState } from './types.js';

export interface MatchInputFrame {
  frame: number;
  byFighterId: Readonly<Record<string, SimInputFrame>>;
}

export interface MatchStepResult {
  state: WorldState;
  events: HitEvent[];
}

const HURTBOX_RADIUS = fixed.fromRatio(3, 4);
const HURTBOX_OFFSET_Y = fixed.fromRatio(3, 2);

export function createTwoFighterMatch(seed: number): WorldState {
  const base = createWorld(seed);
  return {
    ...base,
    fighters: [
      createFighterState('fighter-a', fixed.fromRatio(-9, 10), 1),
      createFighterState('fighter-b', fixed.fromRatio(9, 10), -1),
    ],
  };
}

function combatantFromFighter(fighter: FighterState): CombatantState {
  return {
    id: fighter.id,
    x: fighter.x,
    y: fighter.y,
    vx: fighter.vx,
    vy: fighter.vy,
    facing: fighter.facing,
    hurtboxRadius: HURTBOX_RADIUS,
    hurtboxOffsetY: HURTBOX_OFFSET_Y,
    percentTenths: fighter.percentTenths,
    hitlagFrames: fighter.hitlagFrames,
    hitstunFrames: fighter.hitstunFrames,
    attack: fighter.attack,
  };
}

function mergeCombat(fighter: FighterState, combatant: CombatantState): FighterState {
  const launched = combatant.vy > fixed.zero && (combatant.vx !== fighter.vx || combatant.vy !== fighter.vy);
  return {
    ...fighter,
    vx: combatant.vx,
    vy: combatant.vy,
    percentTenths: combatant.percentTenths,
    hitlagFrames: combatant.hitlagFrames,
    hitstunFrames: combatant.hitstunFrames,
    attack: combatant.attack,
    grounded: launched ? false : fighter.grounded,
    groundSurfaceId: launched ? null : fighter.groundSurfaceId,
    locomotion: launched ? 'airborne' : fighter.locomotion,
    locomotionFrame: launched ? 0 : fighter.locomotionFrame,
  };
}

function neutralInput(frame: number): SimInputFrame {
  return {
    frame,
    moveX: 0,
    moveY: 0,
    jumpPressed: false,
    jumpHeld: false,
    attackPressed: false,
    dodgePressed: false,
    shieldHeld: false,
  };
}

export function stepMatchWorld(
  state: WorldState,
  matchInput: MatchInputFrame,
  attacks: ReadonlyMap<string, AttackDefinition>,
  defaultAttackId: string,
  movementRules: MovementRules = K1_MOVEMENT,
): MatchStepResult {
  if (matchInput.frame !== state.frame) throw new Error(`match input frame ${matchInput.frame} does not match world frame ${state.frame}`);

  const moved = [...state.fighters]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((fighter) => {
      const input = matchInput.byFighterId[fighter.id] ?? neutralInput(state.frame);
      if (input.frame !== state.frame) throw new Error(`${fighter.id} input frame ${input.frame} does not match world frame ${state.frame}`);
      if (fighter.hitlagFrames > 0) return fighter;
      let next = stepFighterMovement(fighter, input, state.surfaces, state.ledges, movementRules);
      if (input.attackPressed && next.attack === null && next.hitstunFrames === 0 && next.invulnerableFrames === 0) {
        const started = beginAttack(combatantFromFighter(next), defaultAttackId);
        next = { ...next, attack: started.attack };
      }
      return next;
    });

  const combat = stepCombatFrame(moved.map(combatantFromFighter), attacks);
  const combatById = new Map(combat.combatants.map((entry) => [entry.id, entry]));
  const fighters = moved.map((fighter) => {
    const resolved = combatById.get(fighter.id);
    if (!resolved) throw new Error(`combat resolution lost fighter ${fighter.id}`);
    return mergeCombat(fighter, resolved);
  });

  return {
    state: {
      frame: state.frame + 1,
      seed: state.seed,
      fighters,
      surfaces: state.surfaces,
      ledges: state.ledges,
    },
    events: combat.events,
  };
}
