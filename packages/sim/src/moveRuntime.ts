import { fixed } from '../../deterministic-math/src/fixed.js';
import type { CancelAction, MoveArmorWindow, MoveHurtboxKeyframe, MoveRuntimeDefinition } from '../../content/src/compileMoveRuntime.js';
import type { FighterState, SimInputFrame } from './types.js';

function activeWindow(frame:number,startFrame:number,endFrame:number):boolean{return frame>=startFrame&&frame<=endFrame;}
export interface DerivedMoveRuntime { armor: MoveArmorWindow | null; hurtbox: MoveHurtboxKeyframe | null; }

/** Content-derived frame state; no extra rollback fields are needed because the result is a pure function of attack id/frame. */
export function deriveMoveRuntime(fighter:FighterState, definitions:ReadonlyMap<string,MoveRuntimeDefinition>):DerivedMoveRuntime {
  if(!fighter.attack) return {armor:null,hurtbox:null}; const definition=definitions.get(fighter.attack.attackId); if(!definition) return {armor:null,hurtbox:null}; const frame=fighter.attack.frame;
  const armor=definition.armor.find((window)=>activeWindow(frame,window.startFrame,window.endFrame))??null;
  const hurtbox=[...definition.hurtboxes].filter((keyframe)=>keyframe.frame<=frame).sort((a,b)=>b.frame-a.frame)[0]??null;
  return {armor,hurtbox};
}
function requestedCancelActions(input:SimInputFrame):CancelAction[]{ const result:CancelAction[]=[]; if(input.attackPressed)result.push('attack'); if(input.specialPressed)result.push('special'); if(input.jumpPressed)result.push('jump'); if(input.dodgePressed)result.push('dodge'); if(input.grabPressed)result.push('grab'); return result; }
/** Returns true when the current authored cancel window permits the current input request. */
export function canCancelCurrentMove(fighter:FighterState,input:SimInputFrame,definitions:ReadonlyMap<string,MoveRuntimeDefinition>):boolean {
  if(!fighter.attack)return false; const definition=definitions.get(fighter.attack.attackId); if(!definition)return false; const frame=fighter.attack.frame; const requested=requestedCancelActions(input); if(requested.length===0)return false;
  return definition.cancels.some((window)=>activeWindow(frame,window.startFrame,window.endFrame)&&(!window.requireContact||fighter.attack!.hitTargets.length>0)&&requested.some((action)=>window.allowedActions.includes(action)));
}

export function applyMoveRuntimeFrame(fighter:FighterState,definitions:ReadonlyMap<string,MoveRuntimeDefinition>):FighterState {
  if(!fighter.attack)return fighter; const definition=definitions.get(fighter.attack.attackId); if(!definition)return fighter; const frame=fighter.attack.frame; let next=fighter; const facing=fixed.fromInt(fighter.facing);
  for(const velocity of definition.velocities){if(velocity.frame!==frame)continue;next={...next,vx:fixed.mul(velocity.x,facing),vy:velocity.y};}
  for(const impulse of definition.impulses){if(impulse.frame!==frame)continue;next={...next,vx:fixed.add(next.vx,fixed.mul(impulse.x,facing)),vy:fixed.add(next.vy,impulse.y)};}
  const invulnerable=definition.invulnerability.some((window)=>activeWindow(frame,window.startFrame,window.endFrame)); if(invulnerable)next={...next,invulnerableFrames:Math.max(next.invulnerableFrames,1)}; return next;
}
export function applyMoveRuntimeFrames(fighters:readonly FighterState[],definitions:ReadonlyMap<string,MoveRuntimeDefinition>):FighterState[]{return [...fighters].sort((a,b)=>a.id.localeCompare(b.id)).map((fighter)=>applyMoveRuntimeFrame(fighter,definitions));}
