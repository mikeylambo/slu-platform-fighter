import { fixed, type Fixed } from '../../deterministic-math/src/fixed.js';

export interface HitboxDefinition {
  id: string;
  offsetX: Fixed;
  offsetY: Fixed;
  radius: Fixed;
  damageTenths: number;
  baseKnockback: Fixed;
  growthPer100Percent: Fixed;
  directionX: number;
  directionY: number;
  hitlagFrames: number;
  hitstunFrames: number;
}

export interface HitboxWindow { startFrame: number; endFrame: number; hitbox: HitboxDefinition; }
export interface AttackDefinition { id: string; totalFrames: number; hitboxes: HitboxWindow[]; }
export interface CombatAttackState { attackId: string; frame: number; hitTargets: string[]; }

export interface CombatDefenseRules {
  shieldMaxHealth: number;
  shieldDamageBase: number;
  shieldStunBaseFrames: number;
  shieldRegenDelayFrames: number;
  shieldRegenPerFrame: number;
  shieldBreakStunFrames: number;
}

export const K2_DEFENSE: CombatDefenseRules = {
  shieldMaxHealth: 600,
  shieldDamageBase: 12,
  shieldStunBaseFrames: 3,
  shieldRegenDelayFrames: 45,
  shieldRegenPerFrame: 2,
  shieldBreakStunFrames: 90,
};

export interface CombatantState {
  id: string;
  x: Fixed;
  y: Fixed;
  vx: Fixed;
  vy: Fixed;
  facing: -1 | 1;
  hurtboxRadius: Fixed;
  hurtboxOffsetY: Fixed;
  percentTenths: number;
  hitlagFrames: number;
  hitstunFrames: number;
  invulnerableFrames: number;
  attack: CombatAttackState | null;
  shielding: boolean;
  shieldHealth: number;
  shieldStunFrames: number;
  shieldRegenDelayFrames: number;
}

export interface HitEvent {
  type: 'hit';
  attackerId: string;
  targetId: string;
  attackId: string;
  hitboxId: string;
  damageTenths: number;
  knockbackX: Fixed;
  knockbackY: Fixed;
  hitlagFrames: number;
  hitstunFrames: number;
}

export interface BlockEvent {
  type: 'block';
  attackerId: string;
  targetId: string;
  attackId: string;
  hitboxId: string;
  shieldDamage: number;
  shieldHealthAfter: number;
  shieldStunFrames: number;
  broken: boolean;
}

export type CombatEvent = HitEvent | BlockEvent;
export interface CombatStepResult { combatants: CombatantState[]; events: CombatEvent[]; }

export function beginAttack(combatant: CombatantState, attackId: string): CombatantState {
  if (combatant.hitlagFrames > 0 || combatant.hitstunFrames > 0 || combatant.shieldStunFrames > 0 || combatant.shielding) return combatant;
  return { ...combatant, attack: { attackId, frame: 0, hitTargets: [] } };
}

function activeHitboxes(attack: AttackDefinition, frame: number): HitboxDefinition[] {
  return attack.hitboxes
    .filter((window) => frame >= window.startFrame && frame <= window.endFrame)
    .map((window) => window.hitbox)
    .sort((a, b) => a.id.localeCompare(b.id));
}

function circlesOverlap(ax: Fixed, ay: Fixed, ar: Fixed, bx: Fixed, by: Fixed, br: Fixed): boolean {
  const dx = fixed.sub(ax, bx);
  const dy = fixed.sub(ay, by);
  const radius = fixed.add(ar, br);
  return fixed.add(fixed.mul(dx, dx), fixed.mul(dy, dy)) <= fixed.mul(radius, radius);
}

function normalizedDirection(hitbox: HitboxDefinition, facing: -1 | 1): { x: Fixed; y: Fixed } {
  const rawX = hitbox.directionX * facing;
  const rawY = hitbox.directionY;
  const magnitude = Math.max(Math.abs(rawX), Math.abs(rawY), 1);
  return { x: fixed.fromRatio(rawX, magnitude), y: fixed.fromRatio(rawY, magnitude) };
}

function knockbackMagnitude(hitbox: HitboxDefinition, targetPercentTenths: number): Fixed {
  const percentScale = fixed.fromRatio(targetPercentTenths, 1000);
  return fixed.add(hitbox.baseKnockback, fixed.mul(hitbox.growthPer100Percent, percentScale));
}

function appendHitTarget(attacker: CombatantState, targetId: string): CombatantState {
  if (!attacker.attack) return attacker;
  return { ...attacker, attack: { ...attacker.attack, hitTargets: [...attacker.attack.hitTargets, targetId].sort() } };
}

function resolveOneHit(attacker: CombatantState, target: CombatantState, hitbox: HitboxDefinition, attackId: string): { attacker: CombatantState; target: CombatantState; event: HitEvent } {
  const postDamagePercent = target.percentTenths + hitbox.damageTenths;
  const magnitude = knockbackMagnitude(hitbox, postDamagePercent);
  const direction = normalizedDirection(hitbox, attacker.facing);
  const knockbackX = fixed.mul(direction.x, magnitude);
  const knockbackY = fixed.mul(direction.y, magnitude);
  return {
    attacker: { ...appendHitTarget(attacker, target.id), hitlagFrames: Math.max(attacker.hitlagFrames, hitbox.hitlagFrames) },
    target: {
      ...target,
      percentTenths: postDamagePercent,
      vx: knockbackX,
      vy: knockbackY,
      hitlagFrames: Math.max(target.hitlagFrames, hitbox.hitlagFrames),
      hitstunFrames: Math.max(target.hitstunFrames, hitbox.hitstunFrames),
      attack: null,
      shielding: false,
    },
    event: {
      type: 'hit', attackerId: attacker.id, targetId: target.id, attackId, hitboxId: hitbox.id,
      damageTenths: hitbox.damageTenths, knockbackX, knockbackY,
      hitlagFrames: hitbox.hitlagFrames, hitstunFrames: hitbox.hitstunFrames,
    },
  };
}

