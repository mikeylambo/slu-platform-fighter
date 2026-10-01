import * as T from 'three';
import type { StageSurface } from '../../../../packages/sim/src/types.js';
import { SURFACES } from '../content/stages/sanctum.js';
import { fixed } from '../../../../packages/deterministic-math/src/fixed.js';
import { STAGE_LOOK, type StageLook } from '../content/presentation.js';
import { markBloom } from './materials.js';
const stone = new T.MeshStandardMaterial({ color: 0x152333, metalness: 0.35, roughness: 0.7, flatShading: true });
const edge = new T.MeshStandardMaterial({ color: 0x567680, metalness: 0.6, roughness: 0.35 });
const glow = new T.MeshBasicMaterial({ color: new T.Color(0x45827f).multiplyScalar(1.3), toneMapped: false });
const silhouette = new T.MeshLambertMaterial({ color: 0x557077 });
const DEFAULT_LOOK = STAGE_LOOK['mirror-sanctum']!;

/** Applies a stage's value structure to the shared stage materials. */
export function applyStageLook(look: StageLook): void {
  stone.color.set(look.stone);
  edge.color.set(look.edge).multiplyScalar(0.7);
  glow.color.set(look.glow).multiplyScalar(1.4);
  silhouette.color.set(look.silhouette);
}

export function createArena(surfaces: StageSurface[] = SURFACES) {
  const root = new T.Group();
  for (const s of surfaces) {
    const width = fixed.toNumber(fixed.sub(s.xMax, s.xMin)),
      x = fixed.toNumber(fixed.add(s.xMax, s.xMin)) / 2,
      y = fixed.toNumber(s.y),
      main = s.kind === 'solid';
    const g = new T.Group();
    g.name = s.id;
    g.position.set(x, y, 0);
    root.add(g);
    const top = new T.Mesh(new T.BoxGeometry(width, 0.3, main ? 6 : 2.4), edge);
    top.position.y = -0.16;
    top.receiveShadow = true;
    g.add(top);
    const slab = new T.Mesh(new T.BoxGeometry(width - 0.15, main ? 1.2 : 0.4, main ? 5.8 : 2.2), stone);
    slab.position.y = main ? -0.87 : -0.5;
    g.add(slab);
    const seam = new T.Mesh(new T.BoxGeometry(width, 0.025, 0.025), glow);
    seam.position.set(0, 0.015, main ? 3.01 : 1.21);
    markBloom(seam);
    g.add(seam);
    for (let i = 0; i < width; i += 2) {
      const band = new T.Mesh(new T.BoxGeometry(0.018, 0.015, main ? 5.9 : 2.3), edge);
      band.position.set(i - width / 2, 0, 0);
      g.add(band);
    }
    if (main) {
      for (let i = -1; i <= 1; i++) {
        const fin = new T.Mesh(new T.ConeGeometry(i === 0 ? 5.5 : 3, 8, 4), stone);
        fin.rotation.z = Math.PI;
        fin.position.set(i * 9, -5, 0);
        fin.scale.z = 0.4;
        g.add(fin);
      }
      const rune = new T.Mesh(new T.TorusGeometry(2, 0.025, 6, 80), glow);
      rune.rotation.x = Math.PI / 2;
      rune.position.y = 0.015;
      g.add(rune);
    }
  }
  return root;
}
const SKY_SHADER = {
  uniforms: {
    top: { value: new T.Color(DEFAULT_LOOK.skyTop) },
    horizon: { value: new T.Color(DEFAULT_LOOK.horizon) },
    glow: { value: new T.Color(DEFAULT_LOOK.glow) },
  },
  vertexShader: `varying vec3 vDirection; void main() { vDirection = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`,
  fragmentShader: `uniform vec3 top; uniform vec3 horizon; uniform vec3 glow; varying vec3 vDirection;
void main() {
  float height = clamp(vDirection.y * 1.6 + 0.12, 0.0, 1.0);
  vec3 sky = mix(horizon, top, pow(height, 0.75));
  float centre = pow(max(0.0, 1.0 - length(vec2(vDirection.x * 1.4, vDirection.y - 0.08)) * 1.6), 2.2);
  gl_FragColor = vec4(mix(sky, glow, centre * 0.75), 1.0);
}`,
};

