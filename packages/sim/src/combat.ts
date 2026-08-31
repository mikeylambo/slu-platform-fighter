import { fixed, type Fixed } from '../../deterministic-math/src/fixed.js';

export interface HitboxDefinition {
  id: string;
  offsetX: Fixed;
  offsetY: Fixed;
  radius: Fixed;
  damageTenths: number;
  baseKnockback: Fixed;
  growthPer100Percent: Fixed;
  directionX: number;
  directionY: number;
  hitlagFrames: number;
  hitstunFrames: number;
  canClank?: boolean;
  clankPriority?: number;
}
export interface HitboxWindow { startFrame: number; endFrame: number; hitbox: HitboxDefinition; }
export interface AttackDefinition { id: string; totalFrames: number; hitboxes: HitboxWindow[]; }
export interface CombatAttackState { attackId: string; frame: number; hitTargets: string[]; }
export interface CombatDefenseRules { shieldMaxHealth:number; shieldDamageBase:number; shieldStunBaseFrames:number; shieldRegenDelayFrames:number; shieldRegenPerFrame:number; shieldBreakStunFrames:number; }
export const K2_DEFENSE:CombatDefenseRules={shieldMaxHealth:600,shieldDamageBase:12,shieldStunBaseFrames:3,shieldRegenDelayFrames:45,shieldRegenPerFrame:2,shieldBreakStunFrames:90};
export interface CombatClankRules { enabled:boolean; equalPriorityOutcome:'clank'|'trade'; clankHitlagFrames:number; }
export const K2_CLANKS:CombatClankRules={enabled:true,equalPriorityOutcome:'clank',clankHitlagFrames:4};
export interface CombatantState {
  id:string;x:Fixed;y:Fixed;vx:Fixed;vy:Fixed;facing:-1|1;hurtboxRadius:Fixed;hurtboxOffsetY:Fixed;percentTenths:number;hitlagFrames:number;hitstunFrames:number;invulnerableFrames:number;attack:CombatAttackState|null;shielding:boolean;shieldHealth:number;shieldStunFrames:number;shieldRegenDelayFrames:number;
}
export interface HitEvent { type:'hit';attackerId:string;targetId:string;attackId:string;hitboxId:string;damageTenths:number;knockbackX:Fixed;knockbackY:Fixed;hitlagFrames:number;hitstunFrames:number; }
export interface BlockEvent { type:'block';attackerId:string;targetId:string;attackId:string;hitboxId:string;shieldDamage:number;shieldHealthAfter:number;shieldStunFrames:number;broken:boolean; }
export interface ClankEvent { type:'clank';fighterAId:string;fighterBId:string;attackAId:string;attackBId:string;hitboxAId:string;hitboxBId:string;winnerId:string|null; }
export type CombatEvent=HitEvent|BlockEvent|ClankEvent;
export interface CombatStepResult { combatants:CombatantState[];events:CombatEvent[]; }
export type CombatTargetPolicy=(attackerId:string,targetId:string)=>boolean;

