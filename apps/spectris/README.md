# Spectris Duellum — playable foundation

A running Step 1 / Step 2 development build in the existing PF monorepo. **Not the completed game.** See `DECISIONS.md` for the feel-gate blocker and current scope.

From the repository root:

```sh
npm ci
npm run spectris:dev
npm run spectris:verify-foundation
npm run spectris:check
```

`verify-foundation` typechecks, lints for unsafe simulation APIs, tests the actual runtime, verifies replay and rollback, and builds the app. `spectris:reference` compares the imported Brawl source with our timings. `check` additionally runs that comparison and exits 2 while role budgets and controller feel remain pending; it does not call a comparison a certification. See `REFERENCE_FORMAT.md`.

The Spectris branch deploys the game directly at `/`, with no lab hub. Old `/spectris/` links redirect to `/`. Vercel builds only this game into `dist-spectris/`. The shared lab build script remains available separately.

## Play

- P1: WASD, Space, J, I. Shift + direction + J for smashes.
- P2: arrows, Numpad 0, Numpad 1, Numpad 5. Right Shift + direction + Numpad 1 for smashes.
- Standard gamepad: left stick, A attack, X/Y jump, LB stance; right stick smash.
- Hold jump after spending all Wings jumps to glide. Up climbs, down dives. Attack cancels glide.
- Esc pauses. Tab opens the workbench. Period advances a frame.

The workbench includes hit/hurt volumes, input/frame/hash telemetry, state setting, five in-memory input-replay slots, JSON import/export, and session-only first-startup editing. Imported tapes are validated through the PF replay player. Reloading restores source tuning. The Reflection can stand still, mirror input, or follow a deterministic movement drill; it is not the final utility AI.

## Proofs

`proofs/verification.json` lists test results and measured CPU timings. `proofs/offstage-exchange.json` is a real PF input tape. `proofs/browser-qa.json` records browser checks. PNGs show actual browser rendering.

## Still required

Accepted source-based role budgets and human feel review; precise glide pitch and full per-move authoring; Steps 3–10 (Fracture/guard/grab/clash/meter, specials/Kindle, full AI/training, stages/Oaths, Gauntlet/Vigil, WebRTC, final art/audio, accessibility and performance certification). There is no full-game completion or AAA-quality claim.

## Graphics startup

The renderer first requests the high-performance GPU with antialiasing, then retries the default GPU without antialiasing on a fresh canvas. If both WebGL 2 context requests fail, the startup screen displays the browser’s actual failure details and recovery steps. Unrelated startup exceptions are reported separately. This cannot override browser-disabled graphics access.

Reference timing pass: all authored moves now accept a new attack on their stated first actionable frame. Replays use `spectris-feel-v2`; older v1 tapes are rejected because recovery timing changed.
