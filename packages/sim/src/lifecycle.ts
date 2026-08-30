import { fixed, type Fixed } from '../../deterministic-math/src/fixed.js';
import { DEFAULT_SHIELD_HEALTH } from './world.js';
import type { FighterState } from './types.js';

export interface StockMatchRules {
  blastLeft: Fixed;
  blastRight: Fixed;
  blastBottom: Fixed;
  blastTop: Fixed;
  respawnXSpacing: Fixed;
  respawnY: Fixed;
  respawnFrames: number;
  respawnInvulnerableFrames: number;
  /** Maximum frames after damaging contact that still receives KO credit. */
  koCreditWindowFrames?: number;
}

export const DEFAULT_STOCK_MATCH_RULES: StockMatchRules = {
  blastLeft: fixed.fromInt(-25),
  blastRight: fixed.fromInt(25),
  blastBottom: fixed.fromInt(-15),
  blastTop: fixed.fromInt(20),
  respawnXSpacing: fixed.fromRatio(3, 2),
  respawnY: fixed.fromInt(8),
  respawnFrames: 60,
  respawnInvulnerableFrames: 120,
  koCreditWindowFrames: 600,
};

export interface KoEvent {
  type: 'ko';
  fighterId: string;
  stocksAfter: number;
  eliminated: boolean;
  creditedAttackerId: string | null;
  selfDestruct: boolean;
}

export interface RespawnEvent {
  type: 'respawn';
  fighterId: string;
}

export type LifecycleEvent = KoEvent | RespawnEvent;

function outsideBlastZone(fighter: FighterState, rules: StockMatchRules): boolean {
  return fighter.x < rules.blastLeft || fighter.x > rules.blastRight || fighter.y < rules.blastBottom || fighter.y > rules.blastTop;
}

function respawnX(index: number, count: number, rules: StockMatchRules): Fixed {
  const centeredTwice = index * 2 - (count - 1);
  return fixed.mul(fixed.fromRatio(centeredTwice, 2), rules.respawnXSpacing);
}

function clearForRespawn(fighter: FighterState, x: Fixed, rules: StockMatchRules, frames: number): FighterState {
  return {
    ...fighter,
    x,
    y: rules.respawnY,
    vx: fixed.zero,
    vy: fixed.zero,
    grounded: false,
    groundSurfaceId: null,
    facing: x > fixed.zero ? -1 : 1,
    locomotion: 'respawn',
    locomotionFrame: 0,
    jumpsRemaining: 1,
    fastFalling: false,
    dropThroughFrames: 0,
    jumpBufferFrames: 0,
    ledgeId: null,
    ledgeRegrabLockoutFrames: 0,
    invulnerableFrames: frames === 0 ? rules.respawnInvulnerableFrames : 0,
    dodgeCooldownFrames: 0,
    techBufferFrames: 0,
    percentTenths: 0,
    hitlagFrames: 0,
    hitstunFrames: 0,
    attack: null,
    shielding: false,
    shieldHealth: DEFAULT_SHIELD_HEALTH,
    shieldStunFrames: 0,
    shieldRegenDelayFrames: 0,
    grabTargetId: null,
    grabbedById: null,
    grabFrames: 0,
    grabAction: null,
    lastHitById: null,
    lastHitFrame: -1,
    respawnFrames: frames,
  };
}

function koCredit(fighter: FighterState, currentFrame: number, rules: StockMatchRules): { creditedAttackerId: string | null; selfDestruct: boolean } {
  const creditWindow = rules.koCreditWindowFrames ?? 600;
  const recent = fighter.lastHitById !== null && fighter.lastHitFrame >= 0 && currentFrame - fighter.lastHitFrame <= creditWindow;
  const creditedAttackerId = recent && fighter.lastHitById !== fighter.id ? fighter.lastHitById : null;
  return { creditedAttackerId, selfDestruct: creditedAttackerId === null };
}

export function stepStockLifecycle(
  fightersInput: FighterState[],
  winnerIdInput: string | null,
  rules: StockMatchRules = DEFAULT_STOCK_MATCH_RULES,
  currentFrame = 0,
): { fighters: FighterState[]; winnerId: string | null; events: LifecycleEvent[] } {
  const sorted = [...fightersInput].sort((a, b) => a.id.localeCompare(b.id));
  const spawnIndex = new Map(sorted.map((fighter, index) => [fighter.id, index] as const));
  const fighters = sorted.map((fighter) => ({ ...fighter }));
  const events: LifecycleEvent[] = [];

  for (let index = 0; index < fighters.length; index += 1) {
    const fighter = fighters[index];
    if (!fighter || fighter.eliminated) continue;

    const position = respawnX(spawnIndex.get(fighter.id) ?? index, fighters.length, rules);
    if (fighter.respawnFrames > 0) {
      const remaining = fighter.respawnFrames - 1;
      if (remaining === 0) {
        fighters[index] = clearForRespawn(fighter, position, rules, 0);
        events.push({ type: 'respawn', fighterId: fighter.id });
      } else {
        fighters[index] = { ...clearForRespawn(fighter, position, rules, remaining), stocks: fighter.stocks, eliminated: false };
      }
      continue;
    }

    if (!outsideBlastZone(fighter, rules)) continue;
    const stocksAfter = Math.max(0, fighter.stocks - 1);
    const eliminated = stocksAfter === 0;
    const credit = koCredit(fighter, currentFrame, rules);
    if (eliminated) {
      fighters[index] = {
        ...fighter,
        stocks: 0,
        eliminated: true,
        respawnFrames: 0,
        vx: fixed.zero,
        vy: fixed.zero,
        hitlagFrames: 0,
        hitstunFrames: 0,
        attack: null,
        shielding: false,
        grabTargetId: null,
        grabbedById: null,
        grabFrames: 0,
        grabAction: null,
        lastHitById: null,
        lastHitFrame: -1,
      };
    } else {
      fighters[index] = { ...clearForRespawn(fighter, position, rules, rules.respawnFrames), stocks: stocksAfter, eliminated: false };
    }
    events.push({ type: 'ko', fighterId: fighter.id, stocksAfter, eliminated, ...credit });
  }

  const eliminatedIds = new Set(fighters.filter((fighter) => fighter.eliminated || fighter.respawnFrames > 0).map((fighter) => fighter.id));
  for (let index = 0; index < fighters.length; index += 1) {
    const fighter = fighters[index];
    if (!fighter) continue;
    const lostTarget = fighter.grabTargetId !== null && eliminatedIds.has(fighter.grabTargetId);
    const lostCaptor = fighter.grabbedById !== null && eliminatedIds.has(fighter.grabbedById);
    if (lostTarget || lostCaptor) {
      fighters[index] = {
        ...fighter,
        grabTargetId: lostTarget ? null : fighter.grabTargetId,
        grabbedById: lostCaptor ? null : fighter.grabbedById,
        grabFrames: 0,
        grabAction: lostTarget ? null : fighter.grabAction,
        locomotion: lostCaptor ? (fighter.grounded ? 'idle' : 'airborne') : fighter.locomotion,
      };
    }
  }

  let winnerId = winnerIdInput;
  if (winnerId === null && fighters.length > 1) {
    const survivors = fighters.filter((fighter) => !fighter.eliminated);
    if (survivors.length === 1) winnerId = survivors[0]?.id ?? null;
  }

  return { fighters, winnerId, events };
}
