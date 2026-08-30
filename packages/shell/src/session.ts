export type ShellMode = 'local-versus' | 'training' | 'replays';
export type ShellPhase = 'title' | 'main-menu' | 'fighter-select' | 'stage-select' | 'match' | 'results' | 'replay-browser' | 'settings';
export type SlotControl = 'human' | 'cpu' | 'closed';
export type TeamId = 'red' | 'blue' | 'green' | 'yellow' | null;

export interface ShellCatalog {
  fighterIds: readonly string[];
  stageIds: readonly string[];
  rulesetIds: readonly string[];
  paletteIdsByFighter?: Readonly<Record<string, readonly string[]>>;
}

export interface PlayerSlot {
  slot: 1 | 2 | 3 | 4;
  control: SlotControl;
  controllerId: string | null;
  fighterId: string | null;
  paletteId: string;
  teamId: TeamId;
  ready: boolean;
}

export interface MatchSetup {
  mode: Exclude<ShellMode, 'replays'>;
  slots: readonly PlayerSlot[];
  stageId: string | null;
  rulesetId: string;
  teamsEnabled: boolean;
}

export interface ShellState {
  phase: ShellPhase;
  previousPhase: ShellPhase | null;
  setup: MatchSetup;
  selectedResultAction: 'rematch' | 'fighter-select' | 'main-menu';
}

export interface StartMatchDescriptor {
  mode: Exclude<ShellMode, 'replays'>;
  participants: readonly {
    participantId: string;
    slot: number;
    control: Exclude<SlotControl, 'closed'>;
    controllerId: string | null;
    fighterId: string;
    paletteId: string;
    teamId: TeamId;
  }[];
  stageId: string;
  rulesetId: string;
  teamsEnabled: boolean;
}

function canonicalIds(values: readonly string[], label: string): string[] {
  const ids = [...values];
  if (ids.length === 0 || ids.some((id) => !id)) throw new Error(`${label} catalog must be non-empty with non-empty ids`);
  if (new Set(ids).size !== ids.length) throw new Error(`${label} catalog contains duplicate ids`);
  return ids.sort();
}

function defaultSlot(slot: 1 | 2 | 3 | 4): PlayerSlot {
  return {
    slot,
    control: slot === 1 ? 'human' : slot === 2 ? 'cpu' : 'closed',
    controllerId: slot === 1 ? 'primary' : null,
    fighterId: null,
    paletteId: '00',
    teamId: null,
    ready: false,
  };
}

export class PlatformFighterShell {
  readonly catalog: ShellCatalog;
  private state: ShellState;

  constructor(catalogInput: ShellCatalog, defaultRulesetId?: string) {
    const fighterIds = canonicalIds(catalogInput.fighterIds, 'fighter');
    const stageIds = canonicalIds(catalogInput.stageIds, 'stage');
    const rulesetIds = canonicalIds(catalogInput.rulesetIds, 'ruleset');
    const rulesetId = defaultRulesetId ?? rulesetIds[0]!;
    if (!rulesetIds.includes(rulesetId)) throw new Error(`unknown default ruleset ${rulesetId}`);
    this.catalog = { ...catalogInput, fighterIds, stageIds, rulesetIds };
    this.state = {
      phase: 'title',
      previousPhase: null,
      setup: {
        mode: 'local-versus',
        slots: [defaultSlot(1), defaultSlot(2), defaultSlot(3), defaultSlot(4)],
        stageId: null,
        rulesetId,
        teamsEnabled: false,
      },
      selectedResultAction: 'rematch',
    };
  }

  get snapshot(): ShellState { return structuredClone(this.state); }

  private transition(phase: ShellPhase): void {
    this.state = { ...this.state, previousPhase: this.state.phase, phase };
  }

  openTitle(): void { this.transition('title'); }
  openMainMenu(): void { this.transition('main-menu'); }
  openSettings(): void { this.transition('settings'); }
  closeSettings(): void { this.transition(this.state.previousPhase === 'settings' || this.state.previousPhase === null ? 'main-menu' : this.state.previousPhase); }
  openReplayBrowser(): void { this.transition('replay-browser'); }

  startLocalVersusSetup(): void {
    this.state = { ...this.state, setup: { ...this.state.setup, mode: 'local-versus' } };
    this.transition('fighter-select');
  }

  startTrainingSetup(): void {
    const slots = this.state.setup.slots.map((slot) => {
      if (slot.slot === 1) return { ...slot, control: 'human' as const, controllerId: slot.controllerId ?? 'primary', ready: false };
      if (slot.slot === 2) return { ...slot, control: 'cpu' as const, controllerId: null, ready: false };
      return { ...slot, control: 'closed' as const, controllerId: null, fighterId: null, ready: false };
    });
    this.state = { ...this.state, setup: { ...this.state.setup, mode: 'training', slots, teamsEnabled: false } };
    this.transition('fighter-select');
  }

