import {existsSync,readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {MOVES} from '../dist/apps/spectris/src/content/knight/moves/index.js';
import {PHYSICS} from '../dist/apps/spectris/src/content/knight/physics.js';
const path='reference/brawl-mk.json';
if(!existsSync(path)){console.error('REFERENCE MISSING: import the independently supplied source first.');process.exit(2);}
const ref=JSON.parse(readFileSync(path,'utf8'));
const mapping={jab:'Jab','jab-2':'Jab','jab-3':'Jab (final hit)','rapid-jab':'Jab','forward-tilt':'Forward tilt 1','up-tilt':'Up tilt','down-tilt':'Down tilt','dash-attack':'Dash attack','forward-smash':'Forward Smash','up-smash':'Up Smash','down-smash':'Down Smash','neutral-air':'Neutral air','forward-air':'Forward air','back-air':'Back air','up-air':'Messed Up air','down-air':'Down air'};
if(ref.schemaVersion!==2||!ref.source?.sha256||!ref.moves)throw Error('Expected imported reference schema 2');
const hash=createHash('sha256').update(readFileSync(ref.source.csv)).digest('hex');
if(hash!==ref.source.sha256)throw Error('Raw source changed: rerun reference importer and review differences.');
const number=s=>/^\d+$/.test(s??'')?Number(s):null;
const comparisons=[];
for(const [id,m] of MOVES){
 const sourceName=mapping[m.key],source=ref.moves[sourceName];if(!source)throw Error(`Missing source mapping for ${id}`);
 const r=source.rows[0];
 const baseline={startup:Number(r.active.match(/^\d+/)?.[0]),faf:number(r.faf),landing:number(r.landing)};
 if(!Number.isFinite(baseline.startup))throw Error(`Unparseable startup for ${sourceName}`);
 const actual={startup:m.strikes[0].start,faf:m.faf,landing:m.landing};
 const delta=Object.fromEntries(Object.keys(actual).map(k=>[k,baseline[k]===null?null:actual[k]-baseline[k]]));
 const differentStructure=['jab','jab-2','jab-3','rapid-jab','forward-tilt','neutral-air','back-air'].includes(m.key)||id.startsWith('cape:')&&m.landing>0;
 comparisons.push({id,sourceName,sourceRow:source.sourceRow,sourceTiming:baseline,spectrisTiming:actual,delta,comparison:differentStructure?'Role comparison only: different strike structure or stance kit':'Timing comparison; not a claim of equal range or knockback',notes:r.faf.includes('*')?'Source FAF has a footnote; numeric comparison deliberately omitted.':null});
}
const movement=[['run','Dash',PHYSICS.run],['walk','Walk',PHYSICS.walk],['gravity','Gravity',PHYSICS.gravity],['airAcceleration','Air accel',PHYSICS.airAccel],['wingsAirSpeed','Air speed',PHYSICS.wings.air],['capeAirSpeed','Air speed',PHYSICS.cape.air],['wingsFall','Fall speed',PHYSICS.wings.fall],['wingsFastFall','Fast fall',PHYSICS.wings.fast],['jumpSquat','Jumpsquat',PHYSICS.squat]].map(([key,sourceKey,value])=>({key,source:Number.parseFloat(ref.attributes[sourceKey].value),spectris:value}));
const report={source:ref.source,comparisons,movement,status:'Reference comparison complete; GDD move contracts are certified separately; human controller feel remains unverified',limitations:['Source measurements are distinct from Spectris design targets.','No acceptance ranges are derived from the implementation.','Jab chains, combined forward tilt and redesigned aerials are role comparisons, not identical moves.','Source footnotes and full glide physics require further review.']};
writeFileSync('apps/spectris/proofs/reference-comparison.json',JSON.stringify(report,null,2)+'\n');
const lines=['# Brawl reference comparison','',`Source: [${ref.source.title}](${ref.source.url}), Meta Knight tab. Snapshot: ${ref.source.retrieved}.`,'','All timings are one-based. Deltas are Spectris minus Brawl. A dash means no unambiguous comparable numeric source value.','', '| Move | Startup (ours / Brawl) | FAF (ours / Brawl) | Landing (ours / Brawl) |','| --- | --- | --- | --- |',...comparisons.map(c=>`| ${c.id} | ${c.spectrisTiming.startup} / ${c.sourceTiming.startup} | ${c.spectrisTiming.faf} / ${c.sourceTiming.faf??'—'} | ${c.spectrisTiming.landing} / ${c.sourceTiming.landing??'—'} |`),'','## Movement','', '| Attribute | Spectris | Brawl |','| --- | --- | --- |',...movement.map(m=>`| ${m.key} | ${m.spectris} | ${m.source} |`),'','## Interpretation','','The GDD intentionally defines a different kit. Source timings are evidence, not automatic replacement values. Wings prioritizes aerial pressure and shorter landing recovery; Cape has slower commitment and heavier attacks. Keep both sets distinguishable during playtesting.','','The compiled FAF conversion was one frame late. It now releases after FAF minus one frames so a new action is available on the authored FAF. Regression checks exercise every authored move through the real simulation.','','## Remaining acceptance work','','GDD role contracts are exercised separately by spectris-certify.mjs. This reference comparison does not certify subjective movement feel, glide pitch, or target hardware performance.'];
writeFileSync('apps/spectris/REFERENCE_COMPARISON.md',lines.join('\n')+'\n');
console.log(`REFERENCE COMPARISON PASS: ${comparisons.length} move entries, ${movement.length} movement comparisons; CSV checksum verified.`);
console.log('Controller feel and target hardware remain unverified; this script certifies only source integrity and comparison coverage.');
