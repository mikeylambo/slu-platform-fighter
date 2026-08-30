import { fixed } from '../../deterministic-math/src/fixed.js';
import { K1_MOVEMENT, stepFighterMovement, type MovementRules } from './movement.js';
import type { FighterState, SimInputFrame, StageSurface, WorldSnapshot, WorldState } from './types.js';

const GROUND_Y = fixed.zero;

function createTrainingSurfaces(): StageSurface[] {
  return [
    {
      id: 'ground',
      kind: 'solid',
      y: GROUND_Y,
      xMin: fixed.fromInt(-100),
      xMax: fixed.fromInt(100),
    },
    {
      id: 'platform-center',
      kind: 'one-way',
      y: fixed.fromInt(4),
      xMin: fixed.fromInt(-4),
      xMax: fixed.fromInt(4),
    },
  ];
}

export function createWorld(seed: number): WorldState {
  const fighter: FighterState = {
    id: 'fighter-a',
    x: fixed.fromInt(-10),
    y: GROUND_Y,
    vx: fixed.zero,
    vy: fixed.zero,
    grounded: true,
    groundSurfaceId: 'ground',
    facing: 1,
    locomotion: 'idle',
    locomotionFrame: 0,
    jumpsRemaining: 1,
    fastFalling: false,
    dropThroughFrames: 0,
    jumpBufferFrames: 0,
    inputHistory: [],
  };

  return {
    frame: 0,
    seed,
    fighters: [fighter],
    surfaces: createTrainingSurfaces(),
  };
}

export function stepWorld(
  state: WorldState,
  input: SimInputFrame,
  movementRules: MovementRules = K1_MOVEMENT,
): WorldState {
  if (input.frame !== state.frame) {
    throw new Error(`input frame ${input.frame} does not match world frame ${state.frame}`);
  }

  const fighter = state.fighters[0];
  if (!fighter) throw new Error('K1 world requires fighter-a');

  return {
    frame: state.frame + 1,
    seed: state.seed,
    fighters: [stepFighterMovement(fighter, input, state.surfaces, movementRules)],
    surfaces: state.surfaces,
  };
}

export function snapshotWorld(state: WorldState): WorldSnapshot {
  return {
    state: structuredClone(state),
  };
}

export function restoreWorld(snapshot: WorldSnapshot): WorldState {
  return structuredClone(snapshot.state);
}