function resolveBlock(
  attacker: CombatantState,
  target: CombatantState,
  hitbox: HitboxDefinition,
  attackId: string,
  rules: CombatDefenseRules,
): { attacker: CombatantState; target: CombatantState; event: BlockEvent } {
  const shieldDamage = rules.shieldDamageBase + hitbox.damageTenths;
  const shieldHealthAfter = Math.max(0, target.shieldHealth - shieldDamage);
  const broken = shieldHealthAfter === 0;
  const shieldStunFrames = rules.shieldStunBaseFrames + hitbox.hitlagFrames + Math.trunc(hitbox.damageTenths / 10);
  return {
    attacker: { ...appendHitTarget(attacker, target.id), hitlagFrames: Math.max(attacker.hitlagFrames, hitbox.hitlagFrames) },
    target: {
      ...target,
      shieldHealth: shieldHealthAfter,
      shielding: !broken,
      shieldStunFrames: broken ? 0 : Math.max(target.shieldStunFrames, shieldStunFrames),
      shieldRegenDelayFrames: rules.shieldRegenDelayFrames,
      hitlagFrames: Math.max(target.hitlagFrames, hitbox.hitlagFrames),
      hitstunFrames: broken ? Math.max(target.hitstunFrames, rules.shieldBreakStunFrames) : target.hitstunFrames,
      attack: broken ? null : target.attack,
    },
    event: {
      type: 'block', attackerId: attacker.id, targetId: target.id, attackId, hitboxId: hitbox.id,
      shieldDamage, shieldHealthAfter, shieldStunFrames, broken,
    },
  };
}

export function stepCombatFrame(
  combatantsInput: CombatantState[],
  attacks: ReadonlyMap<string, AttackDefinition>,
  defenseRules: CombatDefenseRules = K2_DEFENSE,
): CombatStepResult {
  const combatants: CombatantState[] = [...combatantsInput]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((combatant) => ({ ...combatant, attack: combatant.attack ? { ...combatant.attack, hitTargets: [...combatant.attack.hitTargets] } : null }));
  const events: CombatEvent[] = [];

  for (let attackerIndex = 0; attackerIndex < combatants.length; attackerIndex += 1) {
    const initialAttacker = combatants[attackerIndex];
    if (!initialAttacker || initialAttacker.hitlagFrames > 0 || !initialAttacker.attack) continue;
    let attacker: CombatantState = initialAttacker;
    const attack = attacks.get(initialAttacker.attack.attackId);
    if (!attack) throw new Error(`missing attack definition ${initialAttacker.attack.attackId}`);

    for (const hitbox of activeHitboxes(attack, initialAttacker.attack.frame)) {
      const hitboxX = fixed.add(attacker.x, fixed.mul(hitbox.offsetX, fixed.fromInt(attacker.facing)));
      const hitboxY = fixed.add(attacker.y, hitbox.offsetY);
      for (let targetIndex = 0; targetIndex < combatants.length; targetIndex += 1) {
        if (targetIndex === attackerIndex) continue;
        const target = combatants[targetIndex];
        if (!target || target.invulnerableFrames > 0 || attacker.attack?.hitTargets.includes(target.id)) continue;
        const hurtboxY = fixed.add(target.y, target.hurtboxOffsetY);
        if (!circlesOverlap(hitboxX, hitboxY, hitbox.radius, target.x, hurtboxY, target.hurtboxRadius)) continue;
        const resolved: { attacker: CombatantState; target: CombatantState; event: CombatEvent } = target.shielding && target.shieldHealth > 0
          ? resolveBlock(attacker, target, hitbox, attack.id, defenseRules)
          : resolveOneHit(attacker, target, hitbox, attack.id);
        attacker = resolved.attacker;
        combatants[attackerIndex] = attacker;
        combatants[targetIndex] = resolved.target;
        events.push(resolved.event);
      }
    }
  }

  for (let index = 0; index < combatants.length; index += 1) {
    const combatant = combatants[index];
    if (!combatant) continue;
    if (combatant.hitlagFrames > 0) {
      combatants[index] = { ...combatant, hitlagFrames: combatant.hitlagFrames - 1 };
      continue;
    }
    const nextHitstun = Math.max(0, combatant.hitstunFrames - 1);
    const nextShieldStun = Math.max(0, combatant.shieldStunFrames - 1);
    const nextRegenDelay = Math.max(0, combatant.shieldRegenDelayFrames - 1);
    const nextShieldHealth = !combatant.shielding && nextRegenDelay === 0
      ? Math.min(defenseRules.shieldMaxHealth, combatant.shieldHealth + defenseRules.shieldRegenPerFrame)
      : combatant.shieldHealth;
    let attackState = combatant.attack;
    if (attackState) {
      const definition = attacks.get(attackState.attackId);
      if (!definition) throw new Error(`missing attack definition ${attackState.attackId}`);
      const nextFrame = attackState.frame + 1;
      attackState = nextFrame >= definition.totalFrames ? null : { ...attackState, frame: nextFrame };
    }
    combatants[index] = {
      ...combatant,
      hitstunFrames: nextHitstun,
      shieldStunFrames: nextShieldStun,
      shieldRegenDelayFrames: nextRegenDelay,
      shieldHealth: nextShieldHealth,
      attack: attackState,
    };
  }
  return { combatants, events };
}
