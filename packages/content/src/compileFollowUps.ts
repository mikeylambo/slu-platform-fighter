export type FollowUpInput = 'attack' | 'special';
export interface MoveFollowUpDefinition { moveId:string; input:FollowUpInput; startFrame:number; endFrame:number; nextMoveId:string; requireContact:boolean; }
interface PackFollowUp { input:FollowUpInput; startFrame:number; endFrame:number; nextMove:string; requireContact:boolean; }
interface PackMove { totalFrames:number; followUps?:readonly PackFollowUp[]; }
interface FighterPackLike { id:string; moves:Readonly<Record<string,PackMove>>; }
export function compileFighterFollowUps(pack:FighterPackLike):Map<string,readonly MoveFollowUpDefinition[]>{
  const result=new Map<string,readonly MoveFollowUpDefinition[]>();
  for(const [moveName,move] of Object.entries(pack.moves).sort(([a],[b])=>a.localeCompare(b))){
    if(!move.followUps?.length)continue; const moveId=`${pack.id}:${moveName}`; const compiled:MoveFollowUpDefinition[]=[];
    for(const raw of move.followUps){
      if(!Number.isInteger(raw.startFrame)||!Number.isInteger(raw.endFrame)||raw.startFrame<0||raw.endFrame<raw.startFrame||raw.endFrame>=move.totalFrames)throw new Error(`${moveId} follow-up window must lie within move frames`);
      if(!pack.moves[raw.nextMove])throw new Error(`${moveId} follow-up references missing move ${raw.nextMove}`);
      compiled.push({moveId,input:raw.input,startFrame:raw.startFrame,endFrame:raw.endFrame,nextMoveId:`${pack.id}:${raw.nextMove}`,requireContact:raw.requireContact});
    }
    compiled.sort((a,b)=>a.startFrame-b.startFrame||a.endFrame-b.endFrame||a.input.localeCompare(b.input)||a.nextMoveId.localeCompare(b.nextMoveId)); result.set(moveId,compiled);
  }
  return result;
}
