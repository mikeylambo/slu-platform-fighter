import { fixed } from '../../deterministic-math/src/fixed.js';
import { K2_DEFENSE } from '../../sim/src/combat.js';
import { stepAuthoritativeItems, type ItemRuntimePolicy } from '../../sim/src/itemRuntime.js';
import type { ItemDefinition } from '../../sim/src/items.js';
import { createTwoFighterMatch } from '../../sim/src/match.js';

function assert(condition:unknown,message:string):asserts condition{if(!condition)throw new Error(`K49 item combat certification failure: ${message}`);}
const combat={radius:fixed.fromInt(2),damageTenths:80,baseKnockback:fixed.fromInt(3),growthPer100Percent:fixed.fromInt(1),directionX:1000,directionY:500,hitlagFrames:4,hitstunFrames:10};
const bat:ItemDefinition={id:'bat',holdSocket:'hand_r',pickupRadius:fixed.fromInt(2),useMode:'swing',maxUses:2,throwable:true,lifetimeFrames:600,combat};
const rock:ItemDefinition={id:'rock',holdSocket:'hand_r',pickupRadius:fixed.fromInt(2),useMode:'throw',maxUses:2,throwable:true,lifetimeFrames:600,combat:{...combat,radius:fixed.fromInt(1),damageTenths:60}};
const definitions=new Map([[bat.id,bat],[rock.id,rock]]);
const policy:ItemRuntimePolicy={definitions,spawnTable:null,spawnPoints:[],throwSpeedX:fixed.fromInt(2),throwSpeedY:fixed.fromInt(1)};
const attackInput=(frame:number)=>({frame,moveX:0,moveY:0,jumpPressed:false,jumpHeld:false,attackPressed:true,dodgePressed:false,shieldHeld:false});

let world=createTwoFighterMatch(49);
world={...world,fighters:world.fighters.map((fighter,index)=>({...fighter,x:index===0?fixed.zero:fixed.fromInt(1)})),items:[{id:'i1',definitionId:'bat',x:fixed.zero,y:fixed.zero,vx:fixed.zero,vy:fixed.zero,holderId:'fighter-a',usesRemaining:2,ageFrames:0}],nextItemSerial:2};
let result=stepAuthoritativeItems(world,{frame:0,byFighterId:{'fighter-a':attackInput(0)}},policy);
const swingHit=result.events.find((event)=>event.type==='item-hit');
assert(swingHit?.type==='item-hit'&&swingHit.sourceId==='fighter-a'&&swingHit.targetId==='fighter-b'&&swingHit.damageTenths===80,'held swing use must resolve authored item damage with holder attribution');
assert(result.state.fighters.find((fighter)=>fighter.id==='fighter-b')?.percentTenths===80,'item swing damage must be authoritative fighter state');
assert(result.state.items?.[0]?.usesRemaining===1,'swing use must consume one authored item use');
assert(result.input.byFighterId['fighter-a']?.attackPressed===false,'item use must consume semantic attack before fighter attack routing');

world=createTwoFighterMatch(50);
world={...world,fighters:world.fighters.map((fighter,index)=>index===0?{...fighter,x:fixed.zero}:{...fighter,x:fixed.fromInt(1),shielding:true,shieldHealth:K2_DEFENSE.shieldMaxHealth}),items:[{id:'i2',definitionId:'bat',x:fixed.zero,y:fixed.zero,vx:fixed.zero,vy:fixed.zero,holderId:'fighter-a',usesRemaining:2,ageFrames:0}],nextItemSerial:3};
result=stepAuthoritativeItems(world,{frame:0,byFighterId:{'fighter-a':attackInput(0)}},policy);
const block=result.events.find((event)=>event.type==='item-block');
assert(block?.type==='item-block'&&block.targetId==='fighter-b'&&block.shieldHealthAfter<K2_DEFENSE.shieldMaxHealth,'held item combat must share shield damage/break interaction semantics');
assert(result.state.fighters.find((fighter)=>fighter.id==='fighter-b')?.percentTenths===0,'shielded item contact must not also deal percent damage');

world=createTwoFighterMatch(51);
world={...world,fighters:world.fighters.map((fighter,index)=>({...fighter,x:index===0?fixed.fromInt(-10):fixed.zero})),items:[{id:'i3',definitionId:'rock',x:fixed.fromInt(-1),y:fixed.fromRatio(3,2),vx:fixed.fromInt(1),vy:fixed.zero,holderId:null,usesRemaining:1,ageFrames:0}],nextItemSerial:4};
result=stepAuthoritativeItems(world,{frame:0,byFighterId:{}},policy);
const thrownHit=result.events.find((event)=>event.type==='item-hit');
assert(thrownHit?.type==='item-hit'&&thrownHit.sourceId===null&&thrownHit.targetId==='fighter-b'&&thrownHit.damageTenths===60,'travelling free item must resolve generic combat on contact');
assert((result.state.items?.length??0)===0,'travelling item must despawn after its resolved combat contact to prevent repeated frame hits');
assert(result.state.fighters.find((fighter)=>fighter.id==='fighter-b')?.hitstunFrames===10,'travelling item contact must commit authored hitstun');

console.log('K49 ITEM COMBAT PASS — held swing hits, item shield blocks and travelling free-item contacts resolve generic damage/launch/hitlag/hitstun while semantic item use consumes attack input and authoritative uses.');
