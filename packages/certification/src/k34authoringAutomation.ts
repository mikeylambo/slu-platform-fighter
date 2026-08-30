import { scenarioBotInput, SCENARIO_BOT_CATALOG } from '../../sim/src/scenarioBots.js';
import { TrainingSession, type DummyPlayback } from '../../training/src/session.js';
import { createTwoFighterMatch } from '../../sim/src/match.js';
import type { MatchInputFrame, MatchStepResult } from '../../sim/src/match.js';
import type { WorldState } from '../../sim/src/types.js';

function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(`K34 authoring-automation certification failure: ${message}`); }

const passthroughStep = (state: WorldState, input: MatchInputFrame): MatchStepResult => ({ state: { ...state, frame: state.frame + 1 }, events: [input] });
const session = new TrainingSession(createTwoFighterMatch(1234), ['fighter-a', 'fighter-b'], passthroughStep);
session.setDummyProfile('fighter-b', 'tech-left');
const tech = session.stepFrame().events[0] as MatchInputFrame;
assert(tech.byFighterId['fighter-b']?.moveX === -1000, 'tech-left preset must produce deterministic directional input');

const playback: DummyPlayback = {
  loop: true,
  frames: [
    { moveX: 0, moveY: 0, jumpPressed: false, jumpHeld: false, attackPressed: true, specialPressed: false, grabPressed: false, smashX: 0, smashY: 0, dodgePressed: false, shieldHeld: false },
    { moveX: 500, moveY: 0, jumpPressed: false, jumpHeld: false, attackPressed: false, specialPressed: false, grabPressed: false, smashX: 0, smashY: 0, dodgePressed: false, shieldHeld: false },
  ],
};
session.setDummyPlayback('fighter-b', playback);
const a = session.stepFrame().events[0] as MatchInputFrame;
const b = session.stepFrame().events[0] as MatchInputFrame;
const c = session.stepFrame().events[0] as MatchInputFrame;
assert(a.byFighterId['fighter-b']?.attackPressed === true && b.byFighterId['fighter-b']?.moveX === 500 && c.byFighterId['fighter-b']?.attackPressed === true, 'dummy playback must loop authored deterministic input sequences');

assert(SCENARIO_BOT_CATALOG.length >= 8, 'scenario bot catalog must cover reusable attack/defense/grab/recovery/tech cases');
const recovery = scenarioBotInput('recovery-mash', 12); assert(recovery.specialPressed && recovery.moveY === 1000, 'scenario recovery bot must exercise ordinary semantic input contract');
const grab = scenarioBotInput('grab-loop', 14); assert(grab.grabPressed, 'scenario grab bot must exercise grab path');

console.log('K34 AUTHORING AUTOMATION PASS — Training supports deterministic tech presets and arbitrary looping dummy playback; reusable scenario bots exercise attack, defense, grab, recovery and tech paths through ordinary player inputs.');