export function beginAttack(combatant:CombatantState,attackId:string):CombatantState{if(combatant.hitlagFrames>0||combatant.hitstunFrames>0||combatant.shieldStunFrames>0||combatant.shielding)return combatant;return{...combatant,attack:{attackId,frame:0,hitTargets:[]}};}
function activeHitboxes(attack:AttackDefinition,frame:number):HitboxDefinition[]{return attack.hitboxes.filter((window)=>frame>=window.startFrame&&frame<=window.endFrame).map((window)=>window.hitbox).sort((a,b)=>a.id.localeCompare(b.id));}
function circlesOverlap(ax:Fixed,ay:Fixed,ar:Fixed,bx:Fixed,by:Fixed,br:Fixed):boolean{const dx=fixed.sub(ax,bx),dy=fixed.sub(ay,by),radius=fixed.add(ar,br);return fixed.add(fixed.mul(dx,dx),fixed.mul(dy,dy))<=fixed.mul(radius,radius);}
function normalizedDirection(hitbox:HitboxDefinition,facing:-1|1):{x:Fixed;y:Fixed}{const rawX=hitbox.directionX*facing,rawY=hitbox.directionY,magnitude=Math.max(Math.abs(rawX),Math.abs(rawY),1);return{x:fixed.fromRatio(rawX,magnitude),y:fixed.fromRatio(rawY,magnitude)};}
function knockbackMagnitude(hitbox:HitboxDefinition,targetPercentTenths:number):Fixed{const percentScale=fixed.fromRatio(targetPercentTenths,1000);return fixed.add(hitbox.baseKnockback,fixed.mul(hitbox.growthPer100Percent,percentScale));}
function appendHitTarget(attacker:CombatantState,targetId:string):CombatantState{if(!attacker.attack||attacker.attack.hitTargets.includes(targetId))return attacker;return{...attacker,attack:{...attacker.attack,hitTargets:[...attacker.attack.hitTargets,targetId].sort()}};}
function resolveOneHit(attacker:CombatantState,target:CombatantState,hitbox:HitboxDefinition,attackId:string):{attacker:CombatantState;target:CombatantState;event:HitEvent}{const postDamagePercent=target.percentTenths+hitbox.damageTenths,magnitude=knockbackMagnitude(hitbox,postDamagePercent),direction=normalizedDirection(hitbox,attacker.facing),knockbackX=fixed.mul(direction.x,magnitude),knockbackY=fixed.mul(direction.y,magnitude);return{attacker:{...appendHitTarget(attacker,target.id),hitlagFrames:Math.max(attacker.hitlagFrames,hitbox.hitlagFrames)},target:{...target,percentTenths:postDamagePercent,vx:knockbackX,vy:knockbackY,hitlagFrames:Math.max(target.hitlagFrames,hitbox.hitlagFrames),hitstunFrames:Math.max(target.hitstunFrames,hitbox.hitstunFrames),attack:null,shielding:false},event:{type:'hit',attackerId:attacker.id,targetId:target.id,attackId,hitboxId:hitbox.id,damageTenths:hitbox.damageTenths,knockbackX,knockbackY,hitlagFrames:hitbox.hitlagFrames,hitstunFrames:hitbox.hitstunFrames}};}
function resolveBlock(attacker:CombatantState,target:CombatantState,hitbox:HitboxDefinition,attackId:string,rules:CombatDefenseRules):{attacker:CombatantState;target:CombatantState;event:BlockEvent}{const shieldDamage=rules.shieldDamageBase+hitbox.damageTenths,shieldHealthAfter=Math.max(0,target.shieldHealth-shieldDamage),broken=shieldHealthAfter===0,shieldStunFrames=rules.shieldStunBaseFrames+hitbox.hitlagFrames+Math.trunc(hitbox.damageTenths/10);return{attacker:{...appendHitTarget(attacker,target.id),hitlagFrames:Math.max(attacker.hitlagFrames,hitbox.hitlagFrames)},target:{...target,shieldHealth:shieldHealthAfter,shielding:!broken,shieldStunFrames:broken?0:Math.max(target.shieldStunFrames,shieldStunFrames),shieldRegenDelayFrames:rules.shieldRegenDelayFrames,hitlagFrames:Math.max(target.hitlagFrames,hitbox.hitlagFrames),hitstunFrames:broken?Math.max(target.hitstunFrames,rules.shieldBreakStunFrames):target.hitstunFrames,attack:broken?null:target.attack},event:{type:'block',attackerId:attacker.id,targetId:target.id,attackId,hitboxId:hitbox.id,shieldDamage,shieldHealthAfter,shieldStunFrames,broken}};}

interface OffensiveSnapshot { fighterId:string;attack:CombatAttackState;attackId:string;hitbox:HitboxDefinition;x:Fixed;y:Fixed;facing:-1|1; }
function offenseKey(offense:OffensiveSnapshot):string{return `${offense.fighterId}\u0000${offense.attackId}\u0000${offense.hitbox.id}`;}
function buildOffenses(combatants:readonly CombatantState[],attacks:ReadonlyMap<string,AttackDefinition>):OffensiveSnapshot[]{const result:OffensiveSnapshot[]=[];for(const fighter of combatants){if(fighter.hitlagFrames>0||!fighter.attack)continue;const definition=attacks.get(fighter.attack.attackId);if(!definition)throw new Error(`missing attack definition ${fighter.attack.attackId}`);for(const hitbox of activeHitboxes(definition,fighter.attack.frame)){result.push({fighterId:fighter.id,attack:{...fighter.attack,hitTargets:[...fighter.attack.hitTargets]},attackId:definition.id,hitbox,x:fixed.add(fighter.x,fixed.mul(hitbox.offsetX,fixed.fromInt(fighter.facing))),y:fixed.add(fighter.y,hitbox.offsetY),facing:fighter.facing});}}return result.sort((a,b)=>a.fighterId.localeCompare(b.fighterId)||a.attackId.localeCompare(b.attackId)||a.hitbox.id.localeCompare(b.hitbox.id));}
function resolveClanks(offenses:readonly OffensiveSnapshot[],canTarget:CombatTargetPolicy,rules:CombatClankRules):{suppressed:Set<string>;events:ClankEvent[];clankFighters:Set<string>}{const suppressed=new Set<string>(),events:ClankEvent[]=[],clankFighters=new Set<string>();if(!rules.enabled)return{suppressed,events,clankFighters};for(let i=0;i<offenses.length;i+=1){const a=offenses[i]!;if(!(a.hitbox.canClank??false))continue;for(let j=i+1;j<offenses.length;j+=1){const b=offenses[j]!;if(a.fighterId===b.fighterId||!(b.hitbox.canClank??false)||!canTarget(a.fighterId,b.fighterId)||!canTarget(b.fighterId,a.fighterId))continue;if(!circlesOverlap(a.x,a.y,a.hitbox.radius,b.x,b.y,b.hitbox.radius))continue;const pa=a.hitbox.clankPriority??0,pb=b.hitbox.clankPriority??0;if(pa===pb&&rules.equalPriorityOutcome==='trade')continue;let winnerId:string|null=null;if(pa>pb){suppressed.add(offenseKey(b));winnerId=a.fighterId;}else if(pb>pa){suppressed.add(offenseKey(a));winnerId=b.fighterId;}else{suppressed.add(offenseKey(a));suppressed.add(offenseKey(b));}clankFighters.add(a.fighterId);clankFighters.add(b.fighterId);events.push({type:'clank',fighterAId:a.fighterId,fighterBId:b.fighterId,attackAId:a.attackId,attackBId:b.attackId,hitboxAId:a.hitbox.id,hitboxBId:b.hitbox.id,winnerId});}}return{suppressed,events,clankFighters};}

