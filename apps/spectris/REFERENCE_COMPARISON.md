# Brawl reference comparison

Source: [Super Smash Bros. Brawl frame data directory 2.0](https://docs.google.com/spreadsheets/d/1_5NFTe3dvxxC6MMlsI49mnC5m7D3_y5UoGZ7mxPje1I/edit?gid=481003737), Meta Knight tab. Snapshot: 2026-09-30.

All timings are one-based. Deltas are Spectris minus Brawl. A dash means no unambiguous comparable numeric source value.

| Move | Startup (ours / Brawl) | FAF (ours / Brawl) | Landing (ours / Brawl) |
| --- | --- | --- | --- |
| wings:jab | 2 / 7 | 18 / 12 | 0 / — |
| wings:jab-2 | 2 / 7 | 18 / 12 | 0 / — |
| wings:jab-3 | 4 / 30 | 18 / 41 | 0 / — |
| wings:rapid-jab | 2 / 7 | 24 / 12 | 0 / — |
| wings:forward-tilt | 5 / 3 | 30 / 24 | 0 / — |
| wings:up-tilt | 6 / 7 | 26 / 36 | 0 / — |
| wings:down-tilt | 4 / 3 | 16 / 16 | 0 / — |
| wings:dash-attack | 7 / 5 | 34 / 32 | 0 / — |
| wings:forward-smash | 14 / 24 | 48 / 42 | 0 / — |
| wings:up-smash | 10 / 8 | 44 / 50 | 0 / — |
| wings:down-smash | 7 / 5 | 40 / — | 0 / — |
| wings:neutral-air | 4 / 3 | 30 / 32 | 8 / 15 |
| wings:forward-air | 5 / 6 | 32 / 40 | 9 / 15 |
| wings:back-air | 6 / 7 | 28 / 48 | 10 / 12 |
| wings:up-air | 3 / 2 | 18 / 14 | 7 / 12 |
| wings:down-air | 5 / 4 | 28 / 26 | 12 / 15 |
| cape:jab | 2 / 7 | 18 / 12 | 0 / — |
| cape:jab-2 | 2 / 7 | 18 / 12 | 0 / — |
| cape:jab-3 | 4 / 30 | 18 / 41 | 0 / — |
| cape:rapid-jab | 2 / 7 | 24 / 12 | 0 / — |
| cape:forward-tilt | 5 / 3 | 30 / 24 | 0 / — |
| cape:up-tilt | 6 / 7 | 26 / 36 | 0 / — |
| cape:down-tilt | 4 / 3 | 16 / 16 | 0 / — |
| cape:dash-attack | 7 / 5 | 34 / 32 | 0 / — |
| cape:forward-smash | 14 / 24 | 48 / 42 | 0 / — |
| cape:up-smash | 10 / 8 | 44 / 50 | 0 / — |
| cape:down-smash | 7 / 5 | 40 / — | 0 / — |
| cape:neutral-air | 8 / 3 | 34 / 32 | 14 / 15 |
| cape:forward-air | 10 / 6 | 38 / 40 | 18 / 15 |
| cape:back-air | 9 / 7 | 34 / 48 | 14 / 12 |
| cape:up-air | 9 / 2 | 35 / 14 | 15 / 12 |
| cape:down-air | 7 / 4 | 30 / 26 | 12 / 15 |

## Movement

| Attribute | Spectris | Brawl |
| --- | --- | --- |
| run | 1.85 | 1.847 |
| walk | 1.1 | 1.22 |
| gravity | 0.095 | 0.0956 |
| airAcceleration | 0.09 | 0.08 |
| wingsAirSpeed | 1.3 | 0.752 |
| capeAirSpeed | 1.05 | 0.752 |
| wingsFall | 1.4 | 1.39 |
| wingsFastFall | 2.2 | 1.946 |
| jumpSquat | 3 | 4 |

## Interpretation

The GDD intentionally defines a different kit. Source timings are evidence, not automatic replacement values. Wings prioritizes aerial pressure and shorter landing recovery; Cape has slower commitment and heavier attacks. Keep both sets distinguishable during playtesting.

The compiled FAF conversion was one frame late. It now releases after FAF minus one frames so a new action is available on the authored FAF. Regression checks exercise every authored move through the real simulation.

## Remaining acceptance work

Role budgets are not yet approved. This comparison does not certify movement feel, glide physics, or target hardware performance. Do not manufacture ranges around existing values to mark this gate green.
