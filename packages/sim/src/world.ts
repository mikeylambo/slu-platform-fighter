import { fixed } from '../../deterministic-math/src/fixed.js';
import { K1_MOVEMENT, stepFighterMovement, type MovementRules } from './movement.js';
import type { FighterState, SimInputFrame, StageLedge, StageSurface, WorldSnapshot, WorldState } from './types.js';

const GROUND_Y = fixed.zero;

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

export function createFighterState(id: string, x = fixed.fromInt(-10), facing: -1 | 1 = 1): FighterState {
  return {
    id,
    x,
    y: GROUND_Y,
    vx: fixed.zero,
    vy: fixed.zero,
    grounded: true,
    groundSurfaceId: 'ground',
    facing,
    locomotion: 'idle',
    locomotionFrame: 0,
    jumpsRemaining: 1,
    fastFalling: false,
    dropThroughFrames: 0,
    jumpBufferFrames: 0,
    inputHistory: [],
    ledgeId: null,
    ledgeRegrabLockoutFrames: 0,
    invulnerableFrames: 0,
    dodgeCooldownFrames: 0,
    techBufferFrames: 0,
    percentTenths: 0,
    hitlagFrames: 0,
    hitstunFrames: 0,
    attack: null,
  };
}

export function createWorld(seed: number): WorldState {
  return {
    frame: 0,
    seed,
    fighters: [createFighterState('fighter-a')],
    surfaces: createTrainingSurfaces(),
    ledges: createTrainingLedges(),
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
    surfaces: state.surfaces,
    ledges: state.ledges,
  };
}

export function snapshotWorld(state: WorldState): WorldSnapshot { return { state: structuredClone(state) }; }
export function restoreWorld(snapshot: WorldSnapshot): WorldState { return structuredClone(snapshot.state); }
