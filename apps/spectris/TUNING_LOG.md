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
