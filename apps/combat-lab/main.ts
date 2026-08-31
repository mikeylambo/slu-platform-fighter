import * as THREE from 'three';
import { fixed } from '../../packages/deterministic-math/src/fixed.js';
import { compileFighterGrabActions } from '../../packages/content/src/compileGrabActions.js';
import { compileFighterAttacks } from '../../packages/content/src/compileMoves.js';
import { ALL_FIGHTER_PACKS } from '../../packages/content/src/generated/fighterRegistry.js';
import { SemanticInputSampler, type InputProfile, type SemanticAxis, type SemanticButton } from '../../packages/input/src/profile.js';
import { createTwoFighterMatch, stepMatchWorld, type MatchEvent } from '../../packages/sim/src/match.js';
import { K1_MOVEMENT } from '../../packages/sim/src/movement.js';
import type { ReplayFrame } from '../../packages/sim/src/replay.js';
import type { AttackDefinition } from '../../packages/sim/src/combat.js';
import type { FighterState, SimInputFrame, WorldState } from '../../packages/sim/src/types.js';
import { LabInputProfileEditor, LabReplaySession } from '../../packages/training/src/labTools.js';

const SIM_HZ = 60;
const STEP_MS = 1000 / SIM_HZ;
const MAX_STEPS = 8;
const SEED = 0x43_4f_4d_42;

const greybox = ALL_FIGHTER_PACKS.find((pack) => pack.id === 'greybox');
if (!greybox) throw new Error('Combat Lab requires generated greybox pack');
const attacks = compileFighterAttacks(greybox);
const grabActions = compileFighterGrabActions(greybox);
const JAB_ID = 'greybox:jab';
if (!attacks.has(JAB_ID)) throw new Error('Combat Lab requires greybox:jab');

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setSize(innerWidth, innerHeight); renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x090b10); scene.fog = new THREE.Fog(0x090b10, 25, 75);
const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.1, 150); camera.position.set(0, 6.5, 20); camera.lookAt(0, 2.5, 0);
scene.add(new THREE.HemisphereLight(0xffffff, 0x273149, 2.2));
const sun = new THREE.DirectionalLight(0xffffff, 2.8); sun.position.set(-8, 14, 10); sun.castShadow = true; scene.add(sun);
const floor = new THREE.Mesh(new THREE.BoxGeometry(34, 0.5, 6), new THREE.MeshStandardMaterial({ color: 0x293141, roughness: 0.8 })); floor.position.y = -0.25; floor.receiveShadow = true; scene.add(floor);
const centerPlatform = new THREE.Mesh(new THREE.BoxGeometry(8, 0.28, 4), new THREE.MeshStandardMaterial({ color: 0x566780, roughness: 0.7 })); centerPlatform.position.y = 3.86; centerPlatform.receiveShadow = true; scene.add(centerPlatform);
const grid = new THREE.GridHelper(34, 34, 0x31405c, 0x1e2533); grid.rotation.x = Math.PI / 2; grid.position.z = -3.01; scene.add(grid);

interface FighterVisual { root: THREE.Group; body: THREE.Mesh; hurtbox: THREE.Mesh; hitboxes: THREE.Group; shield: THREE.Mesh; }
function createFighterVisual(bodyColor: number, accentColor: number): FighterVisual {
  const root = new THREE.Group(); scene.add(root);
  const bodyMaterial = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.45, metalness: 0.12 });
  const accentMaterial = new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.38, metalness: 0.2 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.95, 2.5, 0.7), bodyMaterial); body.position.y = 1.3; body.castShadow = true; root.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), accentMaterial); head.position.y = 2.9; head.castShadow = true; root.add(head);
  const hurtbox = new THREE.Mesh(new THREE.SphereGeometry(0.75, 20, 14), new THREE.MeshBasicMaterial({ color: 0xff7f9c, wireframe: true, transparent: true, opacity: 0.55 })); hurtbox.position.y = 1.5; root.add(hurtbox);
  const shield = new THREE.Mesh(new THREE.SphereGeometry(1.45, 24, 16), new THREE.MeshBasicMaterial({ color: accentColor, wireframe: true, transparent: true, opacity: 0.75 })); shield.position.y = 1.5; shield.visible = false; root.add(shield);
  const hitboxes = new THREE.Group(); root.add(hitboxes);
  return { root, body, hurtbox, hitboxes, shield };
}
const visuals = new Map<string, FighterVisual>([['fighter-a', createFighterVisual(0xe8edf7, 0x77a6ff)], ['fighter-b', createFighterVisual(0x40495a, 0xffb65c)]]);

