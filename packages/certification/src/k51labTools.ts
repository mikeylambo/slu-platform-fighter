import { compileFighterGrabActions } from '../../content/src/compileGrabActions.js';
import { compileFighterMoveRuntime } from '../../content/src/compileMoveRuntime.js';
import { compileFighterAttacks } from '../../content/src/compileMoves.js';
import { ALL_FIGHTER_PACKS } from '../../content/src/generated/fighterRegistry.js';
import { SemanticInputSampler, type InputProfile } from '../../input/src/profile.js';
import { createTwoFighterMatch, stepMatchWorld } from '../../sim/src/match.js';
import { replayWorldHash, type ReplayFrame } from '../../sim/src/replay.js';
import type { SimInputFrame, WorldState } from '../../sim/src/types.js';
import { LabInputProfileEditor, LabReplaySession } from '../../training/src/labTools.js';

function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(`K51 lab-tools certification failure: ${message}`); }
const pack=ALL_FIGHTER_PACKS.find((candidate)=>candidate.id==='greybox'); assert(pack,'greybox required');
const attacks=compileFighterAttacks(pack); const grabs=compileFighterGrabActions(pack); const runtime=compileFighterMoveRuntime(pack); const jab='greybox:jab';
const simStep=(state:WorldState,input:ReplayFrame)=>stepMatchWorld(state,input,attacks,jab,undefined,grabs,undefined,undefined,undefined,runtime);
const input=(frame:number,id:string):SimInputFrame=>({frame,moveX:(frame%20<10?(id==='fighter-a'?700:-700):0),moveY:0,jumpPressed:frame%47===3,jumpHeld:false,attackPressed:frame%17===5,grabPressed:false,dodgePressed:false,shieldHeld:false});
let world=createTwoFighterMatch(0x4b_51_0001);
const session=new LabReplaySession(world,{gameVersion:'cert-k51',participantIds:['fighter-a','fighter-b'],stageId:'greybox',rulesetId:'lab'},simStep,10);
session.startRecording(world);
const hashes=new Map<number,string>([[world.frame,replayWorldHash(world)]]);
for(let frame=0;frame<60;frame+=1){const bundle:ReplayFrame={frame,byFighterId:{'fighter-a':input(frame,'fighter-a'),'fighter-b':input(frame,'fighter-b')}};const result=simStep(world,bundle);world=result.state;session.appendRecordedFrame(bundle,world);hashes.set(world.frame,replayWorldHash(world));}
const tape=session.stopRecording(); assert(tape.frames.length===60&&session.snapshot().mode==='playback','recording must produce loadable playback tape');
assert(replayWorldHash(session.seek(30))===hashes.get(30),'lab seek must converge to recorded hash');
assert(replayWorldHash(session.stepBackward())===hashes.get(29),'step backward must seek one deterministic frame');
assert(replayWorldHash(session.stepForward())===hashes.get(30),'step forward must seek one deterministic frame');
assert(replayWorldHash(session.playToEnd())===hashes.get(60),'play-to-end must converge to recorded final hash');
session.returnToLive(); assert(session.snapshot().mode==='live','lab session must return to live mode without deleting tape');

const profile:InputProfile={id:'lab-default',buttons:{jump:['KeySpace'],attack:['KeyF'],special:['KeyQ'],grab:['KeyE'],dodge:['KeyK'],shield:['KeyL']},axes:{moveX:{physicalAxis:'keyboard-x',deadzone:0},moveY:{physicalAxis:'keyboard-y',deadzone:0},smashX:{physicalAxis:'smash-x',deadzone:0},smashY:{physicalAxis:'smash-y',deadzone:0}}};
const editor=new LabInputProfileEditor(profile); editor.bindButton('attack',['KeyJ','KeyJ',' Gamepad2 ']); editor.bindAxis('moveX',{physicalAxis:'left-x',invert:true,deadzone:0.2});
const edited=editor.profile; assert(edited.buttons.attack.length===2&&edited.buttons.attack[0]==='KeyJ'&&edited.buttons.attack[1]==='Gamepad2','button editor must trim/dedupe physical bindings');
assert(edited.axes.moveX.physicalAxis==='left-x'&&edited.axes.moveX.invert===true&&edited.axes.moveX.deadzone===0.2,'axis editor must preserve authored binding fields');
const sampler=new SemanticInputSampler(edited); sampler.sample({sequence:0,buttons:{KeyJ:true},axes:{'left-x':-1}}); const semantic=sampler.emitFrame(0); assert(semantic.attackPressed===true&&semantic.moveX===1000,'edited profile must drive the certified semantic sampler');
const snapshot=editor.snapshot(); assert(snapshot.buttonRows.length===6&&snapshot.axisRows.length===4,'visual editor snapshot must enumerate every semantic control row');
console.log('K51 LAB TOOLS PASS — deterministic lab replay record/seek/step/playback and visual semantic input-profile editing certified against shared replay/input systems.');