export interface Backdrop {
  root: T.Group;
  dust: T.Points;
  setLook(look: StageLook): void;
}

/**
 * Sky dome, lights, distant pillars and dust. The space behind the fighting plane stays
 * light-to-mid (gradient sky, glow, fog); Knights stay the darkest shapes on screen.
 */
export function createBackdrop(scene: T.Scene): Backdrop {
  const root = new T.Group();
  scene.add(root);
  const skyMaterial = new T.ShaderMaterial({ ...SKY_SHADER, side: T.BackSide, depthWrite: false, fog: false });
  const sky = new T.Mesh(new T.SphereGeometry(300, 32, 16), skyMaterial);
  sky.renderOrder = -1;
  root.add(sky);
  const hemisphere = new T.HemisphereLight(0xdfeef0, 0x10131a, 1.4);
  scene.add(hemisphere);
  const key = new T.DirectionalLight(0xffffff, 2.2);
  key.position.set(-14, 26, 18);
  scene.add(key);
  const back = new T.DirectionalLight(0xffffff, 1.6);
  back.position.set(4, 10, -22);
  scene.add(back);
  const ringMat = new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, fog: false });
  for (const [radius, width] of [
    [17, 0.05],
    [19, 0.028],
  ] as const) {
    const ring = new T.Mesh(new T.TorusGeometry(radius, width, 6, 180), ringMat);
    ring.position.set(0, 13, -40);
    root.add(ring);
  }
  for (const side of [-1, 1])
    for (let i = 0; i < 5; i++) {
      const pillar = new T.Group();
      pillar.position.set(side * (24 + i * 7), -6 - i * 1.4, -16 - i * 9);
      root.add(pillar);
      const height = 34 + i * 3;
      const shaft = new T.Mesh(new T.CylinderGeometry(0.75, 1.4, height, 6), silhouette);
      shaft.position.y = height / 2;
      pillar.add(shaft);
      const crown = new T.Mesh(new T.ConeGeometry(1.7, 4.5, 4), silhouette);
      crown.position.y = height + 2;
      pillar.add(crown);
    }
  let seed = 471;
  const rand = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const dustPositions = new Float32Array(160 * 3);
  for (let i = 0; i < 160; i++) {
    dustPositions[i * 3] = (rand() - 0.5) * 80;
    dustPositions[i * 3 + 1] = rand() * 40 - 12;
    dustPositions[i * 3 + 2] = (rand() - 0.5) * 22;
  }
  const dustMaterial = new T.PointsMaterial({
    size: 0.08,
    color: 0xffffff,
    transparent: true,
    opacity: 0.55,
    blending: T.AdditiveBlending,
    depthWrite: false,
  });
  const dust = new T.Points(
    new T.BufferGeometry().setAttribute('position', new T.BufferAttribute(dustPositions, 3)),
    dustMaterial,
  );
  root.add(dust);
  const setLook = (look: StageLook) => {
    skyMaterial.uniforms.top!.value.set(look.skyTop);
    skyMaterial.uniforms.horizon!.value.set(look.horizon);
    skyMaterial.uniforms.glow!.value.set(look.glow);
    hemisphere.color.set(look.horizon);
    back.color.set(look.glow);
    ringMat.color.set(look.glow);
    dustMaterial.color.set(look.glow);
    scene.background = new T.Color(look.horizon);
    scene.fog = new T.FogExp2(look.fog, look.fogDensity);
    applyStageLook(look);
  };
  setLook(DEFAULT_LOOK);
  return { root, dust, setLook };
}
/** Decorative silhouettes are separate from collision surfaces. */
export function createBiome(id: string, color: number) {
  const root = new T.Group();
  // Far enough behind the fighting plane that fog carries it into the mid values.
  root.position.z = -38;
  root.scale.setScalar(1.35);
  const dark = silhouette,
    lit = new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.45, side: T.DoubleSide });
  const add = (geometry: T.BufferGeometry, material: T.Material, x: number, y: number, z = 0) => {
    const mesh = new T.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    root.add(mesh);
    return mesh;
  };
  if (id === 'eclipse') {
    add(new T.CircleGeometry(12, 64), new T.MeshBasicMaterial({ color: 0x8c4f43 }), 0, 15);
    add(new T.RingGeometry(12, 12.2, 64), lit, 0, 15, 0.1);
    for (let i = 0; i < 9; i++)
      add(new T.ConeGeometry(3, 15 + (i % 3) * 4, 4), dark, (i - 4) * 7, -8).rotation.z = Math.PI;
  }
  if (id === 'fault-screen')
    for (let i = 0; i < 13; i++) {
      const shard = add(
        new T.BoxGeometry(3 + (i % 3), 18 + (i % 4) * 3, 0.6),
        i % 3 ? dark : lit,
        (i - 6) * 5,
        10 + (i % 3) * 4,
      );
      shard.rotation.z = (i % 2 ? 1 : -1) * 0.22;
    }
  if (id === 'stillwater') {
    for (let i = 0; i < 12; i++) add(new T.PlaneGeometry(85 - i * 3, 0.05), lit, 0, -4 - i * 0.65);
    add(new T.TorusGeometry(9, 0.06, 6, 64), lit, 0, 16);
    add(new T.TorusGeometry(6, 0.04, 6, 64), lit, 0, 16);
  }
  if (id === 'bell-foundry')
    for (let i = -2; i <= 2; i++) {
      const bell = add(new T.CylinderGeometry(2, 4, 6, 12, 1, true), dark, i * 13, 20 - Math.abs(i) * 3);
      add(new T.CylinderGeometry(0.06, 0.06, 20, 4), lit, i * 13, bell.position.y + 12);
      add(new T.TorusGeometry(4, 0.07, 6, 40), lit, i * 13, bell.position.y - 3).rotation.x = Math.PI / 2;
    }
  if (id === 'skyreach')
    for (let i = 0; i < 14; i++) {
      const island = add(new T.ConeGeometry(2 + (i % 4), 8 + (i % 5), 5), dark, (i - 7) * 6, Math.sin(i * 4) * 12);
      island.rotation.z = Math.PI;
      add(new T.BoxGeometry(3 + (i % 4), 0.1, 2), lit, island.position.x, island.position.y + 4);
    }
  if (id === 'hollow-throne') {
    add(new T.BoxGeometry(13, 2, 6), dark, 0, 3);
    add(new T.BoxGeometry(9, 19, 2), dark, 0, 13, -2);
    for (const x of [-7, 7]) {
      add(new T.BoxGeometry(2, 9, 5), dark, x, 7);
      add(new T.ConeGeometry(1.8, 9, 4), lit, x, 18);
    }
    for (let i = 0; i < 5; i++) add(new T.ConeGeometry(0.7, 7 + (i % 2) * 3, 4), dark, (i - 2) * 2, 25);
  }
  if (id === 'unsworn')
    for (let i = 0; i < 12; i++) {
      const shard = add(new T.TetrahedronGeometry(3 + (i % 3)), dark, Math.cos(i) * 20, Math.sin(i) * 13 + 10);
      shard.rotation.z = i;
    }
  if (id === 'pilgrimage')
    for (let i = 0; i < 25; i++) add(new T.ConeGeometry(3, 20 + (i % 5) * 3, 5), dark, (i - 12) * 10, -8 + (i % 4) * 3);
  const crackPoints: number[] = [];
  for (let i = 0; i < 8; i++) {
    const angle = i * 0.77,
      x = Math.sin(angle) * 18,
      y = 13 + Math.cos(angle) * 18;
    crackPoints.push(x, y, 2, x * 0.7 + 2, y * 0.75, 2, x * 0.7 + 2, y * 0.75, 2, x * 0.45 - 1, y * 0.5, 2);
  }
  const cracks = new T.LineSegments(
    new T.BufferGeometry().setAttribute('position', new T.Float32BufferAttribute(crackPoints, 3)),
    new T.LineBasicMaterial({ color, transparent: true, opacity: 0.6 }),
  );
  cracks.name = 'fracture-cracks';
  root.add(cracks);
  return root;
}
