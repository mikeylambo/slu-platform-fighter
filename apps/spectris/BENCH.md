# Hardware bench — 2019 MacBook Pro

The bench runs a fixed CPU-vs-CPU match (level 9 Iron vs level 9 Hunger) on **Skyreach**, the most expensive stage to draw (widest framing, two moving platforms), and times every rendered frame.

## Run it (2 minutes)

1. Quit other apps. Plug in power. In System Settings → Battery, make sure *Low Power Mode* is off.
2. Open **Chrome** (current version) and go to the preview URL with `?bench` on the end, for example:
   `https://<preview-url>/?bench`
   For a quicker check use `?bench&seconds=20`.
3. Keep the window focused and don't touch anything. The default run simulates 60 seconds of play.
4. When the **SPECTRIS BENCH** panel appears, click **Copy results** and paste them to Claude.

Also useful: `chrome://gpu` → copy the *Graphics Feature Status* block if the GPU line in the result says `SwiftShader` or `Disabled` (that means Chrome is not using the graphics card).

## What passes (GDD section 14)

| Line in the report | Target | Meaning |
| --- | --- | --- |
| Frame time: mean | **≤ 16.7 ms** (60 fps), small tolerance for vsync jitter | Average frame |
| Frame time: p95 | **≤ 16.7 ms** (+1.5 ms tolerance) | 95% of frames are on time — this is the one that feels like stutter |
| Sim step: mean | **≤ 2 ms** | Game logic per simulated frame (rollback headroom) |
| Draw calls | informational (~550 at the duel) | Useful if frame time fails |
| GPU | should name your Intel Iris / AMD Radeon Pro | `SwiftShader` = software rendering, results invalid |

Rollback headroom: an 8-frame rollback costs about 8 × sim step, so a 2 ms sim step keeps an 8-frame resimulation inside the GDD's 8 ms budget.

## If it fails

Send the copied block. The usual levers, in order of payoff: bloom resolution (`PRESENTATION.bloomResolution`), render scale (`PRESENTATION.renderScale`), and outline hulls on the wing feathers. All live in `apps/spectris/src/content/presentation.ts`.

## Headless reference (not hardware)

`npm run spectris:bench` runs the same bench in headless Chromium with software rendering (SwiftShader) and writes `apps/spectris/proofs/bench-local.json`. Those numbers are only useful as before/after comparisons inside this workspace; they say nothing about the Mac.
