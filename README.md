# SLU Platform Fighter

Reusable platform-fighter simulation, tooling, and genre frame for the SLU flagship platform fighter.

## Purpose

This repository is **not** the flagship game's content repository. It is the reusable platform-fighter layer between the generic SLU Web Game Shell and the eventual flagship game.

```text
SLU Web Game Shell
        ↓
SLU Platform Fighter
        ↓
SLU Flagship Platform Fighter
```

The initial implementation is a web-based reference laboratory. The authoritative simulation must remain engine-agnostic and port-safe so a later production-engine implementation can be verified against the same golden test vectors instead of being re-tuned by feel.

## Locked architectural decisions

- 3D fighter presentation on a 2D gameplay plane.
- Fixed 60 Hz authoritative simulation.
- Pure deterministic simulation core: no DOM, renderer, wall clock, audio, platform APIs, or engine physics inside `packages/sim`.
- Fighters are kinematic. General-purpose physics middleware has no authority over fighter movement, combat, knockback, platforms, ledges, or match state.
- Snapshot / restore / state hashing are foundation requirements, not later networking features.
- Fighter, stage, and combat-ruleset content is data-driven.
- Training, replay, TAS, QA, and automated certification share the same simulation infrastructure.
- The web lab is a reference implementation, not a commitment to the final shipping engine.
- Kernel / certification scope must never be mistaken for the intended release scope of the flagship.

## Initial repository shape

```text
packages/
  deterministic-math/
  sim/
  fighter-schema/
  stage-schema/
  rulesets/
  replay/
  certification/

apps/
  movement-lab/
  combat-lab/
  training-lab/
  web-reference/

adapters/
  three/
  babylon/

docs/
  constitution.md
  decision-log.md
  combat-ruleset.md
  fighter-definition.md
  stage-definition.md
```

## First certification target: Kernel v0.01

Two generic fighters, one greybox stage, and a headless deterministic harness proving:

- movement state transitions
- authored hitbox / hurtbox combat
- damage, knockback, hitlag, hitstun, DI
- shield, grab, throw, dodge, tech
- ledges, blastzones, KO, respawn
- fixed-step simulation
- event stream
- snapshot / restore
- deterministic state hashing
- pause / frame advance / debug inspection

The first executable milestone is intentionally smaller: **K0 Determinism Harness**. It must prove that replaying identical input from an identical state produces identical per-frame hashes before tuned movement is allowed to depend on the simulation.

## Reference hygiene

External games, frame-data sites, licensed frameworks, decompositions, and inspected prototypes are research inputs only. Shipping code must be original. Decompiled Nintendo code is excluded from this repository. Licensed third-party engine code may be used only within its license terms; otherwise it is treated as behavioral reference/checklist material.
