import { fixed } from '../../deterministic-math/src/fixed.js';
import { serializeWorldState, WORLD_BINARY_VERSION } from '../../sim/src/serialize.js';
import { withSmashCharge, type SmashChargePolicy } from '../../sim/src/smashCharge.js';
import { createTwoFighterMatch, type MatchInputFrame, type MatchStepResult } from '../../sim/src/match.js';
import type { WorldState } from '../../sim/src/types.js';
function assert(condition:unknown,message:string):asserts condition{if(!condition)throw new Error(`K44 smash-charge certification failure: ${message}`)}
const policy:SmashChargePolicy={attackId:'greybox:forward-smash',maxChargeFrames:4,damageBonusPermilleAtMax:500,launchBonusPermilleAtMax:1000};const policies=new Map([[policy.attackId,policy]]);
const inner=(state:WorldState,input:MatchInputFrame):MatchStepResult=>{
  let fighters=state.fighters.map((fighter)=>({...fighter}));const p1=fighters[0]!;const request=Math.abs(input.byFighterId[p1.id]?.smashX??0)>=500;
  if(request&&p1.attack===null)fighters[0]={...p1,attack:{attackId:'greybox:forward-smash',frame:1,hitTargets:['fighter-b']}};
  const active=fighters[0]!.attack?.attackId==='greybox:forward-smash'&&fighters[0]!.attack!.frame>=2;const events:MatchStepResult['events']=[];
  if(active){const target=fighters[1]!;fighters[1]={...target,percentTenths:target.percentTenths+100,vx:fixed.fromInt(4),vy:fixed.fromInt(2)};events.push({type:'hit',attackerId:fighters[0]!.id,targetId:target.id,attackId:'greybox:forward-smash',hitboxId:'smash',damageTenths:100,knockbackX:fixed.fromInt(4),knockbackY:fixed.fromInt(2),hitlagFrames:3,hitstunFrames:12});}
  fighters=fighters.map((fighter,index)=>index===0&&fighter.attack?{...fighter,attack:{...fighter.attack,frame:fighter.attack.frame+1}}:fighter);return{state:{...state,frame:state.frame+1,fighters},events};
};
const step=withSmashCharge(inner,policies);let world=createTwoFighterMatch(44);const smash=(frame:number,value:number):MatchInputFrame=>({frame,byFighterId:{'fighter-a':{frame,moveX:0,moveY:0,jumpPressed:false,jumpHeld:false,smashX:value,smashY:0,dodgePressed:false,shieldHeld:false}}});
world=step(world,smash(0,1000)).state;assert(world.fighters[0]!.smashCharge?.frames===1&&world.fighters[0]!.attack===null,'initial smash hold must enter authoritative charge instead of starting attack');
world=step(world,smash(1,1000)).state;assert(world.fighters[0]!.smashCharge?.frames===2,'held smash must accumulate deterministic charge frames');
const beforeRelease=world;let release=step(world,smash(2,0));world=release.state;assert(world.fighters[0]!.smashCharge===null&&world.fighters[0]!.attack?.chargeFrames===3,'release must start ordinary authored smash carrying accumulated charge');
release=step(world,smash(3,0));const hit=release.events.find((event)=>event.type==='hit');assert(hit?.type==='hit'&&hit.damageTenths===137,'three-of-four-frame charge must linearly apply authored damage bonus');assert(hit?.type==='hit'&&hit.knockbackX===fixed.fromInt(7),'three-of-four-frame charge must linearly apply authored launch bonus');
const bytesA=serializeWorldState(beforeRelease);const bytesB=serializeWorldState({...beforeRelease,fighters:beforeRelease.fighters.map((fighter,index)=>index===0?{...fighter,smashCharge:{...fighter.smashCharge!,frames:3}}:fighter)});assert(WORLD_BINARY_VERSION===16&&Buffer.from(bytesA).compare(Buffer.from(bytesB))!==0,'binary v16 must hash authoritative smash charge frames');
console.log('K44 SMASH CHARGE PASS — smash input enters serialized charge state, release/max starts the ordinary authored smash with retained charge, and policy scales hit damage/launch without fighter-specific combat code.');
