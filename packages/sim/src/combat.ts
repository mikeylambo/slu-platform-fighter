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
  attack: CombatAttackState | null;
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

export interface CombatStepResult { combatants: CombatantState[]; events: HitEvent[]; }

export function beginAttack(combatant: CombatantState, attackId: string): CombatantState {
  if (combatant.hitlagFrames > 0 || combatant.hitstunFrames > 0) return combatant;
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

function resolveOneHit(attacker: CombatantState, target: CombatantState, hitbox: HitboxDefinition, attackId: string): { attacker: CombatantState; target: CombatantState; event: HitEvent } {
  const postDamagePercent = target.percentTenths + hitbox.damageTenths;
  const magnitude = knockbackMagnitude(hitbox, postDamagePercent);
  const direction = normalizedDirection(hitbox, attacker.facing);
  const knockbackX = fixed.mul(direction.x, magnitude);
  const knockbackY = fixed.mul(direction.y, magnitude);
  const hitTargets = attacker.attack ? [...attacker.attack.hitTargets, target.id].sort() : [target.id];
  return {
    attacker: {
      ...attacker,
      hitlagFrames: Math.max(attacker.hitlagFrames, hitbox.hitlagFrames),
      attack: attacker.attack ? { ...attacker.attack, hitTargets } : null,
    },
    target: {
      ...target,
      percentTenths: postDamagePercent,
      vx: knockbackX,
      vy: knockbackY,
      hitlagFrames: Math.max(target.hitlagFrames, hitbox.hitlagFrames),
      hitstunFrames: Math.max(target.hitstunFrames, hitbox.hitstunFrames),
      attack: null,
    },
    event: {
      type: 'hit', attackerId: attacker.id, targetId: target.id, attackId, hitboxId: hitbox.id,
      damageTenths: hitbox.damageTenths, knockbackX, knockbackY,
      hitlagFrames: hitbox.hitlagFrames, hitstunFrames: hitbox.hitstunFrames,
    },
  };
}

export function stepCombatFrame(combatantsInput: CombatantState[], attacks: ReadonlyMap<string, AttackDefinition>): CombatStepResult {
  const combatants = [...combatantsInput]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((combatant) => ({ ...combatant, attack: combatant.attack ? { ...combatant.attack, hitTargets: [...combatant.attack.hitTargets] } : null }));
  const events: HitEvent[] = [];

  for (let attackerIndex = 0; attackerIndex < combatants.length; attackerIndex += 1) {
    let attacker = combatants[attackerIndex];
    if (!attacker || attacker.hitlagFrames > 0 || !attacker.attack) continue;
    const attack = attacks.get(attacker.attack.attackId);
    if (!attack) throw new Error(`missing attack definition ${attacker.attack.attackId}`);

    for (const hitbox of activeHitboxes(attack, attacker.attack.frame)) {
      const hitboxX = fixed.add(attacker.x, fixed.mul(hitbox.offsetX, fixed.fromInt(attacker.facing)));
      const hitboxY = fixed.add(attacker.y, hitbox.offsetY);
      for (let targetIndex = 0; targetIndex < combatants.length; targetIndex += 1) {
        if (targetIndex === attackerIndex) continue;
        const target = combatants[targetIndex];
        if (!target || attacker.attack?.hitTargets.includes(target.id)) continue;
        const hurtboxY = fixed.add(target.y, target.hurtboxOffsetY);
        if (!circlesOverlap(hitboxX, hitboxY, hitbox.radius, target.x, hurtboxY, target.hurtboxRadius)) continue;
        const resolved = resolveOneHit(attacker, target, hitbox, attack.id);
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
    let attack = combatant.attack;
    if (attack) {
      const definition = attacks.get(attack.attackId);
      if (!definition) throw new Error(`missing attack definition ${attack.attackId}`);
      const nextFrame = attack.frame + 1;
      attack = nextFrame >= definition.totalFrames ? null : { ...attack, frame: nextFrame };
    }
    combatants[index] = { ...combatant, hitstunFrames: nextHitstun, attack };
  }
  return { combatants, events };
}
