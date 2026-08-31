import { fixed } from '../../deterministic-math/src/fixed.js';
import type { EntityDefinition } from '../../content/src/compileEntities.js';
import { stepOwnedEntities } from '../../sim/src/entities.js';
import { serializeWorldState } from '../../sim/src/serialize.js';
import type { OwnedEntityState } from '../../sim/src/types.js';
import { createFighterState, createWorld } from '../../sim/src/world.js';

function assert(condition:unknown,message:string):asserts condition{if(!condition)throw new Error(`K46 entity interaction certification failure: ${message}`);}
const definition:EntityDefinition={id:'caster:orb',fighterId:'caster',localId:'orb',kind:'projectile',lifetimeFrames:120,radius:fixed.fromInt(1),spawnOffsetX:fixed.zero,spawnOffsetY:fixed.zero,velocityX:fixed.fromInt(1),velocityY:fixed.zero,gravity:fixed.zero,damageTenths:50,baseKnockback:fixed.fromInt(2),growthPer100Percent:fixed.zero,directionX:1,directionY:0,hitlagFrames:3,hitstunFrames:8,destroyOnHit:true,maxHits:1};
const definitions=new Map([[definition.id,definition]]);
const source:OwnedEntityState={id:'e1',definitionId:definition.id,ownerId:'attacker',ownerDefinitionId:'caster',x:fixed.fromInt(-1),y:fixed.fromRatio(3,2),vx:fixed.fromInt(1),vy:fixed.zero,facing:1,ageFrames:0,lifetimeFrames:120,hitsRemaining:1,hitTargets:['old-target']};
const attacker={...createFighterState('attacker',fixed.fromInt(-8),1,'caster')};
const reflector={...createFighterState('reflector',fixed.zero,-1,'mirror')};

const reflected=stepOwnedEntities([source],[attacker,reflector],definitions,{},()=>true,(_entity,target)=>target.id==='reflector'?'reflect':'hit');
const reflectedEntity=reflected.entities[0];
assert(reflected.events.length===1&&reflected.events[0]?.type==='entity-reflect','reflection policy must emit one semantic reflect event instead of hit/block');
assert(reflectedEntity?.ownerId==='reflector'&&reflectedEntity.ownerDefinitionId==='mirror','reflection must transfer authoritative ownership to reflecting fighter');
assert(reflectedEntity?.vx===fixed.fromInt(-1)&&reflectedEntity.facing===-1,'reflection must reverse deterministic projectile travel/facing');
assert(reflectedEntity?.hitTargets.length===0&&reflectedEntity.hitsRemaining===1,'reflection must clear old target memory without consuming a hit');
assert(reflected.fighters.find((fighter)=>fighter.id==='reflector')?.percentTenths===0,'reflection must prevent ordinary damage resolution on reflecting contact');

const absorber={...createFighterState('absorber',fixed.zero,-1,'absorber')};
const absorbed=stepOwnedEntities([source],[attacker,absorber],definitions,{},()=>true,(_entity,target)=>target.id==='absorber'?'absorb':'hit');
assert(absorbed.entities.length===0,'absorption must consume authoritative entity immediately');
assert(absorbed.events.length===1&&absorbed.events[0]?.type==='entity-absorb','absorption must emit semantic event for presentation/telemetry');
assert(absorbed.fighters.find((fighter)=>fighter.id==='absorber')?.percentTenths===0,'absorption hook must prevent ordinary projectile damage');

const world=createWorld(46);const reflectedWorld={...world,fighters:[attacker,reflector],entities:reflected.entities,nextEntitySerial:2};const originalWorld={...world,fighters:[attacker,reflector],entities:[source],nextEntitySerial:2};
assert(Buffer.from(serializeWorldState(reflectedWorld)).compare(Buffer.from(serializeWorldState(originalWorld)))!==0,'existing binary snapshot must distinguish reflected ownership/velocity state without a new side channel');

console.log('K46 ENTITY INTERACTIONS PASS — deterministic contact policy supports hit/reflect/absorb; reflection transfers serialized ownership/travel and absorption consumes the entity with semantic events.');
