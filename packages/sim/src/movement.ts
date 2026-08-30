import { fixed, type Fixed } from '../../deterministic-math/src/fixed.js';
import type { FighterState, SimInputFrame, StageSurface } from './types.js';

export const K1_MOVEMENT = {
  stickMax: 1000,
  deadzone: 180,
  runThreshold: 720,
  crouchThreshold: -650,
  fastFallThreshold: -700,
  inputHistoryFrames: 30,
  jumpBufferFrames: 5,
  dashFrames: 10,
  turnFrames: 4,
  jumpSquatFrames: 3,
  landingFrames: 4,
  platformDropFrames: 8,
  walkSpeed: fixed.fromRatio(3, 25),
  dashSpeed: fixed.fromRatio(11, 50),
  runSpeed: fixed.fromRatio(9, 50),
  groundAccel: fixed.fromRatio(1, 25),
  groundFriction: fixed.fromRatio(1, 30),
  airAccel: fixed.fromRatio(1, 80),
  maxAirSpeed: fixed.fromRatio(4, 25),
  fullHopSpeed: fixed.fromRatio(49, 100),
  shortHopSpeed: fixed.fromRatio(37, 100),
  doubleJumpSpeed: fixed.fromRatio(11, 25),
  gravity: fixed.fromRatio(1, 40),
  maxFallSpeed: fixed.fromRatio(9, 20),
  fastFallSpeed: fixed.fromRatio(29, 50),
} as const;

function clampStick(value: number): number {
  if (!Number.isInteger(value)) throw new Error(`stick input must be integer, got ${value}`);
  return Math.max(-K1_MOVEMENT.stickMax, Math.min(K1_MOVEMENT.stickMax, value));
}

function approach(current: Fixed, target: Fixed, amount: Fixed): Fixed {
  if (current < target) return Math.min(fixed.add(current, amount), target) as Fixed;
  if (current > target) return Math.max(fixed.sub(current, amount), target) as Fixed;
  return current;
}

function stickToFixed(value: number, maxSpeed: Fixed): Fixed {
  const clamped = clampStick(value);
  return fixed.mul(fixed.fromRatio(clamped, K1_MOVEMENT.stickMax), maxSpeed);
}

function signOutsideDeadzone(value: number): -1 | 0 | 1 {
  if (value > K1_MOVEMENT.deadzone) return 1;
  if (value < -K1_MOVEMENT.deadzone) return -1;
  return 0;
}

function surfaceAt(fighter: FighterState, surfaces: StageSurface[]): StageSurface | undefined {
  if (!fighter.grounded || fighter.groundSurfaceId === null) return undefined;
  return surfaces.find((surface) => surface.id === fighter.groundSurfaceId);
}

function findLandingSurface(
  oldY: Fixed,
  newY: Fixed,
  x: Fixed,
  surfaces: StageSurface[],
  ignoreOneWay: boolean,
): StageSurface | undefined {
  if (newY > oldY) return undefined;
  const candidates = surfaces
    .filter((surface) => (!ignoreOneWay || surface.kind !== 'one-way'))
    .filter((surface) => x >= surface.xMin && x <= surface.xMax)
    .filter((surface) => oldY >= surface.y && newY <= surface.y)
    .sort((a, b) => b.y - a.y || a.id.localeCompare(b.id));
  return candidates[0];
}

export function sanitizeInput(input: SimInputFrame): SimInputFrame {
  return {
    ...input,
    moveX: clampStick(input.moveX),
    moveY: clampStick(input.moveY),
  };
}

