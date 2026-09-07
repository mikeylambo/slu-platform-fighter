import * as THREE from 'three';

export type PlatformFighterVisualTier = 'hero' | 'standard' | 'background';

export interface PlatformFighterVisualContext {
  key: string;
  fighterId?: string;
  stageId?: string;
  entityId?: string;
  itemId?: string;
  metadata?: Readonly<Record<string, unknown>>;
}

export interface PlatformFighterProceduralVisual {
  factory: (context: PlatformFighterVisualContext) => THREE.Group;
  tier?: PlatformFighterVisualTier;
  update?: (visual: THREE.Group, dt: number, context: PlatformFighterVisualContext) => void;
  dispose?: (visual: THREE.Group) => void;
}

export interface MountedPlatformFighterVisual {
  key: string;
  root: THREE.Group;
  update(dt: number): void;
  dispose(): void;
}

const entries = new Map<string, PlatformFighterProceduralVisual>();

/**
 * Presentation-only registry. Deterministic simulation, hitboxes, stage collision,
 * rollback state, and gameplay timing never read from generated Three.js geometry.
 *
 * Stable key families:
 * fighter.<id>.default
 * stage.<id>.default
 * entity.<id>.default
 * item.<id>.default
 * prop.<id>.default
 */
export function registerPlatformFighterVisual(key: string, registration: PlatformFighterProceduralVisual): void {
  assertKey(key);
  if (entries.has(key)) throw new Error(`Procedural visual already registered: ${key}`);
  entries.set(key, registration);
}

export function replacePlatformFighterVisual(key: string, registration: PlatformFighterProceduralVisual): void {
  assertKey(key);
  entries.set(key, registration);
}

export function hasPlatformFighterVisual(key: string): boolean {
  return entries.has(key);
}

export function registeredPlatformFighterVisualKeys(): string[] {
  return [...entries.keys()].sort();
}

export function mountPlatformFighterVisual(
  key: string,
  anchor: THREE.Object3D,
  context: Omit<PlatformFighterVisualContext, 'key'> = {},
): MountedPlatformFighterVisual | null {
  const registration = entries.get(key);
  if (!registration) return null;
  const fullContext: PlatformFighterVisualContext = { key, ...context };
  const root = registration.factory(fullContext);
  root.userData.sluPresentationOnly = true;
  root.userData.sluVisualKey = key;
  root.traverse((child) => {
    child.userData.sluPresentationOnly = true;
    child.userData.sluVisualKey = key;
  });
  anchor.add(root);
  let disposed = false;
  return {
    key,
    root,
    update(dt: number) {
      if (!disposed) registration.update?.(root, dt, fullContext);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      registration.dispose?.(root);
      root.removeFromParent();
      disposeThreeObject(root);
    },
  };
}

function disposeThreeObject(root: THREE.Object3D): void {
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.geometry?.dispose();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) material.dispose();
  });
}

function assertKey(key: string): void {
  if (!/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/.test(key)) throw new Error(`Invalid procedural visual key: ${key}`);
}
