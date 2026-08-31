import { fixed } from '../../deterministic-math/src/fixed.js';
import { withCombatModifiers, type CombatModifierPolicy } from '../../sim/src/combatModifiers.js';
import { createTwoFighterMatch, type MatchInputFrame, type MatchStepResult } from '../../sim/src/match.js';
import { serializeWorldState, WORLD_BINARY_VERSION } from '../../sim/src/serialize.js';
import type { WorldState } from '../../sim/src/types.js';

function assert(condition:unknown,message:string):asserts condition{if(!condition)throw new Error(`K50 combat-modifier certification failure: ${message}`);}
const neutral=(frame:number):MatchInputFrame=>({frame,byFighterId:{}});
const probe=(state:WorldState,_input:MatchInputFrame):MatchStepResult=>{
  const fighters=state.fighters.map((fighter,index)=>index===0?{...fighter,attack:{attackId:'greybox:jab',frame:1,hitTargets:['fighter-b']}}:fighter);
  const target=fighters[1]!;
  fighters[1]={...target,percentTenths:target.percentTenths+100,vx:fixed.fromInt(4),vy:fixed.fromInt(2)};
  return{state:{...state,frame:state.frame+1,fighters},events:[{type:'hit',attackerId:'fighter-a',targetId:'fighter-b',attackId:'greybox:jab',hitboxId:'jab',damageTenths:100,knockbackX:fixed.fromInt(4),knockbackY:fixed.fromInt(2),hitlagFrames:3,hitstunFrames:10}]};
};
function base(seed:number):WorldState{
  let world=createTwoFighterMatch(seed);
  world={...world,fighters:world.fighters.map((fighter,index)=>index===0?{...fighter,percentTenths:1000,stocks:1,recentAttackIds:['greybox:jab','greybox:jab']}:{...fighter,stocks:3})};
  return world;
}
function hitDamage(result:MatchStepResult):number{const hit=result.events.find((event)=>event.type==='hit');assert(hit?.type==='hit','probe must produce hit event');return hit.damageTenths;}

const stalePolicy:CombatModifierPolicy={stale:{historySize:4,penaltyPermillePerPriorUse:100,maxPenaltyPermille:300}};
const stale=withCombatModifiers(probe,stalePolicy)(base(5001),neutral(0));
assert(hitDamage(stale)===80,'two prior uses at 100 permille each must stale a 100-damage move to 80');
assert(stale.state.fighters[1]!.percentTenths===80,'stale scaling must reconcile already-applied authoritative target percent');

const ragePolicy:CombatModifierPolicy={rage:{startPercentTenths:500,endPercentTenths:1500,maxBonusPermille:200}};
const rage=withCombatModifiers(probe,ragePolicy)(base(5002),neutral(0));
assert(hitDamage(rage)===110,'1000 percent-tenths midway through 500-1500 rage window must add 100 permille');

const comebackPolicy:CombatModifierPolicy={comeback:{bonusPermillePerStockDeficit:100,maxBonusPermille:300}};
const comeback=withCombatModifiers(probe,comebackPolicy)(base(5003),neutral(0));
assert(hitDamage(comeback)===120,'two-stock deficit at 100 permille each must add 200 permille');

const combinedPolicy:CombatModifierPolicy={
  stale:{historySize:3,penaltyPermillePerPriorUse:100,maxPenaltyPermille:300},
  rage:{startPercentTenths:500,endPercentTenths:1500,maxBonusPermille:200},
  comeback:{bonusPermillePerStockDeficit:100,maxBonusPermille:300},
};
const combined=withCombatModifiers(probe,combinedPolicy)(base(5004),neutral(0));
const combinedHit=combined.events.find((event)=>event.type==='hit');
assert(combinedHit?.type==='hit'&&combinedHit.damageTenths===104,'stale factor 800 combined with rage+comeback factor 1300 must yield 1040 permille total output');
assert(combinedHit?.type==='hit'&&combinedHit.knockbackX===fixed.mul(fixed.fromInt(4),fixed.fromRatio(1040,1000)),'combined rules must scale semantic launch as well as damage');
assert(combined.state.fighters[1]!.percentTenths===104&&combined.state.fighters[1]!.vx===combinedHit.knockbackX,'combined event scaling must reconcile authoritative target damage and velocity');
assert(combined.state.fighters[0]!.recentAttackIds?.join(',')==='greybox:jab,greybox:jab,greybox:jab','newly-started attack must append exactly once to bounded recent-move history');

const historyA=base(5005);const historyB={...historyA,fighters:historyA.fighters.map((fighter,index)=>index===0?{...fighter,recentAttackIds:['greybox:jab','greybox:forward-tilt']}:fighter)};
assert(WORLD_BINARY_VERSION===17,'recent-move rollback state must use binary v17');
assert(Buffer.from(serializeWorldState(historyA)).compare(Buffer.from(serializeWorldState(historyB)))!==0,'binary v17 must hash recent attack history differences');

console.log('K50 COMBAT MODIFIERS PASS — stale history, percent-based rage and stock-deficit comeback independently and compositionally scale semantic damage/launch; bounded history is authoritative in binary v17.');
