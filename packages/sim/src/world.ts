import { fixed } from '../../deterministic-math/src/fixed.js';
import type { FighterState, SimInputFrame, WorldSnapshot, WorldState } from './types.js';

const RUN_SPEED = fixed.fromRatio(3, 20);
const JUMP_SPEED = fixed.fromRatio(9, 20);
const GRAVITY = fixed.fromRatio(1, 40);
const GROUND_Y = fixed.zero;

export function createWorld(seed: number): WorldState {
  return {
    frame: 0,
    seed,
    fighters: [
      {
        id: 'fighter-a',
        x: fixed.fromInt(-10),
        y: GROUND_Y,
        vx: fixed.zero,
        vy: fixed.zero,
        grounded: true,
      },
    ],
  };
}

export function stepWorld(state: WorldState, input: SimInputFrame): WorldState {
  if (input.frame !== state.frame) {
    throw new Error(`input frame ${input.frame} does not match world frame ${state.frame}`);
  }

  const fighter = state.fighters[0];
  if (!fighter) throw new Error('K0 world requires fighter-a');

  let vx = fixed.mul(fixed.fromInt(input.moveX), RUN_SPEED);
  let vy = fighter.vy;
  let grounded = fighter.grounded;

  if (input.jumpPressed && grounded) {
    vy = JUMP_SPEED;
    grounded = false;
  }

  if (!grounded) {
    vy = fixed.sub(vy, GRAVITY);
  }

  let x = fixed.add(fighter.x, vx);
  let y = fixed.add(fighter.y, vy);

  if (y <= GROUND_Y) {
    y = GROUND_Y;
    vy = fixed.zero;
    grounded = true;
  }

  const nextFighter: FighterState = {
    ...fighter,
    x,
    y,
    vx,
    vy,
    grounded,
  };

  return {
    frame: state.frame + 1,
    seed: state.seed,
    fighters: [nextFighter],
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
