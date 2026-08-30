import type { Fixed } from '../../deterministic-math/src/fixed.js';

interface TimelineEvent { frame: number; type: string; data?: Record<string, unknown>; }
interface PackMove { totalFrames: number; timeline: readonly TimelineEvent[]; }
interface FighterPackLike { id: string; moves: Readonly<Record<string, PackMove>>; }

export interface MoveVectorEvent { frame: number; x: Fixed; y: Fixed; }
export interface MoveFrameWindow { startFrame: number; endFrame: number; }
export interface MoveArmorWindow extends MoveFrameWindow { launchThreshold: Fixed | null; retainDamage: boolean; }
export type CancelAction = 'attack' | 'special' | 'jump' | 'dodge' | 'grab';
export interface MoveCancelWindow extends MoveFrameWindow { allowedActions: readonly CancelAction[]; requireContact: boolean; }
export interface MoveHurtboxKeyframe { frame: number; radius: Fixed; offsetY: Fixed; }
export interface MoveRuntimeDefinition {
  id: string;
  totalFrames: number;
  impulses: readonly MoveVectorEvent[];
  velocities: readonly MoveVectorEvent[];
  invulnerability: readonly MoveFrameWindow[];
  armor: readonly MoveArmorWindow[];
  cancels: readonly MoveCancelWindow[];
  hurtboxes: readonly MoveHurtboxKeyframe[];
}

function integer(data: Record<string, unknown> | undefined, key: string, label: string): number {
  const value = data?.[key]; if (!Number.isInteger(value)) throw new Error(`${label} ${key} must be integer`); return value as number;
}
function bool(data: Record<string, unknown> | undefined, key: string, fallback: boolean, label: string): boolean {
  const value = data?.[key]; if (value === undefined) return fallback; if (typeof value !== 'boolean') throw new Error(`${label} ${key} must be boolean`); return value;
}
function compileWindows(moveId: string, events: readonly TimelineEvent[], onType: string, offType: string): MoveFrameWindow[] {
  const windows: MoveFrameWindow[] = []; let open: number | null = null;
  for (const event of events) {
    if (event.type === onType) { if (open !== null) throw new Error(`${moveId} ${onType} opened twice without ${offType}`); open = event.frame; }
    else if (event.type === offType) { if (open === null) throw new Error(`${moveId} ${offType} has no matching ${onType}`); if (event.frame <= open) throw new Error(`${moveId} ${onType}/${offType} window must span at least one frame`); windows.push({ startFrame: open, endFrame: event.frame - 1 }); open = null; }
  }
  if (open !== null) throw new Error(`${moveId} leaves ${onType} active at move end`); return windows;
}
function compileArmor(moveId: string, events: readonly TimelineEvent[]): MoveArmorWindow[] {
  const windows: MoveArmorWindow[] = []; let open: { frame:number; launchThreshold:Fixed|null; retainDamage:boolean } | null = null;
  for (const event of events) {
    if (event.type === 'armor_on') {
      if (open) throw new Error(`${moveId} armor_on opened twice without armor_off`);
      const raw = event.data?.launchThreshold;
      if (raw !== null && !Number.isInteger(raw)) throw new Error(`${moveId} armor_on launchThreshold must be fixed integer or null`);
      open = { frame:event.frame, launchThreshold:(raw === null ? null : raw as number) as Fixed | null, retainDamage:bool(event.data,'retainDamage',true,`${moveId} armor_on`) };
    } else if (event.type === 'armor_off') {
      if (!open) throw new Error(`${moveId} armor_off has no matching armor_on`); if (event.frame <= open.frame) throw new Error(`${moveId} armor window must span at least one frame`);
      windows.push({ startFrame:open.frame,endFrame:event.frame-1,launchThreshold:open.launchThreshold,retainDamage:open.retainDamage }); open=null;
    }
  }
  if (open) throw new Error(`${moveId} leaves armor active at move end`); return windows;
}
function compileCancels(moveId:string, events:readonly TimelineEvent[]):MoveCancelWindow[] {
  const windows:MoveCancelWindow[]=[]; let open:{frame:number;allowedActions:CancelAction[];requireContact:boolean}|null=null; const valid=new Set<CancelAction>(['attack','special','jump','dodge','grab']);
  for(const event of events){
    if(event.type==='cancel_on'){
      if(open) throw new Error(`${moveId} cancel_on opened twice without cancel_off`); const raw=event.data?.allowedActions;
      if(!Array.isArray(raw)||raw.length===0||raw.some((v)=>typeof v!=='string'||!valid.has(v as CancelAction))) throw new Error(`${moveId} cancel_on allowedActions must contain attack/special/jump/dodge/grab`);
      const allowed=[...new Set(raw as CancelAction[])]; open={frame:event.frame,allowedActions:allowed,requireContact:bool(event.data,'requireContact',false,`${moveId} cancel_on`)};
    } else if(event.type==='cancel_off'){
      if(!open) throw new Error(`${moveId} cancel_off has no matching cancel_on`); if(event.frame<=open.frame) throw new Error(`${moveId} cancel window must span at least one frame`);
      windows.push({startFrame:open.frame,endFrame:event.frame-1,allowedActions:open.allowedActions,requireContact:open.requireContact}); open=null;
    }
  }
  if(open) throw new Error(`${moveId} leaves cancel active at move end`); return windows;
}
function compileHurtboxes(moveId:string, events:readonly TimelineEvent[]):MoveHurtboxKeyframe[]{
  return events.filter((event)=>event.type==='hurtbox').map((event)=>{const radius=integer(event.data,'radius',`${moveId} hurtbox`) as Fixed; const offsetY=integer(event.data,'offsetY',`${moveId} hurtbox`) as Fixed; if(radius<=0) throw new Error(`${moveId} hurtbox radius must be positive`); return {frame:event.frame,radius,offsetY};}).sort((a,b)=>a.frame-b.frame||a.radius-b.radius||a.offsetY-b.offsetY);
}

export function compileMoveRuntime(fighterId:string, moveName:string, move:PackMove):MoveRuntimeDefinition {
  const id=`${fighterId}:${moveName}`; const impulses:MoveVectorEvent[]=[]; const velocities:MoveVectorEvent[]=[];
  for(const event of move.timeline){ if(event.type!=='impulse'&&event.type!=='velocity') continue; const vector={frame:event.frame,x:integer(event.data,'x',`${id} ${event.type}`) as Fixed,y:integer(event.data,'y',`${id} ${event.type}`) as Fixed}; if(event.type==='impulse') impulses.push(vector); else velocities.push(vector); }
  const byFrame=(a:MoveVectorEvent,b:MoveVectorEvent)=>a.frame-b.frame||a.x-b.x||a.y-b.y; impulses.sort(byFrame); velocities.sort(byFrame);
  return { id,totalFrames:move.totalFrames,impulses,velocities,invulnerability:compileWindows(id,move.timeline,'invuln_on','invuln_off'),armor:compileArmor(id,move.timeline),cancels:compileCancels(id,move.timeline),hurtboxes:compileHurtboxes(id,move.timeline) };
}
export function compileFighterMoveRuntime(pack:FighterPackLike):Map<string,MoveRuntimeDefinition>{ return new Map(Object.entries(pack.moves).sort(([a],[b])=>a.localeCompare(b)).map(([name,move])=>{const definition=compileMoveRuntime(pack.id,name,move);return [definition.id,definition] as const;})); }
