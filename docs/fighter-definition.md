# FighterDefinition Specification v0.01

Status: Initial canonical schema contract

A FighterDefinition describes a fighter as authored content. Most fighters should be addable without modifying the simulation kernel.

## Top-level shape

```ts
interface FighterDefinition {
  id: string;
  version: number;
  identity: FighterIdentity;
  attributes: FighterAttributes;
  movement: FighterMovement;
  collision: FighterCollisionProfile;
  rig: FighterRigProfile;
  states: FighterStateExtension[];
  moves: FighterMoveSet;
  ownedEntities: OwnedEntityDefinition[];
  palettes: PaletteProfile;
  presentation: FighterPresentationHooks;
  ai: FighterAIMetadata;
  guide: FighterGuideMetadata;
  telemetry: FighterTelemetryMetadata;
}
```

## Identity

Required:
- stable fighter id
- display name
- internal archetype tags
- roster grouping/faction tags
- default costume id
- content version

## Attributes

Required authored values:
- weight
- gravity scalar/curve inputs
- terminal fall speed
- fastfall speed
- walk speed
- initial dash speed
- run speed
- ground acceleration
- traction
- turnaround timing values
- jumpsquat frames
- short-hop velocity
- full-hop velocity
- double-jump count and velocities
- air acceleration
- max air speed
- air friction / momentum-retention parameters
- shield-specific fighter modifiers if ruleset permits
- ledge snap profile

Values are deterministic numeric data and are interpreted by the active CombatRuleset.

## Collision profile

Required:
- authoritative body/ECB dimensions
- grounded body offsets
- aerial body offsets
- crouch profile
- ledge detection anchors
- hurtbox definitions or rig-derived hurtbox mappings
- grab-vulnerability flags/hooks

Rendered mesh geometry is never authoritative.

## Rig profile

For 3D-on-2D presentation:
- skeleton/rig id
- retarget profile id
- required bone anchors
- hurtbox bone mappings
- hand/weapon/effect sockets
- facing convention
- animation root-motion policy (default: presentation-only; simulation movement is authoritative)
- fighter-specific rig override support

## States

The kernel owns universal states. Fighter definitions may declare extension states for character-specific mechanics.

Each extension state declares:
- stable state id
- allowed entry conditions
- deterministic update behavior identifier/data
- transitions
- cancel permissions
- collision profile overrides
- animation mapping
- presentation event hooks

Custom state behavior must use approved kernel extension interfaces rather than arbitrary world mutation.

## Move set

The universal move vocabulary must support at minimum:
- jab / jab sequence
- forward/up/down tilt
- dash attack
- forward/up/down smash
- neutral/forward/back/up/down aerial
- neutral/side/up/down special
- grab
- pummel
- forward/back/up/down throw
- ledge attack
- getup attack

Fighters may add command moves, stances, resources, aerial specials, contextual attacks, or other moves through extension slots.

## MoveDefinition

```ts
interface MoveDefinition {
  id: string;
  animationId: string;
  totalFrames: number;
  timeline: MoveTimelineEvent[];
  landing?: LandingProfile;
  tags: string[];
  guide?: MoveGuideMetadata;
}
```

A timeline may author:
- hitbox create/update/clear
- grabbox create/update/clear
- hurtbox/intangibility changes
- armor windows
- movement impulses
- velocity set/add operations
- facing locks/turns
- state flags
- cancel windows
- projectile/entity spawn
- remote entity commands
- resource changes
- sound/VFX/camera presentation events
- rumble events
- animation cues
- ledge-grab enable/disable
- landing behavior changes

Gameplay timeline events are deterministic. Presentation-only events may be discarded/replayed safely during rollback.

## Hitbox definition

Required concepts:
- id
- bone/anchor or local position
- deterministic shape and size
- damage
- angle
- base knockback
- knockback growth/scaling
- hitlag modifier
- hitstun modifier hook
- shield damage/modifier
- hit priority/clash properties
- ground/air target mask
- hit category tags
- rehit/multi-hit bookkeeping
- set-knockback/fixed-launch hook
- special angle hook
- elemental/presentation tags

## Hurtboxes

May be:
- bone-derived capsules/spheres/boxes with authored offsets
- manually defined deterministic volumes
- per-animation/timeline overrides

Required support:
- normal
- intangible
- invincible
- armor-related tags where relevant

## Owned entities

First-class support is required for tactical/setup fighters.

Entity definitions may describe:
- projectile
- deployable
- trap
- remote-trigger entity
- persistent fighter-owned object
- tether/chain helper
- temporary combat volume

Required metadata:
- owner relationship
- lifetime
- deterministic spawn/update/despawn rules
- collision/hitbox behavior
- persistence across owner states
- maximum instance count
- remote command hooks
- replay/snapshot serialization contract

## Palettes

Semantic channels should include at minimum where applicable:
- primary
- secondary
- accent
- skin
- hair
- metal
- energy
- FX

Palette data must not modify gameplay collision or state.

## Presentation hooks

May define mappings for simulation events such as:
- match intro
- hit/strong hit
- shield/parry
- grab/throw
- KO
- respawn
- ledge
- special move cues
- victory/defeat
- rival matchup
- team matchup
- revenge/rematch

Voice and presentation conditions may target fighter ids, factions, archetypes, stages, teams, or narrative flags without entering the authoritative combat rules.

## AI metadata

The definition may expose semantic hints rather than hard-coded full AI scripts:
- preferred ranges
- move role tags (poke, burst, anti-air, kill, combo starter, recovery, etc.)
- recovery anchors
- resource priorities
- projectile/trap semantics
- danger tags

CPU logic remains a system consuming these hints.

## Guide metadata

The engine should be able to generate factual move information directly from definitions, while authored guide metadata adds strategic explanation.

May include:
- overview
- archetype
- strengths/weaknesses
- move descriptions
- tutorials/trials
- recommended training setups
- advanced techniques
- combo/confirm references

Frame facts such as startup/active/recovery should be computed from timeline data where possible rather than manually duplicated.

## Telemetry metadata

Moves/states/entities may carry semantic tags so match analysis can derive concepts such as:
- neutral interaction
- punish
- edgeguard
- ledgetrap
- grab conversion
- projectile pressure
- defensive option
- movement option
- risk/reward category

## Certification requirements for a fighter

A production fighter must eventually prove automatically:
- valid spawn and collision profile
- every universal required state/move resolves
- no move leaves permanent unintended hitboxes/grabboxes
- throws release correctly
- owned entity instance limits are respected
- recovery can terminate on stage/ledge or death
- ledge options terminate
- KO and respawn work
- all palette definitions validate
- AI metadata loads
- replay/snapshot serialization includes all fighter-specific authoritative state
- deterministic golden-vector scenarios pass
