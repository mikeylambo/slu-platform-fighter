/** Generic stance transition. No renderer, clock, or character dependency. */
export interface StanceState {
  id: string;
  unfurl: number;
  switchedAirborne: boolean;
}

export interface StanceRules {
  ids: readonly string[];
  unfurlFrames: number;
  airborneSwitches: 'once' | 'unlimited';
}

export function requestStance(state: StanceState, rules: StanceRules, airborne: boolean): StanceState {
  if (state.unfurl > 0 || (airborne && state.switchedAirborne && rules.airborneSwitches === 'once')) return state;
  const index = rules.ids.indexOf(state.id);
  if (index < 0) throw new Error(`Unknown stance ${state.id}`);
  return {
    id: rules.ids[(index + 1) % rules.ids.length]!,
    unfurl: rules.unfurlFrames,
    switchedAirborne: airborne || state.switchedAirborne,
  };
}

export function tickStance(state: StanceState, refresh: boolean): StanceState {
  return {
    ...state,
    unfurl: Math.max(0, state.unfurl - 1),
    switchedAirborne: refresh ? false : state.switchedAirborne,
  };
}

/** True while the stance switch is still unfurling (the fighter cannot act). */
export const isUnfurling = (state: StanceState): boolean => state.unfurl > 0;

/** Skips the remaining unfurl (a paid "flash" switch). */
export function flashStance(state: StanceState): StanceState {
  return { ...state, unfurl: 0 };
}

/** Identifier of a move in a per-stance move table: `<stance>:<move>`. */
export const stanceMoveId = (stance: string, move: string): string => `${stance}:${move}`;

/** Splits a stance move identifier into its stance and move key. */
export function parseStanceMoveId(id: string): {
  stance: string;
  move: string;
} {
  const split = id.indexOf(':');
  if (split < 0) return { stance: '', move: id };
  return { stance: id.slice(0, split), move: id.slice(split + 1) };
}

/** Per-stance move tables: a move key resolves to a different entry depending on the stance. */
export class StanceMoveTable<Move> {
  private readonly entries = new Map<string, Move>();

  constructor(readonly stances: readonly string[]) {}

  set(stance: string, move: string, entry: Move): void {
    if (!this.stances.includes(stance)) throw new Error(`Unknown stance ${stance}`);
    this.entries.set(stanceMoveId(stance, move), entry);
  }

  /** Registers the same entry for every stance (shared ground moves). */
  setShared(move: string, entry: Move): void {
    for (const stance of this.stances) this.set(stance, move, entry);
  }

  lookup(stance: string, move: string): Move | undefined {
    return this.entries.get(stanceMoveId(stance, move));
  }

  get(id: string): Move | undefined {
    return this.entries.get(id);
  }

  has(stance: string, move: string): boolean {
    return this.entries.has(stanceMoveId(stance, move));
  }

  /** Move keys available in a stance. */
  keys(stance: string): string[] {
    const prefix = `${stance}:`;
    return [...this.entries.keys()].filter((id) => id.startsWith(prefix)).map((id) => id.slice(prefix.length));
  }

  entriesById(): IterableIterator<[string, Move]> {
    return this.entries.entries();
  }
}
