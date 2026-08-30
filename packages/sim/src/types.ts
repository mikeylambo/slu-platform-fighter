import type { Fixed } from '../../deterministic-math/src/fixed.js';

export type LocomotionState =
  | 'idle' | 'walk' | 'dash' | 'run' | 'turn' | 'crouch' | 'jump-squat' | 'airborne' | 'landing'
  | 'ledge-hang' | 'air-dodge' | 'spot-dodge' | 'roll' | 'tech-in-place' | 'tech-roll' | 'knockdown' | 'grabbed' | 'respawn';

export interface SimInputFrame {
  frame: number;
  /** Quantized analogue horizontal movement axis in [-1000, 1000]. */
  moveX: number;
  /** Quantized analogue vertical movement axis in [-1000, 1000]. */
  moveY: number;
  jumpPressed: boolean;
  jumpHeld: boolean;
  /** Movement-only adapters may omit combat semantics; combat adapters should provide them explicitly. */
  attackPressed?: boolean;
  specialPressed?: boolean;
  grabPressed?: boolean;
  /** Quantized semantic smash/right-stick axes in [-1000, 1000]. Zero means no smash-stick request. */
  smashX?: number;
  smashY?: number;
  dodgePressed: boolean;
  shieldHeld: boolean;
}

export interface StageSurface { id: string; kind: 'solid' | 'one-way'; y: Fixed; xMin: Fixed; xMax: Fixed; }
export interface StageLedge { id: string; x: Fixed; y: Fixed; /** Direction toward the stage interior. */ inward: -1 | 1; }
export interface FighterAttackState { attackId: string; frame: number; hitTargets: string[]; }
export interface FighterGrabActionState { actionId: string; frame: number; }

export interface FighterState {
  /** Stable runtime participant/slot id, e.g. fighter-a or player-3. */
  id: string;
  /** Stable fighter-pack/content id, e.g. greybox or a roster character id. */
  definitionId: string;
  x: Fixed;
  y: Fixed;
  vx: Fixed;
  vy: Fixed;
  grounded: boolean;
  groundSurfaceId: string | null;
  facing: -1 | 1;
  locomotion: LocomotionState;
  locomotionFrame: number;
  jumpsRemaining: number;
  fastFalling: boolean;
  dropThroughFrames: number;
  jumpBufferFrames: number;
  inputHistory: SimInputFrame[];
  ledgeId: string | null;
  ledgeRegrabLockoutFrames: number;
  invulnerableFrames: number;
  dodgeCooldownFrames: number;
  techBufferFrames: number;
  /** Damage percent stored in tenths: 35 = 3.5%. */
  percentTenths: number;
  hitlagFrames: number;
  hitstunFrames: number;
  attack: FighterAttackState | null;
  shielding: boolean;
  /** Shield health in integer simulation units. */
  shieldHealth: number;
  shieldStunFrames: number;
  shieldRegenDelayFrames: number;
  /** Captor-side relationship; null when this fighter is not holding another fighter. */
  grabTargetId: string | null;
  /** Captive-side relationship; null when this fighter is not grabbed. */
  grabbedById: string | null;
  /** Frames elapsed in the current grab relationship. */
  grabFrames: number;
  /** Fighter-authored pummel/throw timeline currently executing while holding a target. */
  grabAction: FighterGrabActionState | null;
  /** Remaining stocks in stock-based rulesets. */
  stocks: number;
  /** True after the fighter has lost its final stock. */
  eliminated: boolean;
  /** Frames remaining before control resumes after a non-final-stock KO. */
  respawnFrames: number;
}

/** Authoritative dynamic state for projectiles, traps, summons and fighter-owned weapons. */
export interface OwnedEntityState {
  /** Stable runtime entity id; generated from the monotonic world entity serial. */
  id: string;
  /** Fighter-owned entity definition id, e.g. greybox:pulse. */
  definitionId: string;
  /** Runtime participant that spawned/owns this actor. */
  ownerId: string;
  /** Fighter-pack definition that owns the actor contract. */
  ownerDefinitionId: string;
  x: Fixed;
  y: Fixed;
  vx: Fixed;
  vy: Fixed;
  facing: -1 | 1;
  ageFrames: number;
  lifetimeFrames: number;
  hitsRemaining: number;
  hitTargets: string[];
}

export interface WorldState {
  frame: number;
  seed: number;
  fighters: FighterState[];
  entities: OwnedEntityState[];
  /** Monotonic serial used to mint deterministic runtime entity ids. */
  nextEntitySerial: number;
  surfaces: StageSurface[];
  ledges: StageLedge[];
  /** Stable winner participant id once a stock match is resolved; null while unresolved. */
  winnerId: string | null;
}

export interface WorldSnapshot { state: WorldState; }
