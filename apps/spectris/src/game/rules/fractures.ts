import { fixed as f } from '../../../../../packages/deterministic-math/src/fixed.js';
import { stepStockLifecycle, type StockMatchRules } from '../../../../../packages/sim/src/lifecycle.js';
import type { HitEvent } from '../../../../../packages/sim/src/combat.js';
import type { MatchEvent } from '../../../../../packages/sim/src/match.js';
import type { FighterState } from '../../../../../packages/sim/src/types.js';
import { StrainFractures } from '../../../../../packages/life-system/src/life.js';
import { LIFE, type Oath } from '../../content/rules/duel.js';
import { MOVES } from '../../content/knight/moves/index.js';
import { kindleOnHit } from './kindle.js';
import { hitMeter } from './meter.js';
import { emit, initialKnight, type DuelState, type Frame } from './state.js';

export const LIFE_SYSTEM = new StrainFractures(LIFE);

/** Cape Fair: only the outer sweetspot (first hitbox) is Shatter-class. */
const SWEETSPOT_ONLY = new Map([['cape:forward-air', ':0']]);

/** Whether this hit is Shatter-class (GDD 3.5). */
export function isShatterHit(hit: HitEvent): boolean {
  if (!MOVES.get(hit.attackId)?.shatter) {
    return false;
  }
  const sweetspot = SWEETSPOT_ONLY.get(hit.attackId);
  return !sweetspot || hit.hitboxId.endsWith(sweetspot);
}

/**
 * Applies an unguarded hit: meter, Kindle effects, Rift-cut recovery, and the Shatter check
 * against the Strain the target had before the hit.
 */
export function applyHit(
  frame: Frame,
  hit: HitEvent,
  target: FighterState,
  attacker: FighterState,
  before: FighterState,
  attackerOath: Oath,
): void {
  const { d } = frame;
  const k = d.knights[target.id]!;
  const ak = d.knights[attacker.id]!;
  hitMeter(ak, k, hit.damageTenths);
  target.percentTenths = LIFE_SYSTEM.clampDamage(target.percentTenths);
  kindleOnHit(ak, k, attackerOath);
  if (hit.attackId.endsWith(':rift-cut')) {
    ak.helpless = false;
  }
  const lethal = isShatterHit(hit);
  if (
    LIFE_SYSTEM.losesLife({
      damage: before.percentTenths,
      lethal,
      outside: false,
    })
  ) {
    frame.shatterTargets.add(target.id);
  }
}

/** A Shatter takes a Fracture immediately by routing the Knight through PF's blast-zone lifecycle. */
export function shatter(frame: Frame, p: FighterState, rules: StockMatchRules, events: MatchEvent[]): void {
  if (p.respawnFrames || p.eliminated) {
    return;
  }
  p.x = f.add(rules.blastRight, f.one);
  const life = stepStockLifecycle([p], null, rules);
  Object.assign(p, life.fighters[0]);
  events.push(...life.events);
  emit(frame.d, 'shatter', p);
}

/** A lost Fracture resets the Knight's duel state, keeping meter and match statistics. */
export function takeFracture(d: DuelState, p: FighterState): void {
  const k = d.knights[p.id]!;
  k.fractures++;
  const fresh = initialKnight();
  d.knights[p.id] = {
    ...fresh,
    meter: k.meter,
    parries: k.parries,
    clashes: k.clashes,
    fractures: k.fractures,
  };
  emit(d, 'fracture', p);
}
