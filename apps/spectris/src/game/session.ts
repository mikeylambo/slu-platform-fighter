import type { StockMatchRules } from '../../../../packages/sim/src/lifecycle.js';
import { fixed as f, type Fixed } from '../../../../packages/deterministic-math/src/fixed.js';
import { createTwoFighterMatch, stepMatchWorld, type MatchEvent, type MatchInputFrame } from '../../../../packages/sim/src/match.js';
import { resolveStandardMove } from '../../../../packages/sim/src/actionResolver.js';
import type { SimInputFrame, WorldState } from '../../../../packages/sim/src/types.js';
import { requestStance, tickStance, type StanceState } from '../../../../packages/stance/src/stance.js';
import { PHYSICS, MOVEMENT, PHYSICS_REGISTRY, worldValue } from '../content/knight/physics.js';
import { STANCES } from '../content/knight/stances.js';
import { ATTACKS, MOVES } from '../content/knight/moves/index.js';
import { SURFACES, LEDGES, SANCTUM, STOCK_RULES } from '../content/stages/sanctum.js';
export interface KnightState { stance: StanceState; glide: number; gliding: boolean; glideUsed: boolean; glideSpeed: Fixed; ledgeTouched: boolean; bufferedMove: string|null; bufferFrames: number; stanceBuffer: number; jabIndex: number; jabWindow: number; lastHitReset: number; }
export interface GameData { modifiers?:Record<string,{extraJumps:number;glideDuration:number;buffer:number}>; knights: Record<string,KnightState>; }
export const IDS = ['player-1','player-2'] as const;
export const neutral = (frame:number): SimInputFrame => ({frame,moveX:0,moveY:0,jumpPressed:false,jumpHeld:false,dodgePressed:false,shieldHeld:false});
function newKnight(): KnightState { return {stance:{id:'wings',unfurl:0,switchedAirborne:false},glide:0,gliding:false,glideUsed:false,glideSpeed:worldValue(PHYSICS.glide.initialSpeed),ledgeTouched:false,bufferedMove:null,bufferFrames:0,stanceBuffer:0,jabIndex:0,jabWindow:0,lastHitReset:-1}; }
export function gameData(world:WorldState):GameData { if(!world.extensionState) throw new Error('Spectris state is missing'); return JSON.parse(world.extensionState) as GameData; }
export function createSession(seed=0x53504543):WorldState {
 const w=createTwoFighterMatch(seed);
 w.fighters=w.fighters.map((p,i)=>({...p,id:IDS[i]!,definitionId:'wings',x:f.fromInt(SANCTUM.spawn[i]!),jumpsRemaining:3,stocks:4}));
 w.surfaces=structuredClone(SURFACES);w.ledges=structuredClone(LEDGES);delete w.match;
 w.extensionState=JSON.stringify({knights:Object.fromEntries(IDS.map(id=>[id,newKnight()]))});return w;
}
export function stepSession(original:WorldState,bundle:MatchInputFrame,stockRules?:StockMatchRules):{state:WorldState;events:MatchEvent[]} {
 // PF owns immutable histories and surfaces. Copy only the records this adapter edits.
 const w:WorldState={...original,fighters:original.fighters.map(p=>({...p,attack:p.attack?{...p.attack,hitTargets:[...p.attack.hitTargets]}:null}))};
 const data=gameData(w),inputs:Record<string,SimInputFrame>={};
 for(const p of w.fighters){
  const k=data.knights[p.id]!,modifier=data.modifiers?.[p.id],raw=bundle.byFighterId[p.id]??neutral(w.frame);
  const was=original.fighters.find(v=>v.id===p.id)!;
  let input:SimInputFrame={...raw,grabPressed:false,specialPressed:false,shieldHeld:false,dodgePressed:false};
  const airborne=!p.grounded&&p.locomotion!=='ledge-hang';
  const canAct=p.hitlagFrames===0&&p.hitstunFrames===0&&p.respawnFrames===0;
  k.stance=tickStance(k.stance,p.grounded||p.locomotion==='ledge-hang'||p.hitstunFrames>0);
  if(raw.auxiliaryButtons&&raw.auxiliaryButtons&1) k.stanceBuffer=(modifier?.buffer??PHYSICS.buffer);
  else k.stanceBuffer=Math.max(0,k.stanceBuffer-1);
  if(k.stanceBuffer>0&&canAct&&!p.attack&&p.landingLagFrames===0){
   const next=requestStance(k.stance,STANCES,airborne);
   if(next!==k.stance){k.stance=next;k.stanceBuffer=0;k.gliding=false;}
  }
  p.definitionId=k.stance.id;
  if(p.grounded&&canAct&&!p.attack){const aim=raw.smashX||raw.moveX;if(Math.abs(aim)>180)p.facing=aim>0?1:-1;}
  // Air attacks retain facing: resolve the request before PF movement updates facing.
  const requested=resolveStandardMove(p,{...raw,specialPressed:false,grabPressed:false});
  if(requested){k.bufferedMove=requested;k.bufferFrames=(modifier?.buffer??PHYSICS.buffer);}
  else if(k.bufferFrames>0)k.bufferFrames--;
  if(k.bufferFrames===0)k.bufferedMove=null;
  if(p.attack){
   const move=MOVES.get(p.attack.attackId)!;
   if(k.lastHitReset!==p.attack.frame&&move.strikes.some((s,i)=>i>0&&s.start-1===p.attack!.frame)){p.attack.hitTargets=[];k.lastHitReset=p.attack.frame;}
   const jabChain=p.attack.attackId.endsWith(':jab')||p.attack.attackId.endsWith(':jab-2')||p.attack.attackId.endsWith(':jab-3');
   if(jabChain&&p.attack.frame>=6&&raw.attackPressed){p.attack=null;k.jabIndex=(k.jabIndex+1)%4;k.bufferedMove=['jab','jab-2','jab-3','rapid-jab'][k.jabIndex]!;k.bufferFrames=5;}
  } else if(k.jabWindow--<=0) k.jabIndex=0;
  if(canAct&&k.stance.unfurl===0&&p.landingLagFrames===0&&!p.attack&&k.bufferedMove){
   const id=`${k.stance.id}:${k.bufferedMove}`;
   if(ATTACKS.has(id)){p.attack={attackId:id,frame:0,hitTargets:[]};k.jabWindow=24;k.lastHitReset=-1;k.gliding=false;k.bufferedMove=null;k.bufferFrames=0;}
  }
  input.attackPressed=false;input.smashX=0;input.smashY=0;
  if(k.stance.unfurl>0||p.landingLagFrames>0){input={...neutral(w.frame),auxiliaryButtons:raw.auxiliaryButtons??0};p.landingLagFrames=Math.max(0,p.landingLagFrames-1);}
  if(p.attack&&p.grounded){input.moveX=0;input.moveY=0;input.jumpPressed=false;input.jumpHeld=false;p.vx=f.zero;}
  if(p.attack&&!p.grounded){input.jumpPressed=false;input.jumpHeld=false;}
  if(p.grounded){k.glide=0;k.glideUsed=false;k.gliding=false;k.ledgeTouched=false;}
  if(p.locomotion==='ledge-hang'){k.glide=0;k.glideUsed=false;k.gliding=false;p.jumpsRemaining=(PHYSICS[k.stance.id as 'wings'|'cape'].jumps+(data.modifiers?.[p.id]?.extraJumps??0));}
  const canGlide=canAct&&!p.attack&&k.stance.unfurl===0&&k.stance.id==='wings'&&!p.grounded&&p.locomotion==='airborne'&&p.jumpsRemaining===0;
  if(canGlide&&raw.jumpHeld&&!k.glideUsed&&p.vy<=f.zero){k.gliding=true;k.glideUsed=true;}
  if(k.gliding&&(!raw.jumpHeld||!canGlide||k.glide>=(modifier?.glideDuration??PHYSICS.glide.duration)))k.gliding=false;
  if(k.gliding){
   const pitch=Math.max(-1000,Math.min(1000,raw.moveY));
   const acceleration=worldValue(PHYSICS.glide.acceleration);
   k.glideSpeed=Math.max(worldValue(PHYSICS.glide.minSpeed),Math.min(worldValue(PHYSICS.glide.maxSpeed),k.glideSpeed-Math.trunc(acceleration*pitch/1000))) as Fixed;
   if(Math.abs(raw.moveX)>180)p.facing=raw.moveX>0?1:-1;
   p.vx=(k.glideSpeed*p.facing) as Fixed;
   // PF applies gravity/air acceleration next; precompensate to preserve authored glide.
   p.vy=(Math.trunc(k.glideSpeed*pitch*PHYSICS.glide.lift/1000)-worldValue(PHYSICS.glide.sink)+worldValue(PHYSICS.gravity)) as Fixed;
   input.moveX=p.facing*1000;k.glide++;p.fastFalling=false;
  }
  if(!p.grounded&&p.jumpsRemaining>(PHYSICS[k.stance.id as 'wings'|'cape'].jumps+(data.modifiers?.[p.id]?.extraJumps??0)))p.jumpsRemaining=(PHYSICS[k.stance.id as 'wings'|'cape'].jumps+(data.modifiers?.[p.id]?.extraJumps??0));
  inputs[p.id]=input;
  // Zero ledge invulnerability on regrabs is applied after PF resolves the catch.
  if(was.hitstunFrames>0){k.gliding=false;k.stance.switchedAirborne=false;}
 }
 const result=stepMatchWorld(w,{frame:w.frame,byFighterId:inputs},ATTACKS,'wings:jab',MOVEMENT,new Map(),stockRules??STOCK_RULES,new Map(),new Map(),new Map(),PHYSICS_REGISTRY);
 for(const p of result.state.fighters){
  const before=w.fighters.find(v=>v.id===p.id)!,k=data.knights[p.id]!;
  if(before.grounded&&!p.grounded)p.jumpsRemaining=(PHYSICS[k.stance.id as 'wings'|'cape'].jumps+(data.modifiers?.[p.id]?.extraJumps??0));
  if(p.grounded&&!before.grounded){
   p.jumpsRemaining=(PHYSICS[k.stance.id as 'wings'|'cape'].jumps+(data.modifiers?.[p.id]?.extraJumps??0));
   p.landingLagFrames=k.gliding?PHYSICS.glide.landing:before.attack?(MOVES.get(before.attack.attackId)?.landing??0):0;
   p.attack=null;k.gliding=false;k.glideUsed=false;k.glide=0;k.stance.switchedAirborne=false;
  }
  if(p.locomotion==='ledge-hang'&&before.locomotion!=='ledge-hang'){
   if(k.ledgeTouched)p.invulnerableFrames=0;
   k.ledgeTouched=true;k.stance.switchedAirborne=false;
  }
  if(p.respawnFrames>0){data.knights[p.id]=newKnight();if(!stockRules)p.stocks=4;}
  if(p.hitstunFrames>0)k.gliding=false;
 }
 result.state.extensionState=JSON.stringify(data);
 return result;
}