function required<T extends Element>(selector: string): T { const node=document.querySelector<T>(selector); if(!node)throw new Error(`Combat Lab UI missing ${selector}`); return node; }
const hud=required<HTMLDivElement>('#hud'); const eventsHud=required<HTMLDivElement>('#events');
const replayStatus=required<HTMLDivElement>('#replay-status'); const inputStatus=required<HTMLDivElement>('#input-status');
const buttonBindings=required<HTMLDivElement>('#button-bindings'); const axisBindings=required<HTMLDivElement>('#axis-bindings'); const seek=required<HTMLInputElement>('#seek');

const DEFAULT_PROFILE: InputProfile = {
  id: 'combat-lab-default',
  buttons: { jump:['Space','Pad0'], attack:['KeyF','Pad2'], special:['KeyQ','Pad4'], grab:['KeyE','Pad3'], dodge:['KeyK','Pad1'], shield:['KeyL','Pad5'] },
  axes: {
    moveX:{physicalAxis:'move-x',deadzone:0.12}, moveY:{physicalAxis:'move-y',deadzone:0.12},
    smashX:{physicalAxis:'smash-x',deadzone:0.2}, smashY:{physicalAxis:'smash-y',deadzone:0.2},
  },
};
let profileEditor=new LabInputProfileEditor(DEFAULT_PROFILE); let inputSampler=new SemanticInputSampler(profileEditor.profile); let sampleSequence=0;
const keys=new Set<string>();
let world=createTwoFighterMatch(SEED); let previous=structuredClone(world); let accumulator=0; let lastTime=performance.now();
let paused=false; let stepRequested=false; let lastEvent:MatchEvent|null=null; let flashFrames=0; let dummyShield=false; let dummyAttackLatch=false; let dummyGrabLatch=false;
const simStep=(state:WorldState,input:ReplayFrame)=>stepMatchWorld(state,input,attacks,JAB_ID,K1_MOVEMENT,grabActions);
const replay=new LabReplaySession<MatchEvent>(world,{gameVersion:'combat-lab',participantIds:['fighter-a','fighter-b'],stageId:'greybox',rulesetId:'lab-default'},simStep,60);

function resetInputSampler(){inputSampler=new SemanticInputSampler(profileEditor.profile);sampleSequence=0;}
function reset(){world=createTwoFighterMatch(SEED);previous=structuredClone(world);accumulator=0;lastEvent=null;flashFrames=0;dummyAttackLatch=false;dummyGrabLatch=false;eventsHud.textContent='NO MATCH EVENTS YET';replay.returnToLive(world);resetInputSampler();paused=false;syncReplayUi();}

addEventListener('keydown',(event)=>{
  const target=event.target as HTMLElement|null; if(target?.matches('input,select'))return;
  if(!event.repeat&&event.code==='KeyH')dummyShield=!dummyShield;
  if(!event.repeat&&event.code==='KeyG')dummyAttackLatch=true;
  if(!event.repeat&&event.code==='KeyT')dummyGrabLatch=true;
  if(!event.repeat&&event.code==='KeyR')reset();
  if(!event.repeat&&event.code==='KeyP')paused=!paused;
  if(!event.repeat&&event.code==='Period')stepRequested=true;
  keys.add(event.code);
});
addEventListener('keyup',(event)=>keys.delete(event.code));

