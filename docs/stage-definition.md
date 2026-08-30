# StageDefinition Specification v0.01

Status: Initial canonical schema contract

A StageDefinition describes authoritative 2D gameplay geometry plus presentation/content metadata. The future Stage Builder must emit this same canonical format.

## Top-level shape

```ts
interface StageDefinition {
  id: string;
  version: number;
  identity: StageIdentity;
  collision: StageCollision;
  ledges: LedgeDefinition[];
  blastzones: BlastzoneDefinition;
  camera: StageCameraDefinition;
  spawns: SpawnDefinition;
  movingGeometry: MovingGeometryDefinition[];
  hazards: StageHazardDefinition[];
  events: StageEventDefinition[];
  variants: StageVariantDefinition[];
  presentation: StagePresentationDefinition;
  music: StageMusicDefinition;
  builder: StageBuilderMetadata;
}
```

## Identity

Required:
- stable stage id
- display name
- content version
- stage/category tags
- competitive/legal metadata hooks

## Collision

Authoritative collision is 2D and renderer-independent.

Required support:
- solid floor segments/polygons
- one-way/pass-through platforms
- walls
- ceilings
- platform surface normals
- surface ids/tags
- stable deterministic contact ordering

Rendered mesh collision is never authoritative.

## Ledges

Each ledge defines:
- stable id
- world position
- facing/direction
- snap region
- associated collision surface
- occupancy rules inherited from CombatRuleset
- enable/disable conditions for stage variants/events

## Blastzones

Required:
- left
- right
- top
- bottom

Optional hooks:
- special KO regions
- stamina/objective-specific bounds

## Camera

Required stage metadata:
- default camera bounds
- minimum/maximum zoom
- framing margins
- soft/hard camera constraints
- respawn framing hints
- spectator camera points/hooks

The gameplay CameraDirector remains a system and interprets this metadata based on active participants.

## Spawns

Required:
- initial spawn points
- team-aware spawn groups
- respawn points/platform anchors
- neutral/item spawn hooks
- deterministic spawn selection ordering

## Moving geometry

Moving platforms/geometry are authoritative deterministic stage entities.

Required concepts:
- id
- deterministic path/motion definition
- collision shape
- period/timing
- carry behavior interpreted by CombatRuleset
- activation conditions
- hazardless/competitive behavior
- snapshot state

## Hazards

Hazards must be authored deterministic systems or approved stage-entity behaviors.

May include:
- damage volumes
- moving attack volumes
- environmental projectiles
- breakable/temporary collision
- stage transformations
- wind/push zones

Each hazard requires:
- deterministic activation/update order
- explicit gameplay state
- event emission for presentation
- hazard-off behavior or explicit declaration that no hazardless form exists
- snapshot/replay serialization

## Stage events

A data-driven timeline/trigger layer may respond to:
- match time
- stock count
- player position zones
- hazard state
- scripted single-player/challenge objectives

Stage events may alter approved stage entities/geometry but may not directly mutate arbitrary fighter state outside kernel interfaces.

## Variants

A stage may define variants without duplicating the full stage definition.

Use cases:
- competitive/hazardless
- alternate platform layout
- story variant
- challenge variant
- visual/time-of-day variant

A variant declares deterministic overrides to permitted fields.

## Presentation

Presentation metadata may reference:
- scene/environment asset ids
- lighting profile
- background/effect profiles
- stage-specific camera presentation hooks
- KO effect profile
- crowd/ambient profile

Presentation is non-authoritative.

## Music

Required hooks:
- default playlist ids
- track weights
- victory/music transition metadata
- player soundtrack-preference compatibility
- optional EQ/profile compatibility metadata

Music never affects simulation.

## Builder metadata

The same StageDefinition must support internal and future user-facing authoring.

Builder metadata may include:
- editable object grouping
- snapping/grid hints
- designer notes
- legal-builder constraints
- validation hints
- preview camera defaults

## Certification requirements for a stage

A production stage must eventually prove automatically:
- collision geometry validates
- no invalid/self-contradictory ledges
- spawns are inside safe playable bounds
- required blastzones exist and enclose intended play space
- moving geometry is deterministic
- hazards serialize/restore deterministically
- hazardless/competitive variant validates if declared
- camera metadata is well formed
- every fighter spawn/respawn scenario can resolve
- deterministic golden-vector stage scenarios pass
