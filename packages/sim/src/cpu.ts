import { fixed, type Fixed } from '../../deterministic-math/src/fixed.js';
import type { FighterState, SimInputFrame, WorldState } from './types.js';

export interface CpuProfile {
  approachDistance: Fixed;
  attackDistance: Fixed;
  verticalAttackTolerance: Fixed;
  recoveryY: Fixed;
  shieldThreatDistance: Fixed;
  actionPeriod: number;
}

export const BASIC_CPU: CpuProfile = {
  approachDistance: fixed.fromInt(5),
  attackDistance: fixed.fromRatio(21, 10),
  verticalAttackTolerance: fixed.fromInt(2),
  recoveryY: fixed.fromInt(-3),
  shieldThreatDistance: fixed.fromRatio(5, 2),
  actionPeriod: 17,
};

function abs(value: Fixed): Fixed { return value < fixed.zero ? fixed.sub(fixed.zero, value) : value; }
function sign(value: Fixed): -1 | 0 | 1 { return value < fixed.zero ? -1 : value > fixed.zero ? 1 : 0; }
function phaseFor(id: string, period: number): number {
  let hash = 2166136261 >>> 0;
  for (let i = 0; i < id.length; i += 1) { hash ^= id.charCodeAt(i); hash = Math.imul(hash, 16777619) >>> 0; }
  return hash % period;
}

function nearestOpponent(world: WorldState, self: FighterState): FighterState | null {
  const candidates = world.fighters
    .filter((fighter) => fighter.id !== self.id && !fighter.eliminated && fighter.respawnFrames === 0)
    .sort((a, b) => {
      const da = abs(fixed.sub(a.x, self.x)) + abs(fixed.sub(a.y, self.y));
      const db = abs(fixed.sub(b.x, self.x)) + abs(fixed.sub(b.y, self.y));
      return da === db ? a.id.localeCompare(b.id) : da - db;
    });
  return candidates[0] ?? null;
}

/** Pure deterministic CPU policy using the same SimInputFrame contract as players. */
export function cpuInputForFighter(world: WorldState, fighterId: string, profile: CpuProfile = BASIC_CPU): SimInputFrame {
  const frame = world.frame;
  const self = world.fighters.find((fighter) => fighter.id === fighterId);
  if (!self || self.eliminated || self.respawnFrames > 0) return neutral(frame);
  const target = nearestOpponent(world, self);
  if (!target) return neutral(frame);

  const dx = fixed.sub(target.x, self.x);
  const dy = fixed.sub(target.y, self.y);
  const absX = abs(dx);
  const absY = abs(dy);
  const horizontal = sign(dx);
  const actionFrame = (frame + phaseFor(fighterId, profile.actionPeriod)) % profile.actionPeriod === 0;

  // Recovery policy deliberately remains simple but uses ordinary player inputs.
  if (self.y < profile.recoveryY) {
    return {
      ...neutral(frame),
      moveX: self.x < fixed.zero ? 900 : -900,
      moveY: 1000,
      jumpPressed: self.jumpsRemaining > 0 && actionFrame,
      jumpHeld: self.jumpsRemaining > 0,
      specialPressed: self.jumpsRemaining === 0 && actionFrame,
    };
  }

  const threatened = target.attack !== null && absX <= profile.shieldThreatDistance && absY <= profile.verticalAttackTolerance;
  if (threatened && self.grounded) return { ...neutral(frame), shieldHeld: true };

  if (absX <= profile.attackDistance && absY <= profile.verticalAttackTolerance) {
    const cycle = (frame + phaseFor(fighterId, 11)) % 11;
    if (actionFrame && cycle === 0) return { ...neutral(frame), grabPressed: true };
    if (actionFrame && cycle === 1) return { ...neutral(frame), specialPressed: true, moveX: horizontal * 850 };
    if (actionFrame && cycle === 2) return { ...neutral(frame), attackPressed: true, smashX: horizontal * 1000 };
    if (actionFrame) return { ...neutral(frame), attackPressed: true, moveX: horizontal * 650 };
    return { ...neutral(frame), moveX: horizontal * 300 };
  }

  const moveX = absX > profile.approachDistance ? horizontal * 1000 : horizontal * 720;
  const jump = target.y > fixed.add(self.y, fixed.fromInt(3)) && actionFrame;
  return { ...neutral(frame), moveX, jumpPressed: jump, jumpHeld: jump };
}

export function cpuInputsForWorld(world: WorldState, fighterIds: readonly string[], profile: CpuProfile = BASIC_CPU): Record<string, SimInputFrame> {
  const out: Record<string, SimInputFrame> = {};
  for (const id of [...fighterIds].sort()) out[id] = cpuInputForFighter(world, id, profile);
  return out;
}

function neutral(frame: number): SimInputFrame {
  return {
    frame,
    moveX: 0,
    moveY: 0,
    jumpPressed: false,
    jumpHeld: false,
    attackPressed: false,
    specialPressed: false,
    grabPressed: false,
    smashX: 0,
    smashY: 0,
    dodgePressed: false,
    shieldHeld: false,
  };
}
