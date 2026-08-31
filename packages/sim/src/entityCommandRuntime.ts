import type { EntityCommandDefinition } from '../../content/src/compileEntities.js';
import { applyEntityCommandsFromAttacks } from './entities.js';
import type { MatchInputFrame, MatchStepResult } from './match.js';
import type { FighterState, WorldState } from './types.js';

export type EntityCommandAwareStep = (state:WorldState,input:MatchInputFrame)=>MatchStepResult;

function withFrameZeroAttack(fighter:FighterState):FighterState {
  if(!fighter.attack)return fighter;
  return {...fighter,attack:{...fighter.attack,frame:0}};
}

/**
 * Executes commands for attacks already active at frame start, then catches commands on
 * attacks that began during the inner step by replaying only their authored frame-0 command.
 */
export function withEntityCommands(step:EntityCommandAwareStep,commandsByMoveId:ReadonlyMap<string,readonly EntityCommandDefinition[]>):EntityCommandAwareStep {
  if(commandsByMoveId.size===0)return step;
  return (state,input)=>{
    const preEntities=applyEntityCommandsFromAttacks(state.fighters,state.entities??[],commandsByMoveId);
    const prepared:WorldState={...state,entities:preEntities};
    const result=step(prepared,input);
    const previousById=new Map(state.fighters.map((fighter)=>[fighter.id,fighter] as const));
    const newFrameZeroFighters=result.state.fighters
      .filter((fighter)=>{
        if(!fighter.attack||fighter.attack.frame!==1)return false;
        const previous=previousById.get(fighter.id);
        return !previous?.attack||previous.attack.attackId!==fighter.attack.attackId;
      })
      .map(withFrameZeroAttack);
    if(newFrameZeroFighters.length===0)return result;
    const postEntities=applyEntityCommandsFromAttacks(newFrameZeroFighters,result.state.entities??[],commandsByMoveId);
    return {...result,state:{...result.state,entities:postEntities}};
  };
}
