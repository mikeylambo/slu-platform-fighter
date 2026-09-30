# SPECTRIS DUELLUM — Claude Code Build Brief

Read `GDD.md` in full before writing code. This is a **single continuous build**: work through every step in order and don't stop for approval between steps. The GDD is the spec. This brief tells you the order of work and how to prove each step is done.

---

## 0. Ground rules

- **Done means proven in a running build.** Every step below ends with a Proof. Produce it: a screenshot, a replay file, or a passing check.
- No stubs, fake UI, or placeholder logic presented as finished.
- Never report success you haven't verified. If something falls short, say so in the final report.
- Keep files small and data typed. All tunable numbers live in data files, never hard-coded in logic.
- Commit after every meaningful unit of work, with clear messages.
- Old code is not a reference unless you verify it. The `slu-platform-fighter` packages are verified foundation (cert gates K0–K51 green): use them. Don't rebuild subsystems that already exist there.

## 1. Project setup

- Work in `mikeylambo/slu-platform-fighter`. Add a new app package: `apps/spectris`.
- Scripts: `dev`, `build`, `test`, and **one `check` command** that runs typecheck, lint, the unit tests, the determinism check, the rollback check, the frame-data cert gate, and the replay round-trip.
- Deploy target: Vercel (a preview on every push, production on main).
- Anything platform-specific (gamepad API, audio context, WebRTC, storage) goes behind one module per concern, reached through the PF shell.

## 2. Architecture

```
apps/spectris/
  src/
    game/        # rules: stances, strain/fractures, guard, clash, meter, kindle params, modes
    content/     # typed data: knight moveset, physics, oaths, stages, AI personalities
    ai/          # utility AI + personality weights (runs in-sim, deterministic)
    scenes/      # boot, title, star-map select, match, results, training, gauntlet, vigil
    presentation/# knight assembly, flame shader, wings, cape ribbon, VFX, camera, HUD
    audio/       # adaptive music layers, SFX bank, voice, mix rules
    dev/         # dev panel, overlays, bot hooks
packages/ (new or extended PF modules, built generic)
  soulfire/      # buff-state module with per-character param packs (Kindle = first pack)
  stance/        # stance system: unfurl frames, per-stance move tables, switch rules
  life-system/   # abstraction; Strain+Fractures is one implementation
  clash/         # hitbox-collision clash + choice resolution
```

- **Fixed-step deterministic sim** at 60Hz, using PF fixed-point math. Presentation reads sim state and never writes to it.
- The cape ribbon, flame particles, and wing fan are **presentation-only**, so the sim never depends on them.
- Object pools for VFX, afterimages, and projectiles (Blade Sling, feint ghosts).
- All content is data-driven: moves are hitbox and timeline data, not code branches.
- Oaths are **data overrides** on top of the base kit. They replace move entries and the Kindle param pack.
- Put dev and bot hooks on `window.__spectris`: set state, step N frames, dump the sim hash, run a bot match, load a replay.

## 3. Data files

| GDD section | File |
|---|---|
| 3.3–3.4 stances + physics | `content/knight/physics.ts`, `content/knight/stances.ts` |
| 3.5 Strain / Fracture rules | `content/rules/life.ts` |
| 3.6–3.7 guard / evade | `content/rules/defense.ts` |
| 3.8 moveset | `content/knight/moves/*.ts` (one file per move group) |
| 3.9 grab game | `content/knight/grabs.ts` |
| 3.10 clash | `content/rules/clash.ts` |
| 3.11 meter | `content/rules/meter.ts` |
| 3.12 Kindle | `content/knight/kindle.ts` (Soulfire param pack) |
| 4 rulesets | `content/rules/rulesets.ts` |
| 5 Oaths | `content/oaths/*.ts` |
| 6 Gauntlet + AI personalities | `content/gauntlet.ts`, `content/ai/personalities.ts` |
| 7 stages | `content/stages/*.ts` |
| 10 presentation constants | `content/presentation.ts` |
| 11 audio cues | `content/audio/cues.ts` + `audio.manifest.json` |
| Brawl MK reference | `reference/brawl-mk.json` (Michael provides; used only by the cert gate as role budgets) |

## 4. Build order

**Step 1: Foundation.** Scaffold `apps/spectris` on the PF packages. Build a greybox Knight from primitives: an elongated flame-crest helm at 1.25× scale, the chest shell, two floating gauntlets, a thick sword with a glow edge, and a wisp shader. Greybox Mirror Sanctum. Two local players with gamepad and keyboard.
*Proof:* two greybox Knights moving on Sanctum at 60fps; determinism check green.

**Step 2: FEEL GATE.** Movement, jumps, glide (attack and cancel), both stances with the 6f unfurl and the one-switch-offstage rule, ledge rules, and all ground and aerial normals with hitboxes. Tune in the dev panel until the Knight feels fast, sharp, and aerial, calibrated against the role budgets in `reference/brawl-mk.json`. **Don't start Step 3 until the movement and aerial feel is right.** Log every tuning change in `TUNING_LOG.md`.
*Proof:* a replay showing a full offstage exchange (chase, glide, stance switch, recovery), plus the cert gate passing for every normal.

