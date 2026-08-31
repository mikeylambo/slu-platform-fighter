import { fixed } from '../../deterministic-math/src/fixed.js';
import type { FighterPhysicsDefinition } from '../../content/src/compileFighterPhysics.js';
import { withWeightScaling, launchScalePermille, type WeightScalingPolicy } from '../../sim/src/weightScaling.js';
import { createTwoFighterMatch, type MatchInputFrame, type MatchStepResult } from '../../sim/src/match.js';
import type { WorldState } from '../../sim/src/types.js';
function assert(condition:unknown,message:string):asserts condition{if(!condition)throw new Error(`K41 weight certification failure: ${message}`)}
const policy:WeightScalingPolicy={enabled:true,baselineWeight:100,minLaunchPermille:700,maxLaunchPermille:1400,scaleHitstun:true};
assert(launchScalePermille(50,policy)===1400&&launchScalePermille(200,policy)===700,'weight curve must clamp authored light/heavy extremes');
const base={id:'',weight:100,hurtboxWidth:fixed.fromInt(1),hurtboxHeight:fixed.fromInt(2),walkSpeed:fixed.zero,initialDashSpeed:fixed.zero,runSpeed:fixed.zero,gravity:fixed.zero,fallSpeed:fixed.zero,fastFallSpeed:fixed.zero,shortHopVelocity:fixed.zero,fullHopVelocity:fixed.zero,doubleJumpVelocity:fixed.zero,airAcceleration:fixed.zero,airSpeed:fixed.zero,traction:fixed.zero,jumpSquatFrames:3} satisfies FighterPhysicsDefinition;
const physics=new Map<string,FighterPhysicsDefinition>([['light',{...base,id:'light',weight:80}],['heavy',{...base,id:'heavy',weight:125}]]);
let world=createTwoFighterMatch(41); world={...world,fighters:world.fighters.map((f,i)=>({...f,definitionId:i===0?'light':'heavy'}))};
const ordinary=(state:WorldState,_input:MatchInputFrame):MatchStepResult=>({state:{...state,frame:state.frame+1,fighters:state.fighters.map((f,i)=>i===1?{...f,vx:fixed.fromInt(10),vy:fixed.fromInt(5),hitstunFrames:20}:f)},events:[{type:'hit',attackerId:state.fighters[0]!.id,targetId:state.fighters[1]!.id,attackId:'light:jab',hitboxId:'jab',damageTenths:50,knockbackX:fixed.fromInt(10),knockbackY:fixed.fromInt(5),hitlagFrames:3,hitstunFrames:20}]});
const result=withWeightScaling(ordinary,physics,policy)(world,{frame:0,byFighterId:{}}); const target=result.state.fighters[1]!; const hit=result.events[0];
assert(target.vx===fixed.fromInt(8)&&target.vy===fixed.fromInt(4),'125-weight target must scale launch to 800 permille from baseline 100');
assert(target.hitstunFrames===16,'policy may scale hitstun by same weight factor');
assert(hit?.type==='hit'&&hit.knockbackX===target.vx&&hit.hitstunFrames===target.hitstunFrames,'semantic hit event must report the same post-weight launch state used by simulation');
console.log('K41 WEIGHT PASS — fighter-authored weight feeds a universal configurable launch/hitstun curve across semantic launch events without attack-specific formulas.');
