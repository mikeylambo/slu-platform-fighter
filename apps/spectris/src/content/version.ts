/**
 * Replay and netcode compatibility tags. Bump whenever simulation results change
 * so old tapes and mismatched peers fail loudly instead of silently drifting.
 *
 * v4 (2026-10-01): GDD revision 2 physics, grab mash symmetry, Cape down-throw
 * knockdown, free flash expiring with Kindle, feel-lab presets in match state.
 */
export const REPLAY_VERSION = 'spectris-duel-v4';

/** Session-only (feel lab) replays recorded by `dev/check.ts`. */
export const FEEL_REPLAY_VERSION = 'spectris-feel-v3';
