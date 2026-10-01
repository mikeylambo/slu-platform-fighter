import type { WorldState } from '../../../../../packages/sim/src/types.js';
import { createSession, IDS } from '../session.js';
import { DEFAULT_OPTIONS, DEFAULT_SEED } from '../../content/rules/duel.js';
import { stageById, stageLedges, surfaces } from '../../content/stages/roster.js';
import { initialKnight, save, type DuelOptions } from './state.js';

export const DEFAULT_DUEL: DuelOptions = {
  ...DEFAULT_OPTIONS,
  cpu: [...DEFAULT_OPTIONS.cpu],
  oaths: [...DEFAULT_OPTIONS.oaths],
};

/** Builds a fresh duel world: stage geometry, Fracture counts, and the duel rules state. */
export function createDuel(options: Partial<DuelOptions> = {}, seed = DEFAULT_SEED): WorldState {
  const opt: DuelOptions = { ...DEFAULT_DUEL, ...options };
  const w = createSession(seed);
  const stage = stageById(opt.stage);
  w.surfaces = surfaces(stage);
  w.ledges = stageLedges(stage);
  w.fighters.forEach((p) => {
    p.stocks = opt.lives;
  });
  save(w, {
    options: opt,
    knights: Object.fromEntries(IDS.map((id) => [id, initialKnight()])),
    round: 1,
    wins: [0, 0],
    clock: opt.timer,
    sudden: false,
    suddenFrames: 0,
    phase: 'fight',
    pause: 0,
    winner: null,
    clash: 0,
    doubleKindle: false,
    progress: 0,
    events: [],
  });
  return w;
}
