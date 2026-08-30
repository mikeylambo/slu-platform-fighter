import { compileMoveAnimationRoles, compileRenderDefinition } from '../../content/src/compileRender.js';
import { resolveFighterAnimation } from '../../presentation/src/animationResolver.js';
import { createFighterState } from '../../sim/src/world.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`K22 animation certification failure: ${message}`);
}

const render = compileRenderDefinition({
  fighterId: 'anim-test', model: 'fighter.glb', armature: 'Armature', rigProfile: 'slu-humanoid-v1', scale: 1, facing: 'right',
  materials: { primary: 'Primary', secondary: 'Secondary', accent: 'Accent', skin: 'Skin', hair: 'Hair', metal: 'Metal', energy: 'Energy' },
  sockets: { hand_r: 'Hand.R', hand_l: 'Hand.L' },
  animations: {
    idle: { clip: 'Idle', grade: 'retargeted', loop: true },
    forward_air: { clip: 'Attack_FAir', grade: 'dedicated', speed: 1.25 },
    forward_throw: { clip: 'Throw_F', grade: 'dedicated' },
  },
});
assert(render.animations.get('idle')?.clip === 'Idle' && render.animations.get('idle')?.loop === true, 'render compiler must preserve semantic role to GLB clip binding');
assert(render.animations.get('forward_air')?.speed === 1.25, 'render compiler must preserve presentation playback speed');

const moveRoles = compileMoveAnimationRoles('anim-test', {
  forwardAir: { animationRole: 'forward_air' },
  forwardThrow: { animationRole: 'forward_throw' },
});
const grabRoles = new Map([['anim-test:forwardThrow', 'forward_throw']]);

let fighter = createFighterState('p1', 0 as never, 1, 'anim-test');
let intent = resolveFighterAnimation(fighter, { attackRoleById: moveRoles, grabActionRoleById: grabRoles });
assert(intent.role === 'idle' && intent.loop, 'idle simulation state must resolve to looping idle role');

fighter = { ...fighter, attack: { attackId: 'anim-test:forwardAir', frame: 7, hitTargets: [] }, grounded: false };
intent = resolveFighterAnimation(fighter, { attackRoleById: moveRoles, grabActionRoleById: grabRoles });
assert(intent.role === 'forward_air' && intent.frame === 7 && !intent.loop, 'authored attack must resolve its fighter-pack animation role and exact sim frame');

fighter = { ...fighter, attack: null, grabTargetId: 'p2', grabAction: { actionId: 'anim-test:forwardThrow', frame: 3 } };
intent = resolveFighterAnimation(fighter, { attackRoleById: moveRoles, grabActionRoleById: grabRoles });
assert(intent.role === 'forward_throw' && intent.frame === 3, 'authored grab action must resolve independently from attack roles');

fighter = { ...fighter, grabTargetId: null, grabAction: null, hitstunFrames: 12, shieldHealth: 0, grounded: true };
intent = resolveFighterAnimation(fighter);
assert(intent.role === 'shield_break', 'shield-break presentation must outrank generic hitstun');

fighter = { ...fighter, shieldHealth: 600, hitstunFrames: 8, grounded: false };
intent = resolveFighterAnimation(fighter);
assert(intent.role === 'tumble', 'airborne hitstun must resolve to tumble presentation');

console.log('K22 ANIMATION PASS — renderer-neutral GLB bindings and semantic sim-to-animation role resolution are content-driven and frame-addressable.');
