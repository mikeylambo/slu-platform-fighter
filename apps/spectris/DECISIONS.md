# Decisions

- Work lives on `feat/spectris-duellum`, in the requested `mikeylambo/slu-platform-fighter` repository. Main is untouched.
- Three.js is the existing PF renderer. Spectris reuses PF fixed-point math, movement, combat, knockback, lifecycle, semantic input, shell, replay recorder/player, and rollback session. The new generic stance module is in `packages/stance`.
- The GDD is the source of starting values. Five GDD distance units map to one PF world unit. Jump velocities are derived from the stated heights and gravity, then quantized before simulation.
- The build brief prohibits starting Step 3 before the feel gate. `reference/brawl-mk.json` is absent. The current app is therefore explicitly labeled a foundation/feel build. It has no fake links to unimplemented modes, no claimed Fracture rules, and no claimed Brawl certification. `spectris:check` is deliberately blocked on the missing independently supplied budget file. `spectris:verify-foundation` runs the checks that can genuinely pass today.
- Current blast-zone exits use PF's infinite-stock training reset; they are not the final Strain/Fracture rules. The visible Strain readout supports move testing.
- Direction + attack selects normals. Shift + direction + attack / right stick selects smashes. Jabs chain on a further press after frame 6. Aerial FAF values and unspecified hitbox sizes/knockback values are provisional authoring choices, not extracted Meta Knight data.
- Snapshot-owned game extension data is hashed in world binary version 18. Auxiliary input bits are compared by rollback and serialized into input histories. The PF replay wrapper remains the implementation; old binary-version-17 checkpoint hashes intentionally do not validate under version 18.
- Fixed a PF movement defect where walking beyond a supporting surface remained grounded. This is covered by a real Spectris regression test and the existing PF certification suite.
- Multi-hit windows reset their contact set once per window, not once per hitstop frame. A three-hit test caught and verifies this correction.
- Audio is currently small synthesized feedback cues. It is not the adaptive production audio engine.
- Menu, camera, wings, flame animation, cape deformation, light, and particles are presentation-only. Cape deformation is not yet the specified Verlet ribbon.
- Browser QA uses software-rendered Chromium and simulated standard-mapped gamepads. This establishes API behavior, not physical USB compatibility or 2019 MacBook Pro GPU performance.
- Vercel builds `/spectris/` beside existing lab URLs. Preview publication is requested through the repository branch integration; no production merge is performed while the feel gate remains unresolved.
- Continuation verification: the complete Vercel studio build and Spectris foundation checks pass. A filename and content search did not locate the independently supplied `brawl-mk.json`; the budget gate still exits 2. Publishing the branch was blocked by automatic approval review pending explicit authorization to push project files to the GitHub remote. No deployed URL has been verified.

- The Spectris branch now uses a standalone Vercel root deployment (`dist-spectris`), per Michael’s request. The root opens the game, and legacy `/spectris/` URLs redirect to root. Main and its deployment configuration are untouched.
- The reported Mac failure explicitly says `GL_VENDOR = Disabled` and `BindToCurrentSequence failed`. Add a default-GPU, no-antialiasing context retry, and show actual context failures. Do not claim this resolves browser-disabled graphics or validates the user’s Mac. Built-browser tests cover normal startup, preferred-context rejection with successful fallback, and total graphics unavailability.

## Brawl source import and timing review (2026-09-30)

- Supersedes earlier missing-reference statements: the user supplied a readable Brawl frame-data spreadsheet. Raw CSV and schema-2 source extraction are committed with provenance and checksum. Source measurements remain separate from game design targets.
- The check now produces a reproducible comparison of all 32 authored moves and nine movement attributes. Source import is complete; the feel gate is still pending, not falsely certified by ranges derived from the implementation.
- Fixed a one-frame error converting first actionable frame to the PF attack duration. All moves now release after FAF minus one steps. Real simulation tests assert lockout before FAF and fresh attack acceptance on FAF.
- Replay game version bumped to spectris-feel-v2. Existing v1 tapes deliberately fail validation instead of silently changing results. The offstage proof was re-recorded under current timing.

## 2026-09-30 — Full duel implementation

Mike authorized building through the GDD without a conservative feel-gate stop. The GDD's authored timings remain the working design contract; the independently imported Brawl data remains a comparison, not a claim that these two kits have identical feel. `spectris:check` now exercises the expanded duel and certifies the explicit GDD normal-move timings. Hardware/controller feel remains a playtest question rather than a fabricated automated pass.

- All changes stay on `feat/spectris-duellum`. No merge into main or production alias promotion is part of this work.
- The authoritative duel state lives in the PF world extension, so meters, Oaths, AI history, projectiles, rounds, and Clash choices travel through serialization, replay, and rollback together.
- Soulfire, Clash, and the life predicate are shared modules. Spectris consumes them with its own content parameters.
- A simultaneous Sudden Death loss restarts Sudden Death, with a deterministically advanced seed. Blast zones continue shrinking to 1% to prevent indefinite matches. Double-Kindle Clash ties extinguish both buffs.
- Cape Fair's outer sweetspot is Shatter-class; the inner blade contact is a non-Shatter 12-Strain hit. Charged Cleave interpolates in twelve one-Strain increments between the authored endpoints.
- Pilgrimage uses deterministic exchange segments and a camera transition for earned right of way. It is not yet a continuous traversable five-biome level.
- Direct online pairing exchanges WebRTC invitation/answer payloads and validates the full initial world hash. There is no deployed signaling service, short room-code service, or TURN relay. The interface states that limitation.
- The original 32 normal attacks retain the source reference comparison. Expanded specials and charge variants are separately checked against their authored timing/structural contracts.
- Local versus and training expose all Oaths for development and playtesting. Gauntlet rewards persist as reclaimed shards; unlocks do not hide testable content in this branch.
- Procedural art remains the shipped fallback. Helmet, sword, chest, pauldron, gauntlet, wing-feather GLBs and cape textures can override their procedural pieces through the public art manifest. Backdrop textures and gauntlet pose-node animation still need final asset integration.
- Music and SFX are synthesized by default. An audio manifest accepts replacement cues and synchronized looping stage stems. Michael's voice recordings have not been supplied and are not impersonated or fabricated.
