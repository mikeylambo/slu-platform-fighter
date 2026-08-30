import { fixed } from '../../deterministic-math/src/fixed.js';
import { K1_MOVEMENT, stepFighterMovement, type MovementRules } from './movement.js';
import type { FighterState, SimInputFrame, StageLedge, StageSurface, WorldSnapshot, WorldState } from './types.js';

const GROUND_Y = fixed.zero;
export const DEFAULT_SHIELD_HEALTH = 600;
export const DEFAULT_STOCKS = 3;

function createTrainingSurfaces(): StageSurface[] {
  return [
    { id: 'ground', kind: 'solid', y: GROUND_Y, xMin: fixed.fromInt(-100), xMax: fixed.fromInt(100) },
    { id: 'platform-center', kind: 'one-way', y: fixed.fromInt(4), xMin: fixed.fromInt(-4), xMax: fixed.fromInt(4) },
  ];
}

function createTrainingLedges(): StageLedge[] {
  return [
    { id: 'platform-center-left', x: fixed.fromInt(-4), y: fixed.fromInt(4), inward: 1 },
    { id: 'platform-center-right', x: fixed.fromInt(4), y: fixed.fromInt(4), inward: -1 },
  ];
}

export function createFighterState(id: string, x = fixed.fromInt(-10), facing: -1 | 1 = 1, definitionId = 'greybox'): FighterState {
  return {
    id, definitionId, x, y: GROUND_Y, vx: fixed.zero, vy: fixed.zero,
    grounded: true, groundSurfaceId: 'ground', facing,
    locomotion: 'idle', locomotionFrame: 0, jumpsRemaining: 1, fastFalling: false,
    dropThroughFrames: 0, jumpBufferFrames: 0, inputHistory: [], ledgeId: null,
    ledgeRegrabLockoutFrames: 0, invulnerableFrames: 0, dodgeCooldownFrames: 0, techBufferFrames: 0,
    percentTenths: 0, hitlagFrames: 0, hitstunFrames: 0, attack: null,
    shielding: false, shieldHealth: DEFAULT_SHIELD_HEALTH, shieldStunFrames: 0, shieldRegenDelayFrames: 0,
    grabTargetId: null, grabbedById: null, grabFrames: 0, grabAction: null,
    lastHitById: null, lastHitFrame: -1,
    stocks: DEFAULT_STOCKS, eliminated: false, respawnFrames: 0,
  };
}

export function createWorld(seed: number): WorldState {
  return {
    frame: 0,
    seed,
    fighters: [createFighterState('fighter-a')],
    entities: [],
    nextEntitySerial: 1,
    surfaces: createTrainingSurfaces(),
    ledges: createTrainingLedges(),
    winnerId: null,
  };
}

export function stepWorld(state: WorldState, input: SimInputFrame, movementRules: MovementRules = K1_MOVEMENT): WorldState {
  if (input.frame !== state.frame) throw new Error(`input frame ${input.frame} does not match world frame ${state.frame}`);
  const fighter = state.fighters[0];
  if (!fighter) throw new Error('K1 world requires fighter-a');
  return {
    frame: state.frame + 1,
    seed: state.seed,
    fighters: [stepFighterMovement(fighter, input, state.surfaces, state.ledges, movementRules)],
    entities: state.entities ?? [],
    nextEntitySerial: state.nextEntitySerial ?? 1,
    surfaces: state.surfaces,
    ledges: state.ledges,
    winnerId: state.winnerId,
  };
}

export function snapshotWorld(state: WorldState): WorldSnapshot { return { state: structuredClone(state) }; }
export function restoreWorld(snapshot: WorldSnapshot): WorldState { return structuredClone(snapshot.state); }
