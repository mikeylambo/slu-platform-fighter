import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {MOVES,ATTACKS} from '../dist/apps/spectris/src/content/knight/moves/index.js';
import {registerDuelMoves} from '../dist/apps/spectris/src/content/knight/moves/special.js';
registerDuelMoves();
// Contracts come from GDD §3.8; source comparisons remain independently reported.
const ground={jab:[2,18],'jab-2':[2,18],'jab-3':[4,18],'forward-tilt':[5,30],'up-tilt':[6,26],'down-tilt':[4,16],'dash-attack':[7,34],'forward-smash':[14,48],'up-smash':[10,44],'down-smash':[7,40]};
const aerial={wings:{'neutral-air':[4,8],'forward-air':[5,9],'back-air':[6,10],'up-air':[3,7],'down-air':[5,12]},cape:{'neutral-air':[8,14],'forward-air':[10,18],'back-air':[9,14],'up-air':[9,15],'down-air':[7,12]}};
let contracts=0;for(const [id,m]of MOVES){const [stance,key]=id.split(':');assert(m.faf>1&&m.faf<=120,`${id}: commitment outside 120f cap`);for(const strike of m.strikes){assert(strike.start>=1&&strike.active>=1);assert(strike.start+strike.active-1<m.faf,`${id}: active frame after FAF`);assert(strike.strain>=0&&strike.strain<=24);}const g=ground[key];if(g){assert.equal(m.strikes[0].start,g[0],id+' GDD startup');assert.equal(m.faf,g[1],id+' GDD FAF');contracts++;}const a=aerial[stance]?.[key];if(a){assert.equal(m.strikes[0].start,a[0],id+' GDD startup');assert.equal(m.landing,a[1],id+' GDD landing');contracts++;}assert.equal(ATTACKS.get(id).totalFrames,m.faf-1);}
const report={moves:MOVES.size,gddTimingContracts:contracts,policy:'GDD §3.8 exact authored startup/FAF/landing targets for named normal moves; specials bounded to 24 Strain and 120f commitment with all hit windows before FAF. Brawl source deltas are comparisons, not claims of identical feel.',hardwareFeelValidated:false};writeFileSync('apps/spectris/proofs/move-certification.json',JSON.stringify(report,null,2)+'\n');console.log('MOVE CONTRACT PASS',report.moves,'entries;',contracts,'GDD timing contracts');
