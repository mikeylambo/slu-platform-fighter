import type { MatchEvent, MatchInputFrame, MatchStepResult } from './match.js';
import type { FighterState, SimInputFrame, WorldState } from './types.js';

export interface GrabEscapePolicy {
  enabled: boolean;
  escapeFrames: number;
  mashBonusFramesPerPress: number;
}
export interface GrabEscapeEvent { type: 'grab-escape'; captiveId: string; captorId: string; }
export type GrabEscapeAwareStep = (state: WorldState, input: MatchInputFrame) => MatchStepResult;

function mashPresses(input: SimInputFrame | undefined): number {
  if (!input) return 0;
  return Number(Boolean(input.attackPressed)) + Number(Boolean(input.specialPressed)) + Number(Boolean(input.grabPressed)) + Number(input.jumpPressed) + Number(input.dodgePressed);
}

export function applyGrabEscapeInput(state: WorldState, input: MatchInputFrame, policy: GrabEscapePolicy): { state: WorldState; events: GrabEscapeEvent[] } {
  if (!policy.enabled) return { state, events: [] };
  if (!Number.isInteger(policy.escapeFrames) || policy.escapeFrames < 1 || !Number.isInteger(policy.mashBonusFramesPerPress) || policy.mashBonusFramesPerPress < 0) throw new Error('grab escape policy requires positive escapeFrames and nonnegative integer mash bonus');
  const fighters = state.fighters.map((fighter) => ({ ...fighter }));
  const events: GrabEscapeEvent[] = [];
  const byId = new Map(fighters.map((fighter, index) => [fighter.id, index] as const));
  for (const captive of [...fighters].filter((fighter) => fighter.grabbedById !== null).sort((a,b)=>a.id.localeCompare(b.id))) {
    const captiveIndex=byId.get(captive.id); const captorIndex=captive.grabbedById?byId.get(captive.grabbedById):undefined;
    if(captiveIndex===undefined||captorIndex===undefined)continue;
    const captor=fighters[captorIndex]; if(!captor||captor.grabTargetId!==captive.id||captor.grabAction!==null)continue;
    const bonus=mashPresses(input.byFighterId[captive.id])*policy.mashBonusFramesPerPress;
    const progress=Math.max(captor.grabFrames,captive.grabFrames)+bonus;
    if(progress>=policy.escapeFrames){
      fighters[captorIndex]={...captor,grabTargetId:null,grabFrames:0,grabAction:null};
      fighters[captiveIndex]={...captive,grabbedById:null,grabFrames:0,grabAction:null,locomotion:captive.grounded?'idle':'airborne',locomotionFrame:0};
      events.push({type:'grab-escape',captiveId:captive.id,captorId:captor.id});
    }else if(bonus>0){
      fighters[captorIndex]={...captor,grabFrames:progress};
      fighters[captiveIndex]={...captive,grabFrames:progress};
    }
  }
  return {state:{...state,fighters},events};
}

/** Applies deterministic mash progress before ordinary grab maintenance; authored throws/pummels already in progress cannot be escaped unless future policy explicitly allows it. */
export function withGrabEscape(step: GrabEscapeAwareStep, policy: GrabEscapePolicy): GrabEscapeAwareStep {
  return (state,input)=>{
    const prepared=applyGrabEscapeInput(state,input,policy); const result=step(prepared.state,input);
    return {...result,events:[...prepared.events,...result.events] as MatchEvent[]};
  };
}
