import type { Fixed } from '../../deterministic-math/src/fixed.js';

export type LocomotionState =
  | 'idle' | 'walk' | 'dash' | 'run' | 'turn' | 'crouch' | 'jump-squat' | 'airborne' | 'landing'
  | 'ledge-hang' | 'air-dodge' | 'spot-dodge' | 'roll' | 'tech-in-place' | 'tech-roll' | 'knockdown' | 'grabbed' | 'respawn';

export interface SimInputFrame {
  frame: number; moveX: number; moveY: number; jumpPressed: boolean; jumpHeld: boolean;
  attackPressed?: boolean; specialPressed?: boolean; grabPressed?: boolean; smashX?: number; smashY?: number;
  dodgePressed: boolean; shieldHeld: boolean;
}

export interface StageSurface { id: string; kind: 'solid' | 'one-way'; y: Fixed; xMin: Fixed; xMax: Fixed; }
export interface StageLedge { id: string; x: Fixed; y: Fixed; inward: -1 | 1; }
export interface FighterAttackState { attackId: string; frame: number; hitTargets: string[]; chargeFrames?: number; }
export interface FighterGrabActionState { actionId: string; frame: number; }
export interface FighterSmashChargeState { attackId: string; frames: number; axis: 'x' | 'y'; direction: -1 | 1; }

export interface FighterState {
  id: string; definitionId: string; x: Fixed; y: Fixed; vx: Fixed; vy: Fixed; grounded: boolean; groundSurfaceId: string | null; facing: -1 | 1;
  locomotion: LocomotionState; locomotionFrame: number; jumpsRemaining: number; fastFalling: boolean; dropThroughFrames: number; jumpBufferFrames: number;
  inputHistory: SimInputFrame[]; ledgeId: string | null; ledgeRegrabLockoutFrames: number; invulnerableFrames: number; dodgeCooldownFrames: number; techBufferFrames: number; landingLagFrames: number;
  percentTenths: number; hitlagFrames: number; hitstunFrames: number; attack: FighterAttackState | null; smashCharge?: FighterSmashChargeState | null; shielding: boolean; shieldHealth: number; shieldStunFrames: number; shieldRegenDelayFrames: number;
  grabTargetId: string | null; grabbedById: string | null; grabFrames: number; grabAction: FighterGrabActionState | null;
  lastHitById: string | null; lastHitFrame: number; stocks: number; eliminated: boolean; respawnFrames: number;
}

export interface OwnedEntityState {
  id: string; definitionId: string; ownerId: string; ownerDefinitionId: string; x: Fixed; y: Fixed; vx: Fixed; vy: Fixed; facing: -1 | 1;
  ageFrames: number; lifetimeFrames: number; hitsRemaining: number; hitTargets: string[];
}
export interface ItemState { id: string; definitionId: string; x: Fixed; y: Fixed; vx: Fixed; vy: Fixed; holderId: string | null; usesRemaining: number; ageFrames: number; }
export type MatchMode = 'stock' | 'time' | 'stock-time';
export interface MatchRuntimeState { mode: MatchMode; framesRemaining: number | null; scores: Record<string, number>; suddenDeath: boolean; ended: boolean; winningTeamId: string | null; }
export interface WorldState {
  frame: number; seed: number; fighters: FighterState[]; entities?: OwnedEntityState[]; nextEntitySerial?: number; items?: ItemState[]; nextItemSerial?: number;
  surfaces: StageSurface[]; ledges: StageLedge[]; match?: MatchRuntimeState; winnerId: string | null;
}
export interface WorldSnapshot { state: WorldState; }
