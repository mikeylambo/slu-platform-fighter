import { fixed, type Fixed } from '../../deterministic-math/src/fixed.js';
import { rngRange } from '../../deterministic-math/src/rng.js';
import { K2_DEFENSE } from './combat.js';
import { applyDirectionalInfluence } from './knockback.js';
import type { MatchInputFrame, MatchStepResult } from './match.js';
import { consumeItemUse, pickupItem, type ItemCombatDefinition, type ItemCombatEvent, type ItemDefinition, type ItemSpawnTable } from './items.js';
import type { FighterState, ItemState, SimInputFrame, WorldState } from './types.js';

const FIGHTER_HURTBOX_RADIUS=fixed.fromRatio(3,4);
const FIGHTER_HURTBOX_OFFSET_Y=fixed.fromRatio(3,2);

export interface ItemSpawnPoint { id: string; x: Fixed; y: Fixed; }
export interface ItemRuntimePolicy {
  definitions: ReadonlyMap<string, ItemDefinition>;
  spawnTable: ItemSpawnTable | null;
  spawnPoints: readonly ItemSpawnPoint[];
  throwSpeedX: Fixed;
  throwSpeedY: Fixed;
  canAffect?: (sourceId:string|null,targetId:string)=>boolean;
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
function distanceSq(aX: Fixed, aY: Fixed, bX: Fixed, bY: Fixed): Fixed { const dx=fixed.sub(aX,bX),dy=fixed.sub(aY,bY);return fixed.add(fixed.mul(dx,dx),fixed.mul(dy,dy)); }
function circlesOverlap(ax:Fixed,ay:Fixed,ar:Fixed,bx:Fixed,by:Fixed,br:Fixed):boolean{const dx=fixed.sub(ax,bx),dy=fixed.sub(ay,by),r=fixed.add(ar,br);return fixed.add(fixed.mul(dx,dx),fixed.mul(dy,dy))<=fixed.mul(r,r);}
function syncHeldItems(items: readonly ItemState[], fighters: readonly FighterState[]): ItemState[] {
  const byId=new Map(fighters.map((fighter)=>[fighter.id,fighter] as const));
  return items.map((item)=>{if(item.holderId===null)return item;const fighter=byId.get(item.holderId);return fighter?{...item,x:fighter.x,y:fighter.y,vx:fixed.zero,vy:fixed.zero}:{...item,holderId:null};}).sort((a,b)=>a.id.localeCompare(b.id));
}
function normalizedDirection(combat:ItemCombatDefinition,facing:-1|1):{x:Fixed;y:Fixed}{const rawX=combat.directionX*facing,rawY=combat.directionY,magnitude=Math.max(Math.abs(rawX),Math.abs(rawY),1);return{x:fixed.fromRatio(rawX,magnitude),y:fixed.fromRatio(rawY,magnitude)};}
function applyItemContact(item:ItemState,combat:ItemCombatDefinition,sourceId:string|null,facing:-1|1,fighters:FighterState[],input:MatchInputFrame,canAffect:(sourceId:string|null,targetId:string)=>boolean,stopAfterFirst:boolean):ItemCombatEvent[]{
  const events:ItemCombatEvent[]=[];
  for(let index=0;index<fighters.length;index+=1){
    const target=fighters[index];if(!target||target.id===sourceId||target.eliminated||target.respawnFrames>0||target.invulnerableFrames>0||!canAffect(sourceId,target.id))continue;
    const hurtboxY=fixed.add(target.y,FIGHTER_HURTBOX_OFFSET_Y);if(!circlesOverlap(item.x,item.y,combat.radius,target.x,hurtboxY,FIGHTER_HURTBOX_RADIUS))continue;
    if(target.shielding&&target.shieldHealth>0){
      const shieldDamage=K2_DEFENSE.shieldDamageBase+combat.damageTenths,shieldHealthAfter=Math.max(0,target.shieldHealth-shieldDamage),broken=shieldHealthAfter===0;
      fighters[index]={...target,shieldHealth:shieldHealthAfter,shielding:!broken,shieldStunFrames:broken?0:Math.max(target.shieldStunFrames,K2_DEFENSE.shieldStunBaseFrames+combat.hitlagFrames),shieldRegenDelayFrames:K2_DEFENSE.shieldRegenDelayFrames,hitlagFrames:Math.max(target.hitlagFrames,combat.hitlagFrames),hitstunFrames:broken?Math.max(target.hitstunFrames,K2_DEFENSE.shieldBreakStunFrames):target.hitstunFrames,attack:broken?null:target.attack};
      events.push({type:'item-block',itemId:item.id,definitionId:item.definitionId,sourceId,targetId:target.id,shieldDamage,shieldHealthAfter,broken});
    }else{
      const percentTenths=target.percentTenths+combat.damageTenths,magnitude=fixed.add(combat.baseKnockback,fixed.mul(combat.growthPer100Percent,fixed.fromRatio(percentTenths,1000))),direction=normalizedDirection(combat,facing),baseX=fixed.mul(direction.x,magnitude),baseY=fixed.mul(direction.y,magnitude),influenced=applyDirectionalInfluence(baseX,baseY,input.byFighterId[target.id]??{frame:input.frame,moveX:0,moveY:0,jumpPressed:false,jumpHeld:false,dodgePressed:false,shieldHeld:false});
      fighters[index]={...target,percentTenths,vx:influenced.vx,vy:influenced.vy,hitlagFrames:Math.max(target.hitlagFrames,combat.hitlagFrames),hitstunFrames:Math.max(target.hitstunFrames,combat.hitstunFrames),attack:null,shielding:false,grounded:false,groundSurfaceId:null,locomotion:'airborne',locomotionFrame:0};
      events.push({type:'item-hit',itemId:item.id,definitionId:item.definitionId,sourceId,targetId:target.id,damageTenths:combat.damageTenths,knockbackX:influenced.vx,knockbackY:influenced.vy,hitlagFrames:combat.hitlagFrames,hitstunFrames:combat.hitstunFrames});
    }
    if(stopAfterFirst)break;
  }
  return events;
}

export function stepAuthoritativeItems(state: WorldState, input: MatchInputFrame, policy: ItemRuntimePolicy): { state: WorldState; input: MatchInputFrame; events: ItemCombatEvent[] } {
  let seed=state.seed;let serial=state.nextItemSerial??1;let items=[...(state.items??[])].map((item)=>({...item}));let fighters=state.fighters.map((fighter)=>({...fighter}));const events:ItemCombatEvent[]=[];const canAffect=policy.canAffect??(()=>true);
  const table=policy.spawnTable;
  if(table&&policy.spawnPoints.length>0&&state.frame%table.intervalFrames===0&&items.length<table.maxActive){
    const chosen=weightedChoice(seed,table);seed=chosen.seed;const definition=policy.definitions.get(chosen.definitionId);if(!definition)throw new Error(`missing item definition ${chosen.definitionId}`);
    const pointRoll=rngRange(seed,policy.spawnPoints.length);seed=pointRoll.nextSeed;const point=policy.spawnPoints[pointRoll.value];if(!point)throw new Error('item spawn point selection failed');
    items.push({id:`i${serial}`,definitionId:definition.id,x:point.x,y:point.y,vx:fixed.zero,vy:fixed.zero,holderId:null,usesRemaining:definition.maxUses,ageFrames:0});serial+=1;
  }

  items=items.map((item)=>item.holderId===null?{...item,x:fixed.add(item.x,item.vx),y:fixed.add(item.y,item.vy),ageFrames:item.ageFrames+1}:item)
    .filter((item)=>{const def=policy.definitions.get(item.definitionId);if(!def)throw new Error(`missing item definition ${item.definitionId}`);return def.lifetimeFrames===null||item.ageFrames<def.lifetimeFrames;});

  // Free items only become combat actors while actually travelling; idle pickups remain safe.
  for(const item of [...items].filter((candidate)=>candidate.holderId===null&&(candidate.vx!==fixed.zero||candidate.vy!==fixed.zero)).sort((a,b)=>a.id.localeCompare(b.id))){
    const definition=policy.definitions.get(item.definitionId);if(!definition?.combat)continue;const facing:-1|1=item.vx<fixed.zero?-1:1;const contactEvents=applyItemContact(item,definition.combat,null,facing,fighters,input,canAffect,true);if(contactEvents.length>0){events.push(...contactEvents);items=items.filter((candidate)=>candidate.id!==item.id);}
  }

  const byFighter:Record<string,SimInputFrame>={};
  for(const fighterSeed of [...fighters].sort((a,b)=>a.id.localeCompare(b.id))){
    const fighter=fighters.find((entry)=>entry.id===fighterSeed.id)??fighterSeed;
    let fighterInput=input.byFighterId[fighter.id]??{frame:state.frame,moveX:0,moveY:0,jumpPressed:false,jumpHeld:false,dodgePressed:false,shieldHeld:false};
    const held=items.find((item)=>item.holderId===fighter.id);
    if(held&&fighterInput.attackPressed){
      const definition=policy.definitions.get(held.definitionId);if(!definition)throw new Error(`missing item definition ${held.definitionId}`);
      if(definition.useMode==='swing'&&definition.combat){events.push(...applyItemContact({...held,x:fighter.x,y:fighter.y},definition.combat,fighter.id,fighter.facing,fighters,input,canAffect,false));}
      if(definition.useMode==='throw'&&definition.throwable){
        const facing=fixed.fromInt(fighter.facing);const dropped={...held,holderId:null,x:fighter.x,y:fighter.y,vx:fixed.mul(policy.throwSpeedX,facing),vy:policy.throwSpeedY};
        const consumed=consumeItemUse(dropped);items=items.filter((item)=>item.id!==held.id);if(consumed)items.push(consumed);
      }else{
        const consumed=consumeItemUse(held);items=items.filter((item)=>item.id!==held.id);if(consumed)items.push(consumed);
      }
      fighterInput={...fighterInput,attackPressed:false};
    }else if(!held&&fighterInput.grabPressed){
      const candidates=items.filter((item)=>item.holderId===null).map((item)=>({item,definition:policy.definitions.get(item.definitionId)})).filter((entry):entry is {item:ItemState;definition:ItemDefinition}=>entry.definition!==undefined)
        .filter(({item,definition})=>distanceSq(fighter.x,fighter.y,item.x,item.y)<=fixed.mul(definition.pickupRadius,definition.pickupRadius)).sort((a,b)=>a.item.id.localeCompare(b.item.id));
      const candidate=candidates[0]?.item;if(candidate){items=items.map((item)=>item.id===candidate.id?pickupItem(item,fighter.id):item);fighterInput={...fighterInput,grabPressed:false};}
    }
    byFighter[fighter.id]=fighterInput;
  }
  return{state:{...state,seed,fighters,items:items.sort((a,b)=>a.id.localeCompare(b.id)),nextItemSerial:serial},input:{frame:input.frame,byFighterId:byFighter},events};
}

export function withAuthoritativeItems(step: ItemAwareStep, policy: ItemRuntimePolicy): ItemAwareStep {
  return (state,input)=>{
    const prepared=stepAuthoritativeItems(state,input,policy);const result=step(prepared.state,prepared.input);const synced=syncHeldItems(prepared.state.items??[],result.state.fighters);
    return{...result,state:{...result.state,seed:prepared.state.seed,items:synced,nextItemSerial:prepared.state.nextItemSerial??1},events:[...prepared.events,...result.events]};
  };
}
