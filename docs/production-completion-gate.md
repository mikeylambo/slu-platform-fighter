# SLU Platform Fighter — Production Completion Gate

## Purpose

This document defines the **true engine/foundation stopping point** for the project.

The target is not a small vertical slice and not a minimal release. The foundation is considered complete when adding the planned roster no longer requires engine architecture work. At that point the primary human production loop should be:

1. finalize character model/design,
2. rig to the supported humanoid or declared custom rig profile,
3. author/retarget required animation clips,
4. author fighter-pack move/entity data,
5. tune values in Combat/Movement/Training labs,
6. run automated certification,
7. publish the fighter.

A new conventional fighter should **not** require edits to simulation, rollback, match lifecycle, menus, networking, replay, camera, stage, input, UI, or generic combat code.

## Foundation-complete definition

The project reaches the production handoff only after all of the following are represented by deterministic contracts, tests, and at least one usable lab/tooling surface.

### 1. Deterministic simulation kernel

- Fixed-step deterministic simulation.
- Stable fixed-point math and seeded RNG.
- Canonical ordering for fighters, entities, hitboxes, events, and serialization.
- Binary world snapshots with explicit schema/version migration policy.
- Restore/resim hash certification across long runs.
- No renderer, DOM, wall-clock, platform API, or nondeterministic source inside authoritative simulation.

### 2. Complete universal fighter locomotion

- Walk, initial dash, run, brake, turn, crouch and crouch-turn.
- Jumpsquat, short/full hop, double jump, falling and fastfall.
- Platform drop-through and one-way platforms.
- Landing and hard landing.
- Spot dodge, forward/back roll and air dodge.
- Ledge grab/hang/getup/roll/jump/attack/drop and deterministic regrab policy.
- Wall jump/cling policy hooks.
- Knockback flight distinct from ordinary player-controlled air movement.
- Tumble, knockdown, missed tech, tech in place and tech roll.
- Ground/wall bounce and collision reactions.
- DI and SDI policy with deterministic input sampling.

### 3. Complete universal combat interaction model

- Authored attacks compiled from fighter-pack timelines.
- Ground normals: jab chains/rapid jab, tilts, dash attack, smashes and smash charge.
- Aerials with landing-lag/autocancel policy.
- Specials and fighter-owned entities/projectiles.
- Hitbox/hurtbox timeline mutation.
- Damage, knockback growth, weight/scaling hooks, hitlag, hitstun and tumble thresholds.
- Multi-hit/re-hit rules and once-per-attack target memory.
- Clank/trade/prioritization policy.
- Armor, super armor, invulnerability and intangibility timeline events.
- Shield raise/hold/drop, shieldstun, regeneration and shield break.
- Parry/perfect-shield policy hook.
- Grab, grab hold, pummel, forward/back/up/down throws and grab release/escape policy.
- Ground/wall bounce and techable-impact hooks.
- Stale-move/rage/comeback modifiers expressed as optional rulesets rather than kernel assumptions.

### 4. Match lifecycle

- Blast zones and KO detection.
- Stocks, stock loss, elimination and winner resolution.
- Respawn platform/state and respawn invulnerability.
- Timed matches, stock matches and configurable rule presets.
- Sudden death/tiebreak policy.
- Teams, team colors, friendly-fire policy and score ownership.
- 1–4 player authoritative match state from the beginning.
- Pause/disconnect/controller-loss policy.

### 5. Stage runtime and authoring

- Stage pack/schema independent of renderer.
- Solids, one-way platforms, ledges, walls, slopes where supported.
- Spawn points, respawn points and blast zones.
- Moving platforms and deterministic stage motion.
- Hazards, triggers and stage-owned entities.
- Camera bounds/anchors and dynamic multiplayer framing metadata.
- Stage validation/certification tooling.
- Greybox stage lab/editor sufficient to author and test stages without touching kernel code.

### 6. Fighter-owned entities and items

- Deterministic entity IDs/lifetimes/ownership.
- Projectiles, weapons, traps, summons and other fighter-owned actors.
- Spawn/command/despawn timeline events.
- Collision teams and reflection/absorption hooks.
- Generic item pickup/hold/drop/throw/use contracts.
- Item spawn tables and stage item rules.
- Item/entity state included in snapshots and rollback.

### 7. Camera, presentation bridge and animation contract

