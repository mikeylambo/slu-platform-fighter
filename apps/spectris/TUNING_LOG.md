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

## 2026-10-01 — GDD revision 2 physics (replay version spectris-duel-v4)

Calibrated against Brawl Meta Knight (`reference/brawl-mk.json`): match the feel, not the values. Wings drifts ~20% above MK, Cape sits at MK's drift.

| Value | Before | After | Reason | Verification |
|---|---|---|---|---|
| Wings air speed | 1.30 | 0.90 | GDD 3.3; MK 0.752 + ~20% so Wings is the mobile stance | Reference table regenerated; golden v4 recorded |
| Cape air speed | 1.05 | 0.75 | GDD 3.3; MK's value | Same |
| Wings fast fall | 2.20 | 1.95 | GDD 3.3; MK 1.946 | Same |
| Cape fast fall | 2.60 | 2.30 | GDD 3.3; heavier stance falls faster | Same |
| Walk | 1.10 | 1.20 | GDD 3.4; MK 1.22 | Same |
| Traction | 0.20 | 0.06 | GDD 3.4; toward MK's 0.04 slide without going icy | Feel lab A/B 0.04 / 0.06 / 0.10 |
| Air acceleration | 0.09 | 0.08 | GDD 3.4; MK 0.08 | Same |
| Jumpsquat | 3 | 3 (A/B 4) | GDD 16 open item; feel lab toggles 3f/4f | Unit test: 4f leaves the ground exactly one frame later |

Unchanged: gravity 0.095, fall speeds 1.40/1.65, jump heights, glide.

Behaviour fixes shipped in the same version bump: grab mash symmetry (P1 could not escape P2), Cape down throw keeps its knockdown, Kindle's free Flash Unfurl expires with Kindle.

Sanity: 20-match soak completes with no watchdog timeouts; level 9 won 17/20 against level 3 under the new physics (the full 100-match benchmark runs with the Step 4 AI).

## 2026-10-02 — Utility AI pass (replay versions v5–v6)

| Value | Before | After | Reason | Verification |
|---|---|---|---|---|
| Roll / air-dodge travel | 0.4 world/frame (~11 units per evade) | 0.1 (~2.8 units) | An evade carried a Knight eight body-widths, often offstage into helplessness; GDD 3.7 gives no distance, two body lengths is the genre norm | Rules unit test; AI SDs fell from ~1 per match to ~0 |
| Sudden Death shrink on replay | restarted from 100% | continues | Repeated double losses could stall matches indefinitely | The three watchdog cases now finish in ~7,100 frames |
| Double loss at minimum blast zones | replay | draw | Cannot produce a result otherwise | Rules logic; draw banner/result copy |
| CPU benchmark protocol | 60 s timer | GDD default 6:00 | 60 s forced every match into Sudden Death coin-flips | Level 9 vs 3: 96/100 |

AI numbers (option base utilities, level curves, personality weights) live in `content/ai/`; see `proofs/ai-personalities.html` for the resulting behaviour.
