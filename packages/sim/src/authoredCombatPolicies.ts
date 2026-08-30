import { fixed } from '../../deterministic-math/src/fixed.js';
import type { MoveRuntimeDefinition } from '../../content/src/compileMoveRuntime.js';
import type { MatchInputFrame, MatchStepResult } from './match.js';
import { canCancelCurrentMove, deriveMoveRuntime } from './moveRuntime.js';
import type { FighterAttackState, FighterState, WorldState } from './types.js';

export type PolicyAwareStep = (state: WorldState, input: MatchInputFrame) => MatchStepResult;

function advancedAttack(state: FighterAttackState | null, definitions: ReadonlyMap<string, MoveRuntimeDefinition>): FighterAttackState | null {
  if (!state) return null;
  const definition = definitions.get(state.attackId);
  if (!definition) return state;
  const nextFrame = state.frame + 1;
  return nextFrame >= definition.totalFrames ? null : { ...state, frame: nextFrame, hitTargets: [...state.hitTargets] };
}
function abs(value:number):number{return value<0?-value:value;}

/**
 * Executes authored cancel and armor semantics around the canonical match step.
 * Both are derivable from attack id/frame, so no additional rollback fields are required.
 */
export function withAuthoredCombatPolicies(step:PolicyAwareStep, definitions:ReadonlyMap<string,MoveRuntimeDefinition>):PolicyAwareStep {
  return (state,input)=>{
    const preFighters=state.fighters.map((fighter)=>{
      const fighterInput=input.byFighterId[fighter.id];
      if(!fighterInput||!canCancelCurrentMove(fighter,fighterInput,definitions)) return fighter;
      return {...fighter,attack:null};
    });
    const preState:WorldState={...state,fighters:preFighters};
    const result=step(preState,input);
    const beforeById=new Map(preFighters.map((fighter)=>[fighter.id,fighter] as const));
    const armoredTargets=new Map<string,{before:FighterState;retainDamage:boolean}>();
    for(const event of result.events){
      if(event.type!=='hit') continue;
      const before=beforeById.get(event.targetId); if(!before) continue;
      const armor=deriveMoveRuntime(before,definitions).armor; if(!armor) continue;
      const magnitude=Math.max(abs(event.knockbackX),abs(event.knockbackY));
      if(armor.launchThreshold!==null&&magnitude>armor.launchThreshold) continue;
      armoredTargets.set(event.targetId,{before,retainDamage:armor.retainDamage});
    }
    if(armoredTargets.size===0) return result;
    const fighters=result.state.fighters.map((fighter)=>{
      const armored=armoredTargets.get(fighter.id); if(!armored)return fighter;
      const {before,retainDamage}=armored;
      const matchingHits=result.events.filter((event)=>event.type==='hit'&&event.targetId===fighter.id);
      const damage=matchingHits.reduce((sum,event)=>sum+(event.type==='hit'?event.damageTenths:0),0);
      return {...fighter,vx:before.vx,vy:before.vy,hitstunFrames:before.hitstunFrames,attack:advancedAttack(before.attack,definitions),grounded:before.grounded,groundSurfaceId:before.groundSurfaceId,locomotion:before.locomotion,locomotionFrame:before.locomotionFrame,percentTenths:retainDamage?fighter.percentTenths:Math.max(0,fighter.percentTenths-damage)};
    });
    return {state:{...result.state,fighters},events:result.events};
  };
}
