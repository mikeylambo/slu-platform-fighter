import { fixed } from '../../deterministic-math/src/fixed.js';
import type { AttackDefinition } from '../../sim/src/combat.js';
import { withUniversalLocomotion } from '../../sim/src/universalLocomotion.js';
import { createFighterState, createWorld } from '../../sim/src/world.js';
import type { MatchInputFrame, MatchStepResult } from '../../sim/src/match.js';
import type { WorldState } from '../../sim/src/types.js';
import type { StageWallDefinition } from '../../content/src/compileStage.js';

function assert(condition:unknown,message:string):asserts condition{if(!condition)throw new Error(`K36 universal-locomotion certification failure: ${message}`)}
function input(frame:number,patch:Record<string,unknown>={}){return {frame,moveX:0,moveY:0,jumpPressed:false,jumpHeld:false,attackPressed:false,specialPressed:false,grabPressed:false,smashX:0,smashY:0,dodgePressed:false,shieldHeld:false,...patch} as any;}
const ledge={id:'right',x:fixed.fromInt(5),y:fixed.zero,inward:-1 as const}; const ground={id:'ground',kind:'solid' as const,y:fixed.zero,xMin:fixed.fromInt(-5),xMax:fixed.fromInt(5)};
const ledgeAttack:AttackDefinition={id:'greybox:ledge-attack',totalFrames:20,hitboxes:[]}; const attacks=new Map([[ledgeAttack.id,ledgeAttack]]);
let captured:WorldState|null=null;
const probe=(state:WorldState,_input:MatchInputFrame):MatchStepResult=>{captured=structuredClone(state);return{state:{...state,frame:state.frame+1},events:[]}};
let world=createWorld(1); world={...world,surfaces:[ground],ledges:[ledge],fighters:[{...createFighterState('p1',fixed.fromInt(5),-1,'greybox'),x:fixed.fromInt(5),y:fixed.sub(fixed.zero,fixed.fromRatio(7,10)),grounded:false,groundSurfaceId:null,locomotion:'ledge-hang',ledgeId:'right'}]};
let step=withUniversalLocomotion(probe,[],attacks,{wallJumpEnabled:true,wallClingEnabled:false});
step(world,{frame:0,byFighterId:{p1:input(0,{attackPressed:true})}}); const ledgeAttackState=(captured as WorldState).fighters[0]!; assert(ledgeAttackState.grounded&&ledgeAttackState.ledgeId===null&&ledgeAttackState.attack?.attackId==='greybox:ledge-attack','ledge attack input must move fighter onto stage and seed authored ledge attack');
step(world,{frame:0,byFighterId:{p1:input(0,{dodgePressed:true})}}); const roll=(captured as WorldState).fighters[0]!; assert(roll.locomotion==='roll'&&roll.vx<0&&roll.invulnerableFrames>0,'ledge dodge must become inward ledge roll with authored universal invulnerability');
step(world,{frame:0,byFighterId:{p1:input(0,{moveX:-1000})}}); const getup=(captured as WorldState).fighters[0]!; assert(getup.locomotion==='idle'&&getup.grounded&&getup.x<ledge.x,'inward stick must perform neutral getup onto stage');

const wall:StageWallDefinition={id:'right-wall',x:fixed.fromInt(4),yMin:fixed.fromInt(-2),yMax:fixed.fromInt(8),normal:-1};
const wallInner=(state:WorldState,_input:MatchInputFrame):MatchStepResult=>({state:{...state,frame:state.frame+1,fighters:state.fighters.map((f)=>({...f,x:fixed.fromInt(5),y:fixed.fromInt(2),grounded:false,vy:fixed.sub(fixed.zero,fixed.fromRatio(1,5))}))},events:[]});
world={...createWorld(2),fighters:[{...createFighterState('p1',fixed.fromInt(3),1,'greybox'),y:fixed.fromInt(2),grounded:false,groundSurfaceId:null,locomotion:'airborne'}]};
step=withUniversalLocomotion(wallInner,[wall],new Map(),{wallJumpEnabled:true,wallClingEnabled:false}); const jumped=step(world,{frame:0,byFighterId:{p1:input(0,{jumpPressed:true,moveX:1000})}}).state.fighters[0]!; assert(jumped.x===wall.x&&jumped.vx<0&&jumped.vy>0&&jumped.facing===-1,'wall jump must clamp contact and launch away/up according to wall normal');
step=withUniversalLocomotion(wallInner,[wall],new Map(),{wallJumpEnabled:false,wallClingEnabled:true}); const cling=step(world,{frame:0,byFighterId:{p1:input(0,{moveX:1000})}}).state.fighters[0]!; assert(cling.x===wall.x&&cling.vx===fixed.zero&&cling.vy>=fixed.sub(fixed.zero,fixed.fromRatio(1,10)),'wall cling must clamp wallward motion and limit fall speed');

const landingInner=(state:WorldState,_input:MatchInputFrame):MatchStepResult=>({state:{...state,frame:state.frame+1,fighters:state.fighters.map((f)=>({...f,y:fixed.zero,grounded:true,groundSurfaceId:'ground',vy:fixed.zero,locomotion:'idle'}))},events:[]});
world={...createWorld(3),surfaces:[ground],fighters:[{...createFighterState('p1',fixed.zero,1,'greybox'),y:fixed.fromInt(1),grounded:false,groundSurfaceId:null,locomotion:'airborne',vy:fixed.sub(fixed.zero,fixed.fromRatio(1,2))}]};
step=withUniversalLocomotion(landingInner,[],new Map(),{wallJumpEnabled:true,wallClingEnabled:false}); const landed=step(world,{frame:0,byFighterId:{p1:input(0)}}).state.fighters[0]!; assert(landed.locomotion==='landing'&&landed.landingLagFrames>=8,'high-speed ordinary landing must enter universal hard-landing recovery');
console.log('K36 UNIVERSAL LOCOMOTION PASS — ledge getup/roll/authored attack, wall collision/jump/cling and hard-landing recovery are universal stage/input policies without fighter-specific engine code.');
