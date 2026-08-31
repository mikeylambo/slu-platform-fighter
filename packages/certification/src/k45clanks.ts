import { fixed } from '../../deterministic-math/src/fixed.js';
import { K2_DEFENSE, stepCombatFrame, type AttackDefinition, type CombatantState, type HitboxDefinition } from '../../sim/src/combat.js';

function assert(condition:unknown,message:string):asserts condition{if(!condition)throw new Error(`K45 clank certification failure: ${message}`);}
function body(id:string,facing:-1|1):CombatantState{return{id,x:fixed.zero,y:fixed.zero,vx:fixed.zero,vy:fixed.zero,facing,hurtboxRadius:fixed.fromInt(2),hurtboxOffsetY:fixed.zero,percentTenths:0,hitlagFrames:0,hitstunFrames:0,invulnerableFrames:0,attack:null,shielding:false,shieldHealth:K2_DEFENSE.shieldMaxHealth,shieldStunFrames:0,shieldRegenDelayFrames:0};}
function hitbox(id:string,canClank:boolean,priority:number,damageTenths=50):HitboxDefinition{return{id,offsetX:fixed.zero,offsetY:fixed.zero,radius:fixed.fromInt(2),damageTenths,baseKnockback:fixed.fromInt(2),growthPer100Percent:fixed.zero,directionX:1,directionY:1,hitlagFrames:3,hitstunFrames:8,canClank,clankPriority:priority};}
function attack(id:string,h:HitboxDefinition):AttackDefinition{return{id,totalFrames:10,hitboxes:[{startFrame:0,endFrame:2,hitbox:h}]};}
function armed(id:string,attackId:string,facing:-1|1):CombatantState{return{...body(id,facing),attack:{attackId,frame:0,hitTargets:[]}};}

const tradeAttacks=new Map<string,AttackDefinition>([['a:trade',attack('a:trade',hitbox('a-hit',false,0,40))],['b:trade',attack('b:trade',hitbox('b-hit',false,0,60))]]);
const trade=stepCombatFrame([armed('b','b:trade',-1),armed('a','a:trade',1)],tradeAttacks);
const tradeHits=trade.events.filter((event)=>event.type==='hit');
assert(tradeHits.length===2,'non-clanking simultaneous active attacks must both resolve regardless of stable iteration order');
assert(tradeHits.some((event)=>event.type==='hit'&&event.attackerId==='a'&&event.targetId==='b')&&tradeHits.some((event)=>event.type==='hit'&&event.attackerId==='b'&&event.targetId==='a'),'trade must preserve both attacker/target directions from the frame-start offense snapshot');
assert(trade.combatants.find((fighter)=>fighter.id==='a')?.percentTenths===60&&trade.combatants.find((fighter)=>fighter.id==='b')?.percentTenths===40,'true trade must apply both authored damages');

const equalAttacks=new Map<string,AttackDefinition>([['a:clank',attack('a:clank',hitbox('a-clank',true,2))],['b:clank',attack('b:clank',hitbox('b-clank',true,2))]]);
const equal=stepCombatFrame([armed('a','a:clank',1),armed('b','b:clank',-1)],equalAttacks);
const equalClank=equal.events.find((event)=>event.type==='clank');
assert(equalClank?.type==='clank'&&equalClank.winnerId===null,'equal authored priority must emit a mutual clank under the default policy');
assert(!equal.events.some((event)=>event.type==='hit'),'mutual clank must suppress both hurtbox hits for that frame');
assert(equal.combatants.every((fighter)=>fighter.attack===null),'mutual clank must cancel both attacks so the same active windows cannot re-clank after hitlag');

const priorityAttacks=new Map<string,AttackDefinition>([['a:strong',attack('a:strong',hitbox('strong',true,5,70))],['b:weak',attack('b:weak',hitbox('weak',true,1,30))]]);
const priority=stepCombatFrame([armed('a','a:strong',1),armed('b','b:weak',-1)],priorityAttacks);
const priorityClank=priority.events.find((event)=>event.type==='clank');
assert(priorityClank?.type==='clank'&&priorityClank.winnerId==='a','higher authored clank priority must win independent of fighter id ordering');
const priorityHits=priority.events.filter((event)=>event.type==='hit');
assert(priorityHits.length===1&&priorityHits[0]?.type==='hit'&&priorityHits[0].attackerId==='a'&&priorityHits[0].targetId==='b','priority winner must keep its frame-start offense while loser is suppressed');
assert(priority.combatants.find((fighter)=>fighter.id==='b')?.attack===null,'priority loser attack must be cancelled');

const equalTrade=stepCombatFrame([armed('a','a:clank',1),armed('b','b:clank',-1)],equalAttacks,K2_DEFENSE,()=>true,{enabled:true,equalPriorityOutcome:'trade',clankHitlagFrames:4});
assert(equalTrade.events.filter((event)=>event.type==='hit').length===2&&!equalTrade.events.some((event)=>event.type==='clank'),'ruleset may explicitly convert equal-priority clankable contact into a true trade');

console.log('K45 CLANKS PASS — frame-start offensive snapshots make simultaneous trades order-independent; authored canClank/priority resolves mutual and winner/loser clanks with ruleset-controlled equal-priority behavior.');
