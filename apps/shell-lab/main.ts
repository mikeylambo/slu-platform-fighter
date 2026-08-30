import greybox from '../../fighters/greybox/fighter.json' with { type: 'json' };
import bruiser from '../../fighters/cert-bruiser/fighter.json' with { type: 'json' };
import stage from '../../stages/greybox/stage.json' with { type: 'json' };
import { PlatformFighterShell } from '../../packages/shell/src/session.js';
import { createDefaultPlayerProfile } from '../../packages/shell/src/profile.js';

const fighters = [greybox, bruiser];
const shell = new PlatformFighterShell({ fighterIds: fighters.map((f) => f.id), stageIds: [stage.id], rulesetIds: ['stock', 'time', 'stock-time'], paletteIdsByFighter: Object.fromEntries(fighters.map((f) => [f.id, ['00','01','02','03']])) });
const profile = createDefaultPlayerProfile('shell-lab');
const app = document.querySelector<HTMLDivElement>('#app')!;
let phase: 'title'|'main'|'fighter'|'stage'|'results'|'settings'|'replays' = 'title';
let selected: [string,string] = [fighters[0]!.id, fighters[1]!.id]; let rule='stock';
function nav(next: typeof phase){phase=next;render()}
function button(label:string,next:()=>void){return `<button data-action="${label}">${label}</button>`}
function bind(label:string,fn:()=>void){app.querySelector<HTMLButtonElement>(`[data-action="${label}"]`)?.addEventListener('click',fn)}
function render(){
  if(phase==='title'){app.innerHTML=`<div class="top"><h1>SLU Platform Fighter</h1><small>Shell Lab</small></div><p>Renderer-independent shell contract rendered as a browser UI proof.</p>${button('Start',()=>{})}`;bind('Start',()=>nav('main'));return}
  if(phase==='main'){app.innerHTML=`<h1>Main Menu</h1>${button('Local Versus',()=>{})}${button('Training',()=>{})}${button('Squad / Crew',()=>{})}${button('Challenges',()=>{})}${button('Adventure',()=>{})}${button('Replays',()=>{})}${button('Settings',()=>{})}`; bind('Local Versus',()=>{shell.startLocalVersusSetup();nav('fighter')});bind('Training',()=>{shell.startTrainingSetup();nav('fighter')});bind('Replays',()=>nav('replays'));bind('Settings',()=>nav('settings'));for(const x of ['Squad / Crew','Challenges','Adventure'])bind(x,()=>nav('fighter'));return}
  if(phase==='fighter'){app.innerHTML=`<h1>Fighter Select</h1><div class="cards">${[0,1].map((slot)=>`<div class="card"><h3>Player ${slot+1}</h3>${fighters.map(f=>`<button data-fighter="${slot}:${f.id}" class="${selected[slot]===f.id?'active':''}">${f.identity.displayName}</button>`).join('')}</div>`).join('')}</div>${button('Continue',()=>{})}${button('Back',()=>{})}`; app.querySelectorAll<HTMLButtonElement>('[data-fighter]').forEach(el=>el.addEventListener('click',()=>{const [s,id]=el.dataset.fighter!.split(':');selected[Number(s) as 0|1]=id!;render()}));bind('Continue',()=>nav('stage'));bind('Back',()=>nav('main'));return}
  if(phase==='stage'){app.innerHTML=`<h1>Stage & Rules</h1><div class="card"><h3>${stage.identity.displayName}</h3><p>${stage.surfaces.length} surfaces • ${stage.ledges.length} ledges</p></div><label>Rules <select id="rules"><option>stock</option><option>time</option><option>stock-time</option></select></label><br>${button('Launch Match',()=>{})}${button('Back',()=>{})}`;const select=app.querySelector<HTMLSelectElement>('#rules')!;select.value=rule;select.onchange=()=>rule=select.value;bind('Launch Match',()=>nav('results'));bind('Back',()=>nav('fighter'));return}
  if(phase==='results'){app.innerHTML=`<h1>Results</h1><p>${fighters.find(f=>f.id===selected[0])!.identity.displayName} vs ${fighters.find(f=>f.id===selected[1])!.identity.displayName}</p><pre>${JSON.stringify({fighters:selected,stage:stage.id,rules:rule},null,2)}</pre>${button('Rematch',()=>{})}${button('Fighter Select',()=>{})}${button('Main Menu',()=>{})}`;bind('Rematch',()=>nav('results'));bind('Fighter Select',()=>nav('fighter'));bind('Main Menu',()=>nav('main'));return}
  if(phase==='settings'){app.innerHTML=`<h1>Settings / Accessibility</h1><div class="card"><label>Screen shake <input id="shake" type="range" min="0" max="1000" value="${profile.accessibility.screenShakeScalePermille}"></label><br><label><input id="flash" type="checkbox"> Reduce rapid flashes</label><br><label><input id="contrast" type="checkbox"> High contrast HUD</label></div>${button('Back',()=>{})}`;bind('Back',()=>nav('main'));return}
  app.innerHTML=`<h1>Replay Browser</h1><p>Replay format and deterministic seek are certified; this surface is ready for indexed replay metadata.</p>${button('Back',()=>{})}`;bind('Back',()=>nav('main'));
}
render();
