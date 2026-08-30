import type { Fixed } from '../../deterministic-math/src/fixed.js';

interface TimelineEvent {
  frame: number;
  type: string;
  data?: Record<string, unknown>;
}
interface PackMove { totalFrames: number; timeline: readonly TimelineEvent[]; }
interface FighterPackLike { id: string; moves: Readonly<Record<string, PackMove>>; }

export interface MoveVectorEvent {
  frame: number;
  x: Fixed;
  y: Fixed;
}
export interface MoveFrameWindow {
  startFrame: number;
  endFrame: number;
}
export interface MoveRuntimeDefinition {
  id: string;
  totalFrames: number;
  impulses: readonly MoveVectorEvent[];
  velocities: readonly MoveVectorEvent[];
  invulnerability: readonly MoveFrameWindow[];
}

function integer(data: Record<string, unknown> | undefined, key: string, label: string): number {
  const value = data?.[key];
  if (!Number.isInteger(value)) throw new Error(`${label} ${key} must be integer`);
  return value as number;
}

function compileWindows(moveId: string, events: readonly TimelineEvent[], onType: string, offType: string): MoveFrameWindow[] {
  const windows: MoveFrameWindow[] = [];
  let open: number | null = null;
  for (const event of events) {
    if (event.type === onType) {
      if (open !== null) throw new Error(`${moveId} ${onType} opened twice without ${offType}`);
      open = event.frame;
    } else if (event.type === offType) {
      if (open === null) throw new Error(`${moveId} ${offType} has no matching ${onType}`);
      if (event.frame <= open) throw new Error(`${moveId} ${onType}/${offType} window must span at least one frame`);
      windows.push({ startFrame: open, endFrame: event.frame - 1 });
      open = null;
    }
  }
  if (open !== null) throw new Error(`${moveId} leaves ${onType} active at move end`);
  return windows;
}

export function compileMoveRuntime(fighterId: string, moveName: string, move: PackMove): MoveRuntimeDefinition {
  const id = `${fighterId}:${moveName}`;
  const impulses: MoveVectorEvent[] = [];
  const velocities: MoveVectorEvent[] = [];
  for (const event of move.timeline) {
    if (event.type !== 'impulse' && event.type !== 'velocity') continue;
    const vector = {
      frame: event.frame,
      x: integer(event.data, 'x', `${id} ${event.type}`) as Fixed,
      y: integer(event.data, 'y', `${id} ${event.type}`) as Fixed,
    };
    if (event.type === 'impulse') impulses.push(vector);
    else velocities.push(vector);
  }
  const byFrame = (a: MoveVectorEvent, b: MoveVectorEvent) => a.frame - b.frame || a.x - b.x || a.y - b.y;
  impulses.sort(byFrame);
  velocities.sort(byFrame);
  return {
    id,
    totalFrames: move.totalFrames,
    impulses,
    velocities,
    invulnerability: compileWindows(id, move.timeline, 'invuln_on', 'invuln_off'),
  };
}

export function compileFighterMoveRuntime(pack: FighterPackLike): Map<string, MoveRuntimeDefinition> {
  return new Map(
    Object.entries(pack.moves)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, move]) => {
        const definition = compileMoveRuntime(pack.id, name, move);
        return [definition.id, definition] as const;
      }),
  );
}
