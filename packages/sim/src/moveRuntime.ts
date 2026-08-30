import { fixed } from '../../deterministic-math/src/fixed.js';
import type { MoveRuntimeDefinition } from '../../content/src/compileMoveRuntime.js';
import type { FighterState } from './types.js';

function activeWindow(frame: number, startFrame: number, endFrame: number): boolean {
  return frame >= startFrame && frame <= endFrame;
}

/**
 * Applies fighter-authored non-hitbox move timeline primitives for the current
 * attack frame. Horizontal vectors are authored facing-right and mirror with
 * fighter facing. The function never advances the attack timeline itself.
 */
export function applyMoveRuntimeFrame(
  fighter: FighterState,
  definitions: ReadonlyMap<string, MoveRuntimeDefinition>,
): FighterState {
  if (!fighter.attack) return fighter;
  const definition = definitions.get(fighter.attack.attackId);
  if (!definition) return fighter;
  const frame = fighter.attack.frame;
  let next = fighter;
  const facing = fixed.fromInt(fighter.facing);

  for (const velocity of definition.velocities) {
    if (velocity.frame !== frame) continue;
    next = { ...next, vx: fixed.mul(velocity.x, facing), vy: velocity.y };
  }
  for (const impulse of definition.impulses) {
    if (impulse.frame !== frame) continue;
    next = {
      ...next,
      vx: fixed.add(next.vx, fixed.mul(impulse.x, facing)),
      vy: fixed.add(next.vy, impulse.y),
    };
  }
  const invulnerable = definition.invulnerability.some((window) => activeWindow(frame, window.startFrame, window.endFrame));
  if (invulnerable) next = { ...next, invulnerableFrames: Math.max(next.invulnerableFrames, 1) };
  return next;
}

export function applyMoveRuntimeFrames(
  fighters: readonly FighterState[],
  definitions: ReadonlyMap<string, MoveRuntimeDefinition>,
): FighterState[] {
  return [...fighters]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((fighter) => applyMoveRuntimeFrame(fighter, definitions));
}
