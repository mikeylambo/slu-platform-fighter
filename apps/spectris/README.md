# Spectris Duellum

A standalone web platform fighter built on the shared PF deterministic simulation. This branch now contains the broader playable duel, rather than only the movement/normal-attack foundation. It remains a development build; the exact verification boundary is recorded below.

```sh
npm ci
npm run spectris:dev
npm run spectris:check
npm run spectris:soak
```

The branch deploys the game directly at `/`. Legacy `/spectris/` links redirect there. Vercel builds only this app into `dist-spectris`; the lab apps and their build commands remain separate. Work is isolated on `feat/spectris-duellum`.

## Play

| Action | P1 | P2 | Standard gamepad |
| --- | --- | --- | --- |
| Move | WASD | Arrows | Left stick |
| Attack | J | Numpad 1 | A |
| Special | K | Numpad 2 | B |
| Jump | Space | Numpad 0 | X / Y |
| Guard / evade | L | Numpad 3 | RT |
| Grab | U | Numpad 4 | RB |
| Stance | I | Numpad 5 | LB |
| Smash | Shift + direction + attack | Right Shift + direction + attack | Right stick |

Attack + Special feints; Special + Guard Kindles at full meter and performs the finisher while Kindled. Stance + Guard spends 25 meter for Flash Unfurl. Hold jump after the last Wings air jump to glide. Esc pauses offline; Tab opens the workbench; period advances a frame. P1 action keys can be rebound in Options.

## Included

- Rounds, continuous Fractures, timeout/Sudden Death, local versus, CPU levels 1–9, training, and a segmented Pilgrimage race.
- Directional guard/parry, evades, grabs/pummels/throws, Clash, meter, Feint, Flash Unfurl, eight stance specials, Kindle and its finisher.
- Nine stage layouts, moving platforms, Oath-specific changes/palettes/helm ornaments, stage silhouettes, fracture cracks, toon armor, procedural flame, cape cloth, and synthesized adaptive audio.
- Gauntlet selection/progression, Squire/Knight/Paragon difficulties, local rewards, a guided Vigil, result cards, and replay export.
- Five dummy-input slots plus five full replay slots, state setting, stance lock, volumes/frame telemetry, frame advance, playback speed, free camera, and session-only startup tuning.
- Direct WebRTC invitation/answer pairing backed by PF rollback and initial-state compatibility checks. It does not provide public matchmaking, short room codes, or TURN relaying.

## Verification

`proofs/duel-check.json` records mechanical behavior, 10,000-frame determinism, replay round-trip, and delayed rollback. `proofs/move-certification.json` records explicit GDD timing contracts. The imported Brawl source comparison remains separate. `proofs/online-protocol.json` proves a complete packet-level match with 100 ms simulated delay; it is explicitly not a live browser connection proof.

`proofs/duel-browser.json` and the stage/flow PNGs show the actual browser build. Browser measurements use Linux SwiftShader software rendering, not Mike's Mac GPU. The target 2019 Intel Mac 60 fps and physical USB-controller acceptance remain unverified. The soak script uses four-Fracture continuous matches, a shortened 60-second stress timer, seven competitive stages, and Oath combinations; it reports incomplete matches rather than silently passing them.

## Remaining production work

- Internet WebRTC/NAT testing and hosted short-code signaling/TURN. The workspace browser gathers zero ICE candidates, so that acceptance test is blocked here.
- Human controller feel, final balance, and target-Mac GPU/load certification.
- Continuous five-biome Pilgrimage traversal, more varied biome transitions and a recorded, end-to-end Vigil walkthrough.
- Final authored art/audio/voice assets, richer attack animation, precise helm-break/reassembly choreography, and remaining stage/asset polish. The present procedural art and synth audio are intentional stand-ins, not a claim of finished AAA assets.
- Live editing currently covers move startup; complete physics and meter authoring UI remains follow-up work.

See `DECISIONS.md`, `TUNING_LOG.md`, and `AUDIO_DELIVERY.md` for working choices and production handoff details. Public art/audio manifests allow authored files to replace runtime fallbacks. Duel replays use `spectris-duel-v3`; earlier feel-build tapes have different rules and are rejected by this app.
