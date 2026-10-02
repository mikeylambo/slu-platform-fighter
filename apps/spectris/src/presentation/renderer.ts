import * as T from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { WorldState } from '../../../../packages/sim/src/types.js';
import { fixed } from '../../../../packages/deterministic-math/src/fixed.js';
import { gameData } from '../game/session.js';
import { FRAMING, PRESENTATION as P, STAGE_LOOK } from '../content/presentation.js';
import { SelectiveBloom } from './bloom.js';
import { markBloom } from './materials.js';
import { KnightView } from './knight.js';
import { createArena, createBackdrop, createBiome, type Backdrop } from './arena.js';
import { createGraphicsRenderer } from '../platform/graphics.js';
import { duelData } from '../game/duel.js';
import { OATHS } from '../content/rules/duel.js';
import { stageById } from '../content/stages/roster.js';
import { PILGRIMAGE, screenCentre } from '../content/stages/pilgrimage.js';
export class Renderer {
  freeCamera = false;
  private orbit: OrbitControls;
  readonly renderer: T.WebGLRenderer;
  readonly scene = new T.Scene();
  readonly camera = new T.PerspectiveCamera(P.camera.fov, innerWidth / innerHeight, P.camera.near, P.camera.far);
  readonly knights = P.colors.map((c) => new KnightView(c));
  arena = createArena();
  private stageId = '';
  private lookScreen = Number.NaN;
  private biome = new T.Group();
  private eventFrame = -1;
  shake = true;
  contrast = false;
  private shakeUntil = 0;
  private echoes: T.Mesh[] = [];
  private swords: T.Mesh[] = [];
  private guards: T.Mesh[] = [];
  readonly bloom: SelectiveBloom;
  private backdrop: Backdrop;
  private dust: T.Points;
  private particles: { mesh: T.Mesh; life: number; vx: number; vy: number }[] = [];
  private cursor = 0;
  private target = new T.Vector3(0, 6, 0);
  constructor(host: HTMLElement) {
    this.renderer = createGraphicsRenderer();
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, P.renderScale));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.info.autoReset = false;
    host.append(this.renderer.domElement);
    this.orbit = new OrbitControls(this.camera, this.renderer.domElement);
    this.orbit.enabled = false;
    this.backdrop = createBackdrop(this.scene);
    this.dust = this.backdrop.dust;
    this.scene.add(this.arena);
    this.knights.forEach((k) => this.scene.add(k.root));
    for (let i = 0; i < 2; i++) {
      const ghost = new T.Mesh(
        new T.IcosahedronGeometry(1.4, 0),
        new T.MeshBasicMaterial({ color: P.colors[i]!, transparent: true, opacity: 0.22, wireframe: true }),
      );
      const sword = new T.Mesh(new T.OctahedronGeometry(0.5), new T.MeshBasicMaterial({ color: P.colors[i]! }));
      sword.scale.set(0.3, 3, 0.3);
      const guard = new T.Mesh(
        new T.RingGeometry(1.6, 1.7, 40, 1, -Math.PI * 0.45, Math.PI * 0.9),
        new T.MeshBasicMaterial({ color: P.colors[i]!, transparent: true, opacity: 0.7, side: T.DoubleSide }),
      );
      this.echoes.push(ghost);
      this.swords.push(sword);
      this.guards.push(guard);
      this.scene.add(ghost, sword, guard);
    }
    this.camera.position.set(0, 8, FRAMING.minDistance);
    this.camera.lookAt(0, 4, 0);
    this.bloom = new SelectiveBloom(this.renderer, this.scene, this.camera);
    const geo = new T.OctahedronGeometry(0.075);
    for (let i = 0; i < P.hitPool; i++) {
      const mesh = new T.Mesh(
        geo,
        new T.MeshBasicMaterial({ color: new T.Color(0xb5fff5).multiplyScalar(2.5), toneMapped: false }),
      );
      mesh.visible = false;
      markBloom(mesh);
      this.scene.add(mesh);
      this.particles.push({ mesh, life: 0, vx: 0, vy: 0 });
    }
    addEventListener('resize', () => this.resize());
  }
  resize() {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(innerWidth, innerHeight);
    this.bloom.setSize(innerWidth, innerHeight);
  }
  /**
   * Dynamic zoom: keep both Knights, and the nearest ledge when a Knight is near it, in frame.
   * About 30% closer than the pre-revision camera at neutral spacing.
   */
  /** Stage dressing; Pilgrimage gets one biome per screen along its continuous floor. */
  private createStageBiome(stageId: string): T.Group {
    if (stageId !== 'pilgrimage') return createBiome(stageId, stageById(stageId).color);
    const group = new T.Group();
    PILGRIMAGE.biomes.forEach((biome, index) => {
      const dressing = createBiome(biome, stageById(biome).color);
      dressing.position.x = screenCentre(index - PILGRIMAGE.finalScreen);
      group.add(dressing);
    });
    return group;
  }

  /** Sky, fog and stage materials follow the stage (and the current Pilgrimage screen). */
  private updateLook(stageId: string, progress: number) {
    const screen = stageId === 'pilgrimage' ? progress : 0;
    if (screen === this.lookScreen) return;
    this.lookScreen = screen;
    const id = stageId === 'pilgrimage' ? PILGRIMAGE.biomes[progress + PILGRIMAGE.finalScreen]! : stageId;
    this.backdrop.setLook(STAGE_LOOK[id] ?? STAGE_LOOK['mirror-sanctum']!);
  }

  private frameFighters(world: WorldState, offset: number) {
    const points: [number, number][] = [];
    for (const p of world.fighters) {
      if (p.eliminated) continue;
      const x = fixed.toNumber(p.x);
      const y = fixed.toNumber(p.y);
      points.push([x, y - 0.5], [x, y + 3.4]);
    }
    const ground = world.surfaces.find((surface) => surface.kind === 'solid');
    if (ground && points.length) {
      const edges = [fixed.toNumber(ground.xMin), fixed.toNumber(ground.xMax)];
      for (const edge of edges) {
        const near = points.some(([x]) => Math.abs(x - edge) < FRAMING.ledgeReach);
        if (near) points.push([edge, 0]);
      }
    }
    if (!points.length) points.push([0, 0], [0, 4]);
    const xs = points.map(([x]) => x);
    const ys = points.map(([, y]) => y);
    const width = (Math.max(...xs) - Math.min(...xs)) * (1 + FRAMING.margin);
    const height = Math.max(FRAMING.minHeight, (Math.max(...ys) - Math.min(...ys)) * (1 + FRAMING.margin));
    const tangent = Math.tan(T.MathUtils.degToRad(this.camera.fov / 2));
    const distance = T.MathUtils.clamp(
      Math.max(height / 2 / tangent, width / 2 / (tangent * this.camera.aspect)),
      FRAMING.minDistance,
      FRAMING.maxDistance,
    );
    const cx = offset + (Math.max(...xs) + Math.min(...xs)) / 2;
    const cy = (Math.max(...ys) + Math.min(...ys)) / 2 + FRAMING.lift;
    this.camera.position.lerp(new T.Vector3(cx, cy + distance * 0.08, distance), FRAMING.follow);
    this.target.lerp(new T.Vector3(cx, cy, 0), FRAMING.follow);
  }

  hit(x: number, y: number) {
    for (let i = 0; i < 12; i++) {
      const p = this.particles[this.cursor++ % this.particles.length]!;
      const a = (i * Math.PI * 2) / 12;
      p.mesh.position.set(x, y, 1);
      p.life = 1;
      p.vx = Math.cos(a) * 0.22;
      p.vy = Math.sin(a) * 0.22;
      p.mesh.visible = true;
    }
  }
  render(world: WorldState, alpha: number, previous: WorldState, now: number, menu: boolean, debug: boolean) {
    const t = now / 1000,
      d = gameData(world),
      duel = duelData(world);
    this.arena.visible = !menu;
    // Pilgrimage is one continuous world; nothing is offset any more.
    const offset = 0;
    if (duel && this.stageId !== duel.options.stage) {
      this.stageId = duel.options.stage;
      this.scene.remove(this.biome);
      this.biome.traverse((o) => {
        if (o instanceof T.Mesh) {
          o.geometry.dispose();
          if (!Array.isArray(o.material)) o.material.dispose();
        }
      });
      this.biome = this.createStageBiome(this.stageId);
      this.lookScreen = Number.NaN;
      this.scene.add(this.biome);
      this.scene.remove(this.arena);
      this.arena.traverse((o) => {
        if (o instanceof T.Mesh) o.geometry.dispose();
      });
      this.arena = createArena(world.surfaces);
      this.scene.add(this.arena);
    }
    this.biome.visible = !menu;
    this.updateLook(duel?.options.stage ?? this.stageId, duel?.progress ?? 0);
    const cracks = this.biome.getObjectByName('fracture-cracks') as T.LineSegments | undefined;
    if (cracks)
      cracks.geometry.setDrawRange(
        0,
        Math.min(32, Object.values(duel?.knights ?? {}).reduce((n, k) => n + k.fractures, 0) * 4),
      );
    this.arena.visible = !menu;
    this.arena.position.x = offset;
    for (const surface of world.surfaces) {
      const mesh = this.arena.getObjectByName(surface.id);
      if (mesh)
        mesh.position.set(fixed.toNumber(fixed.add(surface.xMin, surface.xMax)) / 2, fixed.toNumber(surface.y), 0);
    }
    if (duel && this.eventFrame !== world.frame) {
      this.eventFrame = world.frame;
      for (const event of duel.events)
        if (['shatter', 'fracture', 'guard-break', 'parry', 'clash'].includes(event.type)) {
          this.hit(event.x, event.y + 2);
          if (event.type === 'shatter' || event.type === 'fracture') this.shakeUntil = now + 180;
        }
    }
    this.knights.forEach((k, i) => {
      const p = world.fighters[i]!,
        old = previous.fighters[i] ?? p;
      const dk = duel?.knights[p.id];
      let color = duel ? OATHS[duel.options.oaths[i]!].color : P.colors[i]!;
      if (i === 1 && duel?.options.oaths[0] === duel?.options.oaths[1]) {
        const c = new T.Color(color);
        c.offsetHSL(1 / 6, 0, 0);
        color = c.getHex();
      }
      if (this.contrast) color = i === 0 ? 0x5eeaff : 0xffdc55;
      k.setContrast(this.contrast, color);
      k.setOath(duel?.options.oaths[i] ?? 'unsworn');
      k.setPalette(color, !!dk?.soul.remaining);
      k.update(p, d.knights[p.id]!, t, debug, menu, dk);
      k.blade.visible = !dk?.blade;
      const sword = this.swords[i]!,
        ghost = this.echoes[i]!,
        guard = this.guards[i]!;
      sword.visible = !menu && !!dk?.blade;
      ghost.visible = !menu && !!dk?.ghost;
      guard.visible = !menu && !!dk?.guard;
      if (dk?.blade) {
        sword.position.set(offset + fixed.toNumber(dk.blade.x), fixed.toNumber(dk.blade.y), 0.5);
        sword.rotation.z = t * 22;
      }
      if (dk?.ghost) {
        ghost.position.set(offset + fixed.toNumber(dk.ghost.x), fixed.toNumber(dk.ghost.y) + 2, 0);
        (ghost.material as T.MeshBasicMaterial).opacity = 0.25 * (1 - dk.ghost.age / 20);
      }
      guard.position.set(offset + fixed.toNumber(p.x), fixed.toNumber(p.y) + 1.5, 0.5);
      guard.rotation.z = p.facing === 1 ? 0 : Math.PI;
      if (menu) {
        k.root.visible = i === 0;
        k.root.position.set(5.2, 2.2, 3);
        k.root.scale.setScalar(1.45);
        k.body.rotation.y = -0.25;
      } else {
        k.root.position.x = offset + T.MathUtils.lerp(fixed.toNumber(old.x), fixed.toNumber(p.x), alpha);
        k.root.position.y = T.MathUtils.lerp(fixed.toNumber(old.y), fixed.toNumber(p.y), alpha);
      }
    });
    if (this.freeCamera && !menu) {
      this.orbit.enabled = true;
      this.orbit.update();
    } else if (menu) {
      this.orbit.enabled = false;
      this.camera.position.lerp(new T.Vector3(1.5, 6.5, FRAMING.titleDistance), 0.06);
      this.target.lerp(new T.Vector3(1.5, 5.2, 0), 0.06);
    } else {
      this.frameFighters(world, offset);
    }
    if (this.shake && now < this.shakeUntil) this.camera.position.x += Math.sin(now * 0.18) * 0.09;
    if (!this.freeCamera) {
      this.orbit.enabled = false;
      this.camera.lookAt(this.target);
      this.orbit.target.copy(this.target);
    }
    this.dust.rotation.y = t * 0.008;
    for (const p of this.particles)
      if (p.life > 0) {
        p.life -= 0.045;
        p.mesh.position.x += p.vx;
        p.mesh.position.y += p.vy;
        p.mesh.scale.setScalar(Math.max(0, p.life));
        p.mesh.visible = p.life > 0;
      }
    this.renderer.info.reset();
    this.bloom.render();
  }
}
