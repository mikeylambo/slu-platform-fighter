import type { Fixed } from '../../deterministic-math/src/fixed.js';

export type ItemUseMode = 'swing' | 'throw' | 'consume' | 'activate';
export interface ItemDefinition {
  id: string;
  holdSocket: string;
  pickupRadius: Fixed;
  useMode: ItemUseMode;
  maxUses: number;
  throwable: boolean;
  lifetimeFrames: number | null;
}
export interface ItemSpawnEntry { itemDefinitionId: string; weight: number; }
export interface ItemSpawnTable { id: string; entries: readonly ItemSpawnEntry[]; intervalFrames: number; maxActive: number; }
export interface ItemRules { enabled: boolean; spawnTableId: string | null; }
export interface ItemState {
  id: string;
  definitionId: string;
  x: Fixed; y: Fixed; vx: Fixed; vy: Fixed;
  holderId: string | null;
  usesRemaining: number;
  ageFrames: number;
}

export function validateItemDefinition(definition: ItemDefinition): void {
  if (!definition.id || !definition.holdSocket) throw new Error('item requires id and holdSocket');
  if (!Number.isInteger(definition.pickupRadius) || definition.pickupRadius < 0) throw new Error(`${definition.id} pickupRadius must be nonnegative fixed integer`);
  if (!Number.isInteger(definition.maxUses) || definition.maxUses < 1) throw new Error(`${definition.id} maxUses must be positive integer`);
  if (definition.lifetimeFrames !== null && (!Number.isInteger(definition.lifetimeFrames) || definition.lifetimeFrames < 1)) throw new Error(`${definition.id} lifetimeFrames must be positive integer or null`);
}
export function validateItemSpawnTable(table: ItemSpawnTable, definitions: ReadonlyMap<string, ItemDefinition>): void {
  if (!table.id || !Number.isInteger(table.intervalFrames) || table.intervalFrames < 1 || !Number.isInteger(table.maxActive) || table.maxActive < 0) throw new Error('invalid item spawn table');
  if (table.entries.length === 0) throw new Error(`${table.id} must contain entries`);
  for (const entry of table.entries) {
    if (!definitions.has(entry.itemDefinitionId)) throw new Error(`${table.id} references unknown item ${entry.itemDefinitionId}`);
    if (!Number.isInteger(entry.weight) || entry.weight < 1) throw new Error(`${table.id}/${entry.itemDefinitionId} weight must be positive integer`);
  }
}
export function pickupItem(item: ItemState, fighterId: string): ItemState {
  if (item.holderId !== null) throw new Error(`${item.id} is already held`);
  return { ...item, holderId: fighterId, vx: 0 as Fixed, vy: 0 as Fixed };
}
export function dropItem(item: ItemState, x: Fixed, y: Fixed, vx: Fixed, vy: Fixed): ItemState { return { ...item, holderId: null, x, y, vx, vy }; }
export function consumeItemUse(item: ItemState): ItemState | null {
  const remaining = item.usesRemaining - 1;
  return remaining <= 0 ? null : { ...item, usesRemaining: remaining };
}
