import {fixed as f,type Fixed} from '../../../../packages/deterministic-math/src/fixed.js';
import {stepStockLifecycle} from '../../../../packages/sim/src/lifecycle.js';
import {stepCombatFrame,type HitEvent} from '../../../../packages/sim/src/combat.js';
import type {MatchEvent,MatchInputFrame} from '../../../../packages/sim/src/match.js';
import type {WorldState,FighterState,SimInputFrame} from '../../../../packages/sim/src/types.js';
import {emptySoulfire,ignite,tickSoulfire,type SoulfireState} from '../../../../packages/soulfire/src/soulfire.js';
import {resolveClash,type ClashChoice} from '../../../../packages/clash/src/clash.js';
import {losesLife} from '../../../../packages/life-system/src/life.js';
import {createSession,stepSession,neutral,gameData,IDS,type GameData} from './session.js';
import {MOVES,ATTACKS} from '../content/knight/moves/index.js';
import {registerDuelMoves} from '../content/knight/moves/special.js';
import {DUEL as R,KINDLE,type Oath} from '../content/rules/duel.js';
import {STAGES,stageById,surfaces} from '../content/stages/roster.js';
import {STOCK_RULES} from '../content/stages/sanctum.js';
registerDuelMoves();
export interface DuelOptions {stage:string;format:'rounds'|'continuous'|'momentum'|'training';bestOf:number;lives:number;timer:number;cpu:[number,number];oaths:[Oath,Oath];buffer:number;counterpick?:boolean;stanceLock?:'free'|'wings'|'cape';}
export const DEFAULT_DUEL:DuelOptions={stage:'mirror-sanctum',format:'rounds',bestOf:3,lives:4,timer:21600,cpu:[0,5],oaths:['unsworn','unsworn'],buffer:5};
interface Ghost {x:Fixed;y:Fixed;facing:-1|1;move:string;age:number;real:boolean;hit:boolean;}
interface Blade {x:Fixed;y:Fixed;origin:Fixed;direction:-1|1;age:number;returning:boolean;wait:number;hit:boolean;returnHit:boolean;}
export interface DuelKnight {meter:number;integrity:number;guard:number;guardRelease:number;regen:number;stagger:number;evade:number;evadeKind:'spot'|'roll'|'air';evadeDirection:number;airDodge:boolean;helpless:boolean;sideUses:number;riftUses:number;soul:SoulfireState;charge:number;charging:boolean;blade:Blade|null;ghost:Ghost|null;feint:number;feintCommitted:boolean;lock:number;grab:number;holding:string|null;heldBy:string|null;hold:number;pummel:number;regrab:number;regrabs:number;shatterGrab:boolean;burn:number;aim:[number,number];emerge:boolean;flash:boolean;bonusJump:boolean;buffered:SimInputFrame|null;bufferFrames:number;lastMove:string;choice:ClashChoice;parries:number;clashes:number;fractures:number;ai:SimInputFrame;history:{x:number;y:number;attack:boolean}[];}
export interface DuelState {options:DuelOptions;knights:Record<string,DuelKnight>;round:number;wins:[number,number];clock:number;sudden:boolean;suddenFrames:number;phase:'fight'|'round-end'|'over';pause:number;winner:string|null;clash:number;doubleKindle:boolean;progress:number;events:{type:string;player:string;x:number;y:number}[];}
export const duelData=(w:WorldState):DuelState|undefined=>(JSON.parse(w.extensionState??'{}') as {duel?:DuelState}).duel;
const initialKnight=():DuelKnight=>({meter:0,integrity:10000,guard:0,guardRelease:0,regen:0,stagger:0,evade:0,evadeKind:'spot',evadeDirection:0,airDodge:false,helpless:false,sideUses:0,riftUses:0,soul:emptySoulfire(),charge:0,charging:false,blade:null,ghost:null,feint:0,feintCommitted:false,lock:0,grab:0,holding:null,heldBy:null,hold:0,pummel:0,regrab:0,regrabs:0,shatterGrab:false,burn:0,aim:[0,1],emerge:false,flash:false,bonusJump:false,buffered:null,bufferFrames:0,lastMove:'wings:jab',choice:'press',parries:0,clashes:0,fractures:0,ai:neutral(0),history:[]});
function save(w:WorldState,d:DuelState){w.extensionState=JSON.stringify({...gameData(w),duel:d});}
export function createDuel(options:Partial<DuelOptions>={},seed=0x53504543):WorldState{
 const opt={...DEFAULT_DUEL,...options};const w=createSession(seed),stage=stageById(opt.stage);w.surfaces=surfaces(stage);w.ledges=[{id:'left',x:f.fromRatio(-stage.width,10),y:f.zero,inward:1},{id:'right',x:f.fromRatio(stage.width,10),y:f.zero,inward:-1}];w.fighters.forEach(p=>p.stocks=opt.lives);
 save(w,{options:opt,knights:Object.fromEntries(IDS.map(id=>[id,initialKnight()])),round:1,wins:[0,0],clock:opt.timer,sudden:false,suddenFrames:0,phase:'fight',pause:0,winner:null,clash:0,doubleKindle:false,progress:0,events:[]});return w;
}
const emit=(d:DuelState,type:string,p:FighterState)=>d.events.push({type,player:p.id,x:f.toNumber(p.x),y:f.toNumber(p.y)});
const gain=(k:DuelKnight,n:number)=>{if(!k.soul.remaining)k.meter=Math.max(0,Math.min(R.meter.max,k.meter+n));};
const setAttack=(p:FighterState,key:string)=>{p.attack={attackId:`${p.definitionId}:${key}`,frame:0,hitTargets:[]};};
function aiInput(w:WorldState,d:DuelState,index:number):SimInputFrame{
 const p=w.fighters[index]!,t=w.fighters[1-index]!,k=d.knights[p.id]!,level=d.options.cpu[index]!;
 k.history.push({x:t.x,y:t.y,attack:!!t.attack});if(k.history.length>32)k.history.shift();
 const observed=k.history[Math.max(0,k.history.length-(32-level*3))]!,dx=f.toNumber((observed.x-p.x) as Fixed),dy=f.toNumber((observed.y-p.y) as Fixed),x=f.toNumber(p.x),y=f.toNumber(p.y),half=stageById(d.options.stage).width/10;
 if(w.frame%R.ai.decision===0){
 const personality=d.options.oaths[index]!;
 const n=(Math.imul(w.frame+index*71+w.seed,1664525)>>>0)%100;
 const off=Math.abs(x)>half-1,stance=gameData(w).knights[p.id]!.stance.id;
 const input={...neutral(w.frame),moveX:Math.abs(dx)>1.8?(dx>0?1000:-1000):0,moveY:dy>2?900:dy< -2?-900:0};
 if(off){input.moveX=x>0?-1000:1000;input.jumpPressed=p.jumpsRemaining>0&&y<(level>=7?1:5);input.jumpHeld=true;input.specialPressed=p.jumpsRemaining===0&&y<(level>=7?0:2);input.moveY=1000;if(stance==='cape'&&!gameData(w).knights[p.id]!.stance.switchedAirborne)input.auxiliaryButtons=1;}
 else if((p.grounded||p.jumpsRemaining>0)&&dy>3){input.jumpPressed=true;input.jumpHeld=true;}
 const ready=w.frame%(36-level*3)<4;
 if(!off&&ready){
  input.attackPressed=Math.abs(dx)<4.5&&Math.abs(dy)<3&&n<50+level*5;
  if(t.percentTenths>=1000&&p.grounded&&Math.abs(dx)<5&&(level>=5||n<level*6)){input.attackPressed=true;if(Math.abs(dx)<2.5)input.smashY=1000;else input.smashX=dx>0?1000:-1000;}
  if(Math.abs(dx)<2.4&&n<15+level){input.grabPressed=true;input.attackPressed=false;}
  if(n>70&&Math.abs(dx)>3){input.specialPressed=true;input.moveY=0;}
  if(observed.attack&&Math.abs(dx)<5&&level>=4&&n<level*9){input.shieldHeld=true;input.dodgePressed=true;if(stance==='wings'&&n<30)input.auxiliaryButtons=1;}
  if(k.meter===R.meter.max){input.specialPressed=true;input.shieldHeld=true;}
  if(k.holding){input.moveX=dx>0?1000:-1000;input.moveY=t.percentTenths<500?1000:0;input.attackPressed=n<35;}
  // Personality changes utility weights, never the opponent's hidden future input.
  if(personality==='hunger'&&Math.abs(dx)<2.4){input.grabPressed=true;input.attackPressed=false;}
  if(personality==='stillness'&&observed.attack&&Math.abs(dx)<5){input.shieldHeld=true;input.dodgePressed=true;input.attackPressed=false;if(stance==='wings')input.auxiliaryButtons=1;}
  if(personality==='iron'&&Math.abs(dx)<4&&n>45){input.specialPressed=true;input.moveY=-1000;if(stance==='wings')input.auxiliaryButtons=1;}
  if(personality==='static'&&k.meter>=2500&&n>60){input.specialPressed=true;input.attackPressed=true;input.auxiliaryButtons=6;}
  if(personality==='ember'&&Math.abs(dx)>2&&n>50){input.specialPressed=true;input.moveX=dx>0?1000:-1000;}
  if(personality==='gale'&&!t.grounded&&dy>0&&p.jumpsRemaining>0){input.jumpPressed=true;input.jumpHeld=true;}
  if(personality==='unsworn'&&level===9&&k.history.filter(v=>v.attack).length>10&&Math.abs(dx)<4&&n<25){input.shieldHeld=true;input.dodgePressed=true;if(stance==='wings')input.auxiliaryButtons=1;}
  if(!off&&level>=6&&Math.abs(dx)<4&&Math.abs(dy)<3){input.attackPressed=true;if(Math.abs(dx)<2.5){input.moveY=1000;input.grabPressed=false;input.shieldHeld=false;input.dodgePressed=false;}if(!p.attack)input.moveX=dx>=0?400:-400;if(t.percentTenths>=1000){input.shieldHeld=false;input.dodgePressed=false;if(Math.abs(dx)<2.5)input.smashY=1000;else input.smashX=dx>0?1000:-1000;input.attackPressed=true;input.grabPressed=false;}}
 }
 if(p.hitstunFrames>0&&level>=6){input.moveX=x>0?-1000:1000;input.moveY=1000;input.dodgePressed=y<3;}
 k.ai=input;
 }
 return {...k.ai,frame:w.frame,attackPressed:!!k.ai.attackPressed&&w.frame%4===0,specialPressed:!!k.ai.specialPressed&&w.frame%4===0,grabPressed:!!k.ai.grabPressed&&w.frame%4===0,jumpPressed:k.ai.jumpPressed&&w.frame%4===0,dodgePressed:k.ai.dodgePressed&&w.frame%4===0,auxiliaryButtons:w.frame%4===0?(k.ai.auxiliaryButtons??0):0};
}
function directHit(w:WorldState,source:FighterState,target:FighterState,damage:number,direction:[number,number],base=45,growth=75):HitEvent|null{
 const id='spectris-direct';const result=stepCombatFrame([{...source,attack:{attackId:id,frame:0,hitTargets:[]},hitlagFrames:0,hurtboxRadius:f.one,hurtboxOffsetY:f.one},{...target,attack:null,shielding:false,hurtboxRadius:f.one,hurtboxOffsetY:f.one}],new Map([[id,{id,totalFrames:2,hitboxes:[{startFrame:0,endFrame:0,hitbox:{id,offsetX:f.mul(f.sub(target.x,source.x),f.fromInt(source.facing)),offsetY:f.sub(f.add(target.y,f.one),source.y),radius:f.one,damageTenths:damage,baseKnockback:f.fromRatio(base,125),growthPer100Percent:f.fromRatio(growth,100),directionX:direction[0],directionY:direction[1],hitlagFrames:6,hitstunFrames:15}}]}]]));
 const hit=result.events.find((e):e is HitEvent=>e.type==='hit');if(!hit)return null;
 const resolved=result.combatants.find(p=>p.id===target.id)!;target.percentTenths=resolved.percentTenths;target.vx=resolved.vx;target.vy=resolved.vy;target.hitlagFrames=resolved.hitlagFrames;target.hitstunFrames=resolved.hitstunFrames;target.attack=null;target.lastHitById=source.id;target.lastHitFrame=w.frame;return hit;
}
export function stepDuel(original:WorldState,bundle:MatchInputFrame):{state:WorldState;events:MatchEvent[]}{
 let w=structuredClone(original);const d=duelData(w);if(!d)return stepSession(w,bundle);
 d.events=[];if(d.phase==='over'){w.frame++;save(w,d);return {state:w,events:[]};}
 if(d.phase==='round-end'){
  if(d.options.counterpick&&d.winner){const loser=d.winner===IDS[0]?1:0;const command=bundle.byFighterId[IDS[loser]!]?.auxiliaryButtons??0;if(d.options.cpu[loser])d.options.stage=STAGES[(d.round+loser)%7]!.id;else if(command&16){const stage=STAGES[(command>>5)&15];if(stage&&STAGES.indexOf(stage)<7){d.options.stage=stage.id;d.pause=1;}}else d.pause=Math.max(2,d.pause);}
  if(--d.pause<=0){const next=createDuel(d.options,(w.seed^w.frame)>>>0);next.frame=w.frame+1;const nd=duelData(next)!;nd.wins=d.wins;nd.round=d.round+1;nd.progress=d.progress;if(d.winner===null&&d.sudden){nd.sudden=true;nd.clock=0;for(const p of next.fighters){p.stocks=1;p.percentTenths=1000;}}for(const id of IDS){nd.knights[id]!.parries=d.knights[id]!.parries;nd.knights[id]!.clashes=d.knights[id]!.clashes;nd.knights[id]!.fractures=d.knights[id]!.fractures;}save(next,nd);return {state:next,events:[]};}
  w.frame++;save(w,d);return {state:w,events:[]};
 }
 if(d.options.format==='training'&&d.options.stanceLock&&d.options.stanceLock!=='free'){const gd=gameData(w);for(const p of w.fighters){p.definitionId=d.options.stanceLock;gd.knights[p.id]!.stance.id=d.options.stanceLock;gd.knights[p.id]!.stance.unfurl=0;}w.extensionState=JSON.stringify({...gd,duel:d});}
 const inputs:Record<string,SimInputFrame>={};for(const [i,p]of w.fighters.entries())inputs[p.id]=d.options.cpu[i]?aiInput(w,d,i):{...(bundle.byFighterId[p.id]??neutral(w.frame))};
 if(d.options.format==='training'&&d.options.stanceLock&&d.options.stanceLock!=='free')for(const input of Object.values(inputs))input.auxiliaryButtons=(input.auxiliaryButtons??0)&~1;
 if(d.clash>0){
  for(const [i,p] of w.fighters.entries()){const raw=inputs[p.id]!,k=d.knights[p.id]!;if(d.options.cpu[i]){k.choice=(['press','parry','slip'] as const)[((w.frame>>2)+w.seed+i*7)%3]!;continue;}if(raw.moveY< -400)k.choice='slip';else if(raw.moveX*p.facing< -400)k.choice='parry';else if(raw.moveX*p.facing>400)k.choice='press';}
  if(--d.clash===0){const win=resolveClash(d.knights[IDS[0]]!.choice,d.knights[IDS[1]]!.choice);for(const [i,p]of w.fighters.entries()){const k=d.knights[p.id]!;p.attack=null;p.hitlagFrames=0;p.vx=f.fromRatio(i?1:-1,5);if(win!==null){gain(k,win===i?R.meter.win:R.meter.lose);if(win===i)k.clashes++;else{k.stagger=R.clash.advantage;k.integrity=Math.max(0,k.integrity-R.clash.chip);if(d.doubleKindle)k.soul=emptySoulfire();}}if(win===null&&d.doubleKindle)k.soul=emptySoulfire();emit(d,'clash-resolve',p);}d.doubleKindle=false;}
  w.frame++;save(w,d);return {state:w,events:[]};
 }
 const stage=stageById(d.options.stage);w.surfaces=surfaces(stage,w.frame);
 if(d.options.format!=='training'&&d.options.timer>0&&!d.sudden&&--d.clock<=0){d.sudden=true;d.suddenFrames=0;for(const p of w.fighters){p.stocks=1;p.percentTenths=1000;emit(d,'sudden-death',p);}}
 if(d.sudden)d.suddenFrames++;
 const shrink=d.sudden?Math.max(.01,1-Math.floor(d.suddenFrames/60)/100):1;
 const rules={...STOCK_RULES,finiteStocks:d.options.format!=='training',blastLeft:f.fromRatio(-Math.round(stage.blast[0]*shrink*100),500),blastRight:f.fromRatio(Math.round(stage.blast[1]*shrink*100),500),blastTop:f.fromRatio(Math.round(stage.blast[2]*shrink*100),500),blastBottom:f.fromRatio(-Math.round(stage.blast[3]*shrink*100),500)};
 const guards=new Map<string,{active:boolean;parry:boolean;facing:number}>();
 const immediate:MatchEvent[]=[];
 const shatterTargets=new Set<string>();
 for(const [i,p]of w.fighters.entries()){
  const k=d.knights[p.id]!,t=w.fighters[1-i]!,tk=d.knights[t.id]!,sample=inputs[p.id]!,oath=d.options.oaths[i]!,g=gameData(w).knights[p.id]!,heldSpecial=!!((sample.auxiliaryButtons??0)&4)||!!sample.specialPressed;
  if(sample.specialPressed||sample.grabPressed||sample.dodgePressed){k.buffered={...sample};k.bufferFrames=d.options.buffer;}else if(k.bufferFrames>0)k.bufferFrames--;if(k.bufferFrames===0)k.buffered=null;const raw=k.buffered?{...k.buffered,frame:w.frame,jumpHeld:sample.jumpHeld,shieldHeld:sample.shieldHeld,auxiliaryButtons:sample.auxiliaryButtons??0}:sample;
  k.soul=tickSoulfire(k.soul);if(k.regen>0)k.regen--;else if(!k.guard&&!k.stagger)k.integrity=Math.min(10000,k.integrity+R.guard.regen);
  if(k.regrab>0)k.regrab--;else k.regrabs=0;
  if(p.grounded||p.locomotion==='ledge-hang'){k.airDodge=false;k.helpless=false;k.sideUses=0;k.riftUses=0;}
  if(k.burn>0&&--k.burn===0)p.percentTenths=Math.min(9990,p.percentTenths+40);
  if(p.hitstunFrames>0){k.helpless=false;k.charging=false;k.grab=0;k.guard=0;}
  if(p.definitionId!=='cape')k.guard=0;k.flash=false;
  const free=!k.helpless&&p.landingLagFrames===0&&g.stance.unfurl===0&&p.respawnFrames===0&&!p.eliminated&&p.hitstunFrames===0&&p.hitlagFrames===0&&k.stagger===0&&k.lock===0;
  if(k.soul.activating){p.invulnerableFrames=Math.max(p.invulnerableFrames,2);k.lock=Math.max(k.lock,1);}
  if(k.guardRelease>0)k.guardRelease--;
  if(k.pummel>0)k.pummel--;
  if(k.stagger>0){k.stagger--;p.attack=null;inputs[p.id]=neutral(w.frame);p.vx=f.zero;if(k.stagger===0&&k.integrity===0)k.integrity=5000;}
  if(k.lock>0){k.lock--;inputs[p.id]=neutral(w.frame);}
  if(k.helpless){inputs[p.id]={...neutral(w.frame),moveX:raw.moveX};p.jumpsRemaining=0;}
  if(k.evade>0){const elapsed=(k.evadeKind==='spot'?22:k.evadeKind==='roll'?28:30)-k.evade+1;const from=k.evadeKind==='roll'?3:2,to=k.evadeKind==='spot'?15:k.evadeKind==='roll'?16:19;if(elapsed>=from&&elapsed<=to)p.invulnerableFrames=Math.max(2,p.invulnerableFrames);if(k.evadeKind!=='spot')p.x=f.add(p.x,f.fromRatio(k.evadeDirection*2,5));inputs[p.id]=neutral(w.frame);k.evade--;if(!k.evade&&k.evadeKind==='air'&&p.y<0)k.helpless=true;}
  if(k.holding){
   p.grabFrames=0;
   const victim=w.fighters.find(v=>v.id===k.holding)!,vk=d.knights[victim.id]!,vr=inputs[victim.id]!;
   victim.x=f.add(p.x,f.fromRatio(p.facing*13,10));victim.y=p.y;victim.vx=f.zero;victim.vy=f.zero;victim.invulnerableFrames=2;inputs[victim.id]=neutral(w.frame);inputs[p.id]=neutral(w.frame);
   k.hold-=1+(vr.attackPressed||vr.jumpPressed||vr.specialPressed||vr.grabPressed?R.grab.escape*(g.stance.unfurl?2:1):0);
   if((raw.auxiliaryButtons??0)&1){g.stance.id=g.stance.id==='wings'?'cape':'wings';g.stance.unfurl=6;const data=gameData(w);data.knights[p.id]=g;w.extensionState=JSON.stringify({...data,duel:d});p.definitionId=g.stance.id;}
   if(raw.attackPressed&&k.pummel===0){victim.percentTenths+=30;const amount=Math.min(vk.meter,oath==='hunger'?800:400);vk.meter-=amount;gain(k,amount);k.pummel=R.grab.pummel;emit(d,'pummel',p);}
   else if((Math.abs(raw.moveX)>400||Math.abs(raw.moveY)>400)&&!g.stance.unfurl){
    const up=raw.moveY>400,down=raw.moveY< -400,back=raw.moveX*p.facing<0;
    if(p.definitionId==='cape'&&!up&&!down){const direction=back?-p.facing:p.facing;p.x=f.add(p.x,f.fromInt(direction*4));victim.x=f.add(p.x,f.fromRatio(direction*13,10));}
    victim.invulnerableFrames=0;const before=victim.percentTenths;const hit=directHit(w,p,victim,p.definitionId==='cape'?(up?50:down?60:0):(up?60:down?70:back?100:80),[back?-10:10,up?15:down?-5:7],up?(p.definitionId==='cape'?30:70):down?60:back?50:45,up?40:down?30:back?85:75);if(hit){immediate.push(hit);victim.vx=f.add(victim.vx,f.fromRatio(vr.moveX,10000));victim.vy=f.add(victim.vy,f.fromRatio(vr.moveY,10000));}if(k.shatterGrab&&before>=R.threshold)shatterTargets.add(victim.id);
    if(p.definitionId==='cape'&&!up&&!down)victim.hitstunFrames=10;
    if(down&&p.definitionId==='cape')victim.locomotion='knockdown';k.hold=0;emit(d,'throw',p);
   }
   if(k.hold<=0){vk.heldBy=null;k.holding=null;victim.grabbedById=null;p.grabTargetId=null;victim.locomotion=victim.grounded?'idle':'airborne';k.lock=0;victim.invulnerableFrames=0;if(!p.grounded)victim.hitstunFrames=10;}
  }
  if(k.heldBy){inputs[p.id]=neutral(w.frame);p.grabbedById=k.heldBy;continue;}
  if(k.grab>0&&--k.grab===0&&Math.abs(f.toNumber(f.sub(t.x,p.x)))<R.grab.reach&&Math.abs(f.toNumber(f.sub(t.y,p.y)))<2.5&&t.invulnerableFrames===0&&!tk.heldBy){
   k.holding=t.id;tk.heldBy=p.id;k.hold=Math.max(12,Math.round((R.grab.hold-t.percentTenths*.04)*(.7**tk.regrabs)));tk.regrabs++;tk.regrab=R.grab.regrab;k.shatterGrab=tk.integrity<=4000;p.grabTargetId=t.id;t.grabbedById=p.id;p.grabFrames=0;t.grabFrames=0;p.attack=null;t.attack=null;emit(d,'grab',p);
   if(!p.grounded){p.x=f.add(p.x,f.fromInt(p.facing*4));t.x=p.x;k.hold=10;t.hitstunFrames=0;}
  }
  if(free&&!p.attack&&!k.holding&&!k.heldBy&&!k.evade){k.buffered=null;k.bufferFrames=0;
   if(raw.specialPressed&&raw.shieldHeld){if(k.soul.remaining){k.soul=emptySoulfire();setAttack(p,'kindle-finisher');}else{const buff=ignite(KINDLE,k.meter);if(buff){k.soul=buff.state;k.meter=buff.meter;if(oath==='gale'){p.jumpsRemaining++;k.bonusJump=true;}k.lock=KINDLE.activation;emit(d,'kindle',p);}}inputs[p.id]=neutral(w.frame);}
   else if(raw.specialPressed&&raw.attackPressed&&(k.meter>=R.meter.feint||k.soul.remaining)){
    if(!k.soul.remaining)k.meter-=R.meter.feint;k.feint=1;k.feintCommitted=false;k.ghost={x:p.x,y:p.y,facing:p.facing,move:k.lastMove,age:0,real:false,hit:false};k.lock=R.feint.tap;inputs[p.id]=neutral(w.frame);emit(d,'feint',p);
   }else if(raw.grabPressed&&(p.grounded||p.definitionId==='wings'&&p.jumpsRemaining>0)){
    k.grab=p.grounded?(p.locomotion==='dash'?R.grab.dash:R.grab.startup):R.grab.air;k.lock=k.grab+10;if(!p.grounded)p.jumpsRemaining--;inputs[p.id]=neutral(w.frame);
   }else if(raw.dodgePressed&&p.definitionId==='wings'&&(p.grounded||!k.airDodge)){
    k.evadeKind=!p.grounded?'air':Math.abs(raw.moveX)>400?'roll':'spot';k.evade=k.evadeKind==='spot'?22:k.evadeKind==='roll'?28:30;k.evadeDirection=raw.moveX>0?1:raw.moveX<0?-1:0;k.ghost={x:p.x,y:p.y,facing:p.facing,move:k.lastMove,age:0,real:false,hit:false};if(!p.grounded){k.airDodge=true;p.vy=f.fromRatio(raw.moveY,2000);}inputs[p.id]=neutral(w.frame);emit(d,'evade',p);
   }else if(raw.shieldHeld&&p.definitionId==='cape'){
    if(raw.jumpPressed||raw.grabPressed){k.guard=0;}else{k.guard++;inputs[p.id]=neutral(w.frame);p.vx=f.zero;}
   }else if(k.guard){k.guard=0;k.guardRelease=R.guard.release;inputs[p.id]=neutral(w.frame);}
   else if(raw.specialPressed){
    k.aim=[Math.sign(raw.moveX),Math.sign(raw.moveY)||(!raw.moveX?1:0)];k.emerge=false;
    const up=raw.moveY>450,down=raw.moveY< -450,side=Math.abs(raw.moveX)>450&&!up&&!down;
    if(p.definitionId==='wings'){
     if(up){setAttack(p,'ascend');p.grounded=false;p.groundSurfaceId=null;p.vy=f.fromRatio(7,10);if(oath==='stillness')p.invulnerableFrames=4;}
     else if(down){setAttack(p,'stoop');p.vy=f.fromRatio(-4,5);if(oath==='static')k.ghost={x:p.x,y:p.y,facing:p.facing,move:k.lastMove,age:0,real:false,hit:false};}
     else if(side&&k.sideUses<(oath==='ember'?2:1)){setAttack(p,'gale');k.sideUses++;}
     else if(!side){if(k.blade){k.blade.returning=true;k.blade.wait=0;}else setAttack(p,'sling');}
    }else{
     if(up&&k.riftUses<(oath==='gale'?2:1)){setAttack(p,'rift');k.riftUses++;}
     else if(down){if(oath==='stillness'){k.guard=1;k.lock=20;emit(d,'riposte',p);}else setAttack(p,p.grounded?(oath==='iron'?'anchor-wide':'anchor'):'anchor-air');}
     else if(side)setAttack(p,'veil');else{k.charging=true;k.charge=0;}
    }
    inputs[p.id]={...neutral(w.frame),moveX:raw.moveX};
   }else if(g.gliding&&raw.attackPressed){setAttack(p,'glide-attack');inputs[p.id]!.attackPressed=false;}
   else if(k.blade&&raw.attackPressed){setAttack(p,'punch');inputs[p.id]!.attackPressed=false;}
   if(((raw.auxiliaryButtons??0)&1)&&raw.shieldHeld&&(k.meter>=R.meter.flash||k.soul.freeFlash)){if(k.soul.freeFlash)k.soul.freeFlash=false;else k.meter-=R.meter.flash;k.flash=true;inputs[p.id]={...neutral(w.frame),auxiliaryButtons:1};k.guard=0;g.stance.unfurl=0;const gd=gameData(w);gd.knights[p.id]=g;w.extensionState=JSON.stringify({...gd,duel:d});}
  }
  if(k.guardRelease>0&&!raw.jumpPressed&&!raw.grabPressed)inputs[p.id]=neutral(w.frame);
  if(oath==='stillness'&&k.lock>0&&k.guard>0)k.guard=1;else if(oath==='stillness'&&k.lock===0&&!raw.shieldHeld)k.guard=0;
  guards.set(p.id,{active:k.guard>0||oath==='stillness'&&p.attack?.attackId.endsWith(':ascend')===true&&p.attack.frame<4,parry:k.guard>0&&k.guard<=(oath==='stillness'&&k.soul.remaining?8:R.guard.parry)||oath==='stillness'&&p.attack?.attackId.endsWith(':ascend')===true&&p.attack.frame<4,facing:p.facing});
  if(k.charging){inputs[p.id]=neutral(w.frame);k.charge=Math.min(R.special.charge,k.charge+(oath==='ember'?2:1));if(!heldSpecial||k.charge===R.special.charge){setAttack(p,k.charge===R.special.charge?'cleave-full':`cleave-${Math.floor(k.charge/5)}`);k.charging=false;}}
  if(k.feint){k.feint++;if(heldSpecial&&((raw.auxiliaryButtons??0)&2)&&k.feint>=4&&!k.feintCommitted){k.feintCommitted=true;k.lock=R.feint.hold-k.feint;if(k.ghost)k.ghost.real=true;}if(k.feint>=R.feint.hold)k.feint=0;}
  if(p.attack){const key=p.attack.attackId.split(':')[1]!,frame=p.attack.frame;k.lastMove=p.attack.attackId;
   if(key==='sling'&&frame===11&&!k.blade)k.blade={x:p.x,y:f.add(p.y,f.fromRatio(14,10)),origin:p.x,direction:p.facing,age:0,returning:false,wait:0,hit:false,returnHit:false};
   if(key==='gale'&&frame>=7&&frame<18&&p.hitlagFrames===0)p.x=f.add(p.x,f.fromRatio(p.facing*7,10));
   if(key==='veil'&&frame>=5&&frame<=17){p.invulnerableFrames=2;p.x=f.add(p.x,f.fromRatio(p.facing,4));if(oath==='static'&&frame===17)k.ghost={x:p.x,y:p.y,facing:p.facing,move:'cape:veil-cut',age:0,real:true,hit:false};}
   if(key==='rift'&&frame===7){const [dx,dy]=k.aim;p.x=f.add(p.x,f.fromRatio(dx*(dx&&dy?35:50),10));p.y=f.add(p.y,f.fromRatio(dy*(dx&&dy?35:50),10));p.grounded=false;p.groundSurfaceId=null;p.invulnerableFrames=5;}
   if((key==='veil'||key==='rift')&&raw.attackPressed)k.emerge=true;
   if((key==='veil'&&frame===18||key==='rift'&&frame===12)&&k.emerge)setAttack(p,`${key}-cut`);
   if(key==='stoop'&&frame>=11&&raw.jumpHeld){p.attack=null;p.jumpsRemaining=0;p.vy=f.fromRatio(-1,10);}
   if(key==='anchor-air'){p.vy=f.fromRatio(-1,1);if(p.grounded){setAttack(p,oath==='iron'?'anchor-wide':'anchor');p.landingLagFrames=0;}}
   if(key==='anchor'&&frame<9||key==='cleave-full'||oath==='iron'&&(key==='sling'||k.soul.remaining&&key.endsWith('smash')))p.hitstunFrames=0;
  }
 }
 if(w.fighters.every(p=>d.knights[p.id]!.soul.remaining>0)&&!d.doubleKindle){d.clash=R.clash.window;d.doubleKindle=true;for(const p of w.fighters)d.knights[p.id]!.choice='press';}
 const gd=gameData(w);gd.modifiers=Object.fromEntries(w.fighters.map((p,i)=>[p.id,{extraJumps:d.options.oaths[i]==='gale'&&d.knights[p.id]!.soul.remaining?1:0,glideDuration:d.options.oaths[i]==='gale'&&d.knights[p.id]!.soul.remaining?180:120,buffer:d.options.buffer??5}]));for(const p of w.fighters){const k=d.knights[p.id]!;if(k.lock||k.stagger||k.evade||k.guard||k.heldBy){gd.knights[p.id]!.bufferedMove=null;gd.knights[p.id]!.bufferFrames=0;}}w.extensionState=JSON.stringify({...gd,duel:d});
 save(w,d);const before=structuredClone(w);const result=stepSession(w,{frame:w.frame,byFighterId:inputs},rules);w=result.state;const events=[...immediate,...result.events];
 const fracture=(p:FighterState)=>{if(p.respawnFrames||p.eliminated)return;p.x=f.add(rules.blastRight,f.one);const life=stepStockLifecycle([p],null,rules);Object.assign(p,life.fighters[0]);events.push(...life.events);emit(d,'shatter',p);};
 for(const [i,p]of w.fighters.entries()){
  const k=d.knights[p.id]!,t=w.fighters[1-i]!,old=before.fighters[i]!,oath=d.options.oaths[i]!;
  if(k.flash){const gd=gameData(w);gd.knights[p.id]!.stance.unfurl=0;w.extensionState=JSON.stringify(gd);}
  if(old.attack?.attackId.endsWith(':anchor-air')&&p.grounded&&!old.grounded){setAttack(p,oath==='iron'?'anchor-wide':'anchor');p.landingLagFrames=0;}
  if(old.attack&&!p.attack&&(old.attack.attackId.endsWith(':ascend')&&oath!=='gale'||(old.attack.attackId.endsWith(':rift')||old.attack.attackId.endsWith(':rift-cut')))&&!p.grounded&&p.hitstunFrames===0)k.helpless=true;
  if(k.blade){const b=k.blade;b.age++;if(b.returning){b.x=f.add(b.x,f.fromRatio(b.x>p.x?-5:5,10));b.y=f.add(b.y,f.fromRatio(Math.sign(p.y+f.one-b.y),10));if(Math.abs(b.x-p.x)<f.one){k.blade=null;emit(d,'recall',p);}}
   else if(b.wait>0){if(--b.wait===0)b.returning=true;}
   else{b.x=f.add(b.x,f.fromRatio(b.direction*7,40));if(b.age>=40||Math.abs(b.x-b.origin)>=f.fromInt(7))b.wait=30;}
   if(k.blade&&Math.abs(b.x-t.x)<f.fromRatio(13,10)&&Math.abs(b.y-t.y-f.one)<f.fromRatio(15,10)&&!(b.returning?b.returnHit:b.hit)){
    const hit=directHit(w,p,t,b.returning?70:110,[10,5]);if(hit){events.push(hit);if(b.returning)b.returnHit=true;else{b.hit=true;b.wait=30;}if(oath==='hunger'){const amount=Math.min(1000,d.knights[t.id]!.meter);d.knights[t.id]!.meter-=amount;gain(k,amount);}emit(d,'blade-hit',t);}
   }
  }
  if(k.ghost){const ghost=k.ghost;ghost.age++;if(ghost.real&&!ghost.hit&&ghost.age>=5&&Math.abs(ghost.x-t.x)<f.fromInt(4)&&Math.abs(ghost.y-t.y)<f.fromInt(3)){const damage=Math.round((MOVES.get(ghost.move)?.strikes[0]?.strain??6)*5);const hit=directHit(w,{...p,x:ghost.x,y:ghost.y,facing:ghost.facing},t,damage,[10,4]);if(hit){events.push(hit);ghost.hit=true;}}if(ghost.age>=20)k.ghost=null;}

 }
 const closeClash=events.find(e=>e.type==='clank'&&Math.abs((MOVES.get(e.attackAId)?.strikes[0]?.strain??0)-(MOVES.get(e.attackBId)?.strikes[0]?.strain??0))<=2);
 if(closeClash)for(const [i,p]of w.fighters.entries()){const old=before.fighters[i]!;p.percentTenths=old.percentTenths;p.hitstunFrames=old.hitstunFrames;p.vx=old.vx;p.vy=old.vy;}
 for(const e of events){if(e.type==='hit'){if(closeClash)continue;
  const p=w.fighters.find(p=>p.id===e.targetId)!,a=w.fighters.find(p=>p.id===e.attackerId)!,old=before.fighters.find(v=>v.id===p.id)!,k=d.knights[p.id]!,ak=d.knights[a.id]!,guard=guards.get(p.id),front=(a.x-old.x)*(guard?.facing??old.facing)>=0;
  if(guard?.active&&front){p.percentTenths=old.percentTenths;p.vx=old.vx;p.vy=old.vy;p.hitstunFrames=0;p.hitlagFrames=0;if(guard.parry){if(d.options.oaths[IDS.indexOf(p.id as typeof IDS[number])]==='stillness'&&k.lock>0){k.lock=0;k.guard=0;setAttack(p,'riposte');}a.hitstunFrames=Math.max(a.hitstunFrames,12);a.attack=null;gain(k,R.meter.parry);k.parries++;emit(d,'parry',p);}else{const chip=e.damageTenths*10*(k.blade?2:1)*(ak.soul.remaining?2:1)*(e.attackId.includes(':anchor')?2:1);k.integrity=Math.max(0,k.integrity-chip);p.percentTenths+=Math.round(e.damageTenths*.15);k.regen=R.guard.regenDelay;emit(d,'block',p);if(!k.integrity){k.stagger=R.guard.breakFrames;k.guard=0;emit(d,'guard-break',p);}}continue;}
  const ownOath=d.options.oaths[IDS.indexOf(p.id as typeof IDS[number])]!,ownMove=old.attack?.attackId.split(':')[1];
  const armor=(ownMove?.startsWith('anchor')&&old.attack!.frame<9)||(ownMove==='cleave-full'&&e.damageTenths<=120)||(ownOath==='iron'&&(ownMove==='sling'||k.soul.remaining>0&&!!ownMove?.endsWith('smash')&&e.damageTenths<=150));
  if(armor){p.hitstunFrames=0;p.vx=old.vx;p.vy=old.vy;p.attack=old.attack;}
  gain(ak,e.damageTenths*R.meter.hit);gain(k,e.damageTenths*R.meter.taken);p.percentTenths=Math.min(9990,p.percentTenths);
  const oath=d.options.oaths[IDS.indexOf(a.id as typeof IDS[number])]!;if(ak.soul.remaining&&oath==='ember')k.burn=60;if(ak.soul.remaining&&oath==='hunger')k.meter=Math.max(0,k.meter-500);
  if(e.attackId.endsWith(':rift-cut'))ak.helpless=false;
  if(losesLife(old.percentTenths,!!MOVES.get(e.attackId)?.shatter&&(e.attackId!=='cape:forward-air'||e.hitboxId.endsWith(':0')),false,{lives:d.options.lives,threshold:R.threshold}))shatterTargets.add(p.id);
 }else if(e.type==='clank'){
  const a=MOVES.get(e.attackAId),b=MOVES.get(e.attackBId);if(a&&b&&Math.abs((a.strikes[0]?.strain??0)-(b.strikes[0]?.strain??0))<=2){d.clash=R.clash.window;for(const p of w.fighters){d.knights[p.id]!.choice='press';emit(d,'clash',p);}}
 }}
 for(const p of w.fighters)if(shatterTargets.has(p.id))fracture(p);
 for(const e of events)if(e.type==='ko'){const p=w.fighters.find(p=>p.id===e.fighterId)!,k=d.knights[p.id]!;k.fractures++;const fresh=initialKnight();d.knights[p.id]={...fresh,meter:k.meter,parries:k.parries,clashes:k.clashes,fractures:k.fractures};emit(d,'fracture',p);if(d.options.format==='momentum'){d.progress+=p.id===IDS[1]?1:-1;if(Math.abs(d.progress)>=R.momentum.screens){d.phase='over';d.winner=d.progress>0?IDS[0]:IDS[1];}else{p.eliminated=false;p.stocks=d.options.lives;w.winnerId=null;const direction=p.id===IDS[1]?1:-1;for(const fighter of w.fighters){fighter.x=f.fromInt((fighter.id===p.id?1:-1)*direction*7);fighter.y=f.fromInt(4);fighter.grounded=false;fighter.groundSurfaceId=null;fighter.vx=f.zero;fighter.vy=f.zero;fighter.attack=null;}emit(d,'pilgrimage',p);}}}
 if(d.options.format!=='training'&&d.options.format!=='momentum'&&w.fighters.some(p=>p.eliminated)){
  const alive=w.fighters.filter(p=>!p.eliminated);const winner=alive[0]?.id??null;
  if(winner){const i=IDS.indexOf(winner as typeof IDS[number]);d.wins[i]=(d.wins[i]??0)+1;d.winner=winner;}
  d.phase=winner&&(d.options.format==='continuous'||d.wins.some(n=>n>Math.floor(d.options.bestOf/2)))?'over':'round-end';d.pause=R.roundPause;emit(d,d.phase==='over'?'match-win':'round-win',alive[0]??w.fighters[0]!);
 }
 save(w,d);return {state:w,events};
}
