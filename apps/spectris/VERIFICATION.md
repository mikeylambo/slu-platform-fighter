# Verification — continuation build (2026-10-02)

Branch `feat/spectris-duellum`. Replay version `spectris-duel-v6`. Main is untouched.

## `npm run spectris:check` (all green)

Lint (no tuning literals in `game/rules/`, no nondeterministic APIs in simulation) · typed build · foundation tests · 37 unit tests (rules modules + soulfire/clash/life-system/stance packages) · 31 duel tests · 20-match golden hashes · online protocol (8-frame rollback, 0 desyncs) · move contracts (90 entries) · Brawl reference comparison with role budgets (34 entries) · production build.

## Proofs by step

| Step | Proof | Result | Artifact |
| --- | --- | --- | --- |
| 1 Refactor | 20 seeded matches recorded before the split replay identically after it | Identical checkpoint + final hashes; `duel.ts` 273 lines | `proofs/golden-hashes.json` (now re-recorded for v6), commit `a3b6c6e` |
| 2 Physics | Comparison table regenerated; offstage replay re-recorded; tuning logged | Pass | `REFERENCE_COMPARISON.md`, `proofs/offstage-exchange.json`, `TUNING_LOG.md` |
| 3 Art | Duelist side-by-side; every stage at default camera; 64 px helm strip; frame time | Helms distinct at 64 px; mean frame time 334 → 303 ms (SwiftShader, faster), p95 400 → 383 ms | `proofs/art/` (`duelist-side-by-side.png`, `stage-*.png`, `helm-strip-64.png`), `proofs/bench-before-art.json`, `proofs/bench-final.json` |
| 4 AI | Level 9 vs level 3, 100 matches (GDD default 6:00 rules) | **96 / 100** | `proofs/ai-benchmark.json` |
| 4 AI | Personality signature ≥ 2× Unsworn, 50 matches each | Ember 2.7×, Static 18.7×, Stillness ∞ (Unsworn never guards), Gale 2.3×, Iron ∞, Hunger 59× | `proofs/ai-personalities.json`, `proofs/ai-personalities.html` |
| 4 AI | 1,000-match soak | 1,000 / 1,000 finished; 0 timeouts, 0 crashes, 0 desyncs (duplicate sims every 100th match) | `proofs/duel-soak-{0,250,500,750}.json` |
| 5 Pilgrimage | Full Momentum match replay | Finished (right of way → 2 scrolls → goal); replay verified | `proofs/momentum-match.json`, `proofs/momentum-replay.json` |
| 5 Gauntlet | Bot clears all 7 on Squire | Cleared in 8 attempts (lost Static once); every replay verified | `proofs/gauntlet/summary.json`, `*.json.gz` tapes |
| 5 Vigil | Scripted input completes 10 lessons, screenshot each | 10 / 10 | `proofs/vigil/` |
| 5 Online | Two-tab test (room code, real WebRTC, rollback) | 600+ frames each side, 0 desyncs | `proofs/online-two-tab.json`, `online-host.png`, `online-guest.png`; Michael: `ONLINE_TEST.md` |
| 6 Bench | `?bench` runs in the workspace browser | Runs; software-rendered numbers only | `proofs/bench-final.json`; Michael: `BENCH.md` |
| 6 Controller | Diagnostics panel with a simulated standard pad | Renders mapping, sticks vs deadzone, buttons, latency | `proofs/controller-diagnostics.png` |

## Not proven here (needs Michael's hardware or network)

- 60 fps on the 2019 MacBook Pro (`?bench`, see `BENCH.md`). The workspace browser is software-rendered (~3 fps); its numbers are relative only. Draw calls rose from 282 to 454 with outlines and selective bloom.
- Supabase signaling and cross-network WebRTC (this container's network policy blocks supabase.co). TURN is not implemented.
- Physical controllers (only simulated pads here).
- Helms are interim: redrawn by eye from the v2 sheet because the sheet image was shared in chat, not as a file. Clean front/side renders traced through `npm run spectris:helms` replace them with no code changes.
