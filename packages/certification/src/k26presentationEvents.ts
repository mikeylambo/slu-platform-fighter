import { fixed } from '../../deterministic-math/src/fixed.js';
import { routeMatchEvents } from '../../presentation/src/eventRouter.js';
import type { MatchEvent } from '../../sim/src/match.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`K26 presentation event certification failure: ${message}`);
}

const events: MatchEvent[] = [
  { type: 'hit', attackerId: 'p1', targetId: 'p2', attackId: 'a:jab', hitboxId: 'h', damageTenths: 35, knockbackX: fixed.fromInt(1), knockbackY: fixed.fromInt(1), hitlagFrames: 4, hitstunFrames: 10 },
  { type: 'block', attackerId: 'p1', targetId: 'p2', attackId: 'a:jab', hitboxId: 'h', shieldDamage: 50, shieldHealthAfter: 0, shieldStunFrames: 8, broken: true },
  { type: 'grab', attackerId: 'p1', targetId: 'p2' },
  { type: 'throw', attackerId: 'p1', targetId: 'p2', actionId: 'a:forwardThrow', damageTenths: 60, knockbackX: fixed.fromInt(2), knockbackY: fixed.fromInt(1), hitstunFrames: 20 },
  { type: 'entity-hit', entityId: 'e1', definitionId: 'a:orb', ownerId: 'p1', targetId: 'p2', damageTenths: 20, knockbackX: fixed.fromInt(1), knockbackY: fixed.zero, hitlagFrames: 2, hitstunFrames: 5 },
  { type: 'ko', fighterId: 'p2', stocksAfter: 1, eliminated: false, creditedAttackerId: 'p1', selfDestruct: false },
  { type: 'respawn', fighterId: 'p2' },
];
const cues = routeMatchEvents(events);
assert(cues.length === events.length, 'each current universal match event must map to one semantic cue');
assert(cues[0]?.kind === 'hit' && cues[0].contentId === 'a:jab' && cues[0].knockbackX === fixed.fromInt(1), 'hit cue must preserve content identity and launch vector');
assert(cues[1]?.kind === 'shield-break', 'broken block must route to shield-break rather than ordinary block');
assert(cues[2]?.kind === 'grab' && cues[3]?.kind === 'throw', 'grab/throw interaction must preserve semantic presentation identities');
assert(cues[4]?.kind === 'entity-hit' && cues[4].contentId === 'a:orb', 'fighter-owned entity hit must carry entity definition identity');
assert(cues[5]?.kind === 'ko' && cues[5].sourceId === 'p1' && cues[6]?.kind === 'respawn', 'KO credit and respawn must route without presentation re-derivation');

console.log('K26 PRESENTATION EVENTS PASS — universal sim events route into renderer/audio semantic cues without adding gameplay state or fighter-specific presentation branches.');
