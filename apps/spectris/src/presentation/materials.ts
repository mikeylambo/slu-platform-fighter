import * as T from 'three';
import { KNIGHT, METALS } from '../content/presentation.js';

/** Objects on this layer feed the bloom pass (emissives only). */
export const BLOOM_LAYER = 1;
/** Outline hulls: drawn in the main pass only, skipped by the bloom depth prepass. */
export const OUTLINE_LAYER = 2;

const ramp = new T.DataTexture(new Uint8Array([28, 92, 210]), 3, 1, T.RedFormat);
ramp.minFilter = T.NearestFilter;
ramp.magFilter = T.NearestFilter;
ramp.needsUpdate = true;

export interface RimMaterial extends T.MeshToonMaterial {
  userData: { rim: { value: T.Color } };
}

/**
 * Glossy black toon armor: a 3-band ramp, a strong rim in the flame colour, and a sharp
 * specular glint on bevels from a fixed key direction (GDD 10 rendering recipe).
 */
export function rimMaterial(base: number, rim: number, specular: number = KNIGHT.specular.strength): RimMaterial {
  // Knights ignore fog: they stay the darkest, most saturated shapes in the play area.
  const material = new T.MeshToonMaterial({ color: base, gradientMap: ramp, fog: false }) as RimMaterial;
  const rimColor = { value: new T.Color(rim) };
  material.userData.rim = rimColor;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.rimColor = rimColor;
    shader.uniforms.rimPower = { value: KNIGHT.rim.power };
    shader.uniforms.rimStrength = { value: KNIGHT.rim.strength };
    shader.uniforms.specThreshold = { value: KNIGHT.specular.threshold };
    shader.uniforms.specStrength = { value: specular };
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform vec3 rimColor; uniform float rimPower; uniform float rimStrength; uniform float specThreshold; uniform float specStrength;`,
      )
      .replace(
        '#include <dithering_fragment>',
        `vec3 viewDir = geometryViewDir; // fragment -> camera (orthographic-safe)
float rim = pow(clamp(1.0 - abs(dot(normal, viewDir)), 0.0, 1.0), rimPower);
vec3 keyDir = normalize(vec3(-0.45, 0.75, 0.55));
float glint = step(specThreshold, dot(normal, normalize(keyDir + viewDir)));
gl_FragColor.rgb += rimColor * rim * rimStrength + vec3(glint * specStrength);
#include <dithering_fragment>`,
      );
  };
  return material;
}

export const armorMaterial = (rim: number) => rimMaterial(METALS.armor, rim);
export const steelTrimMaterial = (rim: number) => rimMaterial(METALS.steel, rim);
export const goldMaterial = (rim: number) => rimMaterial(METALS.gold, rim, 1);

/** Unlit emissive in HDR (above 1.0) so bloom catches it; flagged for the bloom layer. */
export function emissiveMaterial(color: number, intensity = 2.4): T.MeshBasicMaterial {
  return new T.MeshBasicMaterial({
    color: new T.Color(color).multiplyScalar(intensity),
    toneMapped: false,
    fog: false,
  });
}

/** Inverted-hull outline: back faces pushed out along normals by `thickness`. */
export function outlineMaterial(color = 0x020306, thickness: number = KNIGHT.outline): T.ShaderMaterial {
  return new T.ShaderMaterial({
    side: T.BackSide,
    fog: false,
    uniforms: { color: { value: new T.Color(color) }, thickness: { value: thickness } },
    vertexShader: `uniform float thickness;
void main() {
  vec3 pushed = position + normalize(normal) * thickness;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pushed, 1.0);
}`,
    fragmentShader: `uniform vec3 color; void main() { gl_FragColor = vec4(color, 1.0); }`,
  });
}

export function setRim(material: T.Material, color: T.Color): void {
  const rim = (material as RimMaterial).userData?.rim;
  if (rim) rim.value.copy(color);
}

/** Puts an object (and children) on the bloom layer in addition to the default one. */
export function markBloom(object: T.Object3D): void {
  object.traverse((child) => child.layers.enable(BLOOM_LAYER));
}
