import ts from 'typescript';
import {readdirSync,readFileSync} from 'node:fs';
import path from 'node:path';
const files=[];function walk(dir){for(const e of readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())walk(p);else if(p.endsWith('.ts'))files.push(p);}}
walk('apps/spectris/src');walk('packages/stance/src');let problems=0;
for(const file of files){const source=ts.createSourceFile(file,readFileSync(file,'utf8'),ts.ScriptTarget.ES2022,true);const pure=/src\/(game|content)\/|packages\/stance/.test(file);function visit(n){if(n.kind===ts.SyntaxKind.AnyKeyword){console.error(`${file}: avoid untyped any`);problems++;}if(pure&&ts.isPropertyAccessExpression(n)&&['Math.random','Date.now','performance.now','window.localStorage'].includes(n.getText(source))){console.error(`${file}: platform/nondeterministic API in sim`);problems++;}ts.forEachChild(n,visit);}visit(source);}
if(problems)process.exit(1);console.log(`SPECTRIS LINT PASS — ${files.length} files; typed content and pure simulation`);
