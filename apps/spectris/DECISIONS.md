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
