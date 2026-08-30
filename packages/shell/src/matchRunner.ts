import type { MatchInputFrame, MatchStepResult } from '../../sim/src/match.js';
import type { WorldState } from '../../sim/src/types.js';
import { MatchControlSession } from './matchControl.js';

export type MatchRunnerStep = (state: WorldState, input: MatchInputFrame) => MatchStepResult;

/**
 * Product/session runner around the deterministic match. Pause/controller/network
 * policy lives outside simulation; a paused runner consumes no simulation frame.
 */
export class ControlledMatchRunner {
  private state: WorldState;
  private readonly step: MatchRunnerStep;
  readonly control: MatchControlSession;

  constructor(initialState: WorldState, step: MatchRunnerStep, control: MatchControlSession) {
    this.state = structuredClone(initialState);
    this.step = step;
    this.control = control;
  }

  get snapshot(): WorldState { return structuredClone(this.state); }

  tick(input: MatchInputFrame): MatchStepResult | null {
    if (this.control.snapshot.paused) return null;
    if (input.frame !== this.state.frame) throw new Error(`controlled match input frame ${input.frame} does not match world frame ${this.state.frame}`);
    const result = this.step(this.state, input);
    if (result.state.frame !== this.state.frame + 1) throw new Error('controlled match step must advance exactly one frame');
    this.state = result.state;
    return result;
  }
}
