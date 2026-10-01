# Tuning log

| Change | Reason | Verification |
|---|---|---|
| Map 5 GDD units to 1 PF world unit | Preserve distance/velocity/gravity ratios in the existing renderer | Fixed-point motion tests |
| Full/short/air hop velocities 2.59 / 1.79 / 2.27 GDD units/frame | Approximate GDD heights under discrete gravity | Jump count tests; heights remain for feel review |
| Wings / Cape air speeds 1.30 / 1.05; gravity .095 | Start from GDD baseline | Data-driven PF physics registry |
| Wings three air jumps; Cape two | Per-stance GDD mobility | Actual stepped-state jump test |
| Six-frame unfurl and five-frame buffer | GDD input timing | Frame-seven action test |
| Glide maximum 120f, speed 1.1–2.4; dive accelerates and climb slows | Fill in unspecified pitch/speed tuning | Offstage input replay; pitch model remains provisional |
| Ground normals and stance aerial startup/active/landing values | Transcribe GDD | All 32 stance/move entries resolve real hits |
| Provisional aerial FAF and hitbox reach | GDD does not give aerial FAF or complete hitbox geometry | Structural checks, not independent role certification |
| Reduced bloom strength .65 → .24 and threshold .8 → 1.2 | Initial screenshot washed out dark steel and visor shape | Screenshot review |
| Hit-window reset latch | Prevent hitstop from causing repeated multihits | Triple Thrust produces exactly three hits |
| Latch keyboard action taps until the next simulation sample | Quick presses must survive between rendered frames | Browser test samples a released jump and stance tap |
| Clear the workbench freeze when starting a session | A new exchange must run after frame stepping or replay completion | Browser restart regression |

| Compile attack duration as FAF − 1 | FAF is the first actionable one-based frame; previous conversion added one recovery frame | Runtime action acceptance for all 32 moves; determinism/replay/rollback rerun |

No claim of feel approval has been made. Independent role budgets and controller playtesting remain required.


Brawl source is now imported. No other move timing or movement values changed in this pass. Version 2 replay recordings prevent silent playback under changed timing.

## 2026-09-30 — Duel rules and CPU pass

- Added directional Cape guard, 4f parry, 6f release, 60f regeneration delay, and 120f break. Fixed regeneration incorrectly resuming during the broken state.
- Added stance defense, grabs/pummels/throws, projectile and swordless states, charged and directional specials, meter, Feint, Flash Unfurl, and Kindle.
- Grounded attack aim now sets facing before attack commitment. Aerial attacks retain facing for front/back aerial selection.
- Specials/grabs/evades share the configurable 3–8f action buffer. Full-charge Cleave and Kindle finisher cap at 24 Strain.
- CPU decisions use delayed observations, four-frame decision ticks, level-based attack breadth, recovery/DI, and Oath weights. The first completed benchmark was 67 wins out of 100 for level 9 versus level 3, below the 80% target. Subsequent facing, spacing, and recovery fixes require a fresh benchmark; do not substitute that earlier number for the final proof.
- Helpless states now reject additional specials. Close-range CPUs prefer Orbit over Longreach at Shatter threshold, avoiding repeated point-blank whiffs.
- Moving platforms and all nine collision layouts are authored in the same fixed-point coordinate scale as the original Sanctum.

## 2026-10-01 — Final benchmark and watchdog review

The final level-9-versus-level-3 benchmark finished 97–3 across 100 seeds with alternating player slots. Lower levels now use advanced Shatter finishers less reliably, matching the specified level-dependent option breadth; neither damage nor life values differ by CPU level.

All 1,000 distinct soak cases completed without a crash. Two cases exceeded the original 10,500-frame watchdog after a legitimate tied Sudden Death restart. Exact seeded followups completed both at frame 14,119 without a simulation change. The watchdog is now 21,000 frames and logs case IDs/state on failure. Original batch reports and targeted followups remain in `proofs/`; the aggregate does not erase the original timeouts. Duplicate-state hashes were sampled on every 100th soak case; the separate full determinism check compares every frame across 10,000 frames.