export function stepFighterMovement(
  fighter: FighterState,
  rawInput: SimInputFrame,
  surfaces: StageSurface[],
): FighterState {
  const input = sanitizeInput(rawInput);
  const priorInput = fighter.inputHistory.at(-1);
  const history = [...fighter.inputHistory, input].slice(-K1_MOVEMENT.inputHistoryFrames);
  const horizontal = signOutsideDeadzone(input.moveX);
  const previousHorizontal = priorInput ? signOutsideDeadzone(priorInput.moveX) : 0;
  const downPressed = input.moveY <= K1_MOVEMENT.crouchThreshold;
  const downFlick = input.moveY <= K1_MOVEMENT.fastFallThreshold && (priorInput?.moveY ?? 0) > K1_MOVEMENT.fastFallThreshold;

  let x = fighter.x;
  let y = fighter.y;
  let vx = fighter.vx;
  let vy = fighter.vy;
  let grounded = fighter.grounded;
  let groundSurfaceId = fighter.groundSurfaceId;
  let locomotion = fighter.locomotion;
  let locomotionFrame = fighter.locomotionFrame + 1;
  let facing = fighter.facing;
  let jumpsRemaining = fighter.jumpsRemaining;
  let fastFalling = fighter.fastFalling;
  let dropThroughFrames = Math.max(0, fighter.dropThroughFrames - 1);
  let jumpBufferFrames = input.jumpPressed
    ? K1_MOVEMENT.jumpBufferFrames
    : Math.max(0, fighter.jumpBufferFrames - 1);

  const currentSurface = surfaceAt(fighter, surfaces);
  if (grounded && currentSurface?.kind === 'one-way' && downPressed) {
    grounded = false;
    groundSurfaceId = null;
    dropThroughFrames = K1_MOVEMENT.platformDropFrames;
    locomotion = 'airborne';
    locomotionFrame = 0;
    y = fixed.sub(y, fixed.fromRatio(1, 1000));
  }

  if (grounded && jumpBufferFrames > 0 && locomotion !== 'jump-squat') {
    locomotion = 'jump-squat';
    locomotionFrame = 0;
    jumpBufferFrames = 0;
    vx = horizontal === 0 ? vx : stickToFixed(input.moveX, K1_MOVEMENT.runSpeed);
  }

  if (grounded) {
    if (locomotion === 'jump-squat') {
      vx = approach(vx, stickToFixed(input.moveX, K1_MOVEMENT.runSpeed), K1_MOVEMENT.groundAccel);
      if (locomotionFrame >= K1_MOVEMENT.jumpSquatFrames) {
        grounded = false;
        groundSurfaceId = null;
        locomotion = 'airborne';
        locomotionFrame = 0;
        vy = input.jumpHeld ? K1_MOVEMENT.fullHopSpeed : K1_MOVEMENT.shortHopSpeed;
        jumpsRemaining = 1;
      }
    } else if (downPressed) {
      locomotion = 'crouch';
      locomotionFrame = locomotion === fighter.locomotion ? locomotionFrame : 0;
      vx = approach(vx, fixed.zero, K1_MOVEMENT.groundFriction);
    } else if (horizontal === 0) {
      locomotion = locomotion === 'landing' && locomotionFrame < K1_MOVEMENT.landingFrames ? 'landing' : 'idle';
      vx = approach(vx, fixed.zero, K1_MOVEMENT.groundFriction);
    } else {
      facing = horizontal;
      const reversed = previousHorizontal !== 0 && horizontal !== previousHorizontal;
      if (reversed && (fighter.locomotion === 'dash' || fighter.locomotion === 'run')) {
        locomotion = 'turn';
        locomotionFrame = 0;
      } else if (locomotion === 'turn' && locomotionFrame < K1_MOVEMENT.turnFrames) {
        vx = approach(vx, fixed.zero, K1_MOVEMENT.groundFriction);
      } else if (Math.abs(input.moveX) >= K1_MOVEMENT.runThreshold) {
        if (fighter.locomotion === 'idle' || fighter.locomotion === 'walk' || fighter.locomotion === 'landing' || previousHorizontal === 0) {
          locomotion = 'dash';
          locomotionFrame = 0;
          vx = fixed.mul(fixed.fromInt(horizontal), K1_MOVEMENT.dashSpeed);
        } else if (locomotion === 'dash' && locomotionFrame < K1_MOVEMENT.dashFrames) {
          vx = fixed.mul(fixed.fromInt(horizontal), K1_MOVEMENT.dashSpeed);
        } else {
          locomotion = 'run';
          vx = approach(vx, fixed.mul(fixed.fromInt(horizontal), K1_MOVEMENT.runSpeed), K1_MOVEMENT.groundAccel);
        }
      } else {
        locomotion = 'walk';
        vx = approach(vx, stickToFixed(input.moveX, K1_MOVEMENT.walkSpeed), K1_MOVEMENT.groundAccel);
      }
    }
  } else {
    locomotion = 'airborne';
    if (jumpBufferFrames > 0 && jumpsRemaining > 0) {
      vy = K1_MOVEMENT.doubleJumpSpeed;
      jumpsRemaining -= 1;
      fastFalling = false;
      jumpBufferFrames = 0;
      locomotionFrame = 0;
    }

    const targetAirVx = stickToFixed(input.moveX, K1_MOVEMENT.maxAirSpeed);
    vx = approach(vx, targetAirVx, K1_MOVEMENT.airAccel);

    if (downFlick && vy < fixed.zero) fastFalling = true;
    if (fastFalling) {
      vy = fixed.mul(fixed.fromInt(-1), K1_MOVEMENT.fastFallSpeed);
    } else {
      vy = fixed.sub(vy, K1_MOVEMENT.gravity);
      const terminal = fixed.mul(fixed.fromInt(-1), K1_MOVEMENT.maxFallSpeed);
      if (vy < terminal) vy = terminal;
    }
  }

  const oldY = y;
  x = fixed.add(x, vx);
  y = fixed.add(y, vy);

  if (!grounded && vy <= fixed.zero) {
    const landing = findLandingSurface(oldY, y, x, surfaces, dropThroughFrames > 0);
    if (landing) {
      y = landing.y;
      vy = fixed.zero;
      grounded = true;
      groundSurfaceId = landing.id;
      locomotion = 'landing';
      locomotionFrame = 0;
      jumpsRemaining = 1;
      fastFalling = false;
    }
  }

  return {
    ...fighter,
    x,
    y,
    vx,
    vy,
    grounded,
    groundSurfaceId,
    facing,
    locomotion,
    locomotionFrame,
    jumpsRemaining,
    fastFalling,
    dropThroughFrames,
    jumpBufferFrames,
    inputHistory: history,
  };
}