- Simulation emits semantic presentation events; presentation never changes simulation outcomes.
- Dynamic 1–4 player camera framing, zoom and bounds.
- Hitstop camera/VFX hooks, screen shake and launch emphasis.
- Animation state resolver driven from semantic simulation state.
- Full animation-role contract with certification grades.
- Root-motion policy explicitly disabled or deterministically authored per supported action.
- Model sockets for weapons, VFX, projectiles and held items.
- Palette/material semantic bindings.

### 8. Content-production pipeline

- `fighter:new` scaffolds a complete fighter pack.
- Fighter schema covers attributes, movement, moves, grabs/throws, entities, palettes, sockets and provenance.
- Render schema covers model/rig/animation/material bindings.
- Tooling detects missing roles, malformed timelines, bad fixed-point scale, impossible release data and publication-blocking animation grades.
- Fighter compiler produces runtime attack/action/entity definitions without fighter-specific kernel code.
- At least two mechanically divergent certification fighters prove the architecture is not accidentally Greybox-specific.
- Batch validation supports the planned roster without manually editing registries.

### 9. Training and developer labs

- Movement Lab.
- Combat/Defense/Grab Lab.
- Hitbox/hurtbox visualization and frame stepping.
- Input display and deterministic frame counter.
- Dummy states: stand, shield, crouch, jump, DI/SDI presets, tech presets, attack playback.
- Percent/stocks reset and position save/load.
- Frame advantage/hitstun/shieldstun readouts.
- Replay recording and deterministic playback from lab sessions.
- Controller diagnostics and input remapping.

### 10. CPU/automation harness

- Deterministic CPU input adapter operating through the same player input contract.
- Basic navigation/recovery/attack/defense/grab behavior.
- Scriptable scenario bots for certification.
- Soak matches that can run thousands of simulated games without rendering.
- Invariant checks for invalid states, NaNs/non-integers, stuck grabs, impossible stocks, entity leaks and rollback mismatch.
- Optional higher-level AI can be added later without changing authoritative match rules.

### 11. Replay and rollback networking

- Input history and periodic snapshot replay format.
- Replay metadata/version compatibility policy.
- Deterministic seek/resim.
- Rollback session driver with prediction, correction and resimulation.
- Input delay configuration.
- Desync hash exchange and diagnostics.
- Spectator/replay feed architecture where practical.
- Local multiplayer and online multiplayer use the same match simulation.

### 12. Player-facing shell

- Title/boot flow.
- Main menu and settings.
- Controller assignment/remapping.
- Character select supporting the intended roster scale.
- Stage select and rules screen.
- Results screen/rematch flow.
- Local versus.
- Online versus/lobby path.
- Training.
- Squad/crew-style multi-fighter format.
- Challenge/event framework.
- Adventure/single-player framework capable of authored encounters without kernel changes.
- Replay browser and statistics surfaces.
- Unlock/reward/customization hooks.
- Accessibility settings and save/version migration.

### 13. Certification before roster production

The foundation is not declared complete until CI can prove:

- kernel determinism,
- locomotion,
- defense/ledge/tech behavior,
- combat and grab/throw behavior,
- knockback/DI/impact behavior,
- stocks/KO/respawn lifecycle,
- entities/items,
- stage motion/hazards,
- replay restore/resim,
- rollback prediction/correction,
- multi-fighter ordering,
- headless soak tests,
- fighter and stage content validation,
- all developer labs build successfully.

## Human production handoff

After this gate, the recurring human work for the planned roster should predominantly be **visual and authored content production**: character design finalization, modeling, rigging, animation, move design, effect/audio direction, and tuning.

If adding an otherwise conventional fighter requires new universal engine logic, treat that as a foundation defect and generalize the feature before continuing roster production.

## Current path

Current certified foundation already covers deterministic kernel, core locomotion, defensive movement/ledge hooks, authored hit combat, shield, grab relationships, authored pummels/throws, rollback serialization and developer movement/combat labs.

Immediate remaining critical path:

1. knockback flight / impacts / tumble / DI / SDI,
2. stocks / blast zones / respawn / match end,
3. full authored normal/aerial/special action routing and cancel/landing rules,
4. fighter entities/projectiles/items,
5. stage runtime + camera,
6. replay + rollback session/network driver,
7. CPU/soak harness,
8. full player-facing shell and game modes,
9. second divergent certification fighter,
10. production-grade batch fighter/stage ingestion tooling.
