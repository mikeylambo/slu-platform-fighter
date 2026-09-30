import { fixed as f } from '../../../../../packages/deterministic-math/src/fixed.js';
import type { StageSurface, StageLedge } from '../../../../../packages/sim/src/types.js';
import { DEFAULT_STOCK_MATCH_RULES } from '../../../../../packages/sim/src/lifecycle.js';
export const SANCTUM = { id:'mirror-sanctum',name:'Mirror Sanctum',width:32,blast:[44.8,44.8,40,28],spawn:[-7,7] } as const;
export const SURFACES: StageSurface[] = [
 {id:'ground',kind:'solid',xMin:f.fromInt(-16),xMax:f.fromInt(16),y:f.zero},
 {id:'left',kind:'one-way',xMin:f.fromInt(-11),xMax:f.fromInt(-5),y:f.fromInt(6)},
 {id:'right',kind:'one-way',xMin:f.fromInt(5),xMax:f.fromInt(11),y:f.fromInt(6)},
 {id:'crown',kind:'one-way',xMin:f.fromInt(-3),xMax:f.fromInt(3),y:f.fromInt(11)},
];
export const LEDGES: StageLedge[] = [{id:'left',x:f.fromInt(-16),y:f.zero,inward:1},{id:'right',x:f.fromInt(16),y:f.zero,inward:-1}];
// Infinite stocks at the feel gate; these are training resets, not the Fracture ruleset.
export const STOCK_RULES = {...DEFAULT_STOCK_MATCH_RULES,blastLeft:f.fromRatio(-224,5),blastRight:f.fromRatio(224,5),blastTop:f.fromInt(40),blastBottom:f.fromInt(-28),respawnFrames:45,respawnInvulnerableFrames:90,finiteStocks:false};
