import { fixed, type Fixed } from '../../deterministic-math/src/fixed.js';
import type { EntityDefinition } from '../../content/src/compileEntities.js';
import type { MatchInputFrame, MatchStepResult } from './match.js';
import type { OwnedEntityState, WorldState } from './types.js';

export interface StageActorSpawnRule {
  id: string;
  entityDefinitionId: string;
  x: Fixed;
  y: Fixed;
  facing: -1 | 1;
  intervalFrames: number;
  phaseFrames: number;
  maxActive: number;
}

export type StageActorAwareStep = (state: WorldState, input: MatchInputFrame) => MatchStepResult;

function due(rule: StageActorSpawnRule, frame: number): boolean {
  if (!Number.isInteger(rule.intervalFrames) || rule.intervalFrames < 1) throw new Error(`${rule.id} intervalFrames must be positive integer`);
  if (!Number.isInteger(rule.phaseFrames) || rule.phaseFrames < 0) throw new Error(`${rule.id} phaseFrames must be nonnegative integer`);
  return frame >= rule.phaseFrames && (frame - rule.phaseFrames) % rule.intervalFrames === 0;
}

export function spawnStageActors(
  state: WorldState,
  stageId: string,
  rules: readonly StageActorSpawnRule[],
  definitions: ReadonlyMap<string, EntityDefinition>,
): WorldState {
  if (rules.length === 0) return state;
  const entities = [...(state.entities ?? [])].map((entity) => ({ ...entity, hitTargets: [...entity.hitTargets] }));
  let serial = state.nextEntitySerial ?? 1;
  const ownerId = `stage:${stageId}`;

  for (const rule of [...rules].sort((a, b) => a.id.localeCompare(b.id))) {
    if (!due(rule, state.frame)) continue;
    if (!Number.isInteger(rule.maxActive) || rule.maxActive < 0) throw new Error(`${rule.id} maxActive must be nonnegative integer`);
    const definition = definitions.get(rule.entityDefinitionId);
    if (!definition) throw new Error(`${rule.id} references missing entity definition ${rule.entityDefinitionId}`);
    if (definition.fighterId !== ownerId) throw new Error(`${rule.id} entity ${definition.id} must declare fighterId ${ownerId}`);
    const active = entities.filter((entity) => entity.ownerId === ownerId && entity.definitionId === definition.id).length;
    if (active >= rule.maxActive) continue;

    const facing = fixed.fromInt(rule.facing);
    const entity: OwnedEntityState = {
      id: `e${serial}`,
      definitionId: definition.id,
      ownerId,
      ownerDefinitionId: ownerId,
      x: rule.x,
      y: rule.y,
      vx: fixed.mul(definition.velocityX, facing),
      vy: definition.velocityY,
      facing: rule.facing,
      ageFrames: 0,
      lifetimeFrames: definition.lifetimeFrames,
      hitsRemaining: definition.maxHits,
      hitTargets: [],
    };
    entities.push(entity);
    serial += 1;
  }

  entities.sort((a, b) => a.id.localeCompare(b.id));
  return { ...state, entities, nextEntitySerial: serial };
}

/** Adds deterministic stage-owned entity spawning before the ordinary match step. The canonical entity engine handles movement, collision, shields and rollback afterward. */
export function withStageActors(
  step: StageActorAwareStep,
  stageId: string,
  rules: readonly StageActorSpawnRule[],
  definitions: ReadonlyMap<string, EntityDefinition>,
): StageActorAwareStep {
  return (state, input) => step(spawnStageActors(state, stageId, rules, definitions), input);
}
