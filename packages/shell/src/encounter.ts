export type EncounterKind = 'challenge' | 'event' | 'adventure';

export interface EncounterParticipant {
  slotId: string;
  fighterDefinitionId: string;
  sideId: string;
  control: 'human' | 'cpu';
  controllerId?: string | null;
  cpuLevel?: number;
  startingPercentTenths?: number;
}

export interface EncounterDefinition {
  id: string;
  kind: EncounterKind;
  title: string;
  stageId: string;
  rulesetId: string;
  participants: readonly EncounterParticipant[];
  seed?: number;
  tags?: readonly string[];
  nextEncounterIds?: readonly string[];
}

export interface EncounterLaunch {
  encounterId: string;
  stageId: string;
  rulesetId: string;
  seed?: number;
  participants: readonly EncounterParticipant[];
}

export function validateEncounter(definition: EncounterDefinition): void {
  if (!definition.id || !definition.title || !definition.stageId || !definition.rulesetId) throw new Error('encounter requires id, title, stageId and rulesetId');
  if (definition.participants.length < 2 || definition.participants.length > 4) throw new Error(`${definition.id} requires 2–4 participants`);
  const slots = definition.participants.map((entry) => entry.slotId);
  if (slots.some((id) => !id) || new Set(slots).size !== slots.length) throw new Error(`${definition.id} participant slot ids must be unique/non-empty`);
  const sides = new Set(definition.participants.map((entry) => entry.sideId));
  if (sides.size < 2) throw new Error(`${definition.id} requires at least two sides`);
  for (const participant of definition.participants) {
    if (!participant.fighterDefinitionId || !participant.sideId) throw new Error(`${definition.id} contains incomplete participant`);
    if (participant.control === 'human' && participant.controllerId === undefined) throw new Error(`${definition.id}/${participant.slotId} human participant must declare controllerId (nullable is allowed for later assignment)`);
    if (participant.cpuLevel !== undefined && (!Number.isInteger(participant.cpuLevel) || participant.cpuLevel < 1 || participant.cpuLevel > 9)) throw new Error(`${definition.id}/${participant.slotId} cpuLevel must be integer 1–9`);
    if (participant.startingPercentTenths !== undefined && (!Number.isInteger(participant.startingPercentTenths) || participant.startingPercentTenths < 0)) throw new Error(`${definition.id}/${participant.slotId} startingPercentTenths must be nonnegative integer`);
  }
}

export function compileEncounterLaunch(definition: EncounterDefinition): EncounterLaunch {
  validateEncounter(definition);
  const launch: EncounterLaunch = {
    encounterId: definition.id,
    stageId: definition.stageId,
    rulesetId: definition.rulesetId,
    participants: definition.participants.map((entry) => ({ ...entry })),
  };
  if (definition.seed !== undefined) launch.seed = definition.seed;
  return launch;
}

export class EncounterSequence {
  private readonly definitions: ReadonlyMap<string, EncounterDefinition>;
  private currentId: string;

  constructor(definitionsInput: readonly EncounterDefinition[], startEncounterId: string) {
    const definitions = new Map<string, EncounterDefinition>();
    for (const definition of definitionsInput) {
      validateEncounter(definition);
      if (definitions.has(definition.id)) throw new Error(`duplicate encounter id ${definition.id}`);
      definitions.set(definition.id, structuredClone(definition));
    }
    if (!definitions.has(startEncounterId)) throw new Error(`unknown start encounter ${startEncounterId}`);
    for (const definition of definitions.values()) {
      for (const nextId of definition.nextEncounterIds ?? []) if (!definitions.has(nextId)) throw new Error(`${definition.id} references unknown next encounter ${nextId}`);
    }
    this.definitions = definitions;
    this.currentId = startEncounterId;
  }

  get current(): EncounterDefinition { return structuredClone(this.definitions.get(this.currentId)!); }
  launch(): EncounterLaunch { return compileEncounterLaunch(this.current); }
  choices(): readonly string[] { return [...(this.definitions.get(this.currentId)!.nextEncounterIds ?? [])]; }
  advance(nextEncounterId: string): EncounterDefinition {
    if (!this.choices().includes(nextEncounterId)) throw new Error(`${nextEncounterId} is not a valid successor of ${this.currentId}`);
    this.currentId = nextEncounterId;
    return this.current;
  }
}
