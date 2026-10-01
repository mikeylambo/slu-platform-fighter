import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { fixed } from '../../../../packages/deterministic-math/src/fixed.js';
import type { FighterState } from '../../../../packages/sim/src/types.js';
import type { KnightState } from '../game/session.js';
import type { DuelKnight } from '../game/duel.js';
import { KNIGHT, OATH_LOOK } from '../content/presentation.js';
import { MOVES } from '../content/knight/moves/index.js';
import type { Oath } from '../content/rules/duel.js';
import { capeTexture, pieceUrl } from './assets.js';
import { flameMaterial } from './flame.js';
import {
  armorMaterial,
  emissiveMaterial,
  goldMaterial,
  markBloom,
  OUTLINE_LAYER,
  outlineMaterial,
  setRim,
  steelTrimMaterial,
} from './materials.js';

type FistPose = 'grip' | 'open' | 'fist' | 'grab';

const loader = new GLTFLoader();
const helmCache = new Map<string, Promise<T.Group | null>>();

/** Loads a traced helm GLB once; null when the manifest has no entry or loading fails. */
function loadHelm(name: string): Promise<T.Group | null> {
  let pending = helmCache.get(name);
  if (!pending) {
    pending = pieceUrl(`helm/${name}`).then(async (url) => {
      if (!url) return null;
      try {
        return (await loader.loadAsync(url)).scene;
      } catch (error) {
        console.warn(`Helm ${name} failed to load; keeping the procedural helm`, error);
        return null;
      }
    });
    helmCache.set(name, pending);
  }
  return pending;
}

function extrudeShape(points: [number, number][], depth: number, bevel = 0.02): T.ExtrudeGeometry {
  const shape = new T.Shape(points.map(([x, y]) => new T.Vector2(x, y)));
  const geometry = new T.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelSegments: 1,
    steps: 1,
    bevelSize: bevel,
    bevelThickness: bevel,
  });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

/** A chunky gauntlet: palm block, knuckle plate, thumb, and four finger plates that pose. */
class Fist {
  readonly group = new T.Group();
  private fingers: T.Mesh;
  private thumb: T.Mesh;

  constructor(armor: T.Material, trim: T.Material, outline: T.Material, mirror: number) {
    const s = KNIGHT.fist.size;
    const palm = new T.Mesh(new T.BoxGeometry(s * 1.15, s, s * 0.9), armor);
    const knuckles = new T.Mesh(new T.BoxGeometry(s * 1.25, s * 0.32, s * 0.5), trim);
    knuckles.position.set(0, s * 0.42, s * 0.3);
    this.group.add(palm, knuckles);
    // Four finger plates as one block (one draw call), hinged at the knuckles.
    this.fingers = new T.Mesh(new T.BoxGeometry(s * 1.12, s * 0.62, s * 0.3), armor);
    this.fingers.geometry.translate(0, s * 0.31, 0);
    this.fingers.position.set(0, s * 0.5, s * 0.12);
    this.group.add(this.fingers);
    this.thumb = new T.Mesh(new T.BoxGeometry(s * 0.3, s * 0.55, s * 0.3), armor);
    this.thumb.position.set(mirror * s * 0.6, 0, s * 0.2);
    this.group.add(this.thumb);
    for (const mesh of [palm, knuckles, this.fingers, this.thumb]) addOutline(mesh, outline);
  }

  pose(pose: FistPose): void {
    const curl = { grip: 1.9, fist: 2.3, open: 0.15, grab: 1.0 }[pose];
    this.fingers.rotation.x = T.MathUtils.lerp(this.fingers.rotation.x, curl, 0.35);
    this.thumb.rotation.z = pose === 'open' ? 0.6 : 0;
  }
}

function addOutline(mesh: T.Mesh, material: T.Material): void {
  const hull = new T.Mesh(mesh.geometry, material);
  hull.name = 'outline';
  hull.layers.set(OUTLINE_LAYER);
  hull.raycast = () => undefined;
  mesh.add(hull);
}

