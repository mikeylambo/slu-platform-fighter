import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
interface ArtManifest {
  pieces: Record<string, string | null>;
  capeTexture: string | null;
  backdrops: Record<string, string>;
}
const fallback: ArtManifest = { pieces: {}, capeTexture: null, backdrops: {} };
const manifest = fetch(new URL('art.manifest.json', document.baseURI))
  .then((r) => (r.ok ? (r.json() as Promise<ArtManifest>) : fallback))
  .catch(() => fallback);
const loader = new GLTFLoader(),
  cache = new Map<string, Promise<T.Group>>();
/** Resolved URL of a manifest piece (null when the piece is procedural). */
export async function pieceUrl(key: string): Promise<string | null> {
  const url = (await manifest).pieces[key];
  return url ? new URL(url, document.baseURI).href : null;
}

export async function replacePiece(parent: T.Object3D, key: string) {
  const data = await manifest,
    url = data.pieces[key];
  if (!url || parent.userData.asset === key) return;
  let pending = cache.get(url);
  if (!pending) {
    pending = loader.loadAsync(url).then((g) => g.scene);
    cache.set(url, pending);
  }
  try {
    const piece = (await pending).clone(true);
    for (const child of [...parent.children]) parent.remove(child);
    parent.add(piece);
    parent.userData.asset = key;
  } catch (error) {
    console.warn(`Using procedural ${key}:`, error);
  }
}
export async function capeTexture(material: T.MeshStandardMaterial) {
  const url = (await manifest).capeTexture;
  if (url)
    new T.TextureLoader().load(url, (t) => {
      t.colorSpace = T.SRGBColorSpace;
      material.map = t;
      material.needsUpdate = true;
    });
}

export function installPiece(mesh: T.Object3D, key: string) {
  const parent = mesh.parent;
  if (!parent) return;
  const wrapper = new T.Group();
  wrapper.position.copy(mesh.position);
  wrapper.quaternion.copy(mesh.quaternion);
  wrapper.scale.copy(mesh.scale);
  parent.add(wrapper);
  wrapper.add(mesh);
  mesh.position.set(0, 0, 0);
  mesh.quaternion.identity();
  mesh.scale.set(1, 1, 1);
  void replacePiece(wrapper, key);
}
