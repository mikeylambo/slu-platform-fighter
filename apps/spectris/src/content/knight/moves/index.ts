import { fixed as f } from '../../../../../../packages/deterministic-math/src/fixed.js';
import type { AttackDefinition } from '../../../../../../packages/sim/src/combat.js';
import { GROUND } from './ground.js';
import { WINGS, CAPE } from './aerial.js';
import type { Move } from './types.js';
export const MOVES = new Map<string, Move>();
for (const [stance, aerial] of [['wings',WINGS],['cape',CAPE]] as const) for(const move of [...GROUND,...aerial]) MOVES.set(`${stance}:${move.key}`,move);
export function compileMoves(): Map<string,AttackDefinition> {
 return new Map([...MOVES].map(([id,m]) => [id,{id,totalFrames:m.faf-1,hitboxes:m.strikes.filter(s=>s.strain>0).map((s,i) => ({startFrame:s.start-1,endFrame:s.start+s.active-2,hitbox:{id:`${id}:${i}`,offsetX:f.fromRatio(Math.round(s.x*100),100),offsetY:f.fromRatio(Math.round(s.y*100),100),radius:f.fromRatio(Math.round(s.radius*100),100),damageTenths:s.strain*10,baseKnockback:f.fromRatio(s.kb[0],125),growthPer100Percent:f.fromRatio(s.kb[1],100),directionX:s.direction[0],directionY:s.direction[1],hitlagFrames:Math.min(12,3+Math.floor(s.strain/4)),hitstunFrames:Math.max(8,Math.round(s.strain*1.5)),canClank:true,clankPriority:Math.floor(s.strain/3)}}))}]));
}
export const ATTACKS=compileMoves();
