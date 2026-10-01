import { PlatformFighterShell } from '../../../../packages/shell/src/session.js';
import { InputPort } from './input.js';
import { AudioPort } from './audio.js';
/** All platform services belong to the PF shell boundary, never to simulation. */
export class SpectrisShell extends PlatformFighterShell {
  readonly input = new InputPort();
  readonly audio = new AudioPort();
  constructor() {
    super({ fighterIds: ['knight'], stageIds: ['mirror-sanctum'], rulesetIds: ['feel-lab'] });
  }
  begin(local: boolean) {
    this.startTrainingSetup();
    this.configureSlot(2, { control: local ? 'human' : 'cpu' });
    for (const slot of [1, 2] as const) {
      this.selectFighter(slot, 'knight');
      this.setSlotReady(slot, true);
    }
    this.continueFromFighterSelect();
    this.selectStage('mirror-sanctum');
    this.input.clear();
    this.audio.start();
    return this.startMatch();
  }
}
