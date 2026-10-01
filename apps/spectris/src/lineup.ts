/**
 * Helm line-up (proof page): one Knight per Oath on the shared rig, front-facing, against a
 * light neutral ground. `?silhouette` renders every Knight solid black for the 64px test.
 */
import * as T from 'three';
import { KnightView } from './presentation/knight.js';
import { OATHS, type Oath } from './content/rules/duel.js';
import { OATH_LOOK } from './content/presentation.js';
import { createDuel } from './game/duel.js';
import { gameData } from './game/session.js';

const silhouette = new URLSearchParams(location.search).has('silhouette');
const oaths = Object.keys(OATHS) as Oath[];
const renderer = new T.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(1);
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = T.ACESFilmicToneMapping;
document.body.append(renderer.domElement);
const scene = new T.Scene();
scene.background = new T.Color(silhouette ? 0xffffff : 0xd9dee2);
scene.add(new T.HemisphereLight(0xffffff, 0x404850, 1.6));
const key = new T.DirectionalLight(0xffffff, 2);
key.position.set(-6, 10, 8);
scene.add(key);
const spacing = 3.4;
const camera = new T.OrthographicCamera();
const world = createDuel({ cpu: [0, 0] });
const fighter = { ...world.fighters[0]!, x: 0 as never, y: 0 as never, facing: 1 as const };
const knight = gameData(world).knights[world.fighters[0]!.id]!;
const views = oaths.map((oath, index) => {
  const view = new KnightView(OATHS[oath].color);
  view.setOath(oath);
  view.setPalette(OATHS[oath].color);
  view.root.position.x = (index - (oaths.length - 1) / 2) * spacing;
  scene.add(view.root);
  return view;
});
const solid = new T.MeshBasicMaterial({ color: 0x000000 });
function frame(time: number) {
  const width = oaths.length * spacing;
  const height = width * (innerHeight / innerWidth);
  Object.assign(camera, { left: -width / 2, right: width / 2, top: 1.7 + height / 2, bottom: 1.7 - height / 2 });
  camera.position.set(0, 1.7, 20);
  camera.updateProjectionMatrix();
  for (const view of views) {
    view.update(fighter, knight, time / 1000, false, true);
    view.body.rotation.y = 0;
    view.body.position.y = 0;
  }
  scene.overrideMaterial = silhouette ? solid : null;
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
Object.assign(window, { __lineup: { oaths, helms: oaths.map((oath) => OATH_LOOK[oath].helm) } });
