import * as T from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import type { WorldState } from '../../../../packages/sim/src/types.js';
import { fixed } from '../../../../packages/deterministic-math/src/fixed.js';
import { gameData } from '../game/session.js';
import { PRESENTATION as P } from '../content/presentation.js';
import { KnightView } from './knight.js';
import { createArena,createBackdrop,createBiome } from './arena.js';
import { createGraphicsRenderer } from '../platform/graphics.js';
import {duelData} from '../game/duel.js';
import {OATHS} from '../content/rules/duel.js';
import {stageById} from '../content/stages/roster.js';
export class Renderer {
 freeCamera=false;private orbit:OrbitControls;readonly renderer:T.WebGLRenderer;readonly scene=new T.Scene();readonly camera=new T.PerspectiveCamera(P.camera.fov,innerWidth/innerHeight,P.camera.near,P.camera.far);readonly knights=P.colors.map(c=>new KnightView(c));
 arena=createArena();private stageId='';private biome=new T.Group();private eventFrame=-1;shake=true;contrast=false;private shakeUntil=0;private echoes:T.Mesh[]=[];private swords:T.Mesh[]=[];private guards:T.Mesh[]=[];readonly composer:EffectComposer;private dust:T.Points;private particles:{mesh:T.Mesh;life:number;vx:number;vy:number}[]=[];private cursor=0;private target=new T.Vector3(0,6,0);
 constructor(host:HTMLElement){
  this.renderer=createGraphicsRenderer();this.renderer.setPixelRatio(Math.min(devicePixelRatio,P.renderScale));this.renderer.setSize(innerWidth,innerHeight);this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.0;this.renderer.info.autoReset=false;host.append(this.renderer.domElement);this.orbit=new OrbitControls(this.camera,this.renderer.domElement);this.orbit.enabled=false;
  this.scene.background=new T.Color(P.background);this.scene.fog=new T.FogExp2(P.background,.007);
  const backdrop=createBackdrop(this.scene);this.dust=backdrop.dust;this.scene.add(this.arena);this.knights.forEach(k=>this.scene.add(k.root));
  for(let i=0;i<2;i++){const ghost=new T.Mesh(new T.IcosahedronGeometry(1.4,0),new T.MeshBasicMaterial({color:P.colors[i]!,transparent:true,opacity:.22,wireframe:true}));const sword=new T.Mesh(new T.OctahedronGeometry(.5),new T.MeshBasicMaterial({color:P.colors[i]!}));sword.scale.set(.3,3,.3);const guard=new T.Mesh(new T.RingGeometry(1.6,1.7,40,1,-Math.PI*.45,Math.PI*.9),new T.MeshBasicMaterial({color:P.colors[i]!,transparent:true,opacity:.7,side:T.DoubleSide}));this.echoes.push(ghost);this.swords.push(sword);this.guards.push(guard);this.scene.add(ghost,sword,guard);}
  this.camera.position.set(0,11,53);this.camera.lookAt(0,6,0);
  this.composer=new EffectComposer(this.renderer);this.composer.addPass(new RenderPass(this.scene,this.camera));this.composer.addPass(new UnrealBloomPass(new T.Vector2(innerWidth,innerHeight),P.bloomStrength,P.bloomRadius,P.bloomThreshold));this.composer.addPass(new OutputPass());
  const geo=new T.OctahedronGeometry(.075);for(let i=0;i<P.hitPool;i++){const mesh=new T.Mesh(geo,new T.MeshBasicMaterial({color:0xb5fff5}));mesh.visible=false;this.scene.add(mesh);this.particles.push({mesh,life:0,vx:0,vy:0});}
  addEventListener('resize',()=>this.resize());
 }
 resize(){this.camera.aspect=innerWidth/innerHeight;this.camera.updateProjectionMatrix();this.renderer.setSize(innerWidth,innerHeight);this.composer.setSize(innerWidth,innerHeight);}
 hit(x:number,y:number){for(let i=0;i<12;i++){const p=this.particles[this.cursor++%this.particles.length]!;const a=i*Math.PI*2/12;p.mesh.position.set(x,y,1);p.life=1;p.vx=Math.cos(a)*.22;p.vy=Math.sin(a)*.22;p.mesh.visible=true;}}
 render(world:WorldState,alpha:number,previous:WorldState,now:number,menu:boolean,debug:boolean){
  const t=now/1000,d=gameData(world),duel=duelData(world);this.arena.visible=!menu;const offset=duel?.options.format==='momentum'?duel.progress*32:0;
  if(duel&&this.stageId!==duel.options.stage){this.stageId=duel.options.stage;this.scene.remove(this.biome);this.biome.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();if(!Array.isArray(o.material))o.material.dispose();}});this.biome=createBiome(this.stageId,stageById(this.stageId).color);this.scene.add(this.biome);this.scene.remove(this.arena);this.arena.traverse(o=>{if(o instanceof T.Mesh)o.geometry.dispose();});this.arena=createArena(world.surfaces);this.scene.add(this.arena);const color=new T.Color(stageById(this.stageId).color).multiplyScalar(.045);this.scene.background=color;(this.scene.fog as T.FogExp2).color.copy(color);}
  this.biome.visible=!menu;const cracks=this.biome.getObjectByName('fracture-cracks') as T.LineSegments|undefined;if(cracks)cracks.geometry.setDrawRange(0,Math.min(32,Object.values(duel?.knights??{}).reduce((n,k)=>n+k.fractures,0)*4));this.arena.visible=!menu;this.arena.position.x=offset;for(const surface of world.surfaces){const mesh=this.arena.getObjectByName(surface.id);if(mesh)mesh.position.set(fixed.toNumber(fixed.add(surface.xMin,surface.xMax))/2,fixed.toNumber(surface.y),0);}
  if(duel&&this.eventFrame!==world.frame){this.eventFrame=world.frame;for(const event of duel.events)if(['shatter','fracture','guard-break','parry','clash'].includes(event.type)){this.hit(event.x,event.y+2);if(event.type==='shatter'||event.type==='fracture')this.shakeUntil=now+180;}}
  this.knights.forEach((k,i)=>{const p=world.fighters[i]!,old=previous.fighters[i]??p;const dk=duel?.knights[p.id];let color=duel?OATHS[duel.options.oaths[i]!].color:P.colors[i]!;if(i===1&&duel?.options.oaths[0]===duel?.options.oaths[1]){const c=new T.Color(color);c.offsetHSL(1/6,0,0);color=c.getHex();}if(this.contrast)color=i===0?0x5eeaff:0xffdc55;k.setContrast(this.contrast,color);k.setOath(duel?.options.oaths[i]??'unsworn');k.setPalette(color,!!dk?.soul.remaining);k.update(p,d.knights[p.id]!,t,debug,menu);k.blade.visible=!dk?.blade;const sword=this.swords[i]!,ghost=this.echoes[i]!,guard=this.guards[i]!;sword.visible=!menu&&!!dk?.blade;ghost.visible=!menu&&!!dk?.ghost;guard.visible=!menu&&!!dk?.guard;if(dk?.blade){sword.position.set(offset+fixed.toNumber(dk.blade.x),fixed.toNumber(dk.blade.y),.5);sword.rotation.z=t*22;}if(dk?.ghost){ghost.position.set(offset+fixed.toNumber(dk.ghost.x),fixed.toNumber(dk.ghost.y)+2,0);(ghost.material as T.MeshBasicMaterial).opacity=.25*(1-dk.ghost.age/20);}guard.position.set(offset+fixed.toNumber(p.x),fixed.toNumber(p.y)+1.5,.5);guard.rotation.z=p.facing===1?0:Math.PI;if(menu){k.root.visible=i===0;k.root.position.set(6,1,3);k.root.scale.setScalar(2.1);k.body.rotation.y=-.25;}else{k.root.position.x=offset+T.MathUtils.lerp(fixed.toNumber(old.x),fixed.toNumber(p.x),alpha);k.root.position.y=T.MathUtils.lerp(fixed.toNumber(old.y),fixed.toNumber(p.y),alpha);}});
  if(this.freeCamera&&!menu){this.orbit.enabled=true;this.orbit.update();}else if(menu){this.orbit.enabled=false;this.camera.position.lerp(new T.Vector3(0,8,37),.06);this.target.lerp(new T.Vector3(0,6,0),.06);}else{
   const a=world.fighters[0]!,b=world.fighters[1]!;const mx=(fixed.toNumber(a.x)+fixed.toNumber(b.x))/2,my=(fixed.toNumber(a.y)+fixed.toNumber(b.y))/2;
   const spread=Math.max(Math.abs(fixed.toNumber(fixed.sub(a.x,b.x)))*.8,Math.abs(fixed.toNumber(fixed.sub(a.y,b.y)))*1.3);
   const z=Math.max(51,spread+31,innerWidth/innerHeight<1.4?70:0);
   this.camera.position.lerp(new T.Vector3(offset+mx*.4,Math.max(8,my+5),z),.045);this.target.lerp(new T.Vector3(offset+mx*.4,Math.max(5,my+2),0),.045);
  }
  if(this.shake&&now<this.shakeUntil)this.camera.position.x+=Math.sin(now*.18)*.09;
  if(!this.freeCamera){this.orbit.enabled=false;this.camera.lookAt(this.target);this.orbit.target.copy(this.target);}this.dust.rotation.y=t*.008;
  for(const p of this.particles)if(p.life>0){p.life-=.045;p.mesh.position.x+=p.vx;p.mesh.position.y+=p.vy;p.mesh.scale.setScalar(Math.max(0,p.life));p.mesh.visible=p.life>0;}
  this.renderer.info.reset();this.composer.render();
 }
}
