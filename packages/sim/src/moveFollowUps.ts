import type { MoveFollowUpDefinition } from '../../content/src/compileFollowUps.js';
import type { MatchInputFrame, MatchStepResult } from './match.js';
import type { FighterState, SimInputFrame, WorldState } from './types.js';

export type FollowUpAwareStep=(state:WorldState,input:MatchInputFrame)=>MatchStepResult;
function requested(input:SimInputFrame|undefined,kind:MoveFollowUpDefinition['input']):boolean{return kind==='attack'?Boolean(input?.attackPressed):Boolean(input?.specialPressed);}
export function applyMoveFollowUps(state:WorldState,input:MatchInputFrame,followUps:ReadonlyMap<string,readonly MoveFollowUpDefinition[]>):WorldState{
  const fighters=state.fighters.map((fighter):FighterState=>{
    const attack=fighter.attack;if(!attack)return fighter;const rules=followUps.get(attack.attackId);if(!rules?.length)return fighter;const current=input.byFighterId[fighter.id];
    const eligible=rules.find((rule)=>attack.frame>=rule.startFrame&&attack.frame<=rule.endFrame&&requested(current,rule.input)&&(!rule.requireContact||attack.hitTargets.length>0));
    if(!eligible)return fighter;
    return{...fighter,attack:{attackId:eligible.nextMoveId,frame:0,hitTargets:[]}};
  });
  return{...state,fighters};
}
/** Generic content-authored move-to-move sequencing, evaluated before the ordinary match step. */
export function withMoveFollowUps(step:FollowUpAwareStep,followUps:ReadonlyMap<string,readonly MoveFollowUpDefinition[]>):FollowUpAwareStep{return(state,input)=>step(applyMoveFollowUps(state,input,followUps),input);}