export class KnightView {
  readonly root = new T.Group();
  readonly body = new T.Group();
  readonly blade = new T.Group();
  readonly wings = new T.Group();
  readonly cape: T.Mesh;
  readonly flame: T.ShaderMaterial;
  readonly cracks: T.LineSegments;
  readonly hairlines: T.LineSegments;
  readonly hitbox: T.Mesh;
  readonly hurtbox: T.Mesh;
  private readonly armor: T.MeshToonMaterial;
  private readonly steel: T.MeshToonMaterial;
  private readonly gold: T.MeshToonMaterial;
  private readonly capeMaterial: T.MeshToonMaterial;
  private readonly visor: T.MeshBasicMaterial;
  private readonly edge: T.MeshBasicMaterial;
  private readonly outline = outlineMaterial();
  private readonly helmMount = new T.Group();
  private readonly fallbackHelm = new T.Group();
  private readonly fans: T.Group[] = [];
  private readonly fists: [Fist, Fist];
  private readonly wisp = new T.Group();
  private readonly light: T.PointLight;
  private readonly arc: T.Mesh;
  private helmName = '';
  private trim: 'gold' | 'steel' = 'steel';
  private fan = 0;
  private capeRest: Float32Array;
  private capePrev: Float32Array;
  private capeTime = 0;

  constructor(color: number) {
    this.armor = armorMaterial(color);
    this.steel = steelTrimMaterial(color);
    this.gold = goldMaterial(color);
    this.visor = emissiveMaterial(color, 2.6);
    this.edge = emissiveMaterial(color, 2.2);
    this.flame = flameMaterial(color);
    this.capeMaterial = armorMaterial(color);
    this.root.add(this.body);
    this.buildHelm();
    this.buildTorso();
    this.buildWisp();
    this.buildWings();
    this.fists = [
      new Fist(this.armor, this.steel, this.outline, 1),
      new Fist(this.armor, this.steel, this.outline, -1),
    ];
    this.buildSword();
    const free = this.fists[1].group;
    free.position.set(KNIGHT.fist.freeX, KNIGHT.fist.freeY, KNIGHT.fist.freeZ);
    this.body.add(free);
    this.cape = this.buildCape();
    this.capeRest = new Float32Array(this.cape.geometry.attributes.position!.array);
    this.capePrev = this.capeRest.slice();
    this.arc = this.buildArc(color);
    this.light = new T.PointLight(color, 1.6, 6, 2);
    this.light.position.set(0, 1.4, 1.2);
    this.root.add(this.light);
    [this.cracks, this.hairlines] = this.buildCracks(color);
    this.hurtbox = new T.Mesh(
      new T.SphereGeometry(0.7, 12, 8),
      new T.MeshBasicMaterial({ color: 0x5ee6cf, wireframe: true }),
    );
    this.hurtbox.position.y = 1.4;
    this.root.add(this.hurtbox);
    this.hitbox = new T.Mesh(
      new T.SphereGeometry(1, 12, 8),
      new T.MeshBasicMaterial({ color: 0xff587e, wireframe: true }),
    );
    this.root.add(this.hitbox);
    this.setOath('unsworn');
  }

  // ------------------------------------------------------------------ construction

  private buildHelm(): void {
    this.helmMount.position.y = KNIGHT.helmCenterY - KNIGHT.helmHeight / 2;
    this.helmMount.scale.set(KNIGHT.helmHeight, KNIGHT.helmHeight, KNIGHT.helmHeight * KNIGHT.helmDepthScale);
    this.body.add(this.helmMount);
    // Procedural stand-in shown until the traced GLB arrives.
    const shell = new T.Mesh(new T.SphereGeometry(0.36, 20, 14), this.armor);
    shell.scale.set(1, 1.25, 0.85);
    shell.position.y = 0.48;
    const slit = new T.Mesh(new T.BoxGeometry(0.42, 0.045, 0.02), this.visor);
    slit.position.set(0, 0.46, 0.31);
    markBloom(slit);
    this.fallbackHelm.add(shell, slit);
    addOutline(shell, this.outline);
    this.helmMount.add(this.fallbackHelm);
  }

  private buildTorso(): void {
    const c = KNIGHT.chest;
    const chest = new T.Mesh(
      extrudeShape(
        [
          [-c.width / 2, c.height * 0.25],
          [-c.width * 0.55, c.height],
          [0, c.height * 1.18],
          [c.width * 0.55, c.height],
          [c.width / 2, c.height * 0.25],
          [0, -c.height * 0.12],
        ],
        c.depth,
        0.03,
      ),
      this.armor,
    );
    chest.position.y = c.y - c.height / 2;
    addOutline(chest, this.outline);
    this.body.add(chest);
    const p = KNIGHT.pauldron;
    for (const side of [-1, 1]) {
      const blade = new T.Mesh(
        extrudeShape(
          [
            [0, -p.width / 2],
            [p.length * 0.75, -p.width * 0.4],
            [p.length, 0.02],
            [p.length * 0.7, p.width / 2],
            [0, p.width / 2],
          ],
          0.12,
          0.02,
        ),
        this.steel,
      );
      blade.position.set(side * p.x, p.y, 0.02);
      blade.rotation.z = side > 0 ? p.splay : Math.PI - p.splay;
      blade.rotation.x = side * 0.2;
      addOutline(blade, this.outline);
      this.body.add(blade);
    }
  }

