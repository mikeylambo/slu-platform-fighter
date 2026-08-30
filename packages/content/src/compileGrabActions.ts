import type { Fixed } from '../../deterministic-math/src/fixed.js';

export type GrabActionInput = 'pummel' | 'forward-throw' | 'back-throw' | 'up-throw' | 'down-throw';

interface TimelineEvent {
  frame: number;
  type: string;
  data?: Record<string, unknown>;
}

interface PackMove {
  animationRole: string;
  grabAction?: GrabActionInput;
  totalFrames: number;
  timeline: readonly TimelineEvent[];
}

interface FighterPackLike {
  id: string;
  moves: Readonly<Record<string, PackMove>>;
}

export interface PummelDefinition {
  kind: 'pummel';
  id: string;
  input: 'pummel';
  totalFrames: number;
  eventFrame: number;
  damageTenths: number;
  hitlagFrames: number;
}

export interface ThrowDefinition {
  kind: 'throw';
  id: string;
  input: Exclude<GrabActionInput, 'pummel'>;
  totalFrames: number;
  releaseFrame: number;
  damageTenths: number;
  baseKnockback: Fixed;
  growthPer100Percent: Fixed;
  directionX: number;
  directionY: number;
  hitstunFrames: number;
}

export type GrabActionDefinition = PummelDefinition | ThrowDefinition;

function integer(data: Record<string, unknown>, key: string): number {
  const value = data[key];
  if (!Number.isInteger(value)) throw new Error(`grab timeline ${key} must be integer`);
  return value as number;
}

function exactlyOne(moveId: string, timeline: readonly TimelineEvent[], type: string): TimelineEvent {
  const events = timeline.filter((event) => event.type === type);
  if (events.length !== 1) throw new Error(`${moveId} must contain exactly one ${type} event`);
  return events[0]!;
}

export function compileFighterGrabActions(pack: FighterPackLike): Map<GrabActionInput, GrabActionDefinition> {
  const result = new Map<GrabActionInput, GrabActionDefinition>();
  for (const [moveName, move] of Object.entries(pack.moves).sort(([a], [b]) => a.localeCompare(b))) {
    if (!move.grabAction) continue;
    const id = `${pack.id}:${moveName}`;
    if (result.has(move.grabAction)) throw new Error(`${pack.id} defines duplicate grab action ${move.grabAction}`);

    if (move.grabAction === 'pummel') {
      const event = exactlyOne(id, move.timeline, 'grab_damage');
      if (!event.data) throw new Error(`${id} grab_damage requires data`);
      result.set('pummel', {
        kind: 'pummel',
        id,
        input: 'pummel',
        totalFrames: move.totalFrames,
        eventFrame: event.frame,
        damageTenths: integer(event.data, 'damageTenths'),
        hitlagFrames: integer(event.data, 'hitlagFrames'),
      });
      continue;
    }

    const event = exactlyOne(id, move.timeline, 'throw_release');
    if (!event.data) throw new Error(`${id} throw_release requires data`);
    result.set(move.grabAction, {
      kind: 'throw',
      id,
      input: move.grabAction,
      totalFrames: move.totalFrames,
      releaseFrame: event.frame,
      damageTenths: integer(event.data, 'damageTenths'),
      baseKnockback: integer(event.data, 'baseKnockback') as Fixed,
      growthPer100Percent: integer(event.data, 'growthPer100Percent') as Fixed,
      directionX: integer(event.data, 'directionX'),
      directionY: integer(event.data, 'directionY'),
      hitstunFrames: integer(event.data, 'hitstunFrames'),
    });
  }
  return result;
}
