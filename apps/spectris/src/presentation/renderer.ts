import * as T from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import type { WorldState } from '../../../../packages/sim/src/types.js';
import { fixed } from '../../../../packages/deterministic-math/src/fixed.js';
import { gameData } from '../game/session.js';
import { PRESENTATION as P } from '../content/presentation.js';
import { KnightView } from './knight.js';
import { createArena,createBackdrop } from './arena.js';
import { createGraphicsRenderer } from '../platform/graphics.js';
export class Renderer {
 readonly renderer:T.WebGLRenderer;readonly scene=new T.Scene();readonly camera=new T.PerspectiveCamera(P.camera.fov,innerWidth/innerHeight,P.camera.near,P.camera.far);readonly knights=P.colors.map(c=>new KnightView(c));
 readonly arena=createArena();readonly composer:EffectComposer;private dust:T.Points;private particles:{mesh:T.Mesh;life:number;vx:number;vy:number}[]=[];private cursor=0;private target=new T.Vector3(0,6,0);
 constructor(host:HTMLElement){
  this.renderer=createGraphicsRenderer();this.renderer.setPixelRatio(Math.min(devicePixelRatio,P.renderScale));this.renderer.setSize(innerWidth,innerHeight);this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.0;this.renderer.info.autoReset=false;host.append(this.renderer.domElement);
  this.scene.background=new T.Color(P.background);this.scene.fog=new T.FogExp2(P.background,.007);
  const backdrop=createBackdrop(this.scene);this.dust=backdrop.dust;this.scene.add(this.arena);this.knights.forEach(k=>this.scene.add(k.root));
  this.camera.position.set(0,11,53);this.camera.lookAt(0,6,0);
  this.composer=new EffectComposer(this.renderer);this.composer.addPass(new RenderPass(this.scene,this.camera));this.composer.addPass(new UnrealBloomPass(new T.Vector2(innerWidth,innerHeight),P.bloomStrength,P.bloomRadius,P.bloomThreshold));this.composer.addPass(new OutputPass());
  const geo=new T.OctahedronGeometry(.075);for(let i=0;i<P.hitPool;i++){const mesh=new T.Mesh(geo,new T.MeshBasicMaterial({color:0xb5fff5}));mesh.visible=false;this.scene.add(mesh);this.particles.push({mesh,life:0,vx:0,vy:0});}
  addEventListener('resize',()=>this.resize());
 }
 resize(){this.camera.aspect=innerWidth/innerHeight;this.camera.updateProjectionMatrix();this.renderer.setSize(innerWidth,innerHeight);this.composer.setSize(innerWidth,innerHeight);}
 hit(x:number,y:number){for(let i=0;i<12;i++){const p=this.particles[this.cursor++%this.particles.length]!;const a=i*Math.PI*2/12;p.mesh.position.set(x,y,1);p.life=1;p.vx=Math.cos(a)*.22;p.vy=Math.sin(a)*.22;p.mesh.visible=true;}}
 render(world:WorldState,alpha:number,previous:WorldState,now:number,menu:boolean,debug:boolean){
  const t=now/1000,d=gameData(world);this.arena.visible=!menu;
  this.knights.forEach((k,i)=>{const p=world.fighters[i]!,old=previous.fighters[i]??p;k.update(p,d.knights[p.id]!,t,debug,menu);if(menu){k.root.visible=i===0;k.root.position.set(6,1,3);k.root.scale.setScalar(2.1);k.body.rotation.y=-.25;}else{k.root.position.x=T.MathUtils.lerp(fixed.toNumber(old.x),fixed.toNumber(p.x),alpha);k.root.position.y=T.MathUtils.lerp(fixed.toNumber(old.y),fixed.toNumber(p.y),alpha);}});
  if(menu){this.camera.position.lerp(new T.Vector3(0,8,37),.06);this.target.lerp(new T.Vector3(0,6,0),.06);}else{
   const a=world.fighters[0]!,b=world.fighters[1]!;const mx=(fixed.toNumber(a.x)+fixed.toNumber(b.x))/2,my=(fixed.toNumber(a.y)+fixed.toNumber(b.y))/2;
   const spread=Math.max(Math.abs(fixed.toNumber(fixed.sub(a.x,b.x)))*.8,Math.abs(fixed.toNumber(fixed.sub(a.y,b.y)))*1.3);
   const z=Math.max(51,spread+31,innerWidth/innerHeight<1.4?70:0);
   this.camera.position.lerp(new T.Vector3(mx*.4,Math.max(8,my+5),z),.045);this.target.lerp(new T.Vector3(mx*.4,Math.max(5,my+2),0),.045);
  }
  this.camera.lookAt(this.target);this.dust.rotation.y=t*.008;
  for(const p of this.particles)if(p.life>0){p.life-=.045;p.mesh.position.x+=p.vx;p.mesh.position.y+=p.vy;p.mesh.scale.setScalar(Math.max(0,p.life));p.mesh.visible=p.life>0;}
  this.renderer.info.reset();this.composer.render();
 }
}