function keyboardAxis(neg:string,pos:string):number{return (keys.has(pos)?1:0)-(keys.has(neg)?1:0);}
function playerInput(frame:number):SimInputFrame{
  const pad=navigator.getGamepads?.()[0]??null; const buttons:Record<string,boolean>={}; for(const code of keys)buttons[code]=true;
  if(pad)for(let index=0;index<pad.buttons.length;index+=1)buttons[`Pad${index}`]=Boolean(pad.buttons[index]?.pressed);
  const keyboardX=keyboardAxis('KeyA','KeyD'); const keyboardY=keyboardAxis('KeyS','KeyW');
  const padX=pad?.axes[0]??0; const padY=-(pad?.axes[1]??0); const moveX=keyboardX!==0?keyboardX:padX; const moveY=keyboardY!==0?keyboardY:padY;
  inputSampler.sample({sequence:sampleSequence++,buttons,axes:{'move-x':moveX,'move-y':moveY,'smash-x':pad?.axes[2]??0,'smash-y':-(pad?.axes[3]??0)}});
  return inputSampler.emitFrame(frame);
}
function dummyInput(frame:number):SimInputFrame{const input:SimInputFrame={frame,moveX:0,moveY:0,jumpPressed:false,jumpHeld:false,attackPressed:dummyAttackLatch,grabPressed:dummyGrabLatch,dodgePressed:false,shieldHeld:dummyShield};dummyAttackLatch=false;dummyGrabLatch=false;return input;}

function liveStep(){
  const bundle:ReplayFrame={frame:world.frame,byFighterId:{'fighter-a':playerInput(world.frame),'fighter-b':dummyInput(world.frame)}}; const result=simStep(world,bundle);
  if(replay.mode==='recording')replay.appendRecordedFrame(bundle,result.state);
  world=result.state; if(result.events.length>0){lastEvent=result.events[result.events.length-1]??null;flashFrames=8;} if(flashFrames>0)flashFrames-=1;
}
function step(){
  previous=world;
  if(replay.mode==='playback'&&replay.replayTape){const before=world.frame;world=replay.stepForward();lastEvent=null;flashFrames=0;if(world.frame===before||world.frame>=replay.snapshot().endFrame)paused=true;}
  else liveStep();
  syncReplayUi();
}

