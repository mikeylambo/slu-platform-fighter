# CombatRuleset Specification v0.01

Status: Initial canonical schema contract

A CombatRuleset defines universal simulation policy. Fighters provide authored values and character-specific behavior; the ruleset determines how the universal platform-fighter systems interpret them.

The kernel must not hard-code one game's philosophy where a ruleset parameter can express it cleanly.

## Top-level shape

```ts
interface CombatRuleset {
  id: string;
  version: number;
  simulation: SimulationRules;
  input: InputRules;
  movement: UniversalMovementRules;
  collision: CollisionRules;
  damage: DamageRules;
  knockback: KnockbackRules;
  hitlag: HitlagRules;
  hitstun: HitstunRules;
  directionalInfluence: DirectionalInfluenceRules;
  shield: ShieldRules;
  parry: ParryRules;
  dodge: DodgeRules;
  grab: GrabRules;
  throw: ThrowRules;
  tech: TechRules;
  ledge: LedgeRules;
  landing: LandingRules;
  staleMoves: StaleMoveRules;
  clash: ClashRules;
  respawn: RespawnRules;
  match: MatchRules;
}
```

## SimulationRules

Must define at minimum:
- authoritative tick rate (locked to 60 Hz for certified flagship rulesets)
- maximum rollback/snapshot history required by local simulation tests
- deterministic RNG policy
- deterministic entity-processing order
- maximum authoritative fighter/projectile/entity counts used by certification

## InputRules

Must define universal interpretation policy without depending on physical controller brands.

Required concepts:
- analog stick deadzone
- analog saturation threshold
- digital normalization policy
- tap / hold / flick thresholds
- smash-input threshold
- fastfall threshold
- platform-drop threshold
- short-hop interpretation policy
- c-stick/right-stick semantic behavior
- input polling samples aggregated into a simulation frame
- default buffer windows
- legal range for player-configurable buffer profiles

Player preferences may tighten or relax permitted buffer windows where the active match profile allows it. Tournament/competitive profiles may restrict allowed values.

## UniversalMovementRules

Rules shared across fighters rather than individual fighter attributes:
- traction application order
- momentum retention rules across state transitions
- platform pass-through behavior
- edge/corner resolution
- aerial speed clamping policy
- fastfall eligibility policy
- jumpsquat cancel policy
- crouch cancel policy
- wall interaction policy
- footstool policy
- state-transition priority when multiple movement transitions become valid on the same frame

Fighter-specific speeds, accelerations, jump velocities, gravity, etc. belong in FighterDefinition.

## CollisionRules

Required concepts:
- 2D authoritative gameplay plane
- fighter collision body representation
- hurtbox representation
- hitbox representation
- grabbox representation
- wind/push volume representation
- one-way platform resolution
- moving-platform carry policy
- ledge detection volumes
- stable collision ordering
- tie-breaking when multiple contacts occur on the same frame

Renderer meshes and engine colliders are never authoritative.

## DamageRules

Required concepts:
- percent/damage accumulation scale
- damage rounding/quantization
- armor damage interaction contract
- healing / negative damage policy
- stale-move damage interaction hook
- rage/comeback-scaling hook, disabled unless explicitly configured

## KnockbackRules

Must parameterize:
- base knockback contribution
- growth/scaling contribution
- damage contribution
- weight contribution
- launch-speed conversion
- angle interpretation
- special-angle handling (including a configurable contextual/Sakurai-angle equivalent if desired)
- grounded vs aerial launch behavior
- knockback quantization
- maximum launch speed
- knockback-decay policy

Reference presets may approximate external-game families for laboratory comparison, but flagship values are authored independently.

## HitlagRules

Required concepts:
- attacker hitlag
- defender hitlag
- damage scaling
- move-specific multiplier hook
- electric/special multiplier hook
- shield hitlag
- SDI eligibility during hitlag
- hitlag maximum

## HitstunRules

Required concepts:
- knockback-to-hitstun conversion
- minimum/maximum hitstun
- tumble threshold
- actionability after hitstun
- landing during hitstun
- hitstun cancel hooks if a laboratory preset requires them

## DirectionalInfluenceRules

Required concepts:
- DI angular influence maximum
- DI eligibility threshold
- stick sampling frame/policy
- SDI displacement
- SDI repeat/lockout behavior
- ASDI/post-hitlag displacement hook if used
- forbidden angle manipulation zones if needed for readability

## ShieldRules

Required concepts:
- shield health
- depletion rate while held
- regeneration
- damage multiplier
- shieldstun formula
- pushback
- shield size scaling
- shield break threshold
- shield-break state duration
- shield-drop timing
- out-of-shield action policy
- projectile interaction hooks

## ParryRules

Must support enabling/disabling the system and configuring:
- activation condition
- timing window
- freeze/hitlag alteration
- defender advantage/actionability
- attacker penalty
- projectile behavior
- multi-hit behavior

## DodgeRules

Separate contracts for:
- roll
- spot dodge
- air dodge

Each supports startup, invulnerability window policy, movement, recovery, landing interaction, directional behavior, repeat-use degradation hook, and cancel rules.

## GrabRules / ThrowRules

Required concepts:
- grab priority/collision
- standing/dash/pivot or equivalent grab categories
- grab hold state
- mash/struggle escape policy
- pummel policy
- release conditions
- throw invulnerability/intangibility policy
- throw victim state
- throw knockback calculation
- team/multi-fighter collision implications
- special-pummel / character-extension hook

## TechRules

Required concepts:
- tech eligibility
- tech input window
- floor tech
- tech roll
- missed tech
- wall tech
- wall tech jump
- ceiling tech hook
- lockout policy
- collision/surface-angle requirements

## LedgeRules

Required concepts:
- ledge eligibility
- snap distance / velocity rules
- regrab rules
- intangibility policy
- ledge occupancy
- ledge trumping policy
- ledge release
- neutral getup
- ledge roll
- ledge jump
- ledge attack
- special ledge option extension hook

## LandingRules

Required concepts:
- normal landing
- hard landing
- aerial landing lag
- autocancel windows
- landing during air dodge
- landing during hitstun/tumble
- special landing state hook

## StaleMoveRules

Must be fully optional/configurable:
- queue depth
- repetition weighting
- damage effect
- knockback effect
- freshness bonus hook
- reset conditions

## ClashRules

Required concepts:
- hitbox-vs-hitbox interaction
- clank eligibility
- priority comparison
- damage differential threshold if used
- projectile clash/reflect hooks
- trade resolution
- deterministic tie-break policy

## RespawnRules

Required concepts:
- respawn delay
- respawn platform behavior
- invulnerability
- actionability
- spawn selection
- simultaneous KO ordering

## MatchRules

The kernel must support policy hooks for:
- stock
- time
- stock + time
- stamina
- teams
- free-for-all
- team attack / friendly fire
- sudden death
- pause behavior
- controller disconnect behavior
- self-destruct handling
- ragequit/disconnect result classification

Squad Strike is modeled above the individual fighter by MatchParticipant owning multiple fighter slots; this ruleset provides only per-match universal policy.

## Presets

Laboratory presets may include:
- `slu_default`
- `melee_reference`
- `brawl_reference`
- `ultimate_reference`
- `rivals_reference`
- `lab_custom`

Reference presets are experimentation tools, not claims of exact emulation and not shipping dependencies.
