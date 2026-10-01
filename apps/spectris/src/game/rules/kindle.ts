import {
  feintCost,
  guardChip,
  ignite,
  isActive,
  isDoubleIgnite,
  notifyHit,
  requestFinisher,
  resolveDoubleIgnite,
  tickSoulfire,
  type SoulfirePack,
} from '../../../../../packages/soulfire/src/soulfire.js';
import type { FighterState } from '../../../../../packages/sim/src/types.js';
import { DUEL, type Oath } from '../../content/rules/duel.js';
import { KINDLE, OATH_EFFECTS } from '../../content/rules/oaths.js';
import { emit, freeze, setAttack, type Actor, type DuelKnight, type DuelState, type Frame } from './state.js';

/** Context handed to Oath Kindle hooks when the Kindled Knight lands a hit. */
export interface KindleHitContext {
  attacker: DuelKnight;
  target: DuelKnight;
}

function buildPack(oath: Oath): SoulfirePack<KindleHitContext> {
  const effect = OATH_EFFECTS[oath].kindle;
  return {
    ...KINDLE,
    hooks: {
      onHit: ({ target }) => {
        if (effect.burnFrames) {
          target.burn = effect.burnFrames;
        }
        if (effect.hitDrain) {
          target.meter = Math.max(0, target.meter - effect.hitDrain);
        }
      },
    },
  };
}

const PACKS = new Map((Object.keys(OATH_EFFECTS) as Oath[]).map((oath) => [oath, buildPack(oath)]));

/** The Soulfire parameter pack for an Oath's Kindle. */
export const kindlePack = (oath: Oath): SoulfirePack<KindleHitContext> => PACKS.get(oath)!;

export function tickKindle(k: DuelKnight): void {
  k.soul = tickSoulfire(k.soul);
}

/** Kindle activation is intangible and locks the Knight. */
export function holdActivation(actor: Actor): void {
  const { k, p } = actor;
  if (!k.soul.activating) {
    return;
  }
  p.invulnerableFrames = Math.max(p.invulnerableFrames, DUEL.sustain);
  k.lock = Math.max(k.lock, 1);
}

/** Special + Guard: ignites Kindle, or fires the finisher if already Kindled. */
export function tryKindle(actor: Actor): boolean {
  const { raw, k, p, oath, effects, frame } = actor;
  if (!raw.specialPressed || !raw.shieldHeld) {
    return false;
  }
  const pack = kindlePack(oath);
  const finisher = requestFinisher(pack, k.soul);
  if (finisher) {
    k.soul = finisher.state;
    setAttack(p, finisher.moveKey);
  } else {
    const buff = ignite(pack, k.meter);
    if (buff) {
      k.soul = buff.state;
      k.meter = buff.meter;
      if (effects.kindle.extraJumps) {
        p.jumpsRemaining += effects.kindle.extraJumps;
        k.bonusJump = true;
      }
      k.lock = pack.activation;
      emit(frame.d, 'kindle', p);
    }
  }
  freeze(frame, p);
  return true;
}

/** Iron Kindle: smashes ignore hitstun while Kindled. */
export function kindleArmorsMove(k: DuelKnight, oath: Oath, key: string): boolean {
  return !!OATH_EFFECTS[oath].kindle.smashArmor && isActive(k.soul) && key.endsWith('smash');
}

/** Iron Kindle: hits up to the armor threshold do not interrupt a smash. */
export function kindleAbsorbs(k: DuelKnight, oath: Oath, key: string | undefined, damage: number): boolean {
  const armor = OATH_EFFECTS[oath].kindle.smashArmor;
  return !!armor && isActive(k.soul) && !!key?.endsWith('smash') && damage <= armor;
}

/** Applies Oath Kindle on-hit effects (Ember burn, Hunger drain). */
export function kindleOnHit(attacker: DuelKnight, target: DuelKnight, oath: Oath): void {
  notifyHit(kindlePack(oath), attacker.soul, { attacker, target });
}

/** Guard chip dealt by an attacker, doubled while Kindled. */
export const kindleGuardChip = (attacker: DuelKnight, oath: Oath, chip: number): number =>
  guardChip(kindlePack(oath), attacker.soul, chip);

/** Feint cost for a Knight, free while Kindled. */
export const kindleFeintCost = (k: DuelKnight, oath: Oath): number =>
  feintCost(kindlePack(oath), k.soul, DUEL.meter.feint);

/** Parry window, widened by Stillness Kindle. */
export function parryWindow(k: DuelKnight, oath: Oath): number {
  const kindled = OATH_EFFECTS[oath].kindle.parryWindow;
  return kindled && isActive(k.soul) ? kindled : DUEL.guard.parry;
}

/** Burns (Ember Kindle) apply their Strain when the timer runs out. */
export function tickBurn(actor: Actor): void {
  const { k, p } = actor;
  if (k.burn > 0 && --k.burn === 0) {
    p.percentTenths = Math.min(DUEL.maxStrain, p.percentTenths + burnStrainAgainst(actor));
  }
}

/** The burn Strain is set by the Oath of the Knight who inflicted it (the opponent). */
function burnStrainAgainst(actor: Actor): number {
  const opponentOath = actor.frame.d.options.oaths[1 - actor.index]!;
  return OATH_EFFECTS[opponentOath].kindle.burnStrain;
}

/** Both Knights Kindled at once force a clash (GDD 3.12). */
export function detectDoubleKindle(frame: Frame, fighters: readonly FighterState[]): boolean {
  const { d } = frame;
  const souls = fighters.map((p) => d.knights[p.id]!.soul);
  if (!isDoubleIgnite(souls) || d.doubleKindle) {
    return false;
  }
  d.doubleKindle = true;
  return true;
}

/** Winner keeps Kindle, loser is extinguished; a tie extinguishes both. */
export function resolveDoubleKindle(d: DuelState, ids: readonly string[], winner: 0 | 1 | null): void {
  const knights = ids.map((id) => d.knights[id]!);
  const souls = resolveDoubleIgnite(
    KINDLE.doubleIgnite,
    knights.map((k) => k.soul),
    winner,
  );
  knights.forEach((k, index) => {
    k.soul = souls[index]!;
  });
}
