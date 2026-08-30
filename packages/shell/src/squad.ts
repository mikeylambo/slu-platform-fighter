export interface SquadSideDefinition {
  sideId: string;
  fighterDefinitionIds: readonly string[];
  controllerId: string | null;
  control: 'human' | 'cpu';
}

export interface SquadRules {
  /** loser-only = crew/elimination; both = round-based/tag rotation. */
  rotation: 'loser-only' | 'both';
  /** Whether the surviving active fighter carries ending percent into the next bout. */
  carryWinnerPercent: boolean;
}

export interface SquadSideState {
  sideId: string;
  fighterDefinitionIds: readonly string[];
  activeIndex: number;
  defeatedIndices: readonly number[];
  carriedPercentTenths: number;
}

export interface SquadState {
  sides: readonly SquadSideState[];
  bout: number;
  ended: boolean;
  winnerSideId: string | null;
}

export interface SquadBout {
  bout: number;
  participants: readonly {
    sideId: string;
    fighterDefinitionId: string;
    controllerId: string | null;
    control: 'human' | 'cpu';
    startingPercentTenths: number;
  }[];
}

export interface SquadBoutResult {
  winnerSideId: string;
  /** Ending percent of the active fighter for each side, if known. */
  endingPercentTenths?: Readonly<Record<string, number>>;
}

export class SquadSession {
  readonly rules: SquadRules;
  readonly definitions: readonly SquadSideDefinition[];
  private state: SquadState;

  constructor(sidesInput: readonly SquadSideDefinition[], rules: SquadRules) {
    if (sidesInput.length < 2 || sidesInput.length > 4) throw new Error('squad session requires 2–4 sides');
    const sideIds = sidesInput.map((side) => side.sideId);
    if (sideIds.some((id) => !id) || new Set(sideIds).size !== sideIds.length) throw new Error('squad side ids must be unique/non-empty');
    for (const side of sidesInput) {
      if (side.fighterDefinitionIds.length < 1 || side.fighterDefinitionIds.length > 9) throw new Error(`${side.sideId} squad requires 1–9 fighters`);
      if (side.fighterDefinitionIds.some((id) => !id)) throw new Error(`${side.sideId} contains empty fighter id`);
    }
    this.rules = { ...rules };
    this.definitions = sidesInput.map((side) => ({ ...side, fighterDefinitionIds: [...side.fighterDefinitionIds] }));
    this.state = {
      sides: this.definitions.map((side) => ({ sideId: side.sideId, fighterDefinitionIds: side.fighterDefinitionIds, activeIndex: 0, defeatedIndices: [], carriedPercentTenths: 0 })),
      bout: 1,
      ended: false,
      winnerSideId: null,
    };
  }

  get snapshot(): SquadState { return structuredClone(this.state); }

  currentBout(): SquadBout {
    if (this.state.ended) throw new Error('squad session has ended');
    return {
      bout: this.state.bout,
      participants: this.state.sides.map((side) => {
        const definition = this.definitions.find((entry) => entry.sideId === side.sideId)!;
        const fighterDefinitionId = side.fighterDefinitionIds[side.activeIndex];
        if (!fighterDefinitionId) throw new Error(`${side.sideId} has no active fighter at index ${side.activeIndex}`);
        return {
          sideId: side.sideId,
          fighterDefinitionId,
          controllerId: definition.controllerId,
          control: definition.control,
          startingPercentTenths: side.carriedPercentTenths,
        };
      }),
    };
  }

  completeBout(result: SquadBoutResult): SquadState {
    if (this.state.ended) throw new Error('cannot complete bout after squad session end');
    if (!this.state.sides.some((side) => side.sideId === result.winnerSideId)) throw new Error(`unknown squad winner ${result.winnerSideId}`);
    const nextSides: SquadSideState[] = [];
    for (const side of this.state.sides) {
      const won = side.sideId === result.winnerSideId;
      const rotate = this.rules.rotation === 'both' || !won;
      const endingPercent = result.endingPercentTenths?.[side.sideId] ?? 0;
      if (!Number.isInteger(endingPercent) || endingPercent < 0) throw new Error(`${side.sideId} ending percent must be nonnegative integer tenths`);
      if (!rotate) {
        nextSides.push({ ...side, carriedPercentTenths: this.rules.carryWinnerPercent ? endingPercent : 0 });
        continue;
      }
      const defeatedIndices = [...side.defeatedIndices, side.activeIndex].sort((a, b) => a - b);
      nextSides.push({ ...side, activeIndex: side.activeIndex + 1, defeatedIndices, carriedPercentTenths: 0 });
    }

    const exhausted = nextSides.filter((side) => side.activeIndex >= side.fighterDefinitionIds.length);
    const survivors = nextSides.filter((side) => side.activeIndex < side.fighterDefinitionIds.length);
    const ended = survivors.length <= 1 || (this.rules.rotation === 'both' && exhausted.length > 0);
    const winnerSideId = ended && survivors.length === 1 ? survivors[0]!.sideId : null;
    this.state = { sides: nextSides, bout: this.state.bout + 1, ended, winnerSideId };
    return this.snapshot;
  }
}
