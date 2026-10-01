import { fixed as f, type Fixed } from '../../../../../packages/deterministic-math/src/fixed.js';
import type { MatchEvent } from '../../../../../packages/sim/src/match.js';
import type { FighterState, SimInputFrame, WorldState } from '../../../../../packages/sim/src/types.js';
import { emptySoulfire, type SoulfireState } from '../../../../../packages/soulfire/src/soulfire.js';
import type { ClashChoice } from '../../../../../packages/clash/src/clash.js';
import { gameData, neutral, type KnightState } from '../session.js';
import { DUEL, type Oath } from '../../content/rules/duel.js';
import { OATH_EFFECTS, type OathEffects } from '../../content/rules/oaths.js';
import type { EvadeKind } from '../../content/knight/defense.js';
import type { FeelSettings } from '../../content/knight/physics.js';

export interface DuelOptions {
  stage: string;
  format: 'rounds' | 'continuous' | 'momentum' | 'training';
  bestOf: number;
  lives: number;
  timer: number;
  cpu: [number, number];
  oaths: [Oath, Oath];
  buffer: number;
  counterpick?: boolean;
  stanceLock?: 'free' | 'wings' | 'cape';
  /** Feel-lab physics preset (jumpsquat/traction A/B); absent = GDD default. */
  feel?: FeelSettings;
}

export interface Ghost {
  x: Fixed;
  y: Fixed;
  facing: -1 | 1;
  move: string;
  age: number;
  real: boolean;
  hit: boolean;
}

export interface Blade {
  x: Fixed;
  y: Fixed;
  origin: Fixed;
  direction: -1 | 1;
  age: number;
  returning: boolean;
  wait: number;
  hit: boolean;
  returnHit: boolean;
}

export interface DuelKnight {
  meter: number;
  integrity: number;
  guard: number;
  guardRelease: number;
  regen: number;
  stagger: number;
  evade: number;
  evadeKind: EvadeKind;
  evadeDirection: number;
  airDodge: boolean;
  helpless: boolean;
  sideUses: number;
  riftUses: number;
  soul: SoulfireState;
  charge: number;
  charging: boolean;
  blade: Blade | null;
  ghost: Ghost | null;
  feint: number;
  feintCommitted: boolean;
  lock: number;
  grab: number;
  holding: string | null;
  heldBy: string | null;
  hold: number;
  pummel: number;
  regrab: number;
  regrabs: number;
  shatterGrab: boolean;
  burn: number;
  aim: [number, number];
  emerge: boolean;
  flash: boolean;
  bonusJump: boolean;
  buffered: SimInputFrame | null;
  bufferFrames: number;
  lastMove: string;
  choice: ClashChoice;
  parries: number;
  clashes: number;
  fractures: number;
  ai: SimInputFrame;
  history: { x: number; y: number; attack: boolean }[];
}

export interface DuelEvent {
  type: string;
  player: string;
  x: number;
  y: number;
}

export interface DuelState {
  options: DuelOptions;
  knights: Record<string, DuelKnight>;
  round: number;
  wins: [number, number];
  clock: number;
  sudden: boolean;
  suddenFrames: number;
  phase: 'fight' | 'round-end' | 'over';
  pause: number;
  winner: string | null;
  clash: number;
  doubleKindle: boolean;
  progress: number;
  events: DuelEvent[];
}

/** Guard state captured before PF resolves hits this frame. */
export interface GuardSnapshot {
  active: boolean;
  parry: boolean;
  facing: number;
}

/** Shared per-frame working set passed through every rules module. */
export interface Frame {
  w: WorldState;
  d: DuelState;
  inputs: Record<string, SimInputFrame>;
  /** Each player's input as sampled this frame, before any rule froze it. */
  samples: Record<string, SimInputFrame>;
  guards: Map<string, GuardSnapshot>;
  immediate: MatchEvent[];
  shatterTargets: Set<string>;
}

/** Per-fighter working set for the pre-simulation pass. */
export interface Actor {
  frame: Frame;
  index: number;
  p: FighterState;
  t: FighterState;
  k: DuelKnight;
  tk: DuelKnight;
  /** Raw sample for this frame (before the action buffer). */
  sample: SimInputFrame;
  /** Buffered input actually acted on. */
  raw: SimInputFrame;
  oath: Oath;
  effects: OathEffects;
  g: KnightState;
  heldSpecial: boolean;
}

export const initialKnight = (): DuelKnight => ({
  meter: 0,
  integrity: DUEL.integrity.max,
  guard: 0,
  guardRelease: 0,
  regen: 0,
  stagger: 0,
  evade: 0,
  evadeKind: 'spot',
  evadeDirection: 0,
  airDodge: false,
  helpless: false,
  sideUses: 0,
  riftUses: 0,
  soul: emptySoulfire(),
  charge: 0,
  charging: false,
  blade: null,
  ghost: null,
  feint: 0,
  feintCommitted: false,
  lock: 0,
  grab: 0,
  holding: null,
  heldBy: null,
  hold: 0,
  pummel: 0,
  regrab: 0,
  regrabs: 0,
  shatterGrab: false,
  burn: 0,
  aim: [0, 1],
  emerge: false,
  flash: false,
  bonusJump: false,
  buffered: null,
  bufferFrames: 0,
  lastMove: 'wings:jab',
  choice: 'press',
  parries: 0,
  clashes: 0,
  fractures: 0,
  ai: neutral(0),
  history: [],
});

export const duelData = (w: WorldState): DuelState | undefined =>
  (JSON.parse(w.extensionState ?? '{}') as { duel?: DuelState }).duel;

export function save(w: WorldState, d: DuelState): void {
  w.extensionState = JSON.stringify({ ...gameData(w), duel: d });
}

/** Writes an edited knight session record back alongside the in-memory duel state. */
export function commitKnight(w: WorldState, d: DuelState, id: string, knight: KnightState): void {
  const data = gameData(w);
  data.knights[id] = knight;
  w.extensionState = JSON.stringify({ ...data, duel: d });
}

export function emit(d: DuelState, type: string, p: FighterState): void {
  d.events.push({ type, player: p.id, x: f.toNumber(p.x), y: f.toNumber(p.y) });
}

/** Starts a Spectris move by key on the fighter's current stance. */
export function setAttack(p: FighterState, key: string): void {
  p.attack = { attackId: `${p.definitionId}:${key}`, frame: 0, hitTargets: [] };
}

/** The move key of an attack id (`wings:sling` → `sling`). */
export const moveKey = (attackId: string): string => attackId.split(':')[1]!;

export const oathOf = (d: DuelState, id: string, ids: readonly string[]): Oath => d.options.oaths[ids.indexOf(id)]!;

export const effectsOf = (oath: Oath): OathEffects => OATH_EFFECTS[oath];

/** Freezes a fighter's input this frame. */
export function freeze(frame: Frame, p: FighterState): void {
  frame.inputs[p.id] = neutral(frame.w.frame);
}

/** A fresh, cosmetic (non-hitting) afterimage at the fighter's position. */
export function afterimage(p: FighterState, move: string, real = false): Ghost {
  return { x: p.x, y: p.y, facing: p.facing, move, age: 0, real, hit: false };
}
