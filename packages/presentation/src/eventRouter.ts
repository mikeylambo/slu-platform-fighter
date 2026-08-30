import type { Fixed } from '../../deterministic-math/src/fixed.js';
import type { MatchEvent } from '../../sim/src/match.js';

export type PresentationCueKind =
  | 'hit' | 'block' | 'shield-break' | 'grab' | 'grab-release' | 'pummel' | 'throw'
  | 'entity-hit' | 'entity-block' | 'entity-shield-break' | 'ko' | 'respawn';

export interface PresentationCue {
  kind: PresentationCueKind;
  sourceId: string | null;
  targetId: string | null;
  contentId: string | null;
  /** Integer presentation strength; renderer/audio may remap but gameplay never reads it. */
  intensity: number;
  knockbackX?: Fixed;
  knockbackY?: Fixed;
}

/**
 * Converts simulation-domain events into renderer/audio-domain semantic cues.
 * The mapping contains no timers or gameplay state and is safe to regenerate
 * after rollback; presentation layers decide dedupe/interpolation policy.
 */
export function routeMatchEvent(event: MatchEvent): PresentationCue[] {
  switch (event.type) {
    case 'hit':
      return [{ kind: 'hit', sourceId: event.attackerId, targetId: event.targetId, contentId: event.attackId, intensity: Math.max(1, event.damageTenths + event.hitlagFrames * 10), knockbackX: event.knockbackX, knockbackY: event.knockbackY }];
    case 'block':
      return [{ kind: event.broken ? 'shield-break' : 'block', sourceId: event.attackerId, targetId: event.targetId, contentId: event.attackId, intensity: Math.max(1, event.shieldDamage) }];
    case 'grab':
      return [{ kind: 'grab', sourceId: event.attackerId, targetId: event.targetId, contentId: null, intensity: 1 }];
    case 'grab-release':
      return [{ kind: 'grab-release', sourceId: event.attackerId, targetId: event.targetId, contentId: null, intensity: 1 }];
    case 'pummel':
      return [{ kind: 'pummel', sourceId: event.attackerId, targetId: event.targetId, contentId: event.actionId, intensity: Math.max(1, event.damageTenths) }];
    case 'throw':
      return [{ kind: 'throw', sourceId: event.attackerId, targetId: event.targetId, contentId: event.actionId, intensity: Math.max(1, event.damageTenths + event.hitstunFrames), knockbackX: event.knockbackX, knockbackY: event.knockbackY }];
    case 'entity-hit':
      return [{ kind: 'entity-hit', sourceId: event.ownerId, targetId: event.targetId, contentId: event.definitionId, intensity: Math.max(1, event.damageTenths + event.hitlagFrames * 10), knockbackX: event.knockbackX, knockbackY: event.knockbackY }];
    case 'entity-block':
      return [{ kind: event.broken ? 'entity-shield-break' : 'entity-block', sourceId: event.ownerId, targetId: event.targetId, contentId: event.definitionId, intensity: Math.max(1, event.shieldDamage) }];
    case 'ko':
      return [{ kind: 'ko', sourceId: event.creditedAttackerId, targetId: event.fighterId, contentId: null, intensity: event.eliminated ? 2 : 1 }];
    case 'respawn':
      return [{ kind: 'respawn', sourceId: event.fighterId, targetId: event.fighterId, contentId: null, intensity: 1 }];
  }
}

export function routeMatchEvents(events: readonly MatchEvent[]): PresentationCue[] {
  return events.flatMap(routeMatchEvent);
}
