# SLU Platform Fighter Constitution

Status: Canonical foundation document
Date: 2026-08-30

This document defines principles that implementation decisions must preserve unless explicitly superseded by a recorded architecture decision.

## 1. Simulation authority

1. The authoritative game simulation runs at a fixed 60 Hz.
2. Presentation never determines gameplay truth.
3. Identical authoritative state + identical inputs + identical seed must produce identical next state.
4. `packages/sim` may not depend on DOM APIs, rendering APIs, wall-clock time, audio, platform services, engine-native physics, or non-deterministic iteration.
5. Fighter locomotion, knockback, hit resolution, stage collision, ledges, blastzones, stocks, timers, and match results are authored simulation systems.
6. Snapshot, restore, state hashing, replayable input history, and seeded RNG are mandatory kernel capabilities.
7. Gameplay events are emitted by simulation; camera, VFX, audio, rumble, HUD, and presentation systems react to those events without mutating authoritative outcomes.

## 2. Port safety

1. The web implementation is the reference laboratory, not the guaranteed final shipping runtime.
2. Deterministic math must be explicitly owned by the project. The authoritative simulation may not rely on platform-dependent transcendental behavior.
3. Positions, velocities, timers, and other continuously accumulated gameplay values use a deterministic numeric strategy defined by the deterministic-math package.
4. Iteration order over authoritative collections must be stable and explicit.
5. Every certification scenario records inputs, seed, and per-frame state hashes as golden vectors.
6. A later production-engine port passes by reproducing the same certified behavior and hashes; it is not re-tuned into approximate equivalence.

## 3. Player-expression principles

1. Movement is a primary form of player expression.
2. Two skilled players using the same fighter should be distinguishable through movement, spacing, routing, tempo, defensive choices, and interaction choices before character-specific gimmicks are considered.
3. Execution accessibility may reduce unnecessary input friction without removing decision depth.
4. Input buffering is configurable infrastructure, not an invisible hard-coded assumption.
5. Universal systems create shared game literacy; character design creates expression by modifying, exploiting, combining, or selectively breaking those systems.
6. Competitive readability takes precedence over physical realism.

## 4. Fighter production principles

1. The game is 3D-presented on a 2D gameplay plane.
2. A shared humanoid rig and retargetable animation library are first-class production assumptions, with explicit support for fighter-specific skeletons when required.
3. Characters are predominantly data and authored content rather than modifications to world simulation code.
4. Fighter definitions include movement, state, move timelines, animation mappings, collision, owned entities, presentation hooks, AI metadata, guide metadata, palette channels, and telemetry tags.
5. Hurtboxes may be derived from rig/bone anchors where appropriate; attack hitboxes remain explicitly authored gameplay data.
6. The project must develop tooling that reduces per-fighter authoring cost as roster scale grows.

## 5. Stage production principles

1. Stage runtime data and stage-authoring data converge on the same canonical StageDefinition format.
2. Stages define collision, ledges, blastzones, spawn points, camera bounds, moving geometry, hazards, visual metadata, music metadata, and competitive/hazardless variants where applicable.
3. A future Stage Builder should export the same format used by internally authored stages.

## 6. Competitive laboratory principles

1. Training Mode is part of the engine, not post-launch polish.
2. Replay, TAS, QA, automated balance analysis, and Training Mode should reuse simulation and input-history infrastructure wherever possible.
3. The engine should support frame advance, state save/load, input recording/playback, hitbox/hurtbox inspection, velocity/state inspection, trajectory inspection, DI/tech scripting, and frame-advantage analysis.
4. Match telemetry is captured structurally so statistics and playstyle analysis do not depend on retrofitted log scraping.
5. Tournament operation is a first-class environment, including temporary unlock/rules overrides that do not corrupt personal progression.

## 7. Product-scale principles

1. The flagship is intended to be a large, content-rich platform fighter.
2. Kernel scope, vertical-slice scope, public-test scope, Steam/PC release scope, 1.0 scope, and console scope are separate concepts.
3. A small certification roster or stage set must never be interpreted as the intended flagship release scope.
4. Release content scale will be informed by measured production throughput after the first certified real fighter and production-ready stage pipeline, not by an arbitrary conservative cap chosen during kernel development.
5. Single-player, challenges, minigames, customization, replay culture, competitive infrastructure, and collection/progression systems are part of the intended product identity even when not implemented in the kernel.

## 8. Multi-AI development discipline

1. Canonical repository documents and tests outrank chat history.
2. GPT, Claude, Gemini, human contributors, and future tools work against the same specifications.
3. No contributor may silently redefine simulation behavior to make an implementation easier.
4. When an implementation disagrees with a spec, either the implementation changes or an explicit decision record updates the spec.
5. Certification tests are the implementation arbiter.

## 9. Reference and legal hygiene

1. Shipping code must be original or used under a license that expressly permits its use.
2. Decompiled Nintendo code is excluded from the shipping repository and is not a source for copied implementation.
3. Frame-data facts and observed behavior may be used as research inputs; third-party code is not copied merely because it is inspectable.
4. Licensed frameworks that do not permit cross-engine source reuse may be treated as behavioral references/checklists only.

## 10. Change policy

Changes to this constitution require an explicit entry in `docs/decision-log.md` explaining what changed, why, and what downstream contracts or certification vectors must be updated.
