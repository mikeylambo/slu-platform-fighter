import * as T from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { Pass } from 'three/addons/postprocessing/Pass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { PRESENTATION as P } from '../content/presentation.js';
import { BLOOM_LAYER, OUTLINE_LAYER } from './materials.js';

/**
 * Renders only bloom-layer objects, correctly occluded: a depth-only pass of the whole scene
 * followed by the emissive layer on top of that depth, against black.
 */
class EmissivePass extends Pass {
  private readonly depthOnly = new T.MeshBasicMaterial({ colorWrite: false });
  private readonly black = new T.Color(0x000000);

  constructor(
    private readonly scene: T.Scene,
    private readonly camera: T.Camera,
  ) {
    super();
    this.needsSwap = false;
  }

  override render(renderer: T.WebGLRenderer, _write: T.WebGLRenderTarget, read: T.WebGLRenderTarget): void {
    const { scene, camera } = this;
    const background = scene.background;
    const fog = scene.fog;
    const autoClear = renderer.autoClear;
    const clearColor = renderer.getClearColor(new T.Color());
    const clearAlpha = renderer.getClearAlpha();
    scene.background = null;
    scene.fog = null;
    renderer.setRenderTarget(this.renderToScreen ? null : read);
    renderer.setClearColor(this.black, 1);
    renderer.clear();
    renderer.autoClear = false;
    const mask = camera.layers.mask;
    scene.overrideMaterial = this.depthOnly;
    camera.layers.set(0);
    renderer.render(scene, camera);
    scene.overrideMaterial = null;
    camera.layers.set(BLOOM_LAYER);
    renderer.render(scene, camera);
    camera.layers.mask = mask;
    renderer.autoClear = autoClear;
    renderer.setClearColor(clearColor, clearAlpha);
    scene.background = background;
    scene.fog = fog;
  }
}

const COMPOSITE = {
  uniforms: {
    tDiffuse: { value: null as T.Texture | null },
    bloomTexture: { value: null as T.Texture | null },
    vignetteStrength: { value: P.vignette.strength as number },
    vignetteSoftness: { value: P.vignette.softness as number },
  },
  vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform sampler2D bloomTexture;
uniform float vignetteStrength; uniform float vignetteSoftness; varying vec2 vUv;
void main() {
  vec4 base = texture2D(tDiffuse, vUv);
  vec3 bloom = texture2D(bloomTexture, vUv).rgb;
  vec2 centered = (vUv - 0.5) * vec2(1.0, 0.82);
  float edge = smoothstep(0.75 - vignetteSoftness, 0.75, length(centered) * 1.35);
  gl_FragColor = vec4((base.rgb + bloom) * (1.0 - edge * vignetteStrength), base.a);
}`,
};

/** Final composer: scene, emissive-only bloom added on top, vignette, tone mapping/output. */
export class SelectiveBloom {
  readonly composer: EffectComposer;
  private readonly bloomComposer: EffectComposer;
  private readonly bloom: UnrealBloomPass;

  constructor(renderer: T.WebGLRenderer, scene: T.Scene, camera: T.Camera) {
    const size = renderer.getSize(new T.Vector2());
    this.bloomComposer = new EffectComposer(renderer);
    this.bloomComposer.renderToScreen = false;
    this.bloomComposer.addPass(new EmissivePass(scene, camera));
    this.bloom = new UnrealBloomPass(
      size.clone().multiplyScalar(P.bloomResolution),
      P.bloomStrength,
      P.bloomRadius,
      P.bloomThreshold,
    );
    this.bloomComposer.addPass(this.bloom);
    camera.layers.enable(OUTLINE_LAYER);
    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(scene, camera));
    const composite = new ShaderPass(new T.ShaderMaterial(COMPOSITE), 'tDiffuse');
    composite.uniforms.bloomTexture!.value = this.bloomComposer.renderTarget2.texture;
    this.composer.addPass(composite);
    this.composer.addPass(new OutputPass());
    this.setSize(size.x, size.y);
  }

  setSize(width: number, height: number): void {
    this.composer.setSize(width, height);
    this.bloomComposer.setSize(width * P.bloomResolution, height * P.bloomResolution);
  }

  render(): void {
    this.bloomComposer.render();
    this.composer.render();
  }
}
