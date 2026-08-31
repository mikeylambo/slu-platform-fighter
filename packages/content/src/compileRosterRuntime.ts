import { compileEntityDefinitionRegistry, compileEntitySpawns, type EntityDefinition, type EntitySpawnDefinition } from './compileEntities.js';
import { compileFighterPhysicsRegistry, type FighterPhysicsDefinition } from './compileFighterPhysics.js';
import { compileGrabActionRegistry, type GrabActionDefinition } from './compileGrabActions.js';
import { compileFighterLandingPolicies, type AerialLandingDefinition } from './compileLanding.js';
import { compileFighterMoveRuntime, type MoveRuntimeDefinition } from './compileMoveRuntime.js';
import { compileFighterAttacks } from './compileMoves.js';
import { compileFighterFollowUps, type MoveFollowUpDefinition } from './compileFollowUps.js';
import { compileFighterSmashCharges } from './compileSmashCharge.js';
import type { AttackDefinition } from '../../sim/src/combat.js';
import type { SmashChargePolicy } from '../../sim/src/smashCharge.js';

interface TimelineEvent { frame: number; type: string; data?: Record<string, unknown>; }
interface PackMove {
  animationRole: string;
  grabAction?: 'pummel' | 'forward-throw' | 'back-throw' | 'up-throw' | 'down-throw';
  landing?: { landingLagFrames: number; autoCancelWindows: readonly { startFrame: number; endFrame: number }[] };
  followUps?: readonly { input:'attack'|'special'; startFrame:number; endFrame:number; nextMove:string; requireContact:boolean }[];
  charge?: { maxChargeFrames:number; damageBonusPermilleAtMax:number; launchBonusPermilleAtMax:number };
  totalFrames: number;
  timeline: readonly TimelineEvent[];
}
export interface RuntimeFighterPack { id:string; attributes:{weight:number;hurtboxWidth:number;hurtboxHeight:number}; movement:Readonly<Record<string,number>>; moves:Readonly<Record<string,PackMove>>; }
export interface RuntimeEntityPack { fighterId:string; entities:Readonly<Record<string,{kind:'projectile'|'trap'|'summon'|'weapon';lifetimeFrames:number;radius:number;spawnOffsetX:number;spawnOffsetY:number;velocityX:number;velocityY:number;gravity:number;damageTenths:number;baseKnockback:number;growthPer100Percent:number;directionX:number;directionY:number;hitlagFrames:number;hitstunFrames:number;destroyOnHit:boolean;maxHits:number}>>; }
export interface RosterRuntime {
  fighterDefinitionIds:readonly string[]; fighterPhysics:ReadonlyMap<string,FighterPhysicsDefinition>; attacks:ReadonlyMap<string,AttackDefinition>; grabActions:ReadonlyMap<string,GrabActionDefinition>;
  moveRuntime:ReadonlyMap<string,MoveRuntimeDefinition>; moveFollowUps:ReadonlyMap<string,readonly MoveFollowUpDefinition[]>; smashCharges:ReadonlyMap<string,SmashChargePolicy>; aerialLanding:ReadonlyMap<string,AerialLandingDefinition>;
  entityDefinitions:ReadonlyMap<string,EntityDefinition>; entitySpawnsByMoveId:ReadonlyMap<string,readonly EntitySpawnDefinition[]>;
}
function mergeUnique<T>(target:Map<string,T>,source:ReadonlyMap<string,T>,label:string):void{for(const[key,value]of source){if(target.has(key))throw new Error(`duplicate ${label} ${key}`);target.set(key,value);}}
export function compileRosterRuntime(fighterPacksInput:readonly RuntimeFighterPack[],entityPacksInput:readonly RuntimeEntityPack[]=[]):RosterRuntime{
  const fighterPacks=[...fighterPacksInput].sort((a,b)=>a.id.localeCompare(b.id));const fighterIds=fighterPacks.map((pack)=>pack.id);if(new Set(fighterIds).size!==fighterIds.length)throw new Error('roster runtime contains duplicate fighter definition ids');
  const entityPacks=[...entityPacksInput].sort((a,b)=>a.fighterId.localeCompare(b.fighterId));const entityDefinitions=compileEntityDefinitionRegistry(entityPacks);
  const attacks=new Map<string,AttackDefinition>();const moveRuntime=new Map<string,MoveRuntimeDefinition>();const moveFollowUps=new Map<string,readonly MoveFollowUpDefinition[]>();const smashCharges=new Map<string,SmashChargePolicy>();const aerialLanding=new Map<string,AerialLandingDefinition>();const spawns=new Map<string,readonly EntitySpawnDefinition[]>();
  for(const pack of fighterPacks){mergeUnique(attacks,compileFighterAttacks(pack),'attack');mergeUnique(moveRuntime,compileFighterMoveRuntime(pack),'move runtime');mergeUnique(moveFollowUps,compileFighterFollowUps(pack),'move follow-up');mergeUnique(smashCharges,compileFighterSmashCharges(pack),'smash charge');mergeUnique(aerialLanding,compileFighterLandingPolicies(pack),'aerial landing policy');mergeUnique(spawns,compileEntitySpawns(pack,entityDefinitions),'entity spawn move');}
  return{fighterDefinitionIds:fighterIds,fighterPhysics:compileFighterPhysicsRegistry(fighterPacks),attacks,grabActions:compileGrabActionRegistry(fighterPacks),moveRuntime,moveFollowUps,smashCharges,aerialLanding,entityDefinitions,entitySpawnsByMoveId:spawns};
}
