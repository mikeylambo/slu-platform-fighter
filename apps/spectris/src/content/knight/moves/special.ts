import {strike as s,type Move} from './types.js';
import {MOVES,ATTACKS,compileMoves} from './index.js';
const move=(key:string,name:string,start:number,damage:number,faf:number,x=1.8,y=1.4,radius=1.2,shatter=false):Move=>({key,name,faf,landing:12,shatter,strikes:[s(start,3,damage,x,y,radius,[10,5],[45,80])]});
export function registerDuelMoves(){for(const stance of ['wings','cape']){
 const list=[...Array.from({length:12},(_,i)=>move(`cleave-${i}`,'Charged Cleave',8,12+i,38)),move('anchor-wide','Iron Anchor',10,14,40,0,.3,4.5,true),move('riposte','Riposte',3,14,32,2,1.4,1.8),move('punch','Bare Gauntlet',5,3,18,1.2,1.4,.65),move('kindle-finisher','Last Light',12,24,48,2,1.4,2.5,true),move('sling','Blade Sling',12,0,26,0,1,.01),move('cleave','Charged Cleave',8,12,38),move('cleave-full','Charged Cleave',8,24,48,2.2,1.4,1.6,true),move('gale','Gale Lunge',8,9,30),move('veil','Veil Step',19,0,32),move('veil-cut','Veil Cut',1,7,14),move('ascend','Ascend',5,8,35,0,2.6,1.5),move('rift','Rift',13,0,30),move('rift-cut','Rift Cut',1,6,18),move('stoop','Stoop',5,6,35,.2,-.3,1),move('anchor','Anchor',10,14,40,0,.3,3,true),move('anchor-air','Anchor Plunge',5,6,90,.1,-.4,1),move('glide-attack','Glide Cut',5,12,24,1.8,1.5,1.4)];
 for(const m of list)MOVES.set(`${stance}:${m.key}`,m);
 }for(const [id,a]of compileMoves())ATTACKS.set(id,a);}