function drawHitboxes(fighter:FighterState,visual:FighterVisual){visual.hitboxes.clear();if(!fighter.attack)return;const attack:AttackDefinition|undefined=attacks.get(fighter.attack.attackId);if(!attack)return;const attackFrame=fighter.attack.frame;for(const window of attack.hitboxes.filter((entry)=>attackFrame>=entry.startFrame&&attackFrame<=entry.endFrame)){const hitbox=window.hitbox;const mesh=new THREE.Mesh(new THREE.SphereGeometry(fixed.toNumber(hitbox.radius),20,14),new THREE.MeshBasicMaterial({color:0xff4d67,wireframe:true}));mesh.position.set(fixed.toNumber(hitbox.offsetX),fixed.toNumber(hitbox.offsetY),0);visual.hitboxes.add(mesh);}}
function interpolateFighter(id:string,alpha:number){const current=world.fighters.find((entry)=>entry.id===id);if(!current)return;const old=previous.fighters.find((entry)=>entry.id===id)??current;const visual=visuals.get(id);if(!visual)return;visual.root.visible=!current.eliminated;visual.root.position.set(THREE.MathUtils.lerp(fixed.toNumber(old.x),fixed.toNumber(current.x),alpha),THREE.MathUtils.lerp(fixed.toNumber(old.y),fixed.toNumber(current.y),alpha),0);visual.root.scale.x=current.facing;visual.hurtbox.visible=current.invulnerableFrames===0||world.frame%4<2;visual.shield.visible=current.shielding;visual.shield.scale.setScalar(0.65+(current.shieldHealth/600)*0.35);const actionLean=current.grabAction?0.23*Math.sin((current.grabAction.frame/8)*Math.PI):current.grabTargetId?0.16:0;visual.body.rotation.z=current.attack?-current.facing*0.13*Math.sin((current.attack.frame/18)*Math.PI):-current.facing*actionLean;drawHitboxes(current,visual);}
function fighterHud(label:string,fighter:FighterState):string[]{const grab=fighter.grabTargetId?`holding ${fighter.grabTargetId} [${fighter.grabFrames}]`:fighter.grabbedById?`grabbed by ${fighter.grabbedById} [${fighter.grabFrames}]`:'none';return[`${label} ${(fighter.percentTenths/10).toFixed(1).padStart(5)}%  ${fighter.locomotion}`,`   stocks   ${fighter.stocks}  ${fighter.eliminated?'ELIMINATED':fighter.respawnFrames>0?`respawn ${fighter.respawnFrames}`:'active'}`,`   attack   ${fighter.attack?`${fighter.attack.attackId} [${fighter.attack.frame}]`:'none'}`,`   grab     ${grab}`,`   action   ${fighter.grabAction?`${fighter.grabAction.actionId} [${fighter.grabAction.frame}]`:'none'}`,`   hitlag   ${fighter.hitlagFrames}  hitstun ${fighter.hitstunFrames}`,`   shield   ${fighter.shielding?'ON ':'off'} ${String(fighter.shieldHealth).padStart(3)}  stun ${fighter.shieldStunFrames}  regen ${fighter.shieldRegenDelayFrames}`];}
function renderHud(){const a=world.fighters.find((entry)=>entry.id==='fighter-a');const b=world.fighters.find((entry)=>entry.id==='fighter-b');if(!a||!b)return;hud.textContent=['SLU PLATFORM FIGHTER — COMBAT / DEFENSE LAB',`frame      ${world.frame}`,`winner     ${world.winnerId??'unresolved'}`,'',...fighterHud('P1',a),'',...fighterHud('P2',b),`   dummy shield toggle ${dummyShield?'ON':'off'}`,'',`sim        ${paused?'PAUSED':'RUNNING'} @ ${SIM_HZ} Hz`,`lab        ${replay.mode.toUpperCase()}`].join('\n');if(!lastEvent)return;if(lastEvent.type==='hit')eventsHud.textContent=[flashFrames>0?'HIT!':'LAST HIT',`${lastEvent.attackerId} → ${lastEvent.targetId}`,`${lastEvent.attackId} / ${lastEvent.hitboxId}`,`damage ${(lastEvent.damageTenths/10).toFixed(1)}%`,`hitlag ${lastEvent.hitlagFrames} / hitstun ${lastEvent.hitstunFrames}`].join('\n');else if(lastEvent.type==='block')eventsHud.textContent=[lastEvent.broken?'SHIELD BREAK!':flashFrames>0?'BLOCK!':'LAST BLOCK',`${lastEvent.attackerId} → ${lastEvent.targetId}`,`${lastEvent.attackId} / ${lastEvent.hitboxId}`,`shield -${lastEvent.shieldDamage} → ${lastEvent.shieldHealthAfter}`,`shieldstun ${lastEvent.shieldStunFrames}`].join('\n');else if(lastEvent.type==='pummel')eventsHud.textContent=[flashFrames>0?'PUMMEL!':'LAST PUMMEL',`${lastEvent.attackerId} → ${lastEvent.targetId}`,lastEvent.actionId,`damage ${(lastEvent.damageTenths/10).toFixed(1)}%`].join('\n');else if(lastEvent.type==='throw')eventsHud.textContent=[flashFrames>0?'THROW!':'LAST THROW',`${lastEvent.attackerId} → ${lastEvent.targetId}`,lastEvent.actionId,`damage ${(lastEvent.damageTenths/10).toFixed(1)}%`,`hitstun ${lastEvent.hitstunFrames}`].join('\n');else if(lastEvent.type==='ko')eventsHud.textContent=[lastEvent.eliminated?'FINAL KO!':'KO!',lastEvent.fighterId,`stocks ${lastEvent.stocksAfter}`,lastEvent.eliminated?'ELIMINATED':'RESPAWNING'].join('\n');else if(lastEvent.type==='respawn')eventsHud.textContent=['RESPAWN',lastEvent.fighterId].join('\n');else if(lastEvent.type==='grab'||lastEvent.type==='grab-release')eventsHud.textContent=[lastEvent.type==='grab'?(flashFrames>0?'GRAB!':'LAST GRAB'):'GRAB RELEASE',`${lastEvent.attackerId} → ${lastEvent.targetId}`].join('\n');}

