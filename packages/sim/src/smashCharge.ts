import { fixed } from '../../deterministic-math/src/fixed.js';
import type { MatchInputFrame, MatchStepResult } from './match.js';
import type { FighterState, SimInputFrame, WorldState } from './types.js';

export interface SmashChargePolicy { attackId:string; maxChargeFrames:number; damageBonusPermilleAtMax:number; launchBonusPermilleAtMax:number; }
export type SmashChargeAwareStep=(state:WorldState,input:MatchInputFrame)=>MatchStepResult;
const THRESHOLD=500;
function smashRequest(fighter:FighterState,input:SimInputFrame):{attackId:string;axis:'x'|'y';direction:-1|1}|null{
  const x=input.smashX??0,y=input.smashY??0;
  if(Math.abs(y)>=Math.abs(x)&&Math.abs(y)>=THRESHOLD)return{attackId:`${fighter.definitionId}:${y>0?'up-smash':'down-smash'}`,axis:'y',direction:y>0?1:-1};
  if(Math.abs(x)>=THRESHOLD)return{attackId:`${fighter.definitionId}:forward-smash`,axis:'x',direction:x>0?1:-1};
  return null;
}
function held(input:SimInputFrame|undefined,axis:'x'|'y',direction:-1|1):boolean{const value=axis==='x'?(input?.smashX??0):(input?.smashY??0);return direction*value>=THRESHOLD;}
function suppress(input:SimInputFrame):SimInputFrame{return{...input,smashX:0,smashY:0};}
function releaseInput(input:SimInputFrame,axis:'x'|'y',direction:-1|1):SimInputFrame{return axis==='x'?{...input,smashX:direction*1000,smashY:0}:{...input,smashX:0,smashY:direction*1000};}
function scalePermille(charge:number,max:number,bonus:number){return 1000+Math.trunc(bonus*Math.min(charge,max)/max);}

export function withSmashCharge(step:SmashChargeAwareStep,policies:ReadonlyMap<string,SmashChargePolicy>):SmashChargeAwareStep{
  return(state,input)=>{
    const releaseCharges=new Map<string,{attackId:string;frames:number}>(); const forwarded:Record<string,SimInputFrame>={};
    const fighters=state.fighters.map((fighter):FighterState=>{
      const raw=input.byFighterId[fighter.id]??{frame:state.frame,moveX:0,moveY:0,jumpPressed:false,jumpHeld:false,dodgePressed:false,shieldHeld:false};
      const charging=fighter.smashCharge??null;
      if(charging){const policy=policies.get(charging.attackId);if(!policy)throw new Error(`missing smash charge policy ${charging.attackId}`);const nextFrames=Math.min(policy.maxChargeFrames,charging.frames+1);if(held(raw,charging.axis,charging.direction)&&nextFrames<policy.maxChargeFrames){forwarded[fighter.id]=suppress(raw);return{...fighter,smashCharge:{...charging,frames:nextFrames}};}releaseCharges.set(fighter.id,{attackId:charging.attackId,frames:nextFrames});forwarded[fighter.id]=releaseInput(raw,charging.axis,charging.direction);return{...fighter,smashCharge:null};}
      const request=smashRequest(fighter,raw);const policy=request?policies.get(request.attackId):undefined;const eligible=request&&policy&&fighter.grounded&&fighter.attack===null&&fighter.hitlagFrames===0&&fighter.hitstunFrames===0&&fighter.shieldStunFrames===0&&fighter.grabTargetId===null&&fighter.grabbedById===null;
      if(eligible){forwarded[fighter.id]=suppress(raw);return{...fighter,smashCharge:{attackId:request.attackId,frames:1,axis:request.axis,direction:request.direction}};}forwarded[fighter.id]=raw;return fighter;
    });
    const prepared={...state,fighters};const result=step(prepared,{frame:input.frame,byFighterId:forwarded});
    const chargeByAttacker=new Map<string,{attackId:string;frames:number}>();
    for(const fighter of prepared.fighters){if(fighter.attack?.chargeFrames&&fighter.attack.chargeFrames>0)chargeByAttacker.set(fighter.id,{attackId:fighter.attack.attackId,frames:fighter.attack.chargeFrames});}
    for(const [id,charge] of releaseCharges)chargeByAttacker.set(id,charge);
    let resultFighters=result.state.fighters.map((fighter)=>{const released=releaseCharges.get(fighter.id);if(!released||fighter.attack?.attackId!==released.attackId)return fighter;return{...fighter,attack:{...fighter.attack,chargeFrames:released.frames}};});
    const byId=new Map(resultFighters.map((fighter,index)=>[fighter.id,index] as const));
    const events=result.events.map((event)=>{
      if(event.type!=='hit')return event;const charge=chargeByAttacker.get(event.attackerId);if(!charge||charge.attackId!==event.attackId)return event;const policy=policies.get(charge.attackId);if(!policy)return event;
      const damageScale=scalePermille(charge.frames,policy.maxChargeFrames,policy.damageBonusPermilleAtMax);const launchScale=scalePermille(charge.frames,policy.maxChargeFrames,policy.launchBonusPermilleAtMax);const damageTenths=Math.trunc(event.damageTenths*damageScale/1000);const knockbackX=fixed.mul(event.knockbackX,fixed.fromRatio(launchScale,1000));const knockbackY=fixed.mul(event.knockbackY,fixed.fromRatio(launchScale,1000));
      const index=byId.get(event.targetId);if(index!==undefined){const target=resultFighters[index]!;resultFighters[index]={...target,percentTenths:target.percentTenths+(damageTenths-event.damageTenths),vx:knockbackX,vy:knockbackY};}
      return{...event,damageTenths,knockbackX,knockbackY};
    });
    return{...result,state:{...result.state,fighters:resultFighters},events};
  };
}
