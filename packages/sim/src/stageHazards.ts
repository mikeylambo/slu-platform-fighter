import type { Fixed } from '../../deterministic-math/src/fixed.js';
import type { StageHazardDefinition } from '../../content/src/compileStage.js';

export interface HazardEffectPolicy {
  damageTenthsByHazardId?: Readonly<Record<string, number>>;
  launchByHazardId?: Readonly<Record<string, { x: Fixed; y: Fixed; hitstunFrames: number }>>;
}
export type HazardEffect =
  | { type: 'damage'; hazardId: string; targetId: string; damageTenths: number }
  | { type: 'launch'; hazardId: string; targetId: string; x: Fixed; y: Fixed; hitstunFrames: number }
  | { type: 'ko'; hazardId: string; targetId: string };

export function hazardActiveAtFrame(hazard: StageHazardDefinition, frame: number): boolean {
  const cycle = hazard.activeFrames + hazard.inactiveFrames;
  if (cycle <= 0 || hazard.activeFrames <= 0) return false;
  const local = ((frame + hazard.phaseFrames) % cycle + cycle) % cycle;
  return local < hazard.activeFrames;
}

export function resolveHazardEffect(hazard: StageHazardDefinition, targetId: string, policy: HazardEffectPolicy): HazardEffect {
  if (hazard.kind === 'ko') return { type: 'ko', hazardId: hazard.id, targetId };
  if (hazard.kind === 'damage') {
    const damageTenths = policy.damageTenthsByHazardId?.[hazard.id];
    if (damageTenths === undefined || !Number.isInteger(damageTenths) || damageTenths < 0) throw new Error(`hazard ${hazard.id} requires authored nonnegative integer damageTenths policy`);
    return { type: 'damage', hazardId: hazard.id, targetId, damageTenths };
  }
  const launch = policy.launchByHazardId?.[hazard.id];
  if (!launch || !Number.isInteger(launch.x) || !Number.isInteger(launch.y) || !Number.isInteger(launch.hitstunFrames) || launch.hitstunFrames < 0) throw new Error(`hazard ${hazard.id} requires authored launch policy`);
  return { type: 'launch', hazardId: hazard.id, targetId, ...launch };
}
