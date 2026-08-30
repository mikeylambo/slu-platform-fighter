import type { MatchEvent, MatchInputFrame, MatchStepResult } from './match.js';
import type { FighterState, WorldState } from './types.js';

export type AttributedMatchStep = (state: WorldState, input: MatchInputFrame) => MatchStepResult;
export interface DamageAttributionRules { creditWindowFrames: number; }
export const DEFAULT_DAMAGE_ATTRIBUTION_RULES: DamageAttributionRules = { creditWindowFrames: 600 };

function damagingContact(event: MatchEvent): { attackerId: string; targetId: string } | null {
  if (event.type === 'hit') return event.damageTenths > 0 ? { attackerId: event.attackerId, targetId: event.targetId } : null;
  if (event.type === 'entity-hit') return event.damageTenths > 0 ? { attackerId: event.ownerId, targetId: event.targetId } : null;
  if (event.type === 'throw' || event.type === 'pummel') return event.damageTenths > 0 ? { attackerId: event.attackerId, targetId: event.targetId } : null;
  return null;
}

function expireStaleAttribution(state: WorldState, rules: DamageAttributionRules): WorldState {
  if (!Number.isInteger(rules.creditWindowFrames) || rules.creditWindowFrames < 0) throw new Error('damage attribution creditWindowFrames must be non-negative integer');
  return {
    ...state,
    fighters: state.fighters.map((fighter) => {
      const stale = fighter.lastHitById !== null && fighter.lastHitFrame >= 0 && state.frame - fighter.lastHitFrame > rules.creditWindowFrames;
      return stale ? { ...fighter, lastHitById: null, lastHitFrame: -1 } : fighter;
    }),
  };
}

/**
 * Applies deterministic last-damaging-contact ownership after one ordinary
 * match step. The state is part of WorldState and therefore rollback/replay
 * snapshots retain KO ownership while a launched fighter travels to a blast zone.
 */
export function applyDamageAttribution(result: MatchStepResult, damageFrame: number): MatchStepResult {
  if (!Number.isInteger(damageFrame) || damageFrame < 0) throw new Error(`damage attribution frame must be non-negative integer, got ${damageFrame}`);
  const lastContact = new Map<string, string>();
  const koTargets = new Set<string>();
  for (const event of result.events) {
    const contact = damagingContact(event);
    if (contact) lastContact.set(contact.targetId, contact.attackerId);
    if (event.type === 'ko') koTargets.add(event.fighterId);
  }

  const fighters: FighterState[] = result.state.fighters.map((fighter) => {
    if (koTargets.has(fighter.id)) return fighter;
    const attackerId = lastContact.get(fighter.id);
    return attackerId ? { ...fighter, lastHitById: attackerId, lastHitFrame: damageFrame } : fighter;
  });

  const events = result.events.map((event) => {
    if (event.type !== 'ko' || event.creditedAttackerId !== null) return event;
    const attackerId = lastContact.get(event.fighterId);
    return attackerId && attackerId !== event.fighterId
      ? { ...event, creditedAttackerId: attackerId, selfDestruct: false }
      : event;
  });
  return { state: { ...result.state, fighters }, events };
}

/** Wraps the canonical match step without duplicating gameplay logic. */
export function withDamageAttribution(
  step: AttributedMatchStep,
  rules: DamageAttributionRules = DEFAULT_DAMAGE_ATTRIBUTION_RULES,
): AttributedMatchStep {
  return (state, input) => {
    const prepared = expireStaleAttribution(state, rules);
    return applyDamageAttribution(step(prepared, input), input.frame);
  };
}