  private buildWisp(): void {
    const w = KNIGHT.wisp;
    for (const [x, scale, height] of [
      [0, 1, 1],
      [-0.12, 0.62, 0.72],
      [0.13, 0.55, 0.64],
    ] as const) {
      const cone = new T.Mesh(new T.ConeGeometry(w.radius * scale, w.height * height, 18, 10, true), this.flame);
      cone.rotation.z = Math.PI;
      cone.position.set(x, w.y - (w.height * height) / 2 + 0.25, 0);
      this.wisp.add(cone);
    }
    const core = new T.Mesh(new T.SphereGeometry(w.radius * 0.7, 16, 12), this.flame);
    core.position.y = w.y + 0.02;
    this.wisp.add(core);
    markBloom(this.wisp);
    this.body.add(this.wisp);
  }

  private buildWings(): void {
    const w = KNIGHT.wing;
    this.wings.position.set(0, w.rootY, w.rootZ);
    this.body.add(this.wings);
    for (const side of [-1, 1]) {
      const fan = new T.Group();
      fan.position.x = side * w.rootX;
      fan.scale.x = side;
      this.wings.add(fan);
      this.fans.push(fan);
      for (let i = 0; i < w.feathers; i++) {
        const length = w.length * (1 - i * 0.09);
        const pivot = new T.Group();
        const feather = new T.Mesh(
          extrudeShape(
            [
              [0, -0.06],
              [length * 0.3, -0.1],
              [length, -0.015],
              [length * 0.92, 0.07],
              [0.05, 0.08],
            ],
            0.05,
            0.012,
          ),
          i % 2 ? this.steel : this.armor,
        );
        const edge = new T.Mesh(
          extrudeShape(
            [
              [length * 0.3, -0.11],
              [length, -0.02],
              [length * 0.3, -0.085],
            ],
            0.054,
            0.004,
          ),
          this.edge,
        );
        markBloom(edge);
        addOutline(feather, this.outline);
        pivot.add(feather, edge);
        pivot.userData.index = i;
        fan.add(pivot);
      }
    }
  }

  private buildSword(): void {
    const s = KNIGHT.sword;
    const grip = this.fists[0].group;
    grip.position.set(KNIGHT.fist.gripX, KNIGHT.fist.gripY, KNIGHT.fist.gripZ);
    this.body.add(grip);
    this.blade.position.copy(grip.position);
    this.body.add(this.blade);
    const steel = new T.Mesh(
      extrudeShape(
        [
          [-s.width / 2, 0],
          [s.width / 2, 0],
          [s.width * 0.42, s.length * 0.82],
          [0, s.length],
          [-s.width * 0.42, s.length * 0.82],
        ],
        s.thickness,
        0.025,
      ),
      this.steel,
    );
    steel.position.y = s.guardHeight / 2;
    addOutline(steel, this.outline);
    const edge = new T.Mesh(
      extrudeShape(
        [
          [s.width / 2 + 0.012, 0.05],
          [s.width * 0.42 + 0.012, s.length * 0.82],
          [0, s.length + 0.03],
          [s.width * 0.36, s.length * 0.8],
          [s.width / 2 - 0.035, 0.05],
        ],
        s.thickness * 0.4,
        0.004,
      ),
      this.edge,
    );
    edge.position.y = s.guardHeight / 2;
    markBloom(edge);
    const guard = new T.Mesh(
      extrudeShape(
        [
          [-s.guardWidth / 2, 0],
          [-s.guardWidth * 0.3, -s.guardHeight / 2],
          [s.guardWidth * 0.3, -s.guardHeight / 2],
          [s.guardWidth / 2, 0],
          [s.guardWidth * 0.3, s.guardHeight / 2],
          [-s.guardWidth * 0.3, s.guardHeight / 2],
        ],
        0.16,
        0.02,
      ),
      this.gold,
    );
    addOutline(guard, this.outline);
    const gem = new T.Mesh(new T.OctahedronGeometry(s.gem), this.visor);
    gem.position.z = 0.1;
    markBloom(gem);
    const handle = new T.Mesh(new T.CylinderGeometry(0.06, 0.07, s.handle, 8), this.armor);
    handle.position.y = -s.handle / 2;
    const pommel = new T.Mesh(new T.OctahedronGeometry(0.09), this.gold);
    pommel.position.y = -s.handle;
    this.blade.add(steel, edge, guard, gem, handle, pommel);
  }

