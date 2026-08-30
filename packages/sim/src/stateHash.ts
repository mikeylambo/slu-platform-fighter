import { serializeWorldState } from './serialize.js';
import type { WorldState } from './types.js';

/** 64-bit FNV-1a over canonical binary world state; stable in browsers and Node. */
export function hashBytes64(bytes: Uint8Array): string {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  for (const byte of bytes) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * prime);
  }
  return hash.toString(16).padStart(16, '0');
}

export function hashWorldState(state: WorldState): string {
  return hashBytes64(serializeWorldState(state));
}
