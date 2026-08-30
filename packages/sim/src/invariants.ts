import type { WorldState } from './types.js';

export interface InvariantViolation {
  code: string;
  message: string;
  fighterId?: string;
  entityId?: string;
}

function safeInteger(value: number): boolean { return Number.isSafeInteger(value); }

export function checkWorldInvariants(state: WorldState): InvariantViolation[] {
  const violations: InvariantViolation[] = [];
  if (!Number.isInteger(state.frame) || state.frame < 0) violations.push({ code: 'world.frame', message: `invalid world frame ${state.frame}` });
  if (!Number.isInteger(state.seed)) violations.push({ code: 'world.seed', message: `invalid seed ${state.seed}` });
  const fighterIds = new Set<string>();

  for (const fighter of state.fighters) {
    if (fighterIds.has(fighter.id)) violations.push({ code: 'fighter.duplicate-id', fighterId: fighter.id, message: `duplicate fighter id ${fighter.id}` });
    fighterIds.add(fighter.id);
    for (const [key, value] of Object.entries({
      x: fighter.x, y: fighter.y, vx: fighter.vx, vy: fighter.vy,
      percentTenths: fighter.percentTenths, hitlagFrames: fighter.hitlagFrames, hitstunFrames: fighter.hitstunFrames,
      shieldHealth: fighter.shieldHealth, shieldStunFrames: fighter.shieldStunFrames, shieldRegenDelayFrames: fighter.shieldRegenDelayFrames,
      stocks: fighter.stocks, respawnFrames: fighter.respawnFrames, invulnerableFrames: fighter.invulnerableFrames,
      grabFrames: fighter.grabFrames,
    })) {
      if (!safeInteger(value)) violations.push({ code: 'fighter.non-integer', fighterId: fighter.id, message: `${fighter.id}.${key} is not a safe integer: ${value}` });
    }
    if (fighter.percentTenths < 0) violations.push({ code: 'fighter.negative-percent', fighterId: fighter.id, message: `${fighter.id} has negative percent` });
    if (fighter.stocks < 0) violations.push({ code: 'fighter.negative-stocks', fighterId: fighter.id, message: `${fighter.id} has negative stocks` });
    if (fighter.eliminated && fighter.stocks !== 0) violations.push({ code: 'fighter.eliminated-stock', fighterId: fighter.id, message: `${fighter.id} eliminated with ${fighter.stocks} stocks` });
    if (fighter.grabTargetId !== null) {
      const target = state.fighters.find((entry) => entry.id === fighter.grabTargetId);
      if (!target || target.grabbedById !== fighter.id) violations.push({ code: 'grab.asymmetric-captor', fighterId: fighter.id, message: `${fighter.id} holds ${fighter.grabTargetId} without reciprocal captive state` });
    }
    if (fighter.grabbedById !== null) {
      const captor = state.fighters.find((entry) => entry.id === fighter.grabbedById);
      if (!captor || captor.grabTargetId !== fighter.id) violations.push({ code: 'grab.asymmetric-captive', fighterId: fighter.id, message: `${fighter.id} is grabbed by ${fighter.grabbedById} without reciprocal captor state` });
    }
    if (fighter.grabbedById !== null && fighter.grabTargetId !== null) violations.push({ code: 'grab.chain', fighterId: fighter.id, message: `${fighter.id} is simultaneously captor and captive` });
  }

  const entityIds = new Set<string>();
  for (const entity of state.entities ?? []) {
    if (entityIds.has(entity.id)) violations.push({ code: 'entity.duplicate-id', entityId: entity.id, message: `duplicate entity id ${entity.id}` });
    entityIds.add(entity.id);
    for (const [key, value] of Object.entries({ x: entity.x, y: entity.y, vx: entity.vx, vy: entity.vy, ageFrames: entity.ageFrames, hitCount: entity.hitCount })) {
      if (!safeInteger(value)) violations.push({ code: 'entity.non-integer', entityId: entity.id, message: `${entity.id}.${key} is not a safe integer: ${value}` });
    }
    if (entity.ageFrames < 0 || entity.hitCount < 0) violations.push({ code: 'entity.negative-counter', entityId: entity.id, message: `${entity.id} has negative age/hit count` });
    if (!fighterIds.has(entity.ownerId)) violations.push({ code: 'entity.missing-owner', entityId: entity.id, message: `${entity.id} owner ${entity.ownerId} is not in authoritative fighter state` });
  }

  if ((state.nextEntitySerial ?? 1) < 1 || !Number.isInteger(state.nextEntitySerial ?? 1)) violations.push({ code: 'entity.serial', message: `invalid nextEntitySerial ${state.nextEntitySerial}` });
  if (state.winnerId !== null && !fighterIds.has(state.winnerId)) violations.push({ code: 'world.winner', message: `winner ${state.winnerId} is not a participant` });
  return violations;
}

export function assertWorldInvariants(state: WorldState): void {
  const violations = checkWorldInvariants(state);
  if (violations.length === 0) return;
  const first = violations[0];
  throw new Error(`world invariant ${first?.code ?? 'unknown'}: ${first?.message ?? 'unknown violation'}${violations.length > 1 ? ` (+${violations.length - 1} more)` : ''}`);
}
