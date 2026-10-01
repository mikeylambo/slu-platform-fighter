import { fixed as f } from '../../../../../packages/deterministic-math/src/fixed.js';
import { stepCombatFrame, type CombatantState, type HitEvent } from '../../../../../packages/sim/src/combat.js';
import type { FighterState, WorldState } from '../../../../../packages/sim/src/types.js';
import { DUEL } from '../../content/rules/duel.js';

const DIRECT_ID = 'spectris-direct';
const H = DUEL.directHit;

export interface DirectHitSpec {
  /** Damage in Strain tenths. */
  damage: number;
  direction: [number, number];
  base?: number;
  growth?: number;
}

/**
 * Lands a runtime-built hit (throws, the thrown blade, real feint ghosts) through PF's
 * own combat step, so knockback, hitlag and hitstun follow the standard formula.
 * Returns the hit event, or null if PF rejected it (e.g. intangible target).
 */
export function directHit(
  w: WorldState,
  source: FighterState,
  target: FighterState,
  spec: DirectHitSpec,
): HitEvent | null {
  const base = spec.base ?? H.base;
  const growth = spec.growth ?? H.growth;
  const attacker: CombatantState = {
    ...source,
    attack: { attackId: DIRECT_ID, frame: 0, hitTargets: [] },
    hitlagFrames: 0,
    hurtboxRadius: f.one,
    hurtboxOffsetY: f.one,
  };
  const defender: CombatantState = {
    ...target,
    attack: null,
    shielding: false,
    hurtboxRadius: f.one,
    hurtboxOffsetY: f.one,
  };
  const hitbox = {
    id: DIRECT_ID,
    offsetX: f.mul(f.sub(target.x, source.x), f.fromInt(source.facing)),
    offsetY: f.sub(f.add(target.y, f.one), source.y),
    radius: f.one,
    damageTenths: spec.damage,
    baseKnockback: f.fromRatio(base, H.baseDivisor),
    growthPer100Percent: f.fromRatio(growth, H.growthDivisor),
    directionX: spec.direction[0],
    directionY: spec.direction[1],
    hitlagFrames: H.hitlag,
    hitstunFrames: H.hitstun,
  };
  const definition = {
    id: DIRECT_ID,
    totalFrames: H.totalFrames,
    hitboxes: [{ startFrame: 0, endFrame: 0, hitbox }],
  };
  const result = stepCombatFrame([attacker, defender], new Map([[DIRECT_ID, definition]]));
  const hit = result.events.find((event): event is HitEvent => event.type === 'hit');
  if (!hit) {
    return null;
  }
  const resolved = result.combatants.find((combatant) => combatant.id === target.id)!;
  target.percentTenths = resolved.percentTenths;
  target.vx = resolved.vx;
  target.vy = resolved.vy;
  target.hitlagFrames = resolved.hitlagFrames;
  target.hitstunFrames = resolved.hitstunFrames;
  target.attack = null;
  target.lastHitById = source.id;
  target.lastHitFrame = w.frame;
  return hit;
}
