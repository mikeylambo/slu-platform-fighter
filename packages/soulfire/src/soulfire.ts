export interface SoulfirePack { duration:number; activation:number; cost:number; guardChip:number; freeFeints:boolean; }
export interface SoulfireState { remaining:number; activating:number; freeFlash:boolean; }
export const emptySoulfire=():SoulfireState=>({remaining:0,activating:0,freeFlash:false});
export function ignite(pack:SoulfirePack,meter:number):{state:SoulfireState;meter:number}|null{return meter<pack.cost?null:{state:{remaining:pack.duration,activating:pack.activation,freeFlash:true},meter:meter-pack.cost};}
export function tickSoulfire(s:SoulfireState):SoulfireState{return {...s,remaining:Math.max(0,s.remaining-1),activating:Math.max(0,s.activating-1)};}
