import { fixed, type Fixed } from '../../deterministic-math/src/fixed.js';
import type { MatchEvent, MatchInputFrame, MatchStepResult } from './match.js';
import type { FighterState, WorldState } from './types.js';

export interface StaleMovePolicy { historySize:number; penaltyPermillePerPriorUse:number; maxPenaltyPermille:number; }
export interface RagePolicy { startPercentTenths:number; endPercentTenths:number; maxBonusPermille:number; }
export interface ComebackPolicy { bonusPermillePerStockDeficit:number; maxBonusPermille:number; }
export interface CombatModifierPolicy { stale?:StaleMovePolicy; rage?:RagePolicy; comeback?:ComebackPolicy; }
export type CombatModifierAwareStep=(state:WorldState,input:MatchInputFrame)=>MatchStepResult;

function clamp(value:number,min:number,max:number):number{return Math.max(min,Math.min(max,value));}
function sourceAndMove(event:MatchEvent):{sourceId:string|null;moveId:string|null}|null{
  switch(event.type){
    case 'hit': return {sourceId:event.attackerId,moveId:event.attackId};
    case 'throw': return {sourceId:event.attackerId,moveId:event.actionId};
    case 'entity-hit': return {sourceId:event.ownerId,moveId:null};
    case 'item-hit': return {sourceId:event.sourceId,moveId:null};
    default:return null;
  }
}
function targetId(event:MatchEvent):string|null{
  switch(event.type){case'hit':case'throw':case'entity-hit':case'item-hit':return event.targetId;default:return null;}
}
function validate(policy:CombatModifierPolicy):void{
  if(policy.stale){const p=policy.stale;if(!Number.isInteger(p.historySize)||p.historySize<1||p.historySize>255||!Number.isInteger(p.penaltyPermillePerPriorUse)||p.penaltyPermillePerPriorUse<0||!Number.isInteger(p.maxPenaltyPermille)||p.maxPenaltyPermille<0||p.maxPenaltyPermille>900)throw new Error('invalid stale-move policy');}
  if(policy.rage){const p=policy.rage;if(!Number.isInteger(p.startPercentTenths)||!Number.isInteger(p.endPercentTenths)||p.startPercentTenths<0||p.endPercentTenths<=p.startPercentTenths||!Number.isInteger(p.maxBonusPermille)||p.maxBonusPermille<0)throw new Error('invalid rage policy');}
  if(policy.comeback){const p=policy.comeback;if(!Number.isInteger(p.bonusPermillePerStockDeficit)||p.bonusPermillePerStockDeficit<0||!Number.isInteger(p.maxBonusPermille)||p.maxBonusPermille<0)throw new Error('invalid comeback policy');}
}
function scaleFor(source:FighterState,moveId:string|null,fighters:readonly FighterState[],policy:CombatModifierPolicy):number{
  let staleFactor=1000;
  if(policy.stale&&moveId){const priorUses=(source.recentAttackIds??[]).filter((id)=>id===moveId).length;const penalty=Math.min(policy.stale.maxPenaltyPermille,priorUses*policy.stale.penaltyPermillePerPriorUse);staleFactor=1000-penalty;}
  let bonus=0;
  if(policy.rage){const p=policy.rage;if(source.percentTenths>p.startPercentTenths){const progress=clamp(source.percentTenths-p.startPercentTenths,0,p.endPercentTenths-p.startPercentTenths);bonus+=Math.trunc(p.maxBonusPermille*progress/(p.endPercentTenths-p.startPercentTenths));}}
  if(policy.comeback){const maxEnemyStocks=Math.max(...fighters.filter((fighter)=>fighter.id!==source.id).map((fighter)=>fighter.stocks),source.stocks);const deficit=Math.max(0,maxEnemyStocks-source.stocks);bonus+=Math.min(policy.comeback.maxBonusPermille,deficit*policy.comeback.bonusPermillePerStockDeficit);}
  return Math.trunc(staleFactor*(1000+bonus)/1000);
}
function scaleFixed(value:Fixed,permille:number):Fixed{return fixed.mul(value,fixed.fromRatio(permille,1000));}
function applyScaledEvent(event:MatchEvent,permille:number,fighters:FighterState[]):MatchEvent{
  if(permille===1000)return event;
  const id=targetId(event);if(!id)return event;const index=fighters.findIndex((fighter)=>fighter.id===id);if(index<0)return event;const target=fighters[index]!;
  if(event.type==='hit'||event.type==='entity-hit'||event.type==='item-hit'){
    const scaledDamage=Math.max(0,Math.trunc(event.damageTenths*permille/1000));const damageDelta=scaledDamage-event.damageTenths;const knockbackX=scaleFixed(event.knockbackX,permille),knockbackY=scaleFixed(event.knockbackY,permille);
    fighters[index]={...target,percentTenths:Math.max(0,target.percentTenths+damageDelta),vx:knockbackX,vy:knockbackY};
    return{...event,damageTenths:scaledDamage,knockbackX,knockbackY};
  }
  if(event.type==='throw'){
    const scaledDamage=Math.max(0,Math.trunc(event.damageTenths*permille/1000));const damageDelta=scaledDamage-event.damageTenths;const knockbackX=scaleFixed(event.knockbackX,permille),knockbackY=scaleFixed(event.knockbackY,permille);
    fighters[index]={...target,percentTenths:Math.max(0,target.percentTenths+damageDelta),vx:knockbackX,vy:knockbackY};
    return{...event,damageTenths:scaledDamage,knockbackX,knockbackY};
  }
  return event;
}
function appendRecentAttacks(before:WorldState,afterFighters:FighterState[],events:readonly MatchEvent[],historySize:number):FighterState[]{
  const beforeById=new Map(before.fighters.map((fighter)=>[fighter.id,fighter] as const));
  const fallbackStarts=new Map<string,string>();for(const event of events){if(event.type==='hit'&&!fallbackStarts.has(event.attackerId))fallbackStarts.set(event.attackerId,event.attackId);}
  return afterFighters.map((fighter)=>{
    const prior=beforeById.get(fighter.id);let started:string|null=null;
    if(fighter.attack&&fighter.attack.frame===1&&(!prior?.attack||prior.attack.attackId!==fighter.attack.attackId))started=fighter.attack.attackId;
    else if(!prior?.attack)started=fallbackStarts.get(fighter.id)??null;
    if(!started)return fighter;const recent=[...(fighter.recentAttackIds??prior?.recentAttackIds??[]),started];return{...fighter,recentAttackIds:recent.slice(-historySize)};
  });
}

export function withCombatModifiers(step:CombatModifierAwareStep,policy:CombatModifierPolicy):CombatModifierAwareStep{
  validate(policy);const historySize=policy.stale?.historySize??1;
  return(state,input)=>{
    const result=step(state,input);const fighters=result.state.fighters.map((fighter)=>({...fighter,recentAttackIds:[...(fighter.recentAttackIds??[])]}));const sourceState=new Map(state.fighters.map((fighter)=>[fighter.id,fighter] as const));
    const events=result.events.map((event)=>{const source=sourceAndMove(event);if(!source?.sourceId)return event;const fighter=sourceState.get(source.sourceId)??fighters.find((entry)=>entry.id===source.sourceId);if(!fighter)return event;return applyScaledEvent(event,scaleFor(fighter,source.moveId,state.fighters,policy),fighters);});
    const withHistory=policy.stale?appendRecentAttacks(state,fighters,events,historySize):fighters;
    return{...result,state:{...result.state,fighters:withHistory},events};
  };
}
