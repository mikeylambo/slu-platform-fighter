import { access, readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
const id=process.argv[2]; if(!id) throw new Error('Usage: npm run stage:handoff -- <stage-id>'); const dir=resolve('stages',id); await access(dir); const stage=JSON.parse(await readFile(join(dir,'stage.json'),'utf8'));
const blockers={
 engine:[],
 authoring:[...(stage.identity?.description?.includes('Seeded from')?['identity/description still seeded baseline']:[]),...(stage.surfaces?.length?[]:['no surfaces']),...(stage.spawns?.length>=4?[]:['fewer than four spawns']),...(stage.ledges?.length?[]:['no ledges'])],
 presentation:[...(stage.provenance?.assets?.length?[]:['no presentation assets/provenance recorded'])],
 certification:[stage.status==='release'?[]:[`stage status is ${stage.status}`]],
};
console.log(`\n${stage.identity?.displayName??id} — stage production handoff\n`); for(const [name,items] of Object.entries(blockers)){console.log(`${name.toUpperCase()}: ${items.length?'WAITING':'READY'}`);for(const item of items)console.log(`  - ${item}`)} console.log(`\nENGINE HANDOFF: ${blockers.engine.length?'FAIL':'PASS — stage requires no stage-specific kernel code.'}`);
