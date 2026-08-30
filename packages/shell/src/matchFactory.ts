import type { CompiledStageDefinition } from '../../content/src/compileStage.js';
import type { RosterRuntime } from '../../content/src/compileRosterRuntime.js';
import { createFighterState } from '../../sim/src/world.js';
import type { WorldState } from '../../sim/src/types.js';
import type { StartMatchDescriptor, TeamId } from './session.js';

export interface ConstructedMatch {
  world: WorldState;
  runtime: RosterRuntime;
  stage: CompiledStageDefinition;
  participantControl: Readonly<Record<string, 'human' | 'cpu'>>;
  controllerByParticipant: Readonly<Record<string, string | null>>;
  paletteByParticipant: Readonly<Record<string, string>>;
  teamByParticipant: Readonly<Record<string, TeamId>>;
  rulesetId: string;
  mode: 'local-versus' | 'training';
}

/**
 * Converts a validated player-facing selection descriptor into authoritative
 * simulation state. No fighter-specific wiring occurs here: fighter identity,
 * stage geometry and runtime behavior all come from compiled content catalogs.
 */
export function constructMatchFromDescriptor(
  descriptor: StartMatchDescriptor,
  runtime: RosterRuntime,
  stage: CompiledStageDefinition,
  seed: number,
): ConstructedMatch {
  if (!Number.isInteger(seed)) throw new Error(`match seed must be integer, got ${seed}`);
  if (descriptor.stageId !== stage.id) throw new Error(`descriptor stage ${descriptor.stageId} does not match compiled stage ${stage.id}`);
  if (descriptor.participants.length < 2 || descriptor.participants.length > 4) throw new Error('platform fighter match requires 2–4 participants');
  if (stage.spawns.length < descriptor.participants.length) throw new Error(`stage ${stage.id} exposes ${stage.spawns.length} spawns for ${descriptor.participants.length} participants`);

  const knownFighters = new Set(runtime.fighterDefinitionIds);
  const sortedParticipants = [...descriptor.participants].sort((a, b) => a.slot - b.slot);
  const participantIds = new Set<string>();
  const fighters = sortedParticipants.map((participant, index) => {
    if (participantIds.has(participant.participantId)) throw new Error(`duplicate participant id ${participant.participantId}`);
    participantIds.add(participant.participantId);
    if (!knownFighters.has(participant.fighterId)) throw new Error(`fighter ${participant.fighterId} is not present in compiled roster runtime`);
    const spawn = stage.spawns[index];
    if (!spawn) throw new Error(`stage ${stage.id} missing spawn ${index}`);
    const fighter = createFighterState(participant.participantId, spawn.x, spawn.facing, participant.fighterId);
    return { ...fighter, y: spawn.y, grounded: true, groundSurfaceId: stage.surfaces.find((surface) => surface.y === spawn.y && spawn.x >= surface.xMin && spawn.x <= surface.xMax)?.id ?? null };
  });

  const participantControl: Record<string, 'human' | 'cpu'> = {};
  const controllerByParticipant: Record<string, string | null> = {};
  const paletteByParticipant: Record<string, string> = {};
  const teamByParticipant: Record<string, TeamId> = {};
  for (const participant of sortedParticipants) {
    participantControl[participant.participantId] = participant.control;
    controllerByParticipant[participant.participantId] = participant.controllerId;
    paletteByParticipant[participant.participantId] = participant.paletteId;
    teamByParticipant[participant.participantId] = descriptor.teamsEnabled ? participant.teamId : null;
  }

  return {
    world: {
      frame: 0,
      seed,
      fighters,
      entities: [],
      nextEntitySerial: 1,
      surfaces: [...stage.surfaces],
      ledges: [...stage.ledges],
      winnerId: null,
    },
    runtime,
    stage,
    participantControl,
    controllerByParticipant,
    paletteByParticipant,
    teamByParticipant,
    rulesetId: descriptor.rulesetId,
    mode: descriptor.mode,
  };
}
