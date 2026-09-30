import * as T from 'three';
import { fixed } from '../../../../packages/deterministic-math/src/fixed.js';
import type { FighterState } from '../../../../packages/sim/src/types.js';
import type { KnightState } from '../game/session.js';
import { PRESENTATION as P } from '../content/presentation.js';
import { MOVES } from '../content/knight/moves/index.js';
import { flameMaterial } from './flame.js';
const metal=new T.MeshStandardMaterial({color:P.steel,metalness:.75,roughness:.32,flatShading:true});
const silver=new T.MeshStandardMaterial({color:P.silver,metalness:.85,roughness:.28,flatShading:true});
function extrude(points:number[][],depth:number,material:T.Material){const shape=new T.Shape();points.forEach(([x,y],i)=>i?shape.lineTo(x!,y!):shape.moveTo(x!,y!));shape.closePath();const g=new T.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelSegments:1,steps:1,bevelSize:.035,bevelThickness:.035});g.translate(0,0,-depth/2);return new T.Mesh(g,material);}
export class KnightView {
 readonly root=new T.Group();readonly body=new T.Group();readonly blade=new T.Group();readonly wings=new T.Group();readonly cape=new T.Mesh(new T.PlaneGeometry(1.5,2.3,10,15),new T.MeshStandardMaterial({color:0x193e4d,side:T.DoubleSide,metalness:.35,roughness:.6}));
 readonly flame:T.ShaderMaterial;readonly trails:T.Mesh[]=[];readonly cracks:T.LineSegments;readonly hitbox:T.Mesh;readonly hurtbox:T.Mesh;private light:T.PointLight;private feathers:T.Group[]=[];private arc:T.Mesh;private accent:T.MeshBasicMaterial;
 constructor(color:number){
  this.flame=flameMaterial(color);this.accent=new T.MeshBasicMaterial({color:new T.Color(color).multiplyScalar(1.1)});
  this.root.add(this.body);this.body.add(this.wings);this.wings.position.set(0,1.65,-.3);
  for(const side of [-1,1]){const fan=new T.Group();fan.scale.x=side;this.wings.add(fan);this.feathers.push(fan);
   for(let i=0;i<P.wingFeathers;i++){const feather=extrude([[.28,0],[.7,.15],[3.25-i*.26,1.65-i*.42],[2.9-i*.28,.78-i*.38],[.6,-.28]],.08,metal);fan.add(feather);const trim=extrude([[.68,.14],[3.25-i*.26,1.65-i*.42],[3.12-i*.26,1.49-i*.42]],.085,this.accent);fan.add(trim);}
  }
  this.cape.position.set(-.3,.6,-.55);this.cape.rotation.x=-.15;this.body.add(this.cape);
  const chest=extrude([[-.58,.25],[-.65,.82],[0,1.03],[.65,.82],[.58,.25],[0,-.1]],.65,metal);chest.position.y=1.05;this.body.add(chest);
  const crest=extrude([[-.08,0],[0,.46],[.08,0],[0,-.15]],.69,this.accent);crest.position.y=1.55;this.body.add(crest);
  for(const side of [-1,1]){const shoulder=extrude([[-.35,-.1],[-.45,.3],[0,.5],[.48,.1],[.25,-.23]],.55,silver);shoulder.position.set(side*.79,1.6,0);shoulder.scale.x=side;this.body.add(shoulder);}
  const helm=new T.Group();helm.scale.setScalar(P.helmScale);helm.position.y=2.35;this.body.add(helm);
  helm.add(extrude([[-.65,-.2],[-.7,.5],[-.35,.85],[0,1.0],[.35,.85],[.7,.5],[.65,-.2],[.3,-.6],[0,-.85],[-.3,-.6]],.78,metal));
  const brow=extrude([[-.72,.35],[0,.13],[.72,.35],[.58,.08],[0,-.04],[-.58,.08]],.04,silver);brow.position.z=.44;helm.add(brow);
  const gaze=extrude([[-.6,.16],[-.1,.02],[0,-.03],[.1,.02],[.6,.16],[.47,-.02],[0,-.19],[-.47,-.02]],.02,this.accent);gaze.position.z=.475;helm.add(gaze);
  const nose=extrude([[-.09,.05],[0,.7],[.09,.05],[.08,-.58],[0,-.78],[-.08,-.58]],.1,silver);nose.position.z=.49;helm.add(nose);
  for(const side of [-1,1]){const cheek=extrude([[.1,-.27],[.59,-.1],[.47,-.4],[.15,-.58]],.025,silver);cheek.scale.x=side;cheek.position.z=.435;helm.add(cheek);}
  for(const [x,y,scale] of [[0,3.8,.63],[-.2,3.55,.34],[.24,3.6,.38],[0,.38,.6]]){const flame=new T.Mesh(new T.ConeGeometry(scale!,1.7,16,16,true),this.flame);flame.position.set(x!,y!,0);if(y!<1)flame.rotation.z=Math.PI;this.body.add(flame);}
  const orb=new T.Mesh(new T.SphereGeometry(.45,16,12),this.flame);orb.position.y=.75;this.body.add(orb);
  this.blade.position.set(.72,1.18,.48);this.body.add(this.blade);
  const sword=extrude([[-P.bladeWidth,0],[P.bladeWidth,0],[.19,2.05],[0,2.48],[-.19,2.05]],.11,silver);sword.position.y=.15;this.blade.add(sword);
  const edge=extrude([[-.22,.12],[-.18,2.2],[0,2.63],[-.1,2.12],[-.13,.12]],.13,this.accent);this.blade.add(edge);
  const guard=new T.Mesh(new T.BoxGeometry(.95,.12,.28),metal);guard.position.y=.16;this.blade.add(guard);
  const handle=new T.Mesh(new T.CylinderGeometry(.085,.09,.55,6),metal);handle.position.y=-.2;this.blade.add(handle);
  for(const side of [-1,1]){const hand=new T.Mesh(new T.DodecahedronGeometry(.24,0),silver);hand.scale.set(1,1.25,.85);if(side===1){hand.position.y=-.09;this.blade.add(hand);}else{hand.position.set(-.9,.9,.4);this.body.add(hand);}}
  const arcMat=new T.MeshBasicMaterial({color,transparent:true,opacity:.5,side:T.DoubleSide,blending:T.AdditiveBlending,depthWrite:false});
  this.arc=new T.Mesh(new T.RingGeometry(1.9,2.15,36,1,0,Math.PI*1.3),arcMat);this.arc.position.set(.2,1.5,.7);this.body.add(this.arc);
  this.light=new T.PointLight(color,2,7,2);this.light.position.set(0,2,1.1);this.root.add(this.light);
  const crackPoints=[-.45,2.9,.61,-.2,2.65,.61,-.2,2.65,.61,-.3,2.4,.61,.45,2.7,.61,.25,2.35,.61,.25,2.35,.61,.4,2.2,.61];
  this.cracks=new T.LineSegments(new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(crackPoints,3)),new T.LineBasicMaterial({color}));this.body.add(this.cracks);
  this.hurtbox=new T.Mesh(new T.SphereGeometry(.7,12,8),new T.MeshBasicMaterial({color:0x5ee6cf,wireframe:true}));this.hurtbox.position.y=1.4;this.root.add(this.hurtbox);
  this.hitbox=new T.Mesh(new T.SphereGeometry(1,12,8),new T.MeshBasicMaterial({color:0xff587e,wireframe:true}));this.root.add(this.hitbox);
  this.root.traverse(o=>{if(o instanceof T.Mesh){o.castShadow=true;o.receiveShadow=true;}});
 }
 update(p:FighterState,k:KnightState,time:number,debug=false,title=false){
  this.flame.uniforms.time!.value=time;
  this.root.visible=!p.eliminated;
  if(!title){this.root.position.set(fixed.toNumber(p.x),fixed.toNumber(p.y),0);this.root.scale.setScalar(1);}
  this.body.rotation.y=T.MathUtils.lerp(this.body.rotation.y,p.facing===1?.38:-.38,.22);
  this.body.position.y=Math.sin(time*3.5)*.055;
  this.body.rotation.z=T.MathUtils.lerp(this.body.rotation.z,k.gliding?-p.facing*.32:-fixed.toNumber(p.vx)*.15,.2);
  const wing=k.stance.id==='wings';this.wings.visible=wing;this.cape.visible=!wing;
  this.feathers.forEach((fan,i)=>{fan.rotation.y=Math.sin(time*2)*.12*(i?1:-1);fan.rotation.z=(k.gliding?.16:Math.sin(time*2)*.035)*(i?1:-1);fan.scale.y=k.stance.unfurl?Math.max(.05,1-k.stance.unfurl/6):1;});
  const pos=this.cape.geometry.attributes.position!;
  for(let i=0;i<pos.count;i++){const y=pos.getY(i);pos.setZ(i,Math.sin(time*4+y*3)*.12*(1.2-y)+Math.abs(fixed.toNumber(p.vx))*(1.2-y));}pos.needsUpdate=true;
  this.blade.rotation.z=p.facing===1?-.75:.75;
  this.arc.visible=false;this.hitbox.visible=false;this.hurtbox.visible=debug;
  if(p.attack){const m=MOVES.get(p.attack.attackId);if(m){const t=p.attack.frame/m.faf;this.blade.rotation.z=p.facing*(-.5-Math.sin(t*Math.PI)*2.5);this.blade.position.x=p.facing*(.72+(m.key==='forward-smash'?Math.sin(t*Math.PI)*1.5:0));this.arc.rotation.z=p.facing*(-t*5);const active=m.strikes.find(s=>p.attack!.frame>=s.start-1&&p.attack!.frame<=s.start+s.active-2);this.arc.visible=Boolean(active);if(active&&debug){this.hitbox.visible=true;this.hitbox.position.set(active.x*p.facing,active.y,0);this.hitbox.scale.setScalar(active.radius);}}}else this.blade.position.x=p.facing*.72;
  this.cracks.visible=p.percentTenths>=250;
  this.cracks.geometry.setDrawRange(0,p.percentTenths<500?2:p.percentTenths<1000?4:8);
  this.flame.uniforms.power!.value=p.hitlagFrames>0?2.7:1;
  this.body.visible=p.invulnerableFrames===0||Math.floor(time*16)%2===0||title;
 }
}
