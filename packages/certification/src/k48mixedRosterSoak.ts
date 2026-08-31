import { createHash } from 'node:crypto';
import { compileRosterRuntime } from '../../content/src/compileRosterRuntime.js';
import { ALL_FIGHTER_PACKS } from '../../content/src/generated/fighterRegistry.js';
import { cpuInputsForWorld } from '../../sim/src/cpu.js';
import { assertWorldInvariants } from '../../sim/src/invariants.js';
import { createTwoFighterMatch, stepMatchWorld } from '../../sim/src/match.js';
import { serializeWorldState } from '../../sim/src/serialize.js';
import type { WorldState } from '../../sim/src/types.js';

function assert(condition:unknown,message:string):asserts condition{if(!condition)throw new Error(`K48 mixed-roster soak certification failure: ${message}`);}
function numberArg(name:string,fallback:number):number{const prefix=`--${name}=`;const raw=process.argv.find((arg)=>arg.startsWith(prefix))?.slice(prefix.length);if(raw===undefined)return fallback;const value=Number(raw);if(!Number.isInteger(value)||value<1)throw new Error(`${name} must be positive integer`);return value;}
function hash(state:WorldState):string{return createHash('sha256').update(serializeWorldState(state)).digest('hex');}

const ROUNDS=numberArg('rounds',2);
const MAX_FRAMES=numberArg('frames',300);
const fighterPacks=[...ALL_FIGHTER_PACKS].sort((a,b)=>a.id.localeCompare(b.id));
assert(fighterPacks.length>=2,'mixed-roster soak requires at least two fighter packs');
const runtime=compileRosterRuntime(fighterPacks);
const ids=fighterPacks.map((pack)=>pack.id);
const pairs:[string,string][]=[];
for(let a=0;a<ids.length;a+=1)for(let b=a;b<ids.length;b+=1)pairs.push([ids[a]!,ids[b]!]);
const participantIds=['fighter-a','fighter-b'] as const;

function run(pair:readonly [string,string],seed:number):{state:WorldState;frames:number}{
  let world=createTwoFighterMatch(seed);
  world={...world,fighters:world.fighters.map((fighter,index)=>({...fighter,definitionId:pair[index]??pair[0]}))};
  assertWorldInvariants(world);
  let frames=0;
  while(frames<MAX_FRAMES&&world.winnerId===null){
    const byFighterId=cpuInputsForWorld(world,participantIds);
    world=stepMatchWorld(world,{frame:world.frame,byFighterId},runtime.attacks,'__no-global-default-attack__',undefined,runtime.grabActions,undefined,runtime.entityDefinitions,runtime.entitySpawnsByMoveId,runtime.moveRuntime,runtime.fighterPhysics).state;
    assertWorldInvariants(world);
    frames+=1;
  }
  return{state:world,frames};
}

let totalFrames=0;let matchCount=0;const samples:{pair:[string,string];seed:number;frames:number;hash:string}[]=[];
for(let pairIndex=0;pairIndex<pairs.length;pairIndex+=1){const pair=pairs[pairIndex]!;for(let round=0;round<ROUNDS;round+=1){const seed=(0x4b_48_0000+pairIndex*1009+round*7919)>>>0;const result=run(pair,seed);totalFrames+=result.frames;matchCount+=1;if(samples.length<Math.min(8,pairs.length*ROUNDS))samples.push({pair,seed,frames:result.frames,hash:hash(result.state)});}}
for(const sample of samples){const replay=run(sample.pair,sample.seed);assert(replay.frames===sample.frames,`${sample.pair.join(' vs ')} replay frame count diverged`);assert(hash(replay.state)===sample.hash,`${sample.pair.join(' vs ')} replay hash diverged`);}
assert(matchCount===pairs.length*ROUNDS,'every unordered roster matchup must execute requested deterministic repeats');
assert(totalFrames>=matchCount,'mixed roster soak must simulate at least one frame per matchup run');
console.log(`K48 MIXED ROSTER SOAK PASS — ${ids.length} fighters / ${pairs.length} unordered matchups / ${matchCount} runs / ${totalFrames} frames; ${samples.length} sampled runs replay bit-identically.`);
