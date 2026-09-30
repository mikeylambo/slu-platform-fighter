import {existsSync,readFileSync} from 'node:fs';
import {MOVES} from '../dist/apps/spectris/src/content/knight/moves/index.js';
const path='reference/brawl-mk.json';
if(!existsSync(path)){console.error('FEEL GATE BLOCKED: reference/brawl-mk.json was not supplied. GDD timing checks are not the requested independent Brawl role budgets. Step 2 is not certified.');process.exit(2);}
const ref=JSON.parse(readFileSync(path,'utf8'));
if(ref.schemaVersion!==1||typeof ref.source!=='string'||!ref.budgets){console.error('Reference needs schemaVersion:1, source attribution, and independently authored budgets. See apps/spectris/REFERENCE_FORMAT.md.');process.exit(2);}
const failures=[];
for(const [id,m]of MOVES){const budget=ref.budgets[id];if(!budget){failures.push(`${id}: missing budget`);continue;}for(const [key,value]of Object.entries({startup:m.strikes[0].start,faf:m.faf,landing:m.landing})){const range=budget[key];if(!Array.isArray(range)||range.length!==2||!range.every(Number.isFinite)||range[0]>range[1])failures.push(`${id}.${key}: invalid inclusive [min,max]`);else if(value<range[0]||value>range[1])failures.push(`${id}.${key}: ${value} outside ${range}`);}}
if(failures.length){console.error(failures.join('\n'));process.exit(1);}console.log(`FRAME BUDGET CERT PASS: ${MOVES.size} move entries compared with ${ref.source}`);
