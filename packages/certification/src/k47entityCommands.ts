import { fixed } from '../../deterministic-math/src/fixed.js';
import { compileEntityCommands, type EntityDefinition } from '../../content/src/compileEntities.js';
import { applyEntityCommandsFromAttacks } from '../../sim/src/entities.js';
import { withEntityCommands } from '../../sim/src/entityCommandRuntime.js';
import type { MatchInputFrame, MatchStepResult } from '../../sim/src/match.js';
import type { OwnedEntityState, WorldState } from '../../sim/src/types.js';
import { createFighterState, createWorld } from '../../sim/src/world.js';

function assert(condition:unknown,message:string):asserts condition{if(!condition)throw new Error(`K47 entity command certification failure: ${message}`);}
const definition:EntityDefinition={id:'caster:orb',fighterId:'caster',localId:'orb',kind:'projectile',lifetimeFrames:120,radius:fixed.fromInt(1),spawnOffsetX:fixed.zero,spawnOffsetY:fixed.zero,velocityX:fixed.fromInt(1),velocityY:fixed.zero,gravity:fixed.zero,damageTenths:0,baseKnockback:fixed.zero,growthPer100Percent:fixed.zero,directionX:1,directionY:0,hitlagFrames:0,hitstunFrames:0,destroyOnHit:false,maxHits:4};
const definitions=new Map([[definition.id,definition]]);
const pack={id:'caster',moves:{control:{animationRole:'special',totalFrames:10,timeline:[
  {frame:0,type:'entity_command',data:{entityId:'orb',command:'reverse_velocity'}},
  {frame:2,type:'entity_command',data:{entityId:'orb',command:'set_velocity',velocityX:123,velocityY:456}},
  {frame:4,type:'entity_command',data:{entityId:'orb',command:'despawn'}},
]}}};
const commands=compileEntityCommands(pack,definitions);
assert(commands.get('caster:control')?.length===3,'fighter timeline entity_command entries must compile into runtime command table');
const fighter={...createFighterState('p1',fixed.zero,1,'caster'),attack:{attackId:'caster:control',frame:0,hitTargets:[]}};
const entity:OwnedEntityState={id:'e1',definitionId:definition.id,ownerId:'p1',ownerDefinitionId:'caster',x:fixed.zero,y:fixed.zero,vx:fixed.fromInt(2),vy:fixed.fromInt(1),facing:1,ageFrames:0,lifetimeFrames:120,hitsRemaining:4,hitTargets:[]};
let entities=applyEntityCommandsFromAttacks([fighter],[entity],commands);
assert(entities[0]?.vx===fixed.fromInt(-2)&&entities[0]?.vy===fixed.fromInt(-1)&&entities[0]?.facing===-1,'reverse_velocity must reverse matching owned instances and facing deterministically');
entities=applyEntityCommandsFromAttacks([{...fighter,attack:{...fighter.attack,frame:2}}],entities,commands);
assert(entities[0]?.vx===123&&entities[0]?.vy===456,'set_velocity must apply authored fixed-point components to matching owned instances');
entities=applyEntityCommandsFromAttacks([{...fighter,attack:{...fighter.attack,frame:4}}],entities,commands);
assert(entities.length===0,'despawn must remove all matching active instances owned by the commanding fighter');

const frame0Commands=new Map([['caster:spawn-control',commands.get('caster:control')!.filter((command)=>command.frame===0).map((command)=>({...command,moveId:'caster:spawn-control'}))]]);
const inner=(state:WorldState,_input:MatchInputFrame):MatchStepResult=>{
  const p1=state.fighters[0]!;
  return{state:{...state,frame:state.frame+1,fighters:[{...p1,attack:{attackId:'caster:spawn-control',frame:1,hitTargets:[]}}],entities:[entity]},events:[]};
};
const wrapped=withEntityCommands(inner,frame0Commands);
let world=createWorld(47);world={...world,fighters:[createFighterState('p1',fixed.zero,1,'caster')],entities:[]};
const wrappedResult=wrapped(world,{frame:0,byFighterId:{}});
assert(wrappedResult.state.entities?.[0]?.vx===fixed.fromInt(-2),'production wrapper must catch frame-0 command on an attack that begins inside the inner match step');

console.log('K47 ENTITY COMMANDS PASS — fighter-pack entity_command timelines compile and execute despawn/set-velocity/reverse operations, including commands on a newly-started move frame 0.');
