import type { SmashChargePolicy } from '../../sim/src/smashCharge.js';
interface PackCharge { maxChargeFrames:number; damageBonusPermilleAtMax:number; launchBonusPermilleAtMax:number; }
interface PackMove { charge?:PackCharge; }
interface FighterPackLike { id:string; moves:Readonly<Record<string,PackMove>>; }
export function compileFighterSmashCharges(pack:FighterPackLike):Map<string,SmashChargePolicy>{
  const result=new Map<string,SmashChargePolicy>();
  for(const [moveName,move] of Object.entries(pack.moves).sort(([a],[b])=>a.localeCompare(b))){
    if(!move.charge)continue; const id=`${pack.id}:${moveName}`; const charge=move.charge;
    if(!Number.isInteger(charge.maxChargeFrames)||charge.maxChargeFrames<1)throw new Error(`${id} maxChargeFrames must be positive integer`);
    if(!Number.isInteger(charge.damageBonusPermilleAtMax)||charge.damageBonusPermilleAtMax<0||!Number.isInteger(charge.launchBonusPermilleAtMax)||charge.launchBonusPermilleAtMax<0)throw new Error(`${id} charge bonuses must be nonnegative integer permille`);
    result.set(id,{attackId:id,...charge});
  }
  return result;
}
