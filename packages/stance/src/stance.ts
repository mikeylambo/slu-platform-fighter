/** Generic stance transition. No renderer, clock, or character dependency. */
export interface StanceState { id: string; unfurl: number; switchedAirborne: boolean; }
export interface StanceRules { ids: readonly string[]; unfurlFrames: number; airborneSwitches: 'once' | 'unlimited'; }
export function requestStance(state: StanceState, rules: StanceRules, airborne: boolean): StanceState {
  if (state.unfurl > 0 || (airborne && state.switchedAirborne && rules.airborneSwitches === 'once')) return state;
  const index = rules.ids.indexOf(state.id);
  if (index < 0) throw new Error(`Unknown stance ${state.id}`);
  return { id: rules.ids[(index + 1) % rules.ids.length]!, unfurl: rules.unfurlFrames, switchedAirborne: airborne || state.switchedAirborne };
}
export function tickStance(state: StanceState, refresh: boolean): StanceState {
  return { ...state, unfurl: Math.max(0, state.unfurl - 1), switchedAirborne: refresh ? false : state.switchedAirborne };
}
