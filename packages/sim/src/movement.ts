import { fixed, type Fixed } from '../../deterministic-math/src/fixed.js';
import type { FighterState, SimInputFrame, StageLedge, StageSurface } from './types.js';

export interface MovementRules {
  stickMax: number;
  deadzone: number;
  runThreshold: number;
  crouchThreshold: number;
  fastFallThreshold: number;
  inputHistoryFrames: number;
  jumpBufferFrames: number;
  dashFrames: number;
  turnFrames: number;
  jumpSquatFrames: number;
  landingFrames: number;
  platformDropFrames: number;
  walkSpeed: Fixed;
  dashSpeed: Fixed;
  runSpeed: Fixed;
  groundAccel: Fixed;
  groundFriction: Fixed;
  airAccel: Fixed;
  maxAirSpeed: Fixed;
  fullHopSpeed: Fixed;
  shortHopSpeed: Fixed;
  doubleJumpSpeed: Fixed;
  gravity: Fixed;
  maxFallSpeed: Fixed;
  fastFallSpeed: Fixed;
  ledgeGrabXRadius: Fixed;
  ledgeGrabAbove: Fixed;
  ledgeGrabBelow: Fixed;
  ledgeHangXOffset: Fixed;
  ledgeHangYOffset: Fixed;
  ledgeRegrabLockoutFrames: number;
  ledgeInvulnFrames: number;
  ledgeJumpHorizontalSpeed: Fixed;
  airDodgeFrames: number;
  airDodgeSpeed: Fixed;
  airDodgeInvulnFrames: number;
  spotDodgeFrames: number;
  rollFrames: number;
  rollSpeed: Fixed;
  groundDodgeInvulnFrames: number;
  dodgeCooldownFrames: number;
  techBufferFrames: number;
  techFrames: number;
  techRollSpeed: Fixed;
  wallJumpEnabled: boolean;
  wallClingEnabled: boolean;
}

export const K1_MOVEMENT: MovementRules = {
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
  ledgeGrabXRadius: fixed.fromRatio(7, 10),
  ledgeGrabAbove: fixed.fromRatio(4, 5),
  ledgeGrabBelow: fixed.fromRatio(7, 5),
  ledgeHangXOffset: fixed.fromRatio(9, 20),
  ledgeHangYOffset: fixed.fromRatio(7, 10),
  ledgeRegrabLockoutFrames: 30,
  ledgeInvulnFrames: 30,
  ledgeJumpHorizontalSpeed: fixed.fromRatio(7, 50),
  airDodgeFrames: 18,
  airDodgeSpeed: fixed.fromRatio(9, 50),
  airDodgeInvulnFrames: 12,
  spotDodgeFrames: 16,
  rollFrames: 20,
  rollSpeed: fixed.fromRatio(4, 25),
  groundDodgeInvulnFrames: 12,
  dodgeCooldownFrames: 12,
  techBufferFrames: 8,
  techFrames: 20,
  techRollSpeed: fixed.fromRatio(7, 50),
  wallJumpEnabled: true,
  wallClingEnabled: false,
};

function clampStick(value: number, rules: MovementRules): number {
  if (!Number.isInteger(value)) throw new Error(`stick input must be integer, got ${value}`);
  return Math.max(-rules.stickMax, Math.min(rules.stickMax, value));
}

function approach(current: Fixed, target: Fixed, amount: Fixed): Fixed {
  if (current < target) return Math.min(fixed.add(current, amount), target) as Fixed;
  if (current > target) return Math.max(fixed.sub(current, amount), target) as Fixed;
  return current;
}

function stickToFixed(value: number, maxSpeed: Fixed, rules: MovementRules): Fixed {
  const clamped = clampStick(value, rules);
  return fixed.mul(fixed.fromRatio(clamped, rules.stickMax), maxSpeed);
}

