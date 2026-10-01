import { SemanticInputSampler, type InputProfile } from '../../../../packages/input/src/profile.js';
import type { SimInputFrame } from '../../../../packages/sim/src/types.js';
const profiles:InputProfile[]=[
 {id:'spectris-p1',buttons:{jump:['Space','Pad2','Pad3'],attack:['KeyJ','Pad0'],special:['KeyK','Pad1'],grab:['KeyU','Pad5'],dodge:['KeyL','Pad7'],shield:['KeyL','Pad7']},axes:{moveX:{physicalAxis:'x',deadzone:.16},moveY:{physicalAxis:'y',deadzone:.16},smashX:{physicalAxis:'sx',deadzone:.3},smashY:{physicalAxis:'sy',deadzone:.3}}},
 {id:'spectris-p2',buttons:{jump:['Numpad0','Pad2','Pad3'],attack:['Numpad1','Pad0'],special:['Numpad2','Pad1'],grab:['Numpad4','Pad5'],dodge:['Numpad3','Pad7'],shield:['Numpad3','Pad7']},axes:{moveX:{physicalAxis:'x',deadzone:.16},moveY:{physicalAxis:'y',deadzone:.16},smashX:{physicalAxis:'sx',deadzone:.3},smashY:{physicalAxis:'sy',deadzone:.3}}}
];
export class InputPort {
 bindings:Record<string,string>={jump:'Space',attack:'KeyJ',special:'KeyK',grab:'KeyU',dodge:'KeyL',stance:'KeyI'};
 remap(bindings:Record<string,string>){this.bindings={...bindings};const p=profiles[0]!;profiles[0]={...p,buttons:{...p.buttons,jump:[bindings.jump!,'Pad2','Pad3'],attack:[bindings.attack!,'Pad0'],special:[bindings.special!,'Pad1'],grab:[bindings.grab!,'Pad5'],dodge:[bindings.dodge!,'Pad7'],shield:[bindings.dodge!,'Pad7']}};this.clear();}
 deadzone=.16;tapJump=false;private upHeld=[false,false];readonly keys=new Set<string>(); private samplers=profiles.map(p=>new SemanticInputSampler(p));private sequence=0;private taps=[new Set<string>(),new Set<string>()];private stanceHeld=[false,false];
 constructor(){
  addEventListener('keydown',e=>{if((e.target as HTMLElement)?.matches('input,select,textarea'))return;this.keys.add(e.code);if(!e.repeat)this.taps.forEach(t=>t.add(e.code));if(['Space','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Tab'].includes(e.code))e.preventDefault();});
  addEventListener('keyup',e=>this.keys.delete(e.code));addEventListener('blur',()=>this.clear());
 }
 clear(){this.keys.clear();this.taps.forEach(t=>t.clear());this.stanceHeld=[false,false];this.samplers=profiles.map(p=>new SemanticInputSampler(p));}
 get connected(){return Array.from(navigator.getGamepads?.()??[]).filter(Boolean).length;}
 sample(index:number,frame:number):SimInputFrame {
  const pads=Array.from(navigator.getGamepads?.()??[]).filter((p):p is Gamepad=>p!==null),pad=pads[index];
  const buttons:Record<string,boolean>={};for(const key of this.keys)buttons[key]=true;for(const key of this.taps[index]!)buttons[key]=true;
  pad?.buttons.forEach((b,i)=>buttons[`Pad${i}`]=b.pressed);
  const keys=index===0?['KeyA','KeyD','KeyS','KeyW']:['ArrowLeft','ArrowRight','ArrowDown','ArrowUp'];
  const x=Number(this.keys.has(keys[1]!))-Number(this.keys.has(keys[0]!));
  const y=Number(this.keys.has(keys[3]!))-Number(this.keys.has(keys[2]!));
  const smash=this.keys.has(index===0?'ShiftLeft':'ShiftRight');
  const sampler=this.samplers[index]!;
  sampler.sample({sequence:this.sequence++,buttons,axes:{x:x||pad?.axes[0]||0,y:y||-(pad?.axes[1]??0),sx:smash?x:pad?.axes[2]??0,sy:smash?y:-(pad?.axes[3]??0)}});
  const input=sampler.emitFrame(frame);const up=y>.6||-(pad?.axes[1]??0)>.6;if(this.tapJump&&up&&!this.upHeld[index])input.jumpPressed=true;this.upHeld[index]=up;if(Math.abs(input.moveX)<this.deadzone*1000)input.moveX=0;if(Math.abs(input.moveY)<this.deadzone*1000)input.moveY=0;const held=Boolean(buttons[index===0?this.bindings.stance!:'Numpad5'])||Boolean(pad?.buttons[4]?.pressed);
  input.auxiliaryButtons=(held&&!this.stanceHeld[index]?1:0)|(buttons[index===0?this.bindings.attack!:'Numpad1']||pad?.buttons[0]?.pressed?2:0)|(buttons[index===0?this.bindings.special!:'Numpad2']||pad?.buttons[1]?.pressed?4:0);
  this.stanceHeld[index]=held;this.taps[index]!.clear();return input;
 }
}
