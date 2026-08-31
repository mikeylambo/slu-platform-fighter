import { fixed } from '../../deterministic-math/src/fixed.js';
import type { ParryPolicy } from '../../sim/src/combatPolicies.js';
import { withParry, perfectShieldActive } from '../../sim/src/parry.js';
import { createTwoFighterMatch, type MatchInputFrame, type MatchStepResult } from '../../sim/src/match.js';
import type { WorldState } from '../../sim/src/types.js';
function assert(condition:unknown,message:string):asserts condition{if(!condition)throw new Error(`K40 parry certification failure: ${message}`)}
const policy:ParryPolicy={enabled:true,perfectWindowFrames:3,attackerFreezeFrames:8,defenderAdvantageFrames:4,shieldHealthCost:5};
let world=createTwoFighterMatch(40); world={...world,fighters:world.fighters.map((fighter,index)=>index===1?{...fighter,shieldHealth:500,inputHistory:[]}:fighter)};
const defender=world.fighters[1]!; assert(perfectShieldActive(defender,true,policy),'fresh shield press must be inside authored perfect window');
const ordinary=(state:WorldState,_input:MatchInputFrame):MatchStepResult=>({state:{...state,frame:state.frame+1,fighters:state.fighters.map((fighter,index)=>index===0?{...fighter,hitlagFrames:2}:index===1?{...fighter,shieldHealth:450,shieldStunFrames:7,shielding:true}:fighter)},events:[{type:'block',attackerId:state.fighters[0]!.id,targetId:state.fighters[1]!.id,attackId:'cert:jab',hitboxId:'jab',shieldDamage:50,shieldHealthAfter:450,shieldStunFrames:7,broken:false}]});
const step=withParry(ordinary,policy); const input={frame:0,byFighterId:{[defender.id]:{frame:0,moveX:0,moveY:0,jumpPressed:false,jumpHeld:false,dodgePressed:false,shieldHeld:true}}}; const result=step(world,input); const attackerAfter=result.state.fighters[0]!; const defenderAfter=result.state.fighters[1]!;
assert(defenderAfter.shieldHealth===495,'parry must replace ordinary block shield damage with authored parry cost');
assert(defenderAfter.shieldStunFrames===3,'parry must reduce defender shieldstun by authored advantage');
assert(attackerAfter.hitlagFrames===8,'parry must enforce authored attacker freeze');
world={...world,fighters:world.fighters.map((fighter,index)=>index===1?{...fighter,inputHistory:[0,1,2].map((frame)=>({frame,moveX:0,moveY:0,jumpPressed:false,jumpHeld:false,dodgePressed:false,shieldHeld:true}))}:fighter)}; const oldShield=world.fighters[1]!; assert(!perfectShieldActive(oldShield,true,policy),'shield held beyond authored window must not parry');
const normal=step(world,{frame:0,byFighterId:{[oldShield.id]:{frame:0,moveX:0,moveY:0,jumpPressed:false,jumpHeld:false,dodgePressed:false,shieldHeld:true}}}); assert(normal.state.fighters[1]!.shieldHealth===450,'expired perfect window must preserve ordinary block result');
console.log('K40 PARRY PASS — perfect-shield timing derives from existing input history, applies authored attacker freeze/defender advantage/cost, and requires no extra rollback state.');
