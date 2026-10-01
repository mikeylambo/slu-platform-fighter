import {fixed as f} from '../../../../../packages/deterministic-math/src/fixed.js';
import type {StageSurface} from '../../../../../packages/sim/src/types.js';
export interface Stage {id:string;name:string;width:number;blast:[number,number,number,number];platforms:[number,number,number][];color:number;}
export const STAGES:Stage[]=[
{id:'mirror-sanctum',name:'Mirror Sanctum',width:160,blast:[224,224,200,140],platforms:[[-40,30,30],[40,30,30],[0,55,30]],color:0x71e9e0},
{id:'eclipse',name:'Eclipse',width:190,blast:[230,230,200,140],platforms:[],color:0xff603b},
{id:'fault-screen',name:'Fault Screen',width:170,blast:[224,224,190,140],platforms:[[-40,35,35],[40,35,35]],color:0x448aff},
{id:'stillwater',name:'Stillwater',width:185,blast:[224,224,200,140],platforms:[[0,40,40]],color:0xd8eeff},
{id:'bell-foundry',name:'Bell Foundry',width:175,blast:[220,220,190,140],platforms:[[0,40,35]],color:0xe8b153},
{id:'skyreach',name:'Skyreach',width:110,blast:[260,260,220,150],platforms:[[-55,30,25],[55,40,25]],color:0x54ffc4},
{id:'hollow-throne',name:'Hollow Throne',width:200,blast:[210,210,185,135],platforms:[],color:0xbc66ff},
{id:'unsworn',name:'Unsworn',width:160,blast:[224,224,200,140],platforms:[[-40,30,30],[40,30,30],[0,55,30]],color:0xeeeeff},
{id:'pilgrimage',name:'Pilgrimage',width:180,blast:[240,240,200,140],platforms:[[-45,30,30],[45,45,30]],color:0xc9a976}];
export const stageById=(id:string)=>STAGES.find(s=>s.id===id)??STAGES[0]!;
export function surfaces(stage:Stage,frame=0):StageSurface[]{return [{id:'ground',kind:'solid',xMin:f.fromRatio(-stage.width,10),xMax:f.fromRatio(stage.width,10),y:f.zero},...stage.platforms.map(([x,y,width],i)=>{const period=stage.id==='bell-foundry'?720:600;const t=frame%period;const triangle=(t<period/2?t:period-t)/(period/4)-1;const drift=stage.id==='bell-foundry'?triangle*40:stage.id==='skyreach'?triangle*12*(i?1:-1):0;return {id:`platform-${i}`,kind:'one-way' as const,xMin:f.fromRatio(Math.round((x+drift-width/2)*100),500),xMax:f.fromRatio(Math.round((x+drift+width/2)*100),500),y:f.fromRatio(y,5)};})];}
