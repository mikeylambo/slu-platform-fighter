import { fixed, type Fixed } from '../../deterministic-math/src/fixed.js';
import { rngRange } from '../../deterministic-math/src/rng.js';
import type { MatchInputFrame, MatchStepResult } from './match.js';
import { consumeItemUse, pickupItem, type ItemDefinition, type ItemSpawnTable } from './items.js';
import type { FighterState, ItemState, SimInputFrame, WorldState } from './types.js';

export interface ItemSpawnPoint { id: string; x: Fixed; y: Fixed; }
export interface ItemRuntimePolicy {
  definitions: ReadonlyMap<string, ItemDefinition>;
  spawnTable: ItemSpawnTable | null;
  spawnPoints: readonly ItemSpawnPoint[];
  throwSpeedX: Fixed;
  throwSpeedY: Fixed;
}
export type ItemAwareStep = (state: WorldState, input: MatchInputFrame) => MatchStepResult;

function weightedChoice(seed: number, table: ItemSpawnTable): { definitionId: string; seed: number } {
  const total = table.entries.reduce((sum, entry) => sum + entry.weight, 0);
  const roll = rngRange(seed, total);
  let cursor = roll.value;
  for (const entry of table.entries) {
    if (cursor < entry.weight) return { definitionId: entry.itemDefinitionId, seed: roll.nextSeed };
    cursor -= entry.weight;
  }
  throw new Error(`${table.id} weighted choice exhausted unexpectedly`);
}
function distanceSq(aX: Fixed, aY: Fixed, bX: Fixed, bY: Fixed): Fixed {
  const dx = fixed.sub(aX,bX); const dy = fixed.sub(aY,bY); return fixed.add(fixed.mul(dx,dx),fixed.mul(dy,dy));
}
function syncHeldItems(items: readonly ItemState[], fighters: readonly FighterState[]): ItemState[] {
  const byId=new Map(fighters.map((fighter)=>[fighter.id,fighter] as const));
  return items.map((item)=>{ if(item.holderId===null)return item; const fighter=byId.get(item.holderId); return fighter?{...item,x:fighter.x,y:fighter.y,vx:fixed.zero,vy:fixed.zero}: {...item,holderId:null}; }).sort((a,b)=>a.id.localeCompare(b.id));
}

export function stepAuthoritativeItems(state: WorldState, input: MatchInputFrame, policy: ItemRuntimePolicy): { state: WorldState; input: MatchInputFrame } {
  let seed=state.seed; let serial=state.nextItemSerial??1;
  let items=[...(state.items??[])].map((item)=>({...item}));
  const table=policy.spawnTable;
  if(table&&policy.spawnPoints.length>0&&state.frame%table.intervalFrames===0&&items.length<table.maxActive){
    const chosen=weightedChoice(seed,table); seed=chosen.seed; const definition=policy.definitions.get(chosen.definitionId); if(!definition)throw new Error(`missing item definition ${chosen.definitionId}`);
    const pointRoll=rngRange(seed,policy.spawnPoints.length); seed=pointRoll.nextSeed; const point=policy.spawnPoints[pointRoll.value]; if(!point)throw new Error('item spawn point selection failed');
    items.push({id:`i${serial}`,definitionId:definition.id,x:point.x,y:point.y,vx:fixed.zero,vy:fixed.zero,holderId:null,usesRemaining:definition.maxUses,ageFrames:0}); serial+=1;
  }

  items=items.map((item)=>item.holderId===null?{...item,x:fixed.add(item.x,item.vx),y:fixed.add(item.y,item.vy),ageFrames:item.ageFrames+1}:item)
    .filter((item)=>{const def=policy.definitions.get(item.definitionId); if(!def)throw new Error(`missing item definition ${item.definitionId}`); return def.lifetimeFrames===null||item.ageFrames<def.lifetimeFrames;});

  const byFighter:Record<string,SimInputFrame>={};
  for(const fighter of [...state.fighters].sort((a,b)=>a.id.localeCompare(b.id))){
    let fighterInput=input.byFighterId[fighter.id]??{frame:state.frame,moveX:0,moveY:0,jumpPressed:false,jumpHeld:false,dodgePressed:false,shieldHeld:false};
    const held=items.find((item)=>item.holderId===fighter.id);
    if(held&&fighterInput.attackPressed){
      const definition=policy.definitions.get(held.definitionId); if(!definition)throw new Error(`missing item definition ${held.definitionId}`);
      if(definition.useMode==='throw'&&definition.throwable){
        const facing=fixed.fromInt(fighter.facing); const dropped={...held,holderId:null,x:fighter.x,y:fighter.y,vx:fixed.mul(policy.throwSpeedX,facing),vy:policy.throwSpeedY};
        const consumed=consumeItemUse(dropped); items=items.filter((item)=>item.id!==held.id); if(consumed)items.push(consumed);
      }else{
        const consumed=consumeItemUse(held); items=items.filter((item)=>item.id!==held.id); if(consumed)items.push(consumed);
      }
      fighterInput={...fighterInput,attackPressed:false};
    }else if(!held&&fighterInput.grabPressed){
      const candidates=items.filter((item)=>item.holderId===null).map((item)=>({item,definition:policy.definitions.get(item.definitionId)})).filter((entry):entry is {item:ItemState;definition:ItemDefinition}=>entry.definition!==undefined)
        .filter(({item,definition})=>distanceSq(fighter.x,fighter.y,item.x,item.y)<=fixed.mul(definition.pickupRadius,definition.pickupRadius)).sort((a,b)=>a.item.id.localeCompare(b.item.id));
      const candidate=candidates[0]?.item; if(candidate){items=items.map((item)=>item.id===candidate.id?pickupItem(item,fighter.id):item); fighterInput={...fighterInput,grabPressed:false};}
    }
    byFighter[fighter.id]=fighterInput;
  }
  return {state:{...state,seed,items:items.sort((a,b)=>a.id.localeCompare(b.id)),nextItemSerial:serial},input:{frame:input.frame,byFighterId:byFighter}};
}

export function withAuthoritativeItems(step: ItemAwareStep, policy: ItemRuntimePolicy): ItemAwareStep {
  return (state,input)=>{
    const prepared=stepAuthoritativeItems(state,input,policy); const result=step(prepared.state,prepared.input);
    const synced=syncHeldItems(prepared.state.items??[],result.state.fighters);
    return {...result,state:{...result.state,seed:prepared.state.seed,items:synced,nextItemSerial:prepared.state.nextItemSerial??1}};
  };
}
