export type AnimationGrade = 'dedicated' | 'retargeted' | 'adapted' | 'procedural' | 'author_required';

export interface AnimationBinding {
  role: string;
  clip: string;
  grade: AnimationGrade;
  loop: boolean;
  speed: number;
  source?: string;
}

export interface CompiledRenderDefinition {
  fighterId: string;
  model: string;
  armature: string;
  rigProfile: string;
  scale: number;
  authoredFacing: 'left' | 'right';
  materials: Readonly<Record<string, string>>;
  sockets: Readonly<Record<string, string>>;
  animations: ReadonlyMap<string, AnimationBinding>;
}

interface RenderAnimationLike {
  clip: string;
  grade: AnimationGrade;
  source?: string;
  loop?: boolean;
  speed?: number;
}
interface RenderPackLike {
  fighterId: string;
  model: string;
  armature: string;
  rigProfile: string;
  scale: number;
  facing: 'left' | 'right';
  materials: Readonly<Record<string, string>>;
  sockets?: Readonly<Record<string, string>>;
  animations: Readonly<Record<string, RenderAnimationLike>>;
}

export function compileRenderDefinition(pack: RenderPackLike): CompiledRenderDefinition {
  if (!pack.fighterId) throw new Error('render fighterId must be non-empty');
  if (!pack.model || !pack.armature || !pack.rigProfile) throw new Error(`${pack.fighterId} render model/armature/rigProfile must be non-empty`);
  if (!(pack.scale > 0) || !Number.isFinite(pack.scale)) throw new Error(`${pack.fighterId} render scale must be finite and > 0`);
  const animations = new Map<string, AnimationBinding>();
  for (const [role, raw] of Object.entries(pack.animations).sort(([a], [b]) => a.localeCompare(b))) {
    if (!role || !raw.clip) throw new Error(`${pack.fighterId} animation role/clip must be non-empty`);
    if (animations.has(role)) throw new Error(`${pack.fighterId} duplicate animation role ${role}`);
    const speed = raw.speed ?? 1;
    if (!(speed > 0) || !Number.isFinite(speed)) throw new Error(`${pack.fighterId}.${role} animation speed must be finite and > 0`);
    const binding: AnimationBinding = { role, clip: raw.clip, grade: raw.grade, loop: raw.loop ?? false, speed };
    if (raw.source !== undefined) binding.source = raw.source;
    animations.set(role, binding);
  }
  return {
    fighterId: pack.fighterId,
    model: pack.model,
    armature: pack.armature,
    rigProfile: pack.rigProfile,
    scale: pack.scale,
    authoredFacing: pack.facing,
    materials: { ...pack.materials },
    sockets: { ...(pack.sockets ?? {}) },
    animations,
  };
}

/** Presentation metadata only: maps authored move ids to their semantic animation roles. */
export function compileMoveAnimationRoles(fighterId: string, moves: Readonly<Record<string, { animationRole: string }>>): Map<string, string> {
  return new Map(Object.entries(moves).sort(([a], [b]) => a.localeCompare(b)).map(([moveId, move]) => [`${fighterId}:${moveId}`, move.animationRole] as const));
}