function signOutsideDeadzone(value: number, rules: MovementRules): -1 | 0 | 1 {
  if (value > rules.deadzone) return 1;
  if (value < -rules.deadzone) return -1;
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

function findGrabbableLedge(
  fighter: FighterState,
  ledges: StageLedge[],
  rules: MovementRules,
): StageLedge | undefined {
  return [...ledges]
    .filter((ledge) => fixed.abs(fixed.sub(fighter.x, ledge.x)) <= rules.ledgeGrabXRadius)
    .filter((ledge) => fighter.y <= fixed.add(ledge.y, rules.ledgeGrabAbove))
    .filter((ledge) => fighter.y >= fixed.sub(ledge.y, rules.ledgeGrabBelow))
    .sort((a, b) => {
      const dx = fixed.abs(fixed.sub(fighter.x, a.x)) - fixed.abs(fixed.sub(fighter.x, b.x));
      return dx || a.id.localeCompare(b.id);
    })[0];
}

function directionalDodgeVelocity(input: SimInputFrame, facing: -1 | 1, rules: MovementRules): { vx: Fixed; vy: Fixed } {
  let x = input.moveX;
  let y = input.moveY;
  let magnitude = Math.max(Math.abs(x), Math.abs(y));
  if (magnitude <= rules.deadzone) {
    x = facing;
    y = 0;
    magnitude = 1;
  }
  return {
    vx: fixed.mul(fixed.fromRatio(x, magnitude), rules.airDodgeSpeed),
    vy: fixed.mul(fixed.fromRatio(y, magnitude), rules.airDodgeSpeed),
  };
}

export function sanitizeInput(input: SimInputFrame, rules: MovementRules = K1_MOVEMENT): SimInputFrame {
  return {
    ...input,
    moveX: clampStick(input.moveX, rules),
    moveY: clampStick(input.moveY, rules),
  };
}

export function resolveGroundImpact(
  fighter: FighterState,
  horizontalIntent: -1 | 0 | 1,
  rules: MovementRules = K1_MOVEMENT,
): FighterState {
  if (fighter.techBufferFrames > 0) {
    const techRoll = horizontalIntent !== 0;
    return {
      ...fighter,
      grounded: true,
      vy: fixed.zero,
      vx: techRoll ? fixed.mul(fixed.fromInt(horizontalIntent), rules.techRollSpeed) : fixed.zero,
      locomotion: techRoll ? 'tech-roll' : 'tech-in-place',
      locomotionFrame: 0,
      facing: horizontalIntent === 0 ? fighter.facing : horizontalIntent,
      invulnerableFrames: rules.techFrames,
      techBufferFrames: 0,
    };
  }
  return {
    ...fighter,
    grounded: true,
    vy: fixed.zero,
    vx: fixed.zero,
    locomotion: 'knockdown',
    locomotionFrame: 0,
  };
}

export function canWallJump(rules: MovementRules = K1_MOVEMENT): boolean {
  return rules.wallJumpEnabled;
}

export function canWallCling(rules: MovementRules = K1_MOVEMENT): boolean {
  return rules.wallClingEnabled;
}

export function stepFighterMovement(
  fighter: FighterState,
  rawInput: SimInputFrame,
  surfaces: StageSurface[],
  ledges: StageLedge[],
  rules: MovementRules = K1_MOVEMENT,
): FighterState {
  const input = sanitizeInput(rawInput, rules);
  const priorInput = fighter.inputHistory.at(-1);
  const history = [...fighter.inputHistory, input].slice(-rules.inputHistoryFrames);
  const horizontal = signOutsideDeadzone(input.moveX, rules);
  const previousHorizontal = priorInput ? signOutsideDeadzone(priorInput.moveX, rules) : 0;
  const downPressed = input.moveY <= rules.crouchThreshold;
  const downFlick = input.moveY <= rules.fastFallThreshold && (priorInput?.moveY ?? 0) > rules.fastFallThreshold;

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
  let jumpBufferFrames = input.jumpPressed ? rules.jumpBufferFrames : Math.max(0, fighter.jumpBufferFrames - 1);
  let ledgeId = fighter.ledgeId;
  let ledgeRegrabLockoutFrames = Math.max(0, fighter.ledgeRegrabLockoutFrames - 1);
  let invulnerableFrames = Math.max(0, fighter.invulnerableFrames - 1);
  let dodgeCooldownFrames = Math.max(0, fighter.dodgeCooldownFrames - 1);
  let techBufferFrames = input.dodgePressed ? rules.techBufferFrames : Math.max(0, fighter.techBufferFrames - 1);

  if (locomotion === 'ledge-hang' && ledgeId !== null) {
    const ledge = ledges.find((candidate) => candidate.id === ledgeId);
    if (!ledge) throw new Error(`fighter ${fighter.id} references missing ledge ${ledgeId}`);
    x = fixed.sub(ledge.x, fixed.mul(fixed.fromInt(ledge.inward), rules.ledgeHangXOffset));
    y = fixed.sub(ledge.y, rules.ledgeHangYOffset);
    vx = fixed.zero;
    vy = fixed.zero;
    grounded = false;
    groundSurfaceId = null;
    facing = ledge.inward;

    if (input.jumpPressed) {
      locomotion = 'airborne';
      locomotionFrame = 0;
      ledgeId = null;
      ledgeRegrabLockoutFrames = rules.ledgeRegrabLockoutFrames;
      vx = fixed.mul(fixed.fromInt(ledge.inward), rules.ledgeJumpHorizontalSpeed);
      vy = rules.shortHopSpeed;
      jumpBufferFrames = 0;
    } else if (downPressed || horizontal === -ledge.inward) {
      locomotion = 'airborne';
      locomotionFrame = 0;
      ledgeId = null;
      ledgeRegrabLockoutFrames = rules.ledgeRegrabLockoutFrames;
      y = fixed.sub(y, fixed.fromRatio(1, 1000));
    } else {
      return {
        ...fighter,
        x, y, vx, vy, grounded, groundSurfaceId, facing, locomotion, locomotionFrame,
        jumpsRemaining, fastFalling, dropThroughFrames, jumpBufferFrames, inputHistory: history,
        ledgeId, ledgeRegrabLockoutFrames, invulnerableFrames, dodgeCooldownFrames, techBufferFrames,
      };
    }
  }

  if (grounded && input.dodgePressed && dodgeCooldownFrames === 0 && locomotion !== 'jump-squat') {
    const rolling = horizontal !== 0;
    locomotion = rolling ? 'roll' : 'spot-dodge';
    locomotionFrame = 0;
    vx = rolling ? fixed.mul(fixed.fromInt(horizontal), rules.rollSpeed) : fixed.zero;
    if (rolling) facing = horizontal;
    invulnerableFrames = rules.groundDodgeInvulnFrames;
    dodgeCooldownFrames = rules.dodgeCooldownFrames;
  }

  if (!grounded && locomotion === 'airborne' && input.dodgePressed && dodgeCooldownFrames === 0) {
    const dodge = directionalDodgeVelocity(input, facing, rules);
    locomotion = 'air-dodge';
    locomotionFrame = 0;
    vx = dodge.vx;
    vy = dodge.vy;
    fastFalling = false;
    invulnerableFrames = rules.airDodgeInvulnFrames;
    dodgeCooldownFrames = rules.dodgeCooldownFrames;
  }

  if (grounded && locomotion === 'spot-dodge') {
    vx = fixed.zero;
    if (locomotionFrame >= rules.spotDodgeFrames) {
      locomotion = 'idle';
      locomotionFrame = 0;
    }
  } else if (grounded && locomotion === 'roll') {
    if (locomotionFrame >= rules.rollFrames) {
      locomotion = 'idle';
      locomotionFrame = 0;
      vx = fixed.zero;
    }
  } else if (grounded && (locomotion === 'tech-in-place' || locomotion === 'tech-roll')) {
    if (locomotionFrame >= rules.techFrames) {
      locomotion = 'idle';
      locomotionFrame = 0;
      vx = fixed.zero;
    }
  } else if (grounded && locomotion === 'knockdown') {
    vx = fixed.zero;
  } else {
    const currentSurface = surfaceAt(fighter, surfaces);
    if (grounded && currentSurface?.kind === 'one-way' && downPressed) {
      grounded = false;
      groundSurfaceId = null;
      dropThroughFrames = rules.platformDropFrames;
      locomotion = 'airborne';
      locomotionFrame = 0;
      y = fixed.sub(y, fixed.fromRatio(1, 1000));
    }

    if (grounded && jumpBufferFrames > 0 && locomotion !== 'jump-squat') {
      locomotion = 'jump-squat';
      locomotionFrame = 0;
      jumpBufferFrames = 0;
      vx = horizontal === 0 ? vx : stickToFixed(input.moveX, rules.runSpeed, rules);
    }

    if (grounded) {
      if (locomotion === 'jump-squat') {
        vx = approach(vx, stickToFixed(input.moveX, rules.runSpeed, rules), rules.groundAccel);
        if (locomotionFrame >= rules.jumpSquatFrames) {
          grounded = false;
          groundSurfaceId = null;
          locomotion = 'airborne';
          locomotionFrame = 0;
          vy = input.jumpHeld ? rules.fullHopSpeed : rules.shortHopSpeed;
          jumpsRemaining = 1;
        }
      } else if (downPressed) {
        locomotion = 'crouch';
        locomotionFrame = locomotion === fighter.locomotion ? locomotionFrame : 0;
        vx = approach(vx, fixed.zero, rules.groundFriction);
      } else if (horizontal === 0) {
        locomotion = locomotion === 'landing' && locomotionFrame < rules.landingFrames ? 'landing' : 'idle';
        vx = approach(vx, fixed.zero, rules.groundFriction);
      } else {
        facing = horizontal;
        const reversed = previousHorizontal !== 0 && horizontal !== previousHorizontal;
        if (reversed && (fighter.locomotion === 'dash' || fighter.locomotion === 'run')) {
          locomotion = 'turn';
          locomotionFrame = 0;
        } else if (locomotion === 'turn' && locomotionFrame < rules.turnFrames) {
          vx = approach(vx, fixed.zero, rules.groundFriction);
        } else if (Math.abs(input.moveX) >= rules.runThreshold) {
          if (fighter.locomotion === 'idle' || fighter.locomotion === 'walk' || fighter.locomotion === 'landing' || previousHorizontal === 0) {
            locomotion = 'dash';
            locomotionFrame = 0;
            vx = fixed.mul(fixed.fromInt(horizontal), rules.dashSpeed);
          } else if (locomotion === 'dash' && locomotionFrame < rules.dashFrames) {
            vx = fixed.mul(fixed.fromInt(horizontal), rules.dashSpeed);
          } else {
            locomotion = 'run';
            vx = approach(vx, fixed.mul(fixed.fromInt(horizontal), rules.runSpeed), rules.groundAccel);
          }
        } else {
          locomotion = 'walk';
          vx = approach(vx, stickToFixed(input.moveX, rules.walkSpeed, rules), rules.groundAccel);
        }
      }
    } else if (locomotion === 'air-dodge') {
      if (locomotionFrame >= rules.airDodgeFrames) {
        locomotion = 'airborne';
        locomotionFrame = 0;
      }
    } else {
      locomotion = 'airborne';
      if (jumpBufferFrames > 0 && jumpsRemaining > 0) {
        vy = rules.doubleJumpSpeed;
        jumpsRemaining -= 1;
        fastFalling = false;
        jumpBufferFrames = 0;
        locomotionFrame = 0;
      }

      const targetAirVx = stickToFixed(input.moveX, rules.maxAirSpeed, rules);
      vx = approach(vx, targetAirVx, rules.airAccel);

      if (downFlick && vy < fixed.zero) fastFalling = true;
      if (fastFalling) {
        vy = fixed.mul(fixed.fromInt(-1), rules.fastFallSpeed);
      } else {
        vy = fixed.sub(vy, rules.gravity);
        const terminal = fixed.mul(fixed.fromInt(-1), rules.maxFallSpeed);
        if (vy < terminal) vy = terminal;
      }
    }
  }

  const oldY = y;
  x = fixed.add(x, vx);
  y = fixed.add(y, vy);

  if (!grounded && locomotion !== 'ledge-hang' && vy <= fixed.zero) {
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
      ledgeId = null;
    } else if (ledgeRegrabLockoutFrames === 0 && locomotion !== 'air-dodge') {
      const probe: FighterState = { ...fighter, x, y, vx, vy, grounded: false };
      const ledge = findGrabbableLedge(probe, ledges, rules);
      if (ledge) {
        ledgeId = ledge.id;
        locomotion = 'ledge-hang';
        locomotionFrame = 0;
        facing = ledge.inward;
        vx = fixed.zero;
        vy = fixed.zero;
        x = fixed.sub(ledge.x, fixed.mul(fixed.fromInt(ledge.inward), rules.ledgeHangXOffset));
        y = fixed.sub(ledge.y, rules.ledgeHangYOffset);
        invulnerableFrames = rules.ledgeInvulnFrames;
        fastFalling = false;
      }
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
    ledgeId,
    ledgeRegrabLockoutFrames,
    invulnerableFrames,
    dodgeCooldownFrames,
    techBufferFrames,
  };
}
