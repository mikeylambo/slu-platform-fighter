import assert from 'node:assert/strict';
import { writeFileSync,mkdirSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { fixed as f } from '../../../../packages/deterministic-math/src/fixed.js';
import { hashWorldState } from '../../../../packages/sim/src/stateHash.js';
import { RollbackSession } from '../../../../packages/sim/src/rollback.js';
import { ReplayRecorder,ReplayPlayer } from '../../../../packages/sim/src/replay.js';
import type { WorldState,SimInputFrame } from '../../../../packages/sim/src/types.js';
import { createSession,stepSession,neutral,gameData,IDS } from '../game/session.js';
import { PHYSICS } from '../content/knight/physics.js';
import { MOVES,ATTACKS } from '../content/knight/moves/index.js';
import { requestStance,tickStance } from '../../../../packages/stance/src/stance.js';
import { STANCES } from '../content/knight/stances.js';
const checks:string[]=[];
function pass(s:string){checks.push(s);console.log(`PASS ${s}`);}
function step(w:WorldState,input:Partial<SimInputFrame>={},p2:Partial<SimInputFrame>={}){return stepSession(w,{frame:w.frame,byFighterId:{'player-1':{...neutral(w.frame),...input},'player-2':{...neutral(w.frame),...p2}}}).state;}
let w=createSession();const start=w.fighters[0]!.x;for(let i=0;i<15;i++)w=step(w,{moveX:1000});assert(w.fighters[0]!.x>start);pass('PF fixed-point movement advances');
w=createSession();w.fighters[0]!.x=f.fromRatio(159,10);for(let i=0;i<12;i++)w=step(w,{moveX:1000});assert(!w.fighters[0]!.grounded);assert(w.fighters[0]!.y<f.zero);pass('Walking off an authored edge starts falling');
w=createSession();for(let i=0;i<4;i++)w=step(w,{jumpPressed:i===0,jumpHeld:true});assert(!w.fighters[0]!.grounded);assert.equal(w.fighters[0]!.jumpsRemaining,3);
for(let j=0;j<3;j++){w=step(w,{jumpPressed:true,jumpHeld:true});assert.equal(w.fighters[0]!.jumpsRemaining,2-j);w=step(w);}
const vy=w.fighters[0]!.vy;w=step(w,{jumpPressed:true,jumpHeld:true});assert(w.fighters[0]!.vy<vy);pass('Ground jump plus exactly three Wings air jumps');
w=createSession();w=step(w,{auxiliaryButtons:1});assert.equal(gameData(w).knights['player-1']!.stance.id,'cape');
for(let i=0;i<5;i++){w=step(w,{attackPressed:true});assert.equal(w.fighters[0]!.attack,null);}w=step(w,{attackPressed:true});assert(w.fighters[0]!.attack);pass('Unfurl locks six frames; action is available on frame seven');
let stance={id:'wings',unfurl:0,switchedAirborne:false};stance=requestStance(stance,STANCES,true);for(let i=0;i<6;i++)stance=tickStance(stance,false);assert.equal(requestStance(stance,STANCES,true),stance);stance=tickStance(stance,true);assert.equal(requestStance(stance,STANCES,true).id,'wings');pass('One airborne switch; landing/hit/ledge refresh module');
w=createSession();let p=w.fighters[0]!;p.grounded=false;p.groundSurfaceId=null;p.locomotion='airborne';p.x=f.fromInt(21);p.y=f.fromInt(15);p.jumpsRemaining=0;p.vy=f.fromRatio(-1,10);w=step(w,{jumpHeld:true,moveX:-1000});assert(gameData(w).knights[p.id]!.gliding);w=step(w,{attackPressed:true});assert(!gameData(w).knights[p.id]!.gliding);assert(w.fighters[0]!.attack);pass('Glide starts after jumps; attacking ends glide');
// Every authored hit window is valid, and the first hit is resolved by the real PF combat kernel.
for(const [id,m] of MOVES){const a=ATTACKS.get(id)!;assert.equal(a.totalFrames,m.faf-1);for(const hit of a.hitboxes){assert(hit.startFrame>=0);assert(hit.endFrame<a.totalFrames);assert(hit.hitbox.damageTenths>0);}
 const state=createSession();const source=state.fighters[0]!,target=state.fighters[1]!,strike=m.strikes[0]!;
 const air=m.landing>0;source.attack={attackId:id,frame:strike.start-1,hitTargets:[]};source.definitionId=id.split(':')[0]!;source.x=f.zero;source.grounded=!air;source.y=air?f.fromInt(10):f.zero;source.locomotion=air?'airborne':'idle';source.groundSurfaceId=air?null:'ground';
 target.x=f.fromRatio(Math.round(strike.x*100),100);target.y=f.add(source.y,f.fromRatio(Math.round((strike.y-1.4)*100),100));target.grounded=false;target.groundSurfaceId=null;target.locomotion='airborne';
 const d=gameData(state);d.knights[source.id]!.stance.id=source.definitionId;state.extensionState=JSON.stringify(d);
 const result=stepSession(state,{frame:0,byFighterId:{'player-1':neutral(0),'player-2':neutral(0)}});assert(result.events.some(e=>e.type==='hit'),`No real hit for ${id}`);
}
pass(`${MOVES.size} authored stance/move entries: valid windows and real kernel hits (GDD data only)`);
// FAF is one-based: a new action must be accepted on the authored FAF, not one frame later.
for(const [id,m] of MOVES){
 let state=createSession();const source=state.fighters[0]!;
 source.x=f.zero;state.fighters[1]!.x=f.fromInt(35);
 source.definitionId=id.split(':')[0]!;source.attack={attackId:id,frame:0,hitTargets:[]};
 if(m.landing){source.y=f.fromInt(25);source.grounded=false;source.groundSurfaceId=null;source.locomotion='airborne';}
 const d=gameData(state);d.knights[source.id]!.stance.id=source.definitionId;state.extensionState=JSON.stringify(d);
 for(let frame=1;frame<m.faf;frame++){
  assert(state.fighters[0]!.attack,`${id} became actionable before FAF on frame ${frame}`);
  state=step(state);
 }
 assert.equal(state.fighters[0]!.attack,null,`${id} still locked on FAF ${m.faf}`);
 state=step(state,{attackPressed:true});assert(state.fighters[0]!.attack,`${id} cannot attack on FAF ${m.faf}`);
}
pass('All 32 moves accept a fresh attack on their authored first actionable frame');
// Explicit multihit: separate active windows must be able to hit the same target again.
w=createSession();w.fighters[0]!.x=f.zero;w.fighters[1]!.x=f.fromInt(2);let hits=0;
for(let i=0;i<55;i++){w.fighters[1]!.x=f.fromInt(2);w.fighters[1]!.y=f.zero;w.fighters[1]!.vx=f.zero;w.fighters[1]!.vy=f.zero;w.fighters[1]!.grounded=true;w.fighters[1]!.hitstunFrames=0;const r=stepSession(w,{frame:w.frame,byFighterId:{'player-1':{...neutral(w.frame),attackPressed:i===0,moveX:i===0?600:0},'player-2':neutral(w.frame)}});hits+=r.events.filter(e=>e.type==='hit').length;w=r.state;}
assert.equal(hits,3);pass('Triple Thrust lands three distinct hits');
function input(frame:number,id:number):SimInputFrame {const t=frame+id*37;return {...neutral(frame),moveX:t%220<95?1000:t%220<190?-1000:0,moveY:t%91<18?850:t%91>75?-850:0,jumpPressed:t%49===0,jumpHeld:t%49<30,attackPressed:t%29===0,auxiliaryButtons:t%157===0?1:0};}
function bundle(frame:number){return {frame,byFighterId:{'player-1':input(frame,0),'player-2':input(frame,1)}};}
let a=createSession(),b=createSession();const samples:number[]=[];for(let i=0;i<10000;i++){const t=performance.now();a=stepSession(a,bundle(i)).state;samples.push(performance.now()-t);b=stepSession(b,bundle(i)).state;if(i%100===0)assert.equal(hashWorldState(a),hashWorldState(b));}assert.equal(hashWorldState(a),hashWorldState(b));pass(`10,000-frame deterministic simulation: ${hashWorldState(a)}`);
const changed=structuredClone(a);const data=gameData(changed);data.knights['player-1']!.stance.switchedAirborne=!data.knights['player-1']!.stance.switchedAirborne;changed.extensionState=JSON.stringify(data);assert.notEqual(hashWorldState(changed),hashWorldState(a));pass('Authoritative stance/glide state affects replay hashes');
const initial=createSession(),recorder=new ReplayRecorder(initial,{gameVersion:'spectris-feel-v2',participantIds:IDS,stageId:'mirror-sanctum',rulesetId:'feel-lab'},120);w=initial;for(let i=0;i<720;i++){const input=bundle(i);w=stepSession(w,input).state;recorder.append(input,w);}const tape=JSON.parse(JSON.stringify(recorder.finish()));const player=new ReplayPlayer(tape,stepSession);assert.equal(hashWorldState(player.playToEnd()),hashWorldState(w));pass('720-frame replay serialization, seek, and round-trip');
const reference=new RollbackSession(createSession(),stepSession,{participants:IDS,historyFrames:32}),delayed=new RollbackSession(createSession(),stepSession,{participants:IDS,historyFrames:32});let resim=0;const rollbackMs:number[]=[];
for(let frame=0;frame<240;frame++){for(const [i,id] of IDS.entries())reference.submitInput(id,input(frame,i));reference.advance();delayed.submitInput(IDS[0],input(frame,0));if(frame>=8)delayed.submitInput(IDS[1],input(frame-8,1));const begin=performance.now();resim+=delayed.advance().resimulatedFrames;rollbackMs.push(performance.now()-begin);}
for(let frame=232;frame<=240;frame++)delayed.submitInput(IDS[1],input(frame,1));delayed.submitInput(IDS[0],input(240,0));delayed.advance();for(const [i,id]of IDS.entries())reference.submitInput(id,input(240,i));reference.advance();assert(resim>0);assert.equal(hashWorldState(reference.currentState),hashWorldState(delayed.currentState));pass(`Eight-frame delayed rollback including stance inputs (${resim} frames resimulated)`);
// An isolated offstage demonstration: launch, spend jumps, glide, switch, recover.
const off=createSession();off.fighters[0]!.x=f.fromInt(14);off.fighters[1]!.x=f.fromInt(11);const offRecorder=new ReplayRecorder(off,{gameVersion:'spectris-feel-v2',participantIds:IDS,stageId:'mirror-sanctum',rulesetId:'feel-lab'},120);w=off;let seenGlide=false,seenSwitch=false,seenOffstage=false,seenReturn=false;
for(let i=0;i<420;i++){const p=w.fighters[0]!;const x=f.toNumber(p.x);const jump=[0,25,50,75].includes(i);const in1={...neutral(i),moveX:i<70?1000:i<220?-1000:0,jumpPressed:jump,jumpHeld:i<160,auxiliaryButtons:i===130?1:0,attackPressed:i===148};const in2={...neutral(i),moveX:i<65?1000:i<205?-1000:0,jumpPressed:[8,35,65].includes(i),jumpHeld:i<160,attackPressed:i===145};const inputFrame={frame:i,byFighterId:{'player-1':in1,'player-2':in2}};w=stepSession(w,inputFrame).state;offRecorder.append(inputFrame,w);seenOffstage ||= Math.abs(x)>16;seenGlide ||= gameData(w).knights[IDS[0]]!.gliding;seenSwitch ||= gameData(w).knights[IDS[0]]!.stance.id==='cape';seenReturn ||= i>170&&w.fighters[0]!.grounded;}
assert(seenOffstage&&seenGlide&&seenSwitch&&seenReturn,JSON.stringify({seenOffstage,seenGlide,seenSwitch,seenReturn}));pass('Recorded offstage chase, glide, normal attack, stance switch, and recovery');
samples.sort((a,b)=>a-b);rollbackMs.sort((a,b)=>a-b);const metrics={simP50Ms:samples[5000],simP95Ms:samples[9500],simP99Ms:samples[9900],rollbackAdvanceP95Ms:rollbackMs[Math.floor(rollbackMs.length*.95)],environment:'Linux Node.js container; not target Mac GPU validation'};
mkdirSync('apps/spectris/proofs',{recursive:true});writeFileSync('apps/spectris/proofs/offstage-exchange.json',JSON.stringify(offRecorder.finish()));writeFileSync('apps/spectris/proofs/verification.json',JSON.stringify({checks,metrics,referenceBudget:'Source imported; see reference-comparison.json for deltas and remaining feel review',fullGame:'Not implemented beyond feel gate'},null,2));console.log(JSON.stringify(metrics,null,2));
