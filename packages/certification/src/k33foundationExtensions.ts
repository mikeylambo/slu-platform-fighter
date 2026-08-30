import { fixed } from '../../deterministic-math/src/fixed.js';
import { validateArmorPolicy, validateCancelWindowPolicy, validateCombatModifierPolicy, validateParryPolicy } from '../../sim/src/combatPolicies.js';
import { consumeItemUse, dropItem, pickupItem, validateItemDefinition, validateItemSpawnTable, type ItemDefinition, type ItemState } from '../../sim/src/items.js';
import { hazardActiveAtFrame, resolveHazardEffect } from '../../sim/src/stageHazards.js';
import { createDefaultPlayerProfile, migratePlayerProfile, validatePlayerProfile } from '../../shell/src/profile.js';
import { assertNoPresentationRootMotion, emphasisForHit, type PresentationPolicy } from '../../presentation/src/policies.js';
import type { StageHazardDefinition } from '../../content/src/compileStage.js';

function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(`K33 foundation-extension certification failure: ${message}`); }

validateArmorPolicy({ launchThreshold: fixed.fromInt(4), retainDamage: true });
validateArmorPolicy({ launchThreshold: null, retainDamage: true });
validateParryPolicy({ enabled: true, perfectWindowFrames: 3, attackerFreezeFrames: 8, defenderAdvantageFrames: 4, shieldHealthCost: 0 });
validateCancelWindowPolicy({ allowedActions: ['jump', 'special'], requireHitConfirm: true, allowBlockConfirm: false });
validateCombatModifierPolicy({ staleMove: { enabled: true, queueSize: 3, multipliersPermille: [1000, 900, 800] }, comeback: { enabled: true, maxBonusPermille: 120, startPercentTenths: 1000, fullPercentTenths: 1800 } });

const itemDef: ItemDefinition = { id: 'cert-baton', holdSocket: 'hand_r', pickupRadius: fixed.fromInt(1), useMode: 'swing', maxUses: 2, throwable: true, lifetimeFrames: null };
validateItemDefinition(itemDef); validateItemSpawnTable({ id: 'cert-table', entries: [{ itemDefinitionId: itemDef.id, weight: 1 }], intervalFrames: 300, maxActive: 1 }, new Map([[itemDef.id, itemDef]]));
let item: ItemState | null = { id: 'i1', definitionId: itemDef.id, x: fixed.zero, y: fixed.zero, vx: fixed.zero, vy: fixed.zero, holderId: null, usesRemaining: 2, ageFrames: 0 };
item = pickupItem(item, 'p1'); assert(item.holderId === 'p1', 'pickup must establish holder');
item = dropItem(item, fixed.fromInt(2), fixed.fromInt(3), fixed.fromInt(1), fixed.zero); assert(item.holderId === null && item.x === fixed.fromInt(2), 'drop must restore world position/velocity');
item = consumeItemUse(item); assert(item?.usesRemaining === 1, 'item use must decrement authored uses'); item = consumeItemUse(item!); assert(item === null, 'item must despawn when uses exhaust');

const damageHazard: StageHazardDefinition = { id: 'lava', kind: 'damage', x: fixed.zero, y: fixed.zero, radius: fixed.fromInt(2), activeFrames: 10, inactiveFrames: 10, phaseFrames: 0 };
assert(hazardActiveAtFrame(damageHazard, 0) && !hazardActiveAtFrame(damageHazard, 10), 'hazard cadence must be deterministic');
const hazardEffect = resolveHazardEffect(damageHazard, 'p1', { damageTenthsByHazardId: { lava: 120 } }); assert(hazardEffect.type === 'damage' && hazardEffect.damageTenths === 120, 'hazard effect must come from authored external policy');

const profile = createDefaultPlayerProfile('cert'); validatePlayerProfile(profile); assert(migratePlayerProfile(profile).profileId === 'cert', 'versioned profile must round-trip through migration gate');

const presentation: PresentationPolicy = { rootMotion: 'disabled', hitstopCameraFreeze: true, launchZoomEmphasis: true, screenShakeScalePermille: 800, heldItemSocketRole: 'hand_r' };
const cue = emphasisForHit(6, 2_000_000, presentation); assert(cue.freezeCameraFrames === 6 && cue.zoomPermille >= 1000, 'presentation emphasis must derive from semantic hit data only');
let rootRejected = false; try { assertNoPresentationRootMotion(presentation, { x: 1, y: 0, z: 0 }); } catch { rootRejected = true; } assert(rootRejected, 'disabled presentation root motion must reject animation-driven displacement');

console.log('K33 FOUNDATION EXTENSIONS PASS — policy-driven armor/parry/cancels/modifiers, generic items, authored hazard effects, versioned player profile/accessibility and presentation/root-motion contracts are structurally ready without flagship values baked into the kernel.');
