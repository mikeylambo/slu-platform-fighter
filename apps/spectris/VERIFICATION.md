# Duel build verification — 2026-10-01

Branch: `feat/spectris-duellum`. Main is unchanged.

## Automated evidence

| Check | Result |
| --- | --- |
| `npm run spectris:check` | Passed: typed build, deterministic-code lint, foundation tests, duel tests, protocol test, move contracts, source comparison, production bundle |
| Duel behavior | 31 checks, including specials, defense, Fractures, round counterpick, stance lock, and Pilgrimage completion |
| Moves | 90 authored entries/charge variants; 30 explicit normal-move GDD timing contracts; valid hit windows before FAF |
| Determinism | Matching worlds at every frame of a 10,000-frame AI/Oath duel |
| Replay | Complete duel state round-trips through the PF replay player |
| Rollback | Eight-frame delayed inputs converge to the live world hash |
| Online protocol | Full one-Fracture match through PF peer packets with simulated 100 ms latency; equal final hashes, zero reported desyncs |
| CPU difficulty | Level 9 won 97/100 versus level 3, alternating sides |
| Soak | 1,000 distinct matches completed; zero crashes; duplicate hash checks sampled every 100th case |
| Watchdog | 998 finished within 10,500 frames. Two legitimate Sudden Death rematches finished at 14,119 in exact seeded followups. Raw results retained. |
| Browser | Title, stage/Oath selection, keyboard Sling, replay slots, nine stage views, results, Gauntlet launch; no page exceptions in recorded run |

## Performance boundary

| Measurement | Observed | Interpretation |
| --- | --- | --- |
| Duel step plus per-frame hash-check overhead | 0.68 ms mean | Linux Node, not the target Mac browser |
| Delayed online-peer advance | 0.72 ms p95 | Packet-queue test; not an internet or full worst-case rollback budget claim |
| Main JS | 854 kB raw / 231 kB gzip | Plus approximately 11 kB HTML/CSS and small manifests; below the 15 MB initial transfer budget with procedural assets |
| Browser render | About 115 calls / 11k triangles | Software SwiftShader; its frame rate is not a hardware performance result |
| 2019 Intel Mac / physical controllers | Not measured here | Target 60 fps and physical USB acceptance require the actual device |

## Explicit limitations

The WebRTC interface and PF transport adapter are implemented, but the workspace's Chromium peers gather zero ICE candidates. A live browser-to-browser match, internet NAT traversal, hosted short room codes, and TURN relay coverage are not certified. No simulated transport test is represented as a successful WebRTC test.

Pilgrimage advances through exchange segments with camera scrolling; it is not yet a seamless traversable five-biome level. Gauntlet progression and the guided/scripted Vigil are playable, but an automated whole-Gauntlet clear and recorded whole-Vigil walkthrough are not present. Art, animation, reactive backdrops, cloth, audio, and accessibility received a procedural implementation pass; final authored assets and production polish remain. Complete live physics/meter authoring, final gauntlet pose-node integration, and production voice/subtitle direction are also follow-up work.

The imported Brawl timings are preserved as source evidence. Passing authored GDD contracts does not certify subjective Brawl-like feel. See `README.md`, `DECISIONS.md`, `TUNING_LOG.md`, and `AUDIO_DELIVERY.md` for implementation and delivery details.
