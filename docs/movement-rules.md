# Movement Rules Contract

Status: K1 reference laboratory contract.

`MovementRules` is the tunable policy layer for universal locomotion. The authoritative simulation accepts a rules object explicitly; the default `K1_MOVEMENT` values are certification fixtures, not final flagship feel.

## Principles

- Tuning changes parameters, not state-machine architecture.
- Simulation remains fixed 60 Hz and fixed-point regardless of ruleset.
- Browser sliders are presentation tooling only; values are quantized before entering simulation.
- A named/frozen ruleset must be serializable as plain engine-neutral data and reproducible in a future production-engine port.
- Certification suites continue to run against the default fixture unless a test explicitly names another profile.

## Current tunable families

Ground: walk speed, dash speed/duration, run speed, acceleration, friction, turnaround frames, crouch thresholds.

Jump: jump squat, short-hop velocity, full-hop velocity, double-jump velocity, jump-buffer frames.

Air: air acceleration, maximum air speed, gravity, maximum fall speed, fastfall speed/threshold.

Landing/platforms: landing frames, one-way platform drop window.

Input interpretation: quantized analogue range, deadzone, run threshold, crouch threshold, fastfall threshold, bounded history.

## Lab workflow

1. Launch `npm run lab:movement`.
2. Change one or more parameters in the live Movement Rules panel.
3. The lab resets the deterministic world whenever a parameter changes so a run never mixes rulesets.
4. Use pause (`P`) and frame-step (`.`) when evaluating transitions.
5. Use `Copy JSON` to capture the current values.
6. A chosen profile should be committed as a named ruleset only after playtest review and certification.

The current K1 defaults are a neutral engineering baseline. They are intentionally not labeled Melee-like, Ultimate-like, Rivals-like, or final SLU movement.