  private buildCape(): T.Mesh {
    const c = KNIGHT.cape;
    const cape = new T.Mesh(new T.PlaneGeometry(c.width, c.length, 10, 15), this.capeMaterial);
    (this.capeMaterial as T.MeshToonMaterial).side = T.DoubleSide;
    cape.position.set(0, c.y - c.length / 2, c.z);
    cape.rotation.x = -0.12;
    void capeTexture(this.capeMaterial as unknown as T.MeshStandardMaterial);
    this.body.add(cape);
    return cape;
  }

  private buildArc(color: number): T.Mesh {
    const material = new T.MeshBasicMaterial({
      color: new T.Color(color).multiplyScalar(1.6),
      transparent: true,
      opacity: 0.55,
      side: T.DoubleSide,
      blending: T.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    const arc = new T.Mesh(new T.RingGeometry(1.9, 2.2, 36, 1, 0, Math.PI * 1.3), material);
    arc.position.set(0.2, 1.4, 0.7);
    markBloom(arc);
    this.body.add(arc);
    return arc;
  }

  /** Strain cracks (flame colour) and guard hairlines (pale) drawn over the helm face. */
  private buildCracks(color: number): [T.LineSegments, T.LineSegments] {
    const z = 0.36;
    const strain = [
      [-0.12, 0.86, -0.05, 0.74],
      [-0.05, 0.74, -0.14, 0.62],
      [0.13, 0.8, 0.07, 0.66],
      [0.07, 0.66, 0.17, 0.55],
      [-0.2, 0.5, -0.1, 0.4],
      [-0.1, 0.4, -0.16, 0.28],
      [0.2, 0.47, 0.1, 0.35],
      [0.1, 0.35, 0.03, 0.2],
    ];
    const hair = [
      [-0.26, 0.6, -0.18, 0.66],
      [0.24, 0.62, 0.16, 0.7],
      [-0.02, 0.92, 0.04, 0.84],
      [-0.22, 0.32, -0.12, 0.3],
    ];
    const lines = (segments: number[][], material: T.LineBasicMaterial) => {
      const points = segments.flatMap(([x1, y1, x2, y2]) => [x1!, y1!, z, x2!, y2!, z]);
      const mesh = new T.LineSegments(
        new T.BufferGeometry().setAttribute('position', new T.Float32BufferAttribute(points, 3)),
        material,
      );
      mesh.renderOrder = 2;
      this.helmMount.add(mesh);
      return mesh;
    };
    const cracks = lines(
      strain,
      new T.LineBasicMaterial({ color: new T.Color(color).multiplyScalar(2), toneMapped: false }),
    );
    markBloom(cracks);
    const hairlines = lines(hair, new T.LineBasicMaterial({ color: 0xdcecff, transparent: true, opacity: 0.8 }));
    return [cracks, hairlines];
  }

  // ------------------------------------------------------------------ looks

  setContrast(enabled: boolean, color: number): void {
    (this.outline.uniforms.color!.value as T.Color).set(enabled ? color : 0x020306);
    this.outline.uniforms.thickness!.value = enabled ? KNIGHT.outline * 2.2 : KNIGHT.outline;
  }

  setOath(oath: Oath): void {
    const look = OATH_LOOK[oath];
    this.trim = look.trim;
    if (this.helmName === look.helm) return;
    this.helmName = look.helm;
    void loadHelm(look.helm).then((scene) => {
      if (!scene || this.helmName !== look.helm) return;
      this.installHelm(scene.clone(true));
    });
  }

  private installHelm(scene: T.Object3D): void {
    for (const child of [...this.helmMount.children]) {
      if (child !== this.cracks && child !== this.hairlines) this.helmMount.remove(child);
    }
    const meshes: T.Mesh[] = [];
    scene.traverse((object) => {
      if (object instanceof T.Mesh) meshes.push(object);
    });
    for (const mesh of meshes) {
      if (mesh.name === 'visor') {
        mesh.material = this.visor;
        markBloom(mesh);
        continue;
      }
      mesh.material = mesh.name === 'trim' ? (this.trim === 'gold' ? this.gold : this.steel) : this.armor;
      addOutline(mesh, this.outline);
    }
    this.helmMount.add(scene);
  }

  setPalette(color: number, kindled = false): void {
    const flame = new T.Color(kindled ? 0xf2ffff : color);
    this.flame.uniforms.tint!.value.copy(flame);
    this.visor.color.copy(flame).multiplyScalar(kindled ? 4.2 : 2.6);
    this.edge.color.copy(flame).multiplyScalar(kindled ? 3.4 : 2.2);
    (this.cracks.material as T.LineBasicMaterial).color.copy(flame).multiplyScalar(2);
    (this.arc.material as T.MeshBasicMaterial).color.copy(flame).multiplyScalar(1.6);
    this.light.color.copy(flame);
    for (const material of [this.armor, this.steel, this.gold, this.capeMaterial]) setRim(material, flame);
    this.capeMaterial.color.copy(flame).multiplyScalar(0.16);
  }

  // ------------------------------------------------------------------ animation

  update(p: FighterState, k: KnightState, time: number, debug = false, title = false, duel?: DuelKnight): void {
    this.flame.uniforms.time!.value = time;
    this.root.visible = !p.eliminated;
    if (!title) {
      this.root.position.set(fixed.toNumber(p.x), fixed.toNumber(p.y), 0);
      this.root.scale.setScalar(p.respawnFrames > 0 ? Math.max(0.02, 1 - p.respawnFrames / 45) : 1);
    }
    const vx = fixed.toNumber(p.vx);
    const vy = fixed.toNumber(p.vy);
    this.body.rotation.y = T.MathUtils.lerp(this.body.rotation.y, p.facing === 1 ? 0.42 : -0.42, 0.22);
    this.body.position.y = Math.sin(time * 3.2) * 0.05;
    this.body.rotation.z = T.MathUtils.lerp(this.body.rotation.z, k.gliding ? -p.facing * 0.3 : -vx * 0.12, 0.2);
    this.animateWisp(vx, vy, time, p.hitlagFrames > 0);
    const wingStance = k.stance.id === 'wings';
    this.wings.visible = wingStance;
    this.cape.visible = !wingStance;
    const wingAttack = wingStance && !!p.attack && !p.grounded;
    const rising = !p.grounded && vy > 0.05;
    this.animateWings(k.gliding || wingAttack || rising ? 1 : 0, k, time);
    if (!wingStance) this.animateCape(vx, time);
    this.animateBlade(p);
    this.animateFists(p, duel);
    this.cracks.visible = p.percentTenths >= 250;
    this.cracks.geometry.setDrawRange(0, this.crackSegments(p.percentTenths) * 2);
    const integrity = duel?.integrity ?? 10000;
    this.hairlines.visible = integrity < 10000;
    this.hairlines.geometry.setDrawRange(0, Math.ceil((1 - integrity / 10000) * 4) * 2);
    this.hurtbox.visible = debug;
    this.body.visible = p.invulnerableFrames === 0 || Math.floor(time * 16) % 2 === 0 || title;
  }

  /** GDD 3.5: cracks spread at 25 / 50 / 100 / 150 Strain. */
  private crackSegments(strain: number): number {
    if (strain >= 1500) return 8;
    if (strain >= 1000) return 6;
    if (strain >= 500) return 4;
    if (strain >= 250) return 2;
    return 0;
  }

  private animateWisp(vx: number, vy: number, time: number, hit: boolean): void {
    this.wisp.rotation.z = T.MathUtils.lerp(this.wisp.rotation.z, T.MathUtils.clamp(vx * 0.9, -0.6, 0.6), 0.2);
    const stretch = 1 + T.MathUtils.clamp(-vy * 0.35, -0.2, 0.5);
    this.wisp.scale.set(1, T.MathUtils.lerp(this.wisp.scale.y, stretch, 0.2), 1);
    this.flame.uniforms.power!.value = hit ? 2.7 : 1 + Math.sin(time * 9) * 0.06;
  }

  private animateWings(target: number, k: KnightState, time: number): void {
    const w = KNIGHT.wing;
    this.fan = T.MathUtils.lerp(this.fan, target, target > this.fan ? 0.3 : 0.12);
    const unfurl = k.stance.unfurl ? 1 - k.stance.unfurl / 6 : 1;
    this.fans.forEach((fan, side) => {
      fan.scale.y = Math.max(0.05, unfurl);
      for (const pivot of fan.children) {
        const i = pivot.userData.index as number;
        const spread = T.MathUtils.lerp(w.foldedSpread, w.fannedSpread, this.fan);
        // Folded: tucked down behind the back. Fanned: a wide upward spread.
        const base = T.MathUtils.lerp(-1.9, -0.05, this.fan);
        pivot.rotation.z = base + i * spread + Math.sin(time * 2 + i) * 0.02 * this.fan;
        // Swept back when fanned, tucked flat against the back when folded.
        pivot.rotation.y = T.MathUtils.lerp(0.9, 0.45, this.fan);
        void side;
      }
    });
  }

  private animateBlade(p: FighterState): void {
    this.blade.rotation.set(0, 0, -0.35);
    this.arc.visible = false;
    this.hitbox.visible = false;
    if (!p.attack) return;
    const move = MOVES.get(p.attack.attackId);
    if (!move) return;
    const t = p.attack.frame / move.faf;
    this.blade.rotation.z = -0.35 - Math.sin(t * Math.PI) * 2.6;
    this.arc.rotation.z = -t * 5;
    const active = move.strikes.find(
      (s) => p.attack!.frame >= s.start - 1 && p.attack!.frame <= s.start + s.active - 2,
    );
    this.arc.visible = Boolean(active);
    if (active && this.hurtbox.visible) {
      this.hitbox.visible = true;
      this.hitbox.position.set(active.x * p.facing, active.y, 0);
      this.hitbox.scale.setScalar(active.radius);
    }
  }

  private animateFists(p: FighterState, duel: DuelKnight | undefined): void {
    const [grip, free] = this.fists;
    grip.pose('grip');
    const grabbing = !!duel && (duel.grab > 0 || !!duel.holding);
    const casting = !!p.attack && /sling|rift|veil|anchor|cleave|kindle/.test(p.attack.attackId);
    const pose: FistPose = grabbing ? 'grab' : casting ? 'open' : 'fist';
    free.pose(pose);
    const reach = grabbing ? 0.55 : 0;
    free.group.position.z = T.MathUtils.lerp(free.group.position.z, KNIGHT.fist.freeZ + reach, 0.3);
  }

  /** Verlet cape ribbon (presentation only), pinned along its top edge. */
  private animateCape(vx: number, time: number): void {
    const pos = this.cape.geometry.attributes.position!;
    const dt = Math.min(0.025, Math.max(0, time - this.capeTime));
    this.capeTime = time;
    const columns = 11;
    for (let i = columns; i < pos.count; i++) {
      const j = i * 3;
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      pos.setXYZ(
        i,
        x + (x - this.capePrev[j]!) * 0.92 - vx * dt * 0.04,
        y + (y - this.capePrev[j + 1]!) * 0.92 - 5 * dt * dt,
        z + (z - this.capePrev[j + 2]!) * 0.92 + (Math.sin(time * 4 + i * 0.2) * 0.3 - Math.abs(vx) * 3) * dt * dt,
      );
      this.capePrev[j] = x;
      this.capePrev[j + 1] = y;
      this.capePrev[j + 2] = z;
    }
    const a = new T.Vector3();
    const b = new T.Vector3();
    const delta = new T.Vector3();
    const rowRest = KNIGHT.cape.width / 10;
    const columnRest = KNIGHT.cape.length / 15;
    for (let n = 0; n < 3; n++) {
      for (let i = 0; i < pos.count; i++) {
        for (const neighbor of [i % columns < columns - 1 ? i + 1 : -1, i + columns < pos.count ? i + columns : -1]) {
          if (neighbor < 0) continue;
          a.fromBufferAttribute(pos, i);
          b.fromBufferAttribute(pos, neighbor);
          delta.subVectors(b, a);
          const length = Math.max(0.001, delta.length());
          const rest = neighbor === i + 1 ? rowRest : columnRest;
          delta.multiplyScalar(((length - rest) / length) * 0.5);
          if (i >= columns) a.add(delta);
          b.sub(delta);
          pos.setXYZ(i, a.x, a.y, a.z);
          pos.setXYZ(neighbor, b.x, b.y, b.z);
        }
      }
    }
    for (let i = 0; i < columns; i++) {
      pos.setXYZ(i, this.capeRest[i * 3]!, this.capeRest[i * 3 + 1]!, this.capeRest[i * 3 + 2]!);
    }
    pos.needsUpdate = true;
    this.cape.geometry.computeVertexNormals();
  }
}
