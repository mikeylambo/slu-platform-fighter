import * as T from 'three';
import { fixed } from '../../../../packages/deterministic-math/src/fixed.js';
import type { FighterState } from '../../../../packages/sim/src/types.js';
import type { KnightState } from '../game/session.js';
import { PRESENTATION as P } from '../content/presentation.js';
import { MOVES } from '../content/knight/moves/index.js';
import { replacePiece, capeTexture, installPiece } from './assets.js';
import type { Oath } from '../content/rules/duel.js';
import { flameMaterial } from './flame.js';
const ramp = new T.DataTexture(new Uint8Array([45, 100, 180, 245]), 4, 1, T.RedFormat);
ramp.minFilter = T.NearestFilter;
ramp.magFilter = T.NearestFilter;
ramp.needsUpdate = true;
const metal = new T.MeshToonMaterial({ color: P.steel, gradientMap: ramp });
const silver = new T.MeshToonMaterial({ color: P.silver, gradientMap: ramp });
function extrude(points: number[][], depth: number, material: T.Material) {
  const shape = new T.Shape();
  points.forEach(([x, y], i) => (i ? shape.lineTo(x!, y!) : shape.moveTo(x!, y!)));
  shape.closePath();
  const g = new T.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelSegments: 1,
    steps: 1,
    bevelSize: 0.035,
    bevelThickness: 0.035,
  });
  g.translate(0, 0, -depth / 2);
  return new T.Mesh(g, material);
}
export class KnightView {
  readonly root = new T.Group();
  readonly body = new T.Group();
  readonly blade = new T.Group();
  readonly wings = new T.Group();
  readonly cape = new T.Mesh(
    new T.PlaneGeometry(1.5, 2.3, 10, 15),
    new T.MeshStandardMaterial({ color: 0x193e4d, side: T.DoubleSide, metalness: 0.35, roughness: 0.6 }),
  );
  readonly flame: T.ShaderMaterial;
  readonly trails: T.Mesh[] = [];
  readonly cracks: T.LineSegments;
  readonly hitbox: T.Mesh;
  readonly hurtbox: T.Mesh;
  private light: T.PointLight;
  private feathers: T.Group[] = [];
  private arc: T.Mesh;
  private accent: T.MeshBasicMaterial;
  private helm = new T.Group();
  private ornament = new T.Group();
  private outlines: T.Mesh[] = [];
  private outlineMaterial = new T.MeshBasicMaterial({ color: 0xffffff, side: T.BackSide });
  private oath: Oath = 'unsworn';
  private capeRest: Float32Array;
  private capePrev: Float32Array;
  private capeTime = 0;
  constructor(color: number) {
    this.capeRest = new Float32Array(this.cape.geometry.attributes.position!.array);
    this.capePrev = this.capeRest.slice();
    void capeTexture(this.cape.material);
    this.flame = flameMaterial(color);
    this.accent = new T.MeshBasicMaterial({ color: new T.Color(color).multiplyScalar(1.1) });
    this.root.add(this.body);
    this.body.add(this.wings);
    this.wings.position.set(0, 1.65, -0.3);
    for (const side of [-1, 1]) {
      const fan = new T.Group();
      fan.scale.x = side;
      this.wings.add(fan);
      this.feathers.push(fan);
      for (let i = 0; i < P.wingFeathers; i++) {
        const feather = extrude(
          [
            [0.28, 0],
            [0.7, 0.15],
            [3.25 - i * 0.26, 1.65 - i * 0.42],
            [2.9 - i * 0.28, 0.78 - i * 0.38],
            [0.6, -0.28],
          ],
          0.08,
          metal,
        );
        fan.add(feather);
        installPiece(feather, 'wing-feather');
        const trim = extrude(
          [
            [0.68, 0.14],
            [3.25 - i * 0.26, 1.65 - i * 0.42],
            [3.12 - i * 0.26, 1.49 - i * 0.42],
          ],
          0.085,
          this.accent,
        );
        fan.add(trim);
      }
    }
    this.cape.position.set(-0.3, 0.6, -0.55);
    this.cape.rotation.x = -0.15;
    this.body.add(this.cape);
    const chest = extrude(
      [
        [-0.58, 0.25],
        [-0.65, 0.82],
        [0, 1.03],
        [0.65, 0.82],
        [0.58, 0.25],
        [0, -0.1],
      ],
      0.65,
      metal,
    );
    chest.position.y = 1.05;
    this.body.add(chest);
    installPiece(chest, 'chest');
    const crest = extrude(
      [
        [-0.08, 0],
        [0, 0.46],
        [0.08, 0],
        [0, -0.15],
      ],
      0.69,
      this.accent,
    );
    crest.position.y = 1.55;
    this.body.add(crest);
    for (const side of [-1, 1]) {
      const shoulder = extrude(
        [
          [-0.35, -0.1],
          [-0.45, 0.3],
          [0, 0.5],
          [0.48, 0.1],
          [0.25, -0.23],
        ],
        0.55,
        silver,
      );
      shoulder.position.set(side * 0.79, 1.6, 0);
      shoulder.scale.x = side;
      this.body.add(shoulder);
      installPiece(shoulder, 'pauldron');
    }
    const helm = this.helm;
    helm.scale.setScalar(P.helmScale);
    helm.position.y = 2.35;
    this.body.add(helm);
    helm.add(
      extrude(
        [
          [-0.65, -0.2],
          [-0.7, 0.5],
          [-0.35, 0.85],
          [0, 1.0],
          [0.35, 0.85],
          [0.7, 0.5],
          [0.65, -0.2],
          [0.3, -0.6],
          [0, -0.85],
          [-0.3, -0.6],
        ],
        0.78,
        metal,
      ),
    );
    const brow = extrude(
      [
        [-0.72, 0.35],
        [0, 0.13],
        [0.72, 0.35],
        [0.58, 0.08],
        [0, -0.04],
        [-0.58, 0.08],
      ],
      0.04,
      silver,
    );
    brow.position.z = 0.44;
    helm.add(brow);
    const gaze = extrude(
      [
        [-0.6, 0.16],
        [-0.1, 0.02],
        [0, -0.03],
        [0.1, 0.02],
        [0.6, 0.16],
        [0.47, -0.02],
        [0, -0.19],
        [-0.47, -0.02],
      ],
      0.02,
      this.accent,
    );
    gaze.position.z = 0.475;
    helm.add(gaze);
    const nose = extrude(
      [
        [-0.09, 0.05],
        [0, 0.7],
        [0.09, 0.05],
        [0.08, -0.58],
        [0, -0.78],
        [-0.08, -0.58],
      ],
      0.1,
      silver,
    );
    nose.position.z = 0.49;
    helm.add(nose);
    for (const side of [-1, 1]) {
      const cheek = extrude(
        [
          [0.1, -0.27],
          [0.59, -0.1],
          [0.47, -0.4],
          [0.15, -0.58],
        ],
        0.025,
        silver,
      );
      cheek.scale.x = side;
      cheek.position.z = 0.435;
      helm.add(cheek);
    }
    for (const [x, y, scale] of [
      [0, 3.8, 0.63],
      [-0.2, 3.55, 0.34],
      [0.24, 3.6, 0.38],
      [0, 0.38, 0.6],
    ]) {
      const flame = new T.Mesh(new T.ConeGeometry(scale!, 1.7, 16, 16, true), this.flame);
      flame.position.set(x!, y!, 0);
      if (y! < 1) flame.rotation.z = Math.PI;
      this.body.add(flame);
    }
    const orb = new T.Mesh(new T.SphereGeometry(0.45, 16, 12), this.flame);
    orb.position.y = 0.75;
    this.body.add(orb);
    this.blade.position.set(0.72, 1.18, 0.48);
    this.body.add(this.blade);
    const sword = extrude(
      [
        [-P.bladeWidth, 0],
        [P.bladeWidth, 0],
        [0.19, 2.05],
        [0, 2.48],
        [-0.19, 2.05],
      ],
      0.11,
      silver,
    );
    sword.position.y = 0.15;
    this.blade.add(sword);
    const edge = extrude(
      [
        [-0.22, 0.12],
        [-0.18, 2.2],
        [0, 2.63],
        [-0.1, 2.12],
        [-0.13, 0.12],
      ],
      0.13,
      this.accent,
    );
    this.blade.add(edge);
    const guard = new T.Mesh(new T.BoxGeometry(0.95, 0.12, 0.28), metal);
    guard.position.y = 0.16;
    this.blade.add(guard);
    const handle = new T.Mesh(new T.CylinderGeometry(0.085, 0.09, 0.55, 6), metal);
    handle.position.y = -0.2;
    this.blade.add(handle);
    for (const side of [-1, 1]) {
      const hand = new T.Mesh(new T.DodecahedronGeometry(0.24, 0), silver);
      hand.scale.set(1, 1.25, 0.85);
      if (side === 1) {
        hand.position.y = -0.09;
        this.blade.add(hand);
      } else {
        hand.position.set(-0.9, 0.9, 0.4);
        this.body.add(hand);
      }
      installPiece(hand, 'gauntlet');
    }
    const arcMat = new T.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.5,
      side: T.DoubleSide,
      blending: T.AdditiveBlending,
      depthWrite: false,
    });
    this.arc = new T.Mesh(new T.RingGeometry(1.9, 2.15, 36, 1, 0, Math.PI * 1.3), arcMat);
    this.arc.position.set(0.2, 1.5, 0.7);
    this.body.add(this.arc);
    this.light = new T.PointLight(color, 2, 7, 2);
    this.light.position.set(0, 2, 1.1);
    this.root.add(this.light);
    const crackPoints = [
      -0.45, 2.9, 0.61, -0.2, 2.65, 0.61, -0.2, 2.65, 0.61, -0.3, 2.4, 0.61, 0.45, 2.7, 0.61, 0.25, 2.35, 0.61, 0.25,
      2.35, 0.61, 0.4, 2.2, 0.61,
    ];
    this.cracks = new T.LineSegments(
      new T.BufferGeometry().setAttribute('position', new T.Float32BufferAttribute(crackPoints, 3)),
      new T.LineBasicMaterial({ color }),
    );
    this.body.add(this.cracks);
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
    helm.add(this.ornament);
    void replacePiece(helm, 'helm/default');
    void replacePiece(this.blade, 'sword');
    const parts: T.Mesh[] = [];
    this.body.traverse((o) => {
      if (o instanceof T.Mesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        if (o.material === metal || o.material === silver) parts.push(o);
      }
    });
    for (const part of parts) {
      const outline = new T.Mesh(part.geometry, this.outlineMaterial);
      outline.scale.setScalar(1.045);
      outline.visible = false;
      part.add(outline);
      this.outlines.push(outline);
    }
  }
  setContrast(enabled: boolean, color: number) {
    this.outlineMaterial.color.set(color);
    for (const outline of this.outlines) outline.visible = enabled;
  }
  setOath(oath: Oath) {
    if (this.oath === oath) return;
    this.oath = oath;
    this.ornament.clear();
    const color = this.accent;
    const variant = {
      unsworn: 'cracked',
      ember: 'horned',
      static: 'crest',
      stillness: 'halo',
      gale: 'winged-crest',
      iron: 'crown',
      hunger: 'hooded',
    }[oath];
    if (oath === 'stillness') {
      const halo = new T.Mesh(new T.TorusGeometry(0.9, 0.035, 6, 32), color);
      halo.position.set(0, 1.3, 0);
      halo.rotation.x = 0.3;
      this.ornament.add(halo);
    } else if (oath === 'hunger') {
      const hood = new T.Mesh(new T.ConeGeometry(1, 1.6, 4, 1, true), metal);
      hood.position.set(0, 0.65, -0.3);
      this.ornament.add(hood);
    } else
      for (const side of [-1, 1]) {
        const spike = new T.Mesh(
          new T.ConeGeometry(oath === 'iron' ? 0.16 : 0.2, oath === 'ember' ? 1.1 : 0.65, 4),
          metal,
        );
        spike.position.set(side * 0.65, 0.9, 0);
        spike.rotation.z = -side * (oath === 'gale' ? 0.8 : 0.3);
        this.ornament.add(spike);
      }
    void replacePiece(this.helm, `helm/${variant}`);
  }
  setPalette(color: number, kindled = false) {
    const c = new T.Color(kindled ? 0xecffff : color);
    this.flame.uniforms.tint!.value.copy(c);
    this.accent.color.copy(c);
    this.light.color.copy(c);
    (this.cracks.material as T.LineBasicMaterial).color.copy(c);
    (this.arc.material as T.MeshBasicMaterial).color.copy(c);
  }
  update(p: FighterState, k: KnightState, time: number, debug = false, title = false) {
    this.flame.uniforms.time!.value = time;
    this.root.visible = !p.eliminated;
    if (!title) {
      this.root.position.set(fixed.toNumber(p.x), fixed.toNumber(p.y), 0);
      this.root.scale.setScalar(p.respawnFrames > 0 ? Math.max(0.02, 1 - p.respawnFrames / 45) : 1);
    }
    this.body.rotation.y = T.MathUtils.lerp(this.body.rotation.y, p.facing === 1 ? 0.38 : -0.38, 0.22);
    this.body.position.y = Math.sin(time * 3.5) * 0.055;
    this.body.rotation.z = T.MathUtils.lerp(
      this.body.rotation.z,
      k.gliding ? -p.facing * 0.32 : -fixed.toNumber(p.vx) * 0.15,
      0.2,
    );
    const wing = k.stance.id === 'wings';
    this.wings.visible = wing;
    this.cape.visible = !wing;
    this.feathers.forEach((fan, i) => {
      fan.rotation.y = Math.sin(time * 2) * 0.12 * (i ? 1 : -1);
      fan.rotation.z = (k.gliding ? 0.16 : Math.sin(time * 2) * 0.035) * (i ? 1 : -1);
      fan.scale.y = k.stance.unfurl ? Math.max(0.05, 1 - k.stance.unfurl / 6) : 1;
    });
    const pos = this.cape.geometry.attributes.position!;
    const dt = Math.min(0.025, Math.max(0, time - this.capeTime));
    this.capeTime = time;
    for (let i = 11; i < pos.count; i++) {
      const j = i * 3,
        x = pos.getX(i),
        y = pos.getY(i),
        z = pos.getZ(i);
      pos.setXYZ(
        i,
        x + (x - this.capePrev[j]!) * 0.92 - fixed.toNumber(p.vx) * dt * 0.04,
        y + (y - this.capePrev[j + 1]!) * 0.92 - 5 * dt * dt,
        z +
          (z - this.capePrev[j + 2]!) * 0.92 +
          (Math.sin(time * 4 + i * 0.2) * 0.3 + Math.abs(fixed.toNumber(p.vx)) * 3) * dt * dt,
      );
      this.capePrev[j] = x;
      this.capePrev[j + 1] = y;
      this.capePrev[j + 2] = z;
    }
    for (let n = 0; n < 3; n++)
      for (let i = 0; i < pos.count; i++)
        for (const neighbor of [i % 11 < 10 ? i + 1 : -1, i + 11 < pos.count ? i + 11 : -1]) {
          if (neighbor < 0) continue;
          const a = new T.Vector3().fromBufferAttribute(pos, i),
            b = new T.Vector3().fromBufferAttribute(pos, neighbor),
            delta = b.clone().sub(a),
            rest = neighbor === i + 1 ? 0.15 : 2.3 / 15;
          delta.multiplyScalar(((delta.length() - rest) / Math.max(0.001, delta.length())) * 0.5);
          if (i >= 11) a.add(delta);
          b.sub(delta);
          pos.setXYZ(i, a.x, a.y, a.z);
          pos.setXYZ(neighbor, b.x, b.y, b.z);
        }
    for (let i = 0; i < 11; i++)
      pos.setXYZ(i, this.capeRest[i * 3]!, this.capeRest[i * 3 + 1]!, this.capeRest[i * 3 + 2]!);
    pos.needsUpdate = true;
    this.cape.geometry.computeVertexNormals();
    this.blade.rotation.z = p.facing === 1 ? -0.75 : 0.75;
    this.arc.visible = false;
    this.hitbox.visible = false;
    this.hurtbox.visible = debug;
    if (p.attack) {
      const m = MOVES.get(p.attack.attackId);
      if (m) {
        const t = p.attack.frame / m.faf;
        this.blade.rotation.z = p.facing * (-0.5 - Math.sin(t * Math.PI) * 2.5);
        this.blade.position.x = p.facing * (0.72 + (m.key === 'forward-smash' ? Math.sin(t * Math.PI) * 1.5 : 0));
        this.arc.rotation.z = p.facing * (-t * 5);
        const active = m.strikes.find(
          (s) => p.attack!.frame >= s.start - 1 && p.attack!.frame <= s.start + s.active - 2,
        );
        this.arc.visible = Boolean(active);
        if (active && debug) {
          this.hitbox.visible = true;
          this.hitbox.position.set(active.x * p.facing, active.y, 0);
          this.hitbox.scale.setScalar(active.radius);
        }
      }
    } else this.blade.position.x = p.facing * 0.72;
    this.cracks.visible = p.percentTenths >= 250;
    this.cracks.geometry.setDrawRange(0, p.percentTenths < 500 ? 2 : p.percentTenths < 1000 ? 4 : 8);
    this.flame.uniforms.power!.value = p.hitlagFrames > 0 ? 2.7 : 1;
    this.body.visible = p.invulnerableFrames === 0 || Math.floor(time * 16) % 2 === 0 || title;
  }
}