export function stepCombatFrame(combatantsInput:CombatantState[],attacks:ReadonlyMap<string,AttackDefinition>,defenseRules:CombatDefenseRules=K2_DEFENSE,canTarget:CombatTargetPolicy=()=>true,clankRules:CombatClankRules=K2_CLANKS):CombatStepResult{
  const combatants:CombatantState[]=[...combatantsInput].sort((a,b)=>a.id.localeCompare(b.id)).map((combatant)=>({...combatant,attack:combatant.attack?{...combatant.attack,hitTargets:[...combatant.attack.hitTargets]}:null}));
  const events:CombatEvent[]=[];const frameStartById=new Map(combatants.map((fighter)=>[fighter.id,{...fighter,attack:fighter.attack?{...fighter.attack,hitTargets:[...fighter.attack.hitTargets]}:null}] as const));const offenses=buildOffenses(combatants,attacks);const clanks=resolveClanks(offenses,canTarget,clankRules);events.push(...clanks.events);
  for(const fighterId of clanks.clankFighters){const index=combatants.findIndex((fighter)=>fighter.id===fighterId);if(index>=0){const fighter=combatants[index]!;combatants[index]={...fighter,hitlagFrames:Math.max(fighter.hitlagFrames,clankRules.clankHitlagFrames)};}}
  for(const offense of offenses){if(clanks.suppressed.has(offenseKey(offense)))continue;const attackerIndex=combatants.findIndex((fighter)=>fighter.id===offense.fighterId);if(attackerIndex<0)continue;const frameStart=frameStartById.get(offense.fighterId);if(!frameStart?.attack)continue;let attackerCurrent=combatants[attackerIndex]!;const hitTargets=new Set(frameStart.attack.hitTargets);
    for(let targetIndex=0;targetIndex<combatants.length;targetIndex+=1){if(targetIndex===attackerIndex)continue;const target=combatants[targetIndex];if(!target||!canTarget(offense.fighterId,target.id)||target.invulnerableFrames>0||hitTargets.has(target.id))continue;const hurtboxY=fixed.add(target.y,target.hurtboxOffsetY);if(!circlesOverlap(offense.x,offense.y,offense.hitbox.radius,target.x,hurtboxY,target.hurtboxRadius))continue;
      const offensiveAttacker:CombatantState={...attackerCurrent,attack:{...frameStart.attack,hitTargets:[...hitTargets]}};const resolved=target.shielding&&target.shieldHealth>0?resolveBlock(offensiveAttacker,target,offense.hitbox,offense.attackId,defenseRules):resolveOneHit(offensiveAttacker,target,offense.hitbox,offense.attackId);hitTargets.add(target.id);
      // If this fighter was already struck earlier this frame, preserve attack interruption while still allowing its frame-start offense to resolve.
      attackerCurrent={...resolved.attacker,attack:attackerCurrent.attack===null?null:resolved.attacker.attack};combatants[attackerIndex]=attackerCurrent;combatants[targetIndex]=resolved.target;events.push(resolved.event);
    }
  }
  for(let index=0;index<combatants.length;index+=1){const combatant=combatants[index];if(!combatant)continue;if(combatant.hitlagFrames>0){combatants[index]={...combatant,hitlagFrames:combatant.hitlagFrames-1};continue;}const nextHitstun=Math.max(0,combatant.hitstunFrames-1),nextShieldStun=Math.max(0,combatant.shieldStunFrames-1),nextRegenDelay=Math.max(0,combatant.shieldRegenDelayFrames-1),nextShieldHealth=!combatant.shielding&&nextRegenDelay===0?Math.min(defenseRules.shieldMaxHealth,combatant.shieldHealth+defenseRules.shieldRegenPerFrame):combatant.shieldHealth;let attackState=combatant.attack;if(attackState){const definition=attacks.get(attackState.attackId);if(!definition)throw new Error(`missing attack definition ${attackState.attackId}`);const nextFrame=attackState.frame+1;attackState=nextFrame>=definition.totalFrames?null:{...attackState,frame:nextFrame};}combatants[index]={...combatant,hitstunFrames:nextHitstun,shieldStunFrames:nextShieldStun,shieldRegenDelayFrames:nextRegenDelay,shieldHealth:nextShieldHealth,attack:attackState};}
  return{combatants,events};
}
