import type { FighterState } from '../../sim/src/types.js';

export interface AnimationIntent {
  role: string;
  frame: number;
  loop: boolean;
}

export interface AnimationRoleRegistry {
  attackRoleById?: ReadonlyMap<string, string>;
  grabActionRoleById?: ReadonlyMap<string, string>;
}

function movingBackward(fighter: FighterState): boolean {
  return fighter.vx !== 0 && Math.sign(fighter.vx) !== fighter.facing;
}

function rollingBackward(fighter: FighterState): boolean {
  return fighter.vx !== 0 && Math.sign(fighter.vx) !== fighter.facing;
}

/**
 * Renderer-neutral animation resolver. It consumes semantic authoritative state
 * and returns an animation role + simulation-relative frame. Renderers are free
 * to blend/ease visually, but may not feed animation timing back into simulation.
 */
export function resolveFighterAnimation(fighter: FighterState, registry: AnimationRoleRegistry = {}): AnimationIntent {
  if (fighter.eliminated) return { role: 'defeat', frame: 0, loop: true };
  if (fighter.respawnFrames > 0 || fighter.locomotion === 'respawn') return { role: 'respawn', frame: fighter.locomotionFrame, loop: false };
  if (fighter.grabbedById !== null || fighter.locomotion === 'grabbed') return { role: 'grabbed', frame: fighter.grabFrames, loop: true };
  if (fighter.grabAction !== null) {
    const role = registry.grabActionRoleById?.get(fighter.grabAction.actionId) ?? 'grab_hold';
    return { role, frame: fighter.grabAction.frame, loop: false };
  }
  if (fighter.grabTargetId !== null) return { role: 'grab_hold', frame: fighter.grabFrames, loop: true };
  if (fighter.attack !== null) {
    const role = registry.attackRoleById?.get(fighter.attack.attackId);
    if (role) return { role, frame: fighter.attack.frame, loop: false };
  }
  if (fighter.shieldHealth <= 0 && fighter.hitstunFrames > 0) return { role: 'shield_break', frame: fighter.locomotionFrame, loop: false };
  if (fighter.hitstunFrames > 0) return { role: fighter.grounded ? 'hit_heavy' : 'tumble', frame: fighter.locomotionFrame, loop: false };
  if (fighter.shielding) return { role: 'shield_hold', frame: fighter.locomotionFrame, loop: true };

  switch (fighter.locomotion) {
    case 'idle': return { role: 'idle', frame: fighter.locomotionFrame, loop: true };
    case 'walk': return { role: movingBackward(fighter) ? 'walk_back' : 'walk', frame: fighter.locomotionFrame, loop: true };
    case 'dash': return { role: 'initial_dash', frame: fighter.locomotionFrame, loop: false };
    case 'run': return { role: 'run', frame: fighter.locomotionFrame, loop: true };
    case 'turn': return { role: 'turn', frame: fighter.locomotionFrame, loop: false };
    case 'crouch': return { role: 'crouch', frame: fighter.locomotionFrame, loop: true };
    case 'jump-squat': return { role: 'jump_squat', frame: fighter.locomotionFrame, loop: false };
    case 'airborne':
      if (fighter.fastFalling) return { role: 'fast_fall', frame: fighter.locomotionFrame, loop: true };
      return { role: fighter.vy > 0 ? 'full_hop' : 'fall', frame: fighter.locomotionFrame, loop: true };
    case 'landing': return { role: 'land', frame: fighter.locomotionFrame, loop: false };
    case 'ledge-hang': return { role: 'ledge_hang', frame: fighter.locomotionFrame, loop: true };
    case 'air-dodge': return { role: 'air_dodge', frame: fighter.locomotionFrame, loop: false };
    case 'spot-dodge': return { role: 'spot_dodge', frame: fighter.locomotionFrame, loop: false };
    case 'roll': return { role: rollingBackward(fighter) ? 'roll_back' : 'roll_forward', frame: fighter.locomotionFrame, loop: false };
    case 'tech-in-place': return { role: 'tech_in_place', frame: fighter.locomotionFrame, loop: false };
    case 'tech-roll': return { role: rollingBackward(fighter) ? 'tech_back' : 'tech_forward', frame: fighter.locomotionFrame, loop: false };
    case 'knockdown': return { role: 'missed_tech', frame: fighter.locomotionFrame, loop: false };
    default: return { role: 'idle', frame: fighter.locomotionFrame, loop: true };
  }
}