  configureSlot(slotNumber: 1 | 2 | 3 | 4, patch: Partial<Omit<PlayerSlot, 'slot'>>): void {
    const slots = this.state.setup.slots.map((slot) => {
      if (slot.slot !== slotNumber) return slot;
      const next: PlayerSlot = { ...slot, ...patch, slot: slotNumber };
      if (next.control === 'closed') return { ...next, controllerId: null, fighterId: null, ready: false };
      if (next.control === 'cpu') next.controllerId = null;
      if (next.control === 'human' && next.controllerId === null) next.controllerId = `slot-${slotNumber}`;
      return next;
    });
    this.state = { ...this.state, setup: { ...this.state.setup, slots } };
  }

  selectFighter(slotNumber: 1 | 2 | 3 | 4, fighterId: string, paletteId = '00'): void {
    if (!this.catalog.fighterIds.includes(fighterId)) throw new Error(`unknown fighter ${fighterId}`);
    const allowedPalettes = this.catalog.paletteIdsByFighter?.[fighterId];
    if (allowedPalettes && !allowedPalettes.includes(paletteId)) throw new Error(`fighter ${fighterId} does not expose palette ${paletteId}`);
    this.configureSlot(slotNumber, { fighterId, paletteId, ready: false });
  }

  setSlotReady(slotNumber: 1 | 2 | 3 | 4, ready: boolean): void {
    const slot = this.state.setup.slots.find((entry) => entry.slot === slotNumber);
    if (!slot || slot.control === 'closed') throw new Error(`slot ${slotNumber} is closed`);
    if (ready && slot.fighterId === null) throw new Error(`slot ${slotNumber} cannot ready without fighter selection`);
    this.configureSlot(slotNumber, { ready });
  }

  setTeams(enabled: boolean): void {
    if (this.state.setup.mode === 'training' && enabled) throw new Error('training mode does not support team assignment');
    const slots = enabled ? this.state.setup.slots : this.state.setup.slots.map((slot) => ({ ...slot, teamId: null }));
    this.state = { ...this.state, setup: { ...this.state.setup, teamsEnabled: enabled, slots } };
  }

  setTeam(slotNumber: 1 | 2 | 3 | 4, teamId: Exclude<TeamId, null>): void {
    if (!this.state.setup.teamsEnabled) throw new Error('teams are not enabled');
    this.configureSlot(slotNumber, { teamId });
  }

  setRuleset(rulesetId: string): void {
    if (!this.catalog.rulesetIds.includes(rulesetId)) throw new Error(`unknown ruleset ${rulesetId}`);
    this.state = { ...this.state, setup: { ...this.state.setup, rulesetId } };
  }

  continueFromFighterSelect(): void {
    const active = this.state.setup.slots.filter((slot) => slot.control !== 'closed');
    if (active.length < 2) throw new Error('match setup requires at least two active slots');
    if (active.some((slot) => slot.fighterId === null || !slot.ready)) throw new Error('every active slot must select a fighter and ready');
    if (this.state.setup.mode === 'training' && active.length !== 2) throw new Error('training setup requires exactly two active slots');
    this.transition('stage-select');
  }

  selectStage(stageId: string): void {
    if (!this.catalog.stageIds.includes(stageId)) throw new Error(`unknown stage ${stageId}`);
    this.state = { ...this.state, setup: { ...this.state.setup, stageId } };
  }

  buildMatchDescriptor(): StartMatchDescriptor {
    if (this.state.setup.stageId === null) throw new Error('cannot start match without stage selection');
    const participants = this.state.setup.slots
      .filter((slot): slot is PlayerSlot & { control: Exclude<SlotControl, 'closed'>; fighterId: string } => slot.control !== 'closed' && slot.fighterId !== null)
      .sort((a, b) => a.slot - b.slot)
      .map((slot) => ({
        participantId: `player-${slot.slot}`,
        slot: slot.slot,
        control: slot.control,
        controllerId: slot.controllerId,
        fighterId: slot.fighterId,
        paletteId: slot.paletteId,
        teamId: this.state.setup.teamsEnabled ? slot.teamId : null,
      }));
    if (participants.length < 2) throw new Error('cannot start match with fewer than two participants');
    if (this.state.setup.teamsEnabled && participants.some((participant) => participant.teamId === null)) throw new Error('every participant needs a team when teams are enabled');
    return {
      mode: this.state.setup.mode,
      participants,
      stageId: this.state.setup.stageId,
      rulesetId: this.state.setup.rulesetId,
      teamsEnabled: this.state.setup.teamsEnabled,
    };
  }

  startMatch(): StartMatchDescriptor {
    const descriptor = this.buildMatchDescriptor();
    this.transition('match');
    return descriptor;
  }

  finishMatch(): void { this.transition('results'); }
  rematch(): StartMatchDescriptor { const descriptor = this.buildMatchDescriptor(); this.transition('match'); return descriptor; }
  returnToFighterSelect(): void {
    const slots = this.state.setup.slots.map((slot) => ({ ...slot, ready: false }));
    this.state = { ...this.state, setup: { ...this.state.setup, slots, stageId: null } };
    this.transition('fighter-select');
  }
  returnToMainMenu(): void { this.transition('main-menu'); }
}
