import * as T from 'three';
import { SURFACES } from '../content/stages/sanctum.js';
import { fixed } from '../../../../packages/deterministic-math/src/fixed.js';
const stone=new T.MeshStandardMaterial({color:0x152333,metalness:.5,roughness:.6,flatShading:true});
const edge=new T.MeshStandardMaterial({color:0x567680,metalness:.7,roughness:.3});
const glow=new T.MeshBasicMaterial({color:new T.Color(0x45827f).multiplyScalar(1.3)});
export function createArena(){
 const root=new T.Group();
 for(const s of SURFACES){const width=fixed.toNumber(fixed.sub(s.xMax,s.xMin)),x=fixed.toNumber(fixed.add(s.xMax,s.xMin))/2,y=fixed.toNumber(s.y),main=s.kind==='solid';
  const g=new T.Group();g.position.set(x,y,0);root.add(g);
  const top=new T.Mesh(new T.BoxGeometry(width,.3,main?6:2.4),edge);top.position.y=-.16;top.receiveShadow=true;g.add(top);
  const slab=new T.Mesh(new T.BoxGeometry(width-.15,main?1.2:.4,main?5.8:2.2),stone);slab.position.y=main?-.87:-.5;g.add(slab);
  const seam=new T.Mesh(new T.BoxGeometry(width,.025,.025),glow);seam.position.set(0,.015,main?3.01:1.21);g.add(seam);
  for(let i=0;i<width;i+=2){const band=new T.Mesh(new T.BoxGeometry(.018,.015,main?5.9:2.3),edge);band.position.set(i-width/2,0,0);g.add(band);}
  if(main){for(let i=-1;i<=1;i++){const fin=new T.Mesh(new T.ConeGeometry(i===0?5.5:3,8,4),stone);fin.rotation.z=Math.PI;fin.position.set(i*9,-5,0);fin.scale.z=.4;g.add(fin);}const rune=new T.Mesh(new T.TorusGeometry(2,.025,6,80),glow);rune.rotation.x=Math.PI/2;rune.position.y=.015;g.add(rune);}
 }
 return root;
}
export function createBackdrop(scene:T.Scene){
 const root=new T.Group();scene.add(root);
 const ambient=new T.HemisphereLight(0xc0e0f5,0x080a16,2.1);scene.add(ambient);
 const moonLight=new T.DirectionalLight(0xd5f4fc,3);moonLight.position.set(-15,30,14);scene.add(moonLight);
 const back=new T.DirectionalLight(0x398a94,4);back.position.set(0,12,-20);scene.add(back);
 const ringMat=new T.MeshBasicMaterial({color:0x35545e,transparent:true,opacity:.45});
 for(const [r,w,z] of [[17,.045,-22],[19,.025,-23],[16.5,.014,-22]]){const ring=new T.Mesh(new T.TorusGeometry(r!,w!,6,180),ringMat);ring.position.set(0,13,z!);root.add(ring);}
 const moon=new T.Mesh(new T.CircleGeometry(13,96),new T.MeshBasicMaterial({color:0x102935}));moon.position.set(0,13,-28);root.add(moon);
 const halo=new T.Mesh(new T.RingGeometry(12.8,13.1,100),new T.MeshBasicMaterial({color:0x86b0b4,transparent:true,opacity:.6}));halo.position.set(0,13,-27.9);root.add(halo);
 for(let i=0;i<12;i++){const a=i*Math.PI/6;const tick=new T.Mesh(new T.BoxGeometry(.055,.8,.04),ringMat);tick.position.set(Math.sin(a)*18,13+Math.cos(a)*18,-22);tick.rotation.z=-a;root.add(tick);}
 for(const side of [-1,1])for(let i=0;i<5;i++){const pillar=new T.Group();pillar.position.set(side*(20+i*6),-4-i*1.4,-10-i*6);root.add(pillar);const height=30+i*3;const shaft=new T.Mesh(new T.CylinderGeometry(.65,1.3,height,6),stone);shaft.position.y=height/2;pillar.add(shaft);const crown=new T.Mesh(new T.ConeGeometry(1.6,4.5,4),edge);crown.position.y=height+2;pillar.add(crown);for(let j=0;j<3;j++){const collar=new T.Mesh(new T.BoxGeometry(2.3,.5,2.3),stone);collar.position.y=height-j*9;pillar.add(collar);}}
 let seed=471;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const positions=new Float32Array(700*3);for(let i=0;i<700;i++){positions[i*3]=(rand()-.5)*180;positions[i*3+1]=(rand()-.3)*100;positions[i*3+2]=-30-rand()*60;}
 const stars=new T.Points(new T.BufferGeometry().setAttribute('position',new T.BufferAttribute(positions,3)),new T.PointsMaterial({size:.10,color:0xb8dbe0,transparent:true,opacity:.55,sizeAttenuation:true}));root.add(stars);
 const dustPositions=new Float32Array(160*3);for(let i=0;i<160;i++){dustPositions[i*3]=(rand()-.5)*80;dustPositions[i*3+1]=rand()*40-12;dustPositions[i*3+2]=(rand()-.5)*22;}
 const dust=new T.Points(new T.BufferGeometry().setAttribute('position',new T.BufferAttribute(dustPositions,3)),new T.PointsMaterial({size:.07,color:0x9fe9df,transparent:true,opacity:.5,blending:T.AdditiveBlending}));root.add(dust);
 return {root,dust};
}
