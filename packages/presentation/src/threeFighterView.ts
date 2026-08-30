import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { fixed, type Fixed } from '../../deterministic-math/src/fixed.js';
import type { CompiledRenderDefinition } from '../../content/src/compileRender.js';
import type { AnimationIntent } from './animationResolver.js';

export interface ThreeFighterViewOptions {
  /** Optional resolver for fighter-relative model URLs in a Vite/host environment. */
  resolveModelUrl?: (definition: CompiledRenderDefinition) => string;
  loader?: GLTFLoader;
}

export interface FighterPresentationPose {
  x: Fixed;
  y: Fixed;
  facing: -1 | 1;
}

/**
 * Generic web-lab adapter for a 3D fighter render pack. Gameplay never reads
 * from this object. Position/facing and animation time are driven exclusively
 * from authoritative simulation state, so rollback/replay can seek presentation.
 */
export class ThreeFighterView {
  readonly root = new THREE.Group();
  private readonly definition: CompiledRenderDefinition;
  private readonly loader: GLTFLoader;
  private readonly resolveModelUrl: (definition: CompiledRenderDefinition) => string;
  private mixer: THREE.AnimationMixer | null = null;
  private readonly clipsByName = new Map<string, THREE.AnimationClip>();
  private currentRole: string | null = null;
  private currentAction: THREE.AnimationAction | null = null;
  private model: THREE.Object3D | null = null;

  constructor(definition: CompiledRenderDefinition, options: ThreeFighterViewOptions = {}) {
    this.definition = definition;
    this.loader = options.loader ?? new GLTFLoader();
    this.resolveModelUrl = options.resolveModelUrl ?? ((value) => value.model);
    this.root.name = `fighter-view:${definition.fighterId}`;
  }

  async load(): Promise<void> {
    const gltf = await this.loader.loadAsync(this.resolveModelUrl(this.definition));
    this.model = gltf.scene;
    this.model.name = `${this.definition.fighterId}:model`;
    this.model.scale.setScalar(this.definition.scale);
    this.root.add(this.model);
    this.mixer = new THREE.AnimationMixer(this.model);
    this.clipsByName.clear();
    for (const clip of gltf.animations) this.clipsByName.set(clip.name, clip);
    this.assertDeclaredClips();
  }

  get loaded(): boolean { return this.model !== null && this.mixer !== null; }

  private assertDeclaredClips(): void {
    for (const binding of this.definition.animations.values()) {
      if (binding.grade === 'procedural' || binding.grade === 'author_required') continue;
      if (!this.clipsByName.has(binding.clip)) throw new Error(`${this.definition.fighterId} animation role ${binding.role} references missing GLB clip ${binding.clip}`);
    }
  }

  /** Authoritative transform projection. The model is never allowed to drive gameplay position. */
  setPose(pose: FighterPresentationPose): void {
    this.root.position.set(fixed.toNumber(pose.x), fixed.toNumber(pose.y), 0);
    const authoredSign = this.definition.authoredFacing === 'right' ? 1 : -1;
    this.root.scale.x = authoredSign * pose.facing;
  }

  /**
   * Seeks a semantic clip by simulation frame. We intentionally do not call
   * mixer.update(realDelta): wall-clock animation time must not become authoritative.
   */
  setAnimation(intent: AnimationIntent): void {
    if (!this.mixer) throw new Error(`${this.definition.fighterId} view must be loaded before animation playback`);
    const binding = this.definition.animations.get(intent.role);
    if (!binding) return;
    if (binding.grade === 'procedural' || binding.grade === 'author_required' || !binding.clip) return;
    const clip = this.clipsByName.get(binding.clip);
    if (!clip) throw new Error(`${this.definition.fighterId} missing loaded clip ${binding.clip}`);

    if (this.currentRole !== intent.role || this.currentAction === null) {
      this.currentAction?.stop();
      const action = this.mixer.clipAction(clip);
      action.enabled = true;
      action.setLoop((binding.loop || intent.loop) ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
      action.clampWhenFinished = !(binding.loop || intent.loop);
      action.play();
      this.currentAction = action;
      this.currentRole = intent.role;
    }

    const rawTime = Math.max(0, intent.frame) / 60 * binding.speed;
    const duration = clip.duration > 0 ? clip.duration : 1 / 60;
    const looping = binding.loop || intent.loop;
    this.currentAction.time = looping ? rawTime % duration : Math.min(rawTime, Math.max(0, duration - 1e-6));
    // Evaluate the action exactly at the requested simulation-derived time.
    this.mixer.update(0);
  }

  dispose(): void {
    if (this.mixer && this.model) this.mixer.uncacheRoot(this.model);
    this.root.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const material = mesh.material;
      if (Array.isArray(material)) for (const entry of material) entry.dispose();
      else material?.dispose();
    });
    this.root.clear();
    this.model = null;
    this.mixer = null;
    this.currentAction = null;
    this.currentRole = null;
    this.clipsByName.clear();
  }
}
