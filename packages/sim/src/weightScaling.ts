import { fixed, type Fixed } from '../../deterministic-math/src/fixed.js';
import type { FighterPhysicsDefinition } from '../../content/src/compileFighterPhysics.js';
import type { MatchEvent, MatchInputFrame, MatchStepResult } from './match.js';
import type { WorldState } from './types.js';

export interface WeightScalingPolicy {
  enabled: boolean;
  baselineWeight: number;
  minLaunchPermille: number;
  maxLaunchPermille: number;
  scaleHitstun: boolean;
}
export type WeightAwareStep=(state:WorldState,input:MatchInputFrame)=>MatchStepResult;
function clamp(value:number,min:number,max:number){return Math.max(min,Math.min(max,value));}
export function launchScalePermille(weight:number,policy:WeightScalingPolicy):number{
  if(!policy.enabled)return 1000;
  if(!Number.isInteger(weight)||weight<=0||!Number.isInteger(policy.baselineWeight)||policy.baselineWeight<=0)throw new Error('weight scaling requires positive integer weight/baseline');
  return clamp(Math.trunc(policy.baselineWeight*1000/weight),policy.minLaunchPermille,policy.maxLaunchPermille);
}
function isLaunchEvent(event:MatchEvent):event is Extract<MatchEvent,{type:'hit'|'throw'|'entity-hit'}>{return event.type==='hit'||event.type==='throw'||event.type==='entity-hit';}
export function withWeightScaling(step:WeightAwareStep,physics:ReadonlyMap<string,FighterPhysicsDefinition>,policy:WeightScalingPolicy):WeightAwareStep{
  return(state,input)=>{
    const result=step(state,input); if(!policy.enabled)return result;
    const definitionByRuntimeId=new Map(result.state.fighters.map((fighter)=>[fighter.id,fighter.definitionId] as const));
    const scaledByTarget=new Map<string,{vx:Fixed;vy:Fixed;hitstunFrames:number}>();
    const events=result.events.map((event)=>{
      if(!isLaunchEvent(event))return event;
      const definitionId=definitionByRuntimeId.get(event.targetId); const targetPhysics=definitionId?physics.get(definitionId):undefined; if(!targetPhysics)return event;
      const scale=launchScalePermille(targetPhysics.weight,policy);
      const vx=fixed.mul(event.knockbackX,fixed.fromRatio(scale,1000)); const vy=fixed.mul(event.knockbackY,fixed.fromRatio(scale,1000));
      const hitstunFrames=policy.scaleHitstun?Math.max(0,Math.trunc(event.hitstunFrames*scale/1000)):event.hitstunFrames;
      scaledByTarget.set(event.targetId,{vx,vy,hitstunFrames}); return{...event,knockbackX:vx,knockbackY:vy,hitstunFrames};
    });
    const fighters=result.state.fighters.map((fighter)=>{const scaled=scaledByTarget.get(fighter.id);return scaled?{...fighter,vx:scaled.vx,vy:scaled.vy,hitstunFrames:scaled.hitstunFrames}:fighter;});
    return{...result,state:{...result.state,fighters},events};
  };
}