**Step 3: Core duel loop.** Strain and knockback, Fractures (blast zone and Shatter-class), respawn, the directional guard with parry, Integrity chip and regen, guard break, evades with afterimages, grabs, Siphon pummel, both throw sets, Cape Carry, Wing Carry, Shatter Throw, escape scaling, clash with the Press/Parry/Slip choice, meter, and the Rounds and Continuous formats with the timer and Sudden Death.
*Proof:* a full Bo3 between two bots, including at least one clash, one parry, one guard break, one Shatter Throw, and a Sudden Death. The replay round-trip matches the hash.

**Step 4: Specials, Feint, Kindle.** All eight specials (Blade Sling with the swordless state, recall, and return hitbox; Charged Cleave; Gale Lunge; Veil Step; Ascend; Rift; Stoop into glide; Anchor grounded and aerial). Feint tap and hold. Flash Unfurl. Build the Soulfire module generically in `packages/soulfire`, then Kindle as its first param pack, with the finisher and double-Kindle clash.
*Proof:* the cert gate green for every move; a replay of each special in training mode; a Soulfire module unit test using a second dummy param pack.

**Step 5: CPU + Training.** Utility AI (levels 1–9) running in the sim. Training mode with the frame data overlay, hitbox view, input display, 5-slot record/playback, state set, frame-advance, and replay save.
*Proof:* a level 9 CPU beats a level 3 CPU in at least 80% of 100 bot matches; a 1,000-match soak with zero desyncs or crashes.

**Step 6: Content.** All 9 stages (reactive backdrops: Fracture cracks, lighting tilt, music layer hooks), the Momentum mode with Pilgrimage scrolling and right-of-way rules, all 6 Oaths as data overrides, and the Oath ruleset.
*Proof:* a screenshot of every stage; one Momentum match replay to completion; each Oath's changed specials and Kindle shown in training mode.

**Step 7: Fracture Gauntlet + Vigil.** The star-map select, all 6 Fracture fights with AI personalities, home stages, and helms (helm swap on one rig), the Unsworn with adaptive weighting, rewards and unlocks, the Squire/Knight/Paragon ladder, the shareable result card, and the Vigil tutorial.
*Proof:* a bot clears the Gauntlet on Squire; a Vigil walkthrough capture.

**Step 8: Online.** Online 1v1 over WebRTC using the PF rollback netcode: lobby by room code, adjustable input delay, desync detection with the hash.
*Proof:* two browser tabs play a full match with simulated 100ms latency and no desync.

**Step 9: Presentation + audio pass.** Toon-ramp armor shading, the flame shader with its palette system, the 6-feather rigid wings, the cape verlet ribbon, afterimages, Shatter and helm-burst VFX, hitstop and shake rules, the star-map UI, the full HUD, and the adaptive music engine with beat-quantized clash stingers, plus the SFX bank and mix rules.
*Proof:* screenshots of every scene; a video capture of a Shatter moment with audio.

**Step 10: Polish to shelf quality.** Options and accessibility (remap, buffer, colorblind palettes, high-contrast outline), menu transitions, the results flow, and a performance pass to the GDD 14 budget.
*Proof:* the perf numbers table; `check` fully green; a production deploy.

## 5. Art

- The procedural greybox is **final-quality stand-in art**: clean shapes, the real flame shader, real palettes. The game has to look intentional without any external art.
- Every art asset loads through `art.manifest.json`. When a GLB or PNG from Michael is dropped in, it overrides the matching procedural piece automatically.
- Pieces to make overridable: `helm/{default, horned, halo, crown, crest, winged-crest, hooded, cracked}.glb`, `chest.glb`, `pauldron.glb`, `gauntlet.glb` (with 4 hand-pose nodes), `sword.glb`, `wing-feather.glb`, `cape-texture.png`, and stage backdrops.
- GLB import follows the path the PF repo already proved with the Riven asset.

## 6. Audio

- Build the full adaptive engine to the GDD 11 spec: 4-layer stage tracks, layer steps on Fractures, beat-quantized stingers, and the ducking rules.
- Synthesized placeholder SFX and music load behind `audio.manifest.json` so real files override them.
- Generate **`AUDIO_DELIVERY.md`**: Michael's production checklist, listing every music stem, SFX, and voice line with its filename, length, loop points, and intent.

## 7. When to stop and ask

Only stop for:
- a contradiction in the player-facing spec, or
- a performance target that can't be met.

For everything else, make the call, log it in `DECISIONS.md`, and keep going. Tuning changes go in `TUNING_LOG.md`.

## 8. Final report

- Deployed URL and final commit.
- `check` results.
- Screenshots of every scene, stage, and mode.
- Perf numbers against the GDD 14 budget.
- Links to `DECISIONS.md`, `TUNING_LOG.md`, and `AUDIO_DELIVERY.md`.
- An honest list of shortfalls and anything unproven.
