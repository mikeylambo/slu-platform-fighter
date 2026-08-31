import type { ParryPolicy } from './combatPolicies.js';
import type { MatchInputFrame, MatchStepResult } from './match.js';
import type { FighterState, WorldState } from './types.js';

export type ParryAwareStep = (state: WorldState, input: MatchInputFrame) => MatchStepResult;

function priorShieldHeldFrames(fighter: FighterState): number {
  let count=0;
  for(let index=fighter.inputHistory.length-1;index>=0;index-=1){const frame=fighter.inputHistory[index];if(!frame?.shieldHeld)break;count+=1;}
  return count;
}
export function perfectShieldActive(fighter:FighterState,inputShieldHeld:boolean,policy:ParryPolicy):boolean{
  if(!policy.enabled||!inputShieldHeld||policy.perfectWindowFrames<=0)return false;
  return priorShieldHeldFrames(fighter)<policy.perfectWindowFrames;
}

/** Post-processes ordinary shield blocks using only pre-frame input history and authored parry policy. No extra rollback state is required. */
export function withParry(step:ParryAwareStep,policy:ParryPolicy):ParryAwareStep{
  return(state,input)=>{
    if(!policy.enabled)return step(state,input);
    const before=new Map(state.fighters.map((fighter)=>[fighter.id,fighter] as const));
    const result=step(state,input);
    const parries=result.events.filter((event):event is Extract<(typeof result.events)[number],{type:'block'}>=>event.type==='block').filter((event)=>{
      const defender=before.get(event.targetId); const current=input.byFighterId[event.targetId];
      return defender!==undefined&&defender.shieldHealth>policy.shieldHealthCost&&perfectShieldActive(defender,Boolean(current?.shieldHeld),policy);
    });
    if(parries.length===0)return result;
    const parryByTarget=new Map(parries.map((event)=>[event.targetId,event] as const));
    const parryByAttacker=new Map(parries.map((event)=>[event.attackerId,event] as const));
    const fighters=result.state.fighters.map((fighter)=>{
      const defenderEvent=parryByTarget.get(fighter.id);
      if(defenderEvent){const previous=before.get(fighter.id)!;return{...fighter,shieldHealth:Math.max(0,previous.shieldHealth-policy.shieldHealthCost),shieldStunFrames:Math.max(0,fighter.shieldStunFrames-policy.defenderAdvantageFrames),shielding:true,hitstunFrames:previous.hitstunFrames};}
      if(parryByAttacker.has(fighter.id))return{...fighter,hitlagFrames:Math.max(fighter.hitlagFrames,policy.attackerFreezeFrames)};
      return fighter;
    });
    return{...result,state:{...result.state,fighters}};
  };
}
