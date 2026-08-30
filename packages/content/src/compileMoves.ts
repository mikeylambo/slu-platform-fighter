import type { Fixed } from '../../deterministic-math/src/fixed.js';
import type { AttackDefinition, HitboxDefinition, HitboxWindow } from '../../sim/src/combat.js';

interface TimelineEvent {
  frame: number;
  type: string;
  data?: Record<string, unknown>;
}

interface PackMove {
  animationRole: string;
  totalFrames: number;
  timeline: readonly TimelineEvent[];
}

interface FighterPackLike {
  id: string;
  moves: Readonly<Record<string, PackMove>>;
}

function integer(data: Record<string, unknown>, key: string): number {
  const value = data[key];
  if (!Number.isInteger(value)) throw new Error(`combat timeline ${key} must be integer`);
  return value as number;
}

function string(data: Record<string, unknown>, key: string): string {
  const value = data[key];
  if (typeof value !== 'string' || value.length === 0) throw new Error(`combat timeline ${key} must be non-empty string`);
  return value;
}

function hitboxFromData(data: Record<string, unknown>): HitboxDefinition {
  return {
    id: string(data, 'id'),
    offsetX: integer(data, 'offsetX') as Fixed,
    offsetY: integer(data, 'offsetY') as Fixed,
    radius: integer(data, 'radius') as Fixed,
    damageTenths: integer(data, 'damageTenths'),
    baseKnockback: integer(data, 'baseKnockback') as Fixed,
    growthPer100Percent: integer(data, 'growthPer100Percent') as Fixed,
    directionX: integer(data, 'directionX'),
    directionY: integer(data, 'directionY'),
    hitlagFrames: integer(data, 'hitlagFrames'),
    hitstunFrames: integer(data, 'hitstunFrames'),
  };
}

export function compileAttack(fighterId: string, moveName: string, move: PackMove): AttackDefinition {
  const open = new Map<string, { frame: number; hitbox: HitboxDefinition }>();
  const windows: HitboxWindow[] = [];

  for (const event of move.timeline) {
    if (event.type === 'hitbox_on') {
      if (!event.data) throw new Error(`${fighterId}.${moveName} hitbox_on missing data`);
      const hitbox = hitboxFromData(event.data);
      if (open.has(hitbox.id)) throw new Error(`${fighterId}.${moveName} hitbox ${hitbox.id} activated twice`);
      open.set(hitbox.id, { frame: event.frame, hitbox });
    } else if (event.type === 'hitbox_off') {
      if (!event.data) throw new Error(`${fighterId}.${moveName} hitbox_off missing data`);
      const id = string(event.data, 'id');
      const active = open.get(id);
      if (!active) throw new Error(`${fighterId}.${moveName} hitbox_off references inactive ${id}`);
      if (event.frame <= active.frame) throw new Error(`${fighterId}.${moveName} hitbox ${id} must remain active for at least one frame`);
      windows.push({ startFrame: active.frame, endFrame: event.frame - 1, hitbox: active.hitbox });
      open.delete(id);
    }
  }

  if (open.size > 0) throw new Error(`${fighterId}.${moveName} leaves hitboxes active at move end`);
  windows.sort((a, b) => a.startFrame - b.startFrame || a.hitbox.id.localeCompare(b.hitbox.id));
  return { id: `${fighterId}:${moveName}`, totalFrames: move.totalFrames, hitboxes: windows };
}

export function compileFighterAttacks(pack: FighterPackLike): Map<string, AttackDefinition> {
  return new Map(
    Object.entries(pack.moves)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, move]) => {
        const attack = compileAttack(pack.id, name, move);
        return [attack.id, attack] as const;
      }),
  );
}
