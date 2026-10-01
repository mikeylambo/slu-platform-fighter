/**
 * Soulfire: a generic, deterministic buff state ("Kindle" in Spectris).
 *
 * A character supplies a parameter pack (cost, timing, multipliers, finisher)
 * and optional effect hooks. The module owns the timeline and the rules every
 * consumer shares; content owns the numbers and the flavour.
 */

export interface SoulfireState {
  remaining: number;
  activating: number;
  freeFlash: boolean;
}

export interface SoulfireFinisher {
  /** Move key started when the finisher is requested while the buff is active. */
  moveKey: string;
}

/** How simultaneous ignition is resolved. `clash` hands control to the consumer's clash module. */
export type DoubleIgniteRule = 'clash' | 'both-keep' | 'both-cancel';

/** Effect hooks. Each receives a consumer-defined context so hooks stay character agnostic. */
export interface SoulfireHooks<Context> {
  /** The buffed fighter landed a hit. */
  onHit?: (context: Context) => void;
  /** Adjusts guard chip dealt by the buffed fighter, after the pack multiplier. */
  onGuardChip?: (chip: number, context: Context) => number;
  /** Adjusts the meter cost of a feint while buffed, after the pack's free-feint rule. */
  onFeint?: (cost: number, context: Context) => number;
  /** The buff expired or was cancelled. */
  onEnd?: (context: Context) => void;
}

export interface SoulfirePack<Context = unknown> {
  duration: number;
  activation: number;
  cost: number;
  /** Multiplier applied to guard chip dealt while active. */
  guardChip: number;
  freeFeints: boolean;
  /** Grants one free stance flash per ignition. */
  freeFlash?: boolean;
  /** Meter cannot be gained while active. */
  blocksMeterGain?: boolean;
  finisher?: SoulfireFinisher;
  doubleIgnite?: DoubleIgniteRule;
  hooks?: SoulfireHooks<Context>;
}

export const emptySoulfire = (): SoulfireState => ({
  remaining: 0,
  activating: 0,
  freeFlash: false,
});

export const isActive = (state: SoulfireState): boolean => state.remaining > 0;

export const isActivating = (state: SoulfireState): boolean => state.activating > 0;

/** Spends the pack cost and starts the buff, or returns null when meter is short. */
export function ignite<Context>(
  pack: SoulfirePack<Context>,
  meter: number,
): { state: SoulfireState; meter: number } | null {
  if (meter < pack.cost) {
    return null;
  }
  const state: SoulfireState = {
    remaining: pack.duration,
    activating: pack.activation,
    freeFlash: pack.freeFlash ?? true,
  };
  return { state, meter: meter - pack.cost };
}

/** Advances the buff by one frame. Fires `onEnd` on the frame it expires. */
export function tickSoulfire<Context>(
  state: SoulfireState,
  pack?: SoulfirePack<Context>,
  context?: Context,
): SoulfireState {
  const next: SoulfireState = {
    ...state,
    remaining: Math.max(0, state.remaining - 1),
    activating: Math.max(0, state.activating - 1),
  };
  if (state.remaining === 1 && context !== undefined) {
    pack?.hooks?.onEnd?.(context);
  }
  return next;
}

/** Ends the buff early (finisher, clash loss). */
export function extinguish<Context>(pack?: SoulfirePack<Context>, context?: Context): SoulfireState {
  if (context !== undefined) {
    pack?.hooks?.onEnd?.(context);
  }
  return emptySoulfire();
}

/** Requests the finisher: returns the move to start and the extinguished state, or null when inactive. */
export function requestFinisher<Context>(
  pack: SoulfirePack<Context>,
  state: SoulfireState,
  context?: Context,
): { state: SoulfireState; moveKey: string } | null {
  if (!isActive(state) || !pack.finisher) {
    return null;
  }
  return { state: extinguish(pack, context), moveKey: pack.finisher.moveKey };
}

/** Whether meter gain is currently allowed. */
export function canGainMeter<Context>(pack: SoulfirePack<Context>, state: SoulfireState): boolean {
  return !(pack.blocksMeterGain ?? true) || !isActive(state);
}

/** Guard chip dealt by an attacker with this buff state. */
export function guardChip<Context>(
  pack: SoulfirePack<Context>,
  state: SoulfireState,
  chip: number,
  context?: Context,
): number {
  if (!isActive(state)) {
    return chip;
  }
  const scaled = chip * pack.guardChip;
  if (context === undefined || !pack.hooks?.onGuardChip) {
    return scaled;
  }
  return pack.hooks.onGuardChip(scaled, context);
}

/** Meter cost of a feint for a fighter with this buff state. */
export function feintCost<Context>(
  pack: SoulfirePack<Context>,
  state: SoulfireState,
  cost: number,
  context?: Context,
): number {
  if (!isActive(state)) {
    return cost;
  }
  const base = pack.freeFeints ? 0 : cost;
  if (context === undefined || !pack.hooks?.onFeint) {
    return base;
  }
  return pack.hooks.onFeint(base, context);
}

/** Notifies the pack that the buffed fighter landed a hit. */
export function notifyHit<Context>(pack: SoulfirePack<Context>, state: SoulfireState, context: Context): void {
  if (isActive(state)) {
    pack.hooks?.onHit?.(context);
  }
}

/** Consumes the one free flash if available. */
export function consumeFreeFlash(state: SoulfireState): boolean {
  if (!state.freeFlash) {
    return false;
  }
  state.freeFlash = false;
  return true;
}

/** True when every participant is buffed at once and the double-ignite rule applies. */
export function isDoubleIgnite(states: readonly SoulfireState[]): boolean {
  return states.length > 1 && states.every(isActive);
}

/**
 * Resolves a double ignition once the consumer has decided a winner (index) or a tie (null).
 * Under `clash`, the winner keeps the buff and every other participant is extinguished; a tie
 * extinguishes everyone.
 */
export function resolveDoubleIgnite(
  rule: DoubleIgniteRule,
  states: readonly SoulfireState[],
  winner: number | null,
): SoulfireState[] {
  if (rule === 'both-keep') {
    return states.map((state) => ({ ...state }));
  }
  if (rule === 'both-cancel' || winner === null) {
    return states.map(() => emptySoulfire());
  }
  return states.map((state, index) => (index === winner ? { ...state } : emptySoulfire()));
}
