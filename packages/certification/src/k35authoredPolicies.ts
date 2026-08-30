import { fixed } from '../../deterministic-math/src/fixed.js';
import { compileMoveRuntime } from '../../content/src/compileMoveRuntime.js';
import { withAuthoredCombatPolicies } from '../../sim/src/authoredCombatPolicies.js';
import { deriveMoveRuntime } from '../../sim/src/moveRuntime.js';
import { createTwoFighterMatch } from '../../sim/src/match.js';
import type { MatchInputFrame, MatchStepResult } from '../../sim/src/match.js';
import type { WorldState } from '../../sim/src/types.js';
function assert(condition:unknown,message:string):asserts condition{if(!condition)throw new Error(`K35 authored-policy certification failure: ${message}`)}
const move=compileMoveRuntime('greybox','policy-test',{totalFrames:20,timeline:[
 {frame:2,type:'cancel_on',data:{allowedActions:['jump','attack'],requireContact:false}},{frame:5,type:'cancel_off'},
 {frame:4,type:'armor_on',data:{launchThreshold:null,retainDamage:true}},{frame:8,type:'armor_off'},
 {frame:3,type:'hurtbox',data:{radius:900000,offsetY:1400000}},
]}); const defs=new Map([[move.id,move]]);
let world=createTwoFighterMatch(9); world={...world,fighters:world.fighters.map((f,i)=>i===0?{...f,attack:{attackId:move.id,frame:3,hitTargets:[]}}:f)};
const derived=deriveMoveRuntime(world.fighters[0]!,defs); assert(derived.hurtbox?.radius===900000,'hurtbox keyframe must derive from authored move frame');
let observedAttack=true;
const cancelProbe=(state:WorldState,input:MatchInputFrame):MatchStepResult=>{observedAttack=state.fighters[0]?.attack!==null;return{state:{...state,frame:state.frame+1},events:[]}};
const cancelAware=withAuthoredCombatPolicies(cancelProbe,defs); cancelAware(world,{frame:world.frame,byFighterId:{'fighter-a':{frame:world.frame,moveX:0,moveY:0,jumpPressed:true,jumpHeld:true,attackPressed:false,specialPressed:false,grabPressed:false,dodgePressed:false,shieldHeld:false},'fighter-b':{frame:world.frame,moveX:0,moveY:0,jumpPressed:false,jumpHeld:false,attackPressed:false,specialPressed:false,grabPressed:false,dodgePressed:false,shieldHeld:false}}}); assert(!observedAttack,'authored cancel must clear attack before wrapped movement/action step sees the frame');
world={...world,fighters:world.fighters.map((f,i)=>i===1?{...f,attack:{attackId:move.id,frame:4,hitTargets:[]},vx:fixed.zero,vy:fixed.zero}:f)};
const armorProbe=(state:WorldState):MatchStepResult=>({state:{...state,frame:state.frame+1,fighters:state.fighters.map((f)=>f.id==='fighter-b'?{...f,percentTenths:f.percentTenths+100,vx:fixed.fromInt(5),vy:fixed.fromInt(3),hitstunFrames:20,attack:null}:f)},events:[{type:'hit',attackerId:'fighter-a',targetId:'fighter-b',attackId:'test',hitboxId:'h',damageTenths:100,knockbackX:fixed.fromInt(5),knockbackY:fixed.fromInt(3),hitlagFrames:2,hitstunFrames:20}]});
const armorAware=withAuthoredCombatPolicies(armorProbe,defs); const armored=armorAware(world,{frame:world.frame,byFighterId:{}}).state.fighters.find((f)=>f.id==='fighter-b')!; assert(armored.percentTenths===100&&armored.vx===fixed.zero&&armored.vy===fixed.zero&&armored.hitstunFrames===0&&armored.attack?.frame===5,'active super armor must retain damage while preserving authored action and rejecting launch/stun');
console.log('K35 AUTHORED POLICIES PASS — cancel windows execute before action routing, armor filters launch/stun while respecting damage policy, and hurtbox keyframes derive deterministically from move timelines.');