const buttonSemantics:SemanticButton[]=['jump','attack','special','grab','dodge','shield']; const axisSemantics:SemanticAxis[]=['moveX','moveY','smashX','smashY']; const physicalAxes=['move-x','move-y','smash-x','smash-y'];
function applyProfile(){inputSampler.setProfile(profileEditor.profile);renderBindings();}
function renderBindings(){
  buttonBindings.replaceChildren(); const snapshot=profileEditor.snapshot();
  for(const row of snapshot.buttonRows){const wrap=document.createElement('div');wrap.className='row';const label=document.createElement('label');label.textContent=row.semantic;const input=document.createElement('input');input.value=row.physicalIds.join(', ');input.addEventListener('change',()=>{profileEditor.bindButton(row.semantic,input.value.split(',').map((value)=>value.trim()).filter(Boolean));applyProfile();});wrap.append(label,input);buttonBindings.append(wrap);}
  axisBindings.replaceChildren();
  for(const row of snapshot.axisRows){const wrap=document.createElement('div');wrap.className='row';const label=document.createElement('label');label.textContent=row.semantic;const select=document.createElement('select');for(const axis of physicalAxes){const option=document.createElement('option');option.value=axis;option.textContent=axis;option.selected=axis===row.binding.physicalAxis;select.append(option);}const invert=document.createElement('input');invert.type='checkbox';invert.checked=Boolean(row.binding.invert);invert.title='Invert';const deadzone=document.createElement('input');deadzone.type='number';deadzone.min='0';deadzone.max='0.95';deadzone.step='0.01';deadzone.value=String(row.binding.deadzone??0.15);const update=()=>{profileEditor.bindAxis(row.semantic,{physicalAxis:select.value,invert:invert.checked,deadzone:Number(deadzone.value)});inputSampler.setProfile(profileEditor.profile);};select.addEventListener('change',update);invert.addEventListener('change',update);deadzone.addEventListener('change',update);wrap.append(label,select,invert,deadzone);axisBindings.append(wrap);}
}
function renderInputStatus(){const d=inputSampler.diagnostics();inputStatus.textContent=`profile ${d.profileId}\nmove ${d.semanticAxes.moveX}, ${d.semanticAxes.moveY} · smash ${d.semanticAxes.smashX}, ${d.semanticAxes.smashY}\nshield ${d.shieldHeld?'held':'off'}`;}
function syncReplayUi(){const s=replay.snapshot();seek.min=String(s.startFrame);seek.max=String(s.endFrame);seek.value=String(Math.min(s.endFrame,Math.max(s.startFrame,world.frame)));replayStatus.textContent=`${s.mode.toUpperCase()} · frame ${world.frame}${s.hasTape?` / ${s.endFrame}`:' · no tape'}`;}

required<HTMLButtonElement>('#record').addEventListener('click',()=>{replay.startRecording(world);paused=false;syncReplayUi();});
required<HTMLButtonElement>('#stop-record').addEventListener('click',()=>{if(replay.mode==='recording'){replay.stopRecording();paused=true;syncReplayUi();}});
required<HTMLButtonElement>('#live').addEventListener('click',()=>{replay.returnToLive(world);paused=false;syncReplayUi();});
required<HTMLButtonElement>('#back').addEventListener('click',()=>{if(replay.replayTape){previous=world;world=replay.stepBackward();paused=true;syncReplayUi();}});
required<HTMLButtonElement>('#forward').addEventListener('click',()=>{if(replay.replayTape){previous=world;world=replay.stepForward();paused=true;syncReplayUi();}});
required<HTMLButtonElement>('#play-replay').addEventListener('click',()=>{if(replay.replayTape){const s=replay.snapshot();if(world.frame>=s.endFrame)world=replay.seek(s.startFrame);paused=false;syncReplayUi();}});
required<HTMLButtonElement>('#play-end').addEventListener('click',()=>{if(replay.replayTape){previous=world;world=replay.playToEnd();paused=true;syncReplayUi();}});
seek.addEventListener('input',()=>{if(replay.replayTape){previous=world;world=replay.seek(Number(seek.value));paused=true;syncReplayUi();}});
required<HTMLButtonElement>('#reset-bindings').addEventListener('click',()=>{profileEditor=new LabInputProfileEditor(DEFAULT_PROFILE);resetInputSampler();renderBindings();});
renderBindings();syncReplayUi();

function frame(now:number){const delta=Math.min(100,now-lastTime);lastTime=now;if(!paused)accumulator+=delta;if(paused&&stepRequested){step();stepRequested=false;}let steps=0;while(!paused&&accumulator>=STEP_MS&&steps<MAX_STEPS){step();accumulator-=STEP_MS;steps+=1;}if(steps===MAX_STEPS)accumulator=0;const alpha=paused?1:accumulator/STEP_MS;interpolateFighter('fighter-a',alpha);interpolateFighter('fighter-b',alpha);renderHud();renderInputStatus();renderer.render(scene,camera);requestAnimationFrame(frame);}
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
requestAnimationFrame(frame);
