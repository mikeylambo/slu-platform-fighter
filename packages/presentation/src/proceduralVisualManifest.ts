import { registeredPlatformFighterVisualKeys } from './proceduralVisualRegistry.js';

/**
 * Single registration point for approved image-to-Three.js presentation assets.
 *
 * Generated factories should live beside this package (or in a game-specific
 * presentation folder) and register stable keys here. Keep fighter simulation,
 * hitboxes, hurtboxes, stage collision, and rollback state completely separate.
 *
 * Recommended keys:
 * fighter.<id>.overlay   generated armor/weapon/energy/accessory layer
 * stage.<id>.default    procedural stage presentation
 * entity.<id>.default   summons/projectiles/assist presentation
 * item.<id>.default     item presentation
 * prop.<id>.default     non-gameplay world dressing
 */
export function bootPlatformFighterProceduralVisualManifest(): void {
  const keys = registeredPlatformFighterVisualKeys();
  if (keys.length > 0) console.info(`Platform Fighter procedural visuals // ${keys.join(', ')}`);
}
