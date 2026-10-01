# SPECTRIS DUELLUM — Continuation Brief (Claude Code)

Branch: **`feat/spectris-duellum`** in `mikeylambo/slu-platform-fighter`. This continues the existing build; it does not restart it. Do not merge to main.

Read `apps/spectris/GDD.md` (replace it with the revision 2 GDD delivered with this brief) and the existing `DECISIONS.md`, `TUNING_LOG.md`, and `VERIFICATION.md` before writing code. This is **one continuous build**: work through every step in order without stopping for approval. Each step ends with a Proof you must produce.

---

## 0. Ground rules

- Done means proven in a running build. No stubs, no fake UI, no unverified success claims.
- `npm run spectris:check` must be green at the end of every step.
- Commit after every meaningful unit with a clear message. Push the branch.
- All tunable numbers live in typed content files, never in rules code.
- Code is formatted and readable: one statement per line, named functions, no multi-statement one-liners. Run Prettier on everything you touch.
- Log choices in `DECISIONS.md` and every tuning change in `TUNING_LOG.md`. Bump the replay game version whenever simulation results change, so old tapes fail loudly instead of silently drifting.

## 1. Verified starting state

Confirmed by an independent review on 2026-10-01 (clone, read, and full `spectris:check` run):

- `spectris:check` passes: 31 duel tests, 10,000-frame determinism, replay round-trip, 8-frame rollback, 90 move entries, production build.
- The GDD's systems are implemented on the PF sim: stances, Strain/Fractures, guard/parry, evades, grabs and both throw sets, clash, meter, Feint, Kindle, all 8 specials, Oaths, rounds, Sudden Death, Pilgrimage (segmented), Gauntlet, Vigil, training, replays.
- Known weak points this brief fixes: `game/duel.ts` is a 31 KB single-function file of dense one-liners with numbers hardcoded in logic; `packages/soulfire`, `clash`, and `life-system` are a few lines each; the AI is scripted if/else; the art doesn't match the concept; the reference comparison mis-maps the jab; physics use pre-revision values.

## 2. Build order

### Step 1: Behavior-preserving refactor

Split `apps/spectris/src/game/duel.ts` into rules modules, each with its own tests:

```
game/rules/  input-buffer.ts  defense.ts (guard, parry, evade)  grab.ts  clash.ts
             meter.ts  feint.ts  kindle.ts  specials/*.ts (one per special)
             fractures.ts  rounds.ts (timer, sudden death, counterpick)  momentum.ts
game/duel.ts  # orchestration only: ordered calls into the modules above
ai/           # moved out of duel.ts (rewritten in Step 4)
```

- Move every literal number in rules code into `content/rules/*.ts` or `content/knight/*.ts`. Add a lint rule (extend `scripts/spectris-lint.mjs`) that fails on numeric literals other than 0, 1, and -1 inside `game/rules/`.
- Grow the shared packages into real, reusable APIs (built generic for the flagship):
  - `packages/soulfire`: param packs with activation, duration, cost, effect hooks (`onHit`, `onGuardChip`, `onFeint`, `onEnd`), a finisher definition, and a double-ignite resolution hook.
  - `packages/clash`: clash detection from colliding hitboxes with a Strain-gap threshold, the choice window, resolution, and outcome payloads (advantage, meter, chip).
  - `packages/life-system`: a `LifeSystem` interface with the Strain + Fractures implementation (thresholds, Shatter rule, respawn, round loss).
  - `packages/stance`: keep, add per-stance move-table lookup.

*Proof:* record 20 seeded bot matches before the refactor; after it, every replay produces **identical final hashes**. `spectris:check` green. `duel.ts` under 300 lines.

### Step 2: Physics and reference corrections

- Apply GDD revision 2 values (section 3.3–3.4): Wings air speed 0.90, Cape 0.75, fast fall 1.95 / 2.30, walk 1.20, traction 0.06, air accel 0.08.
- Fix `REFERENCE_COMPARISON` mapping per GDD 3.8: Jab 1 and Rapid Jab compare to Brawl's rapid jab (frame 7), the Rapid Jab finisher compares to Brawl's jab finisher (frame 30); Jab 2 and 3 compare against role budgets only.
- Add a **feel lab toggle** in the dev panel for jumpsquat 3f/4f and traction presets (0.04 / 0.06 / 0.10) so Michael can A/B them live.
- Bump the replay version and re-record the offstage proof.

*Proof:* the regenerated comparison table, the re-recorded offstage replay, and `TUNING_LOG.md` entries for every changed value.

### Step 3: Art pass to the v2 concept sheet

Copy `helm-concepts-v2.png` (delivered with this brief) to `apps/spectris/art/concepts/`. Target look: **refined concept 01 Duelist**.

**Helm trace pipeline** (`scripts/spectris-trace-helm.mjs`):
1. Input: a front-view black-on-white PNG per helm, plus an optional side-view PNG.
2. Threshold, trace to SVG (`potrace` npm package), simplify.
3. Load with Three.js `SVGLoader`, extrude with a bevel, and shape depth from the side-view profile (fallback: a domed depth curve).
4. Cut the V-visor as a separate emissive mesh.
5. Export each helm to `public/art/helm/<name>.glb` and register it in `art.manifest.json`.

Until Michael's clean front/side renders arrive, crop the helms from the v2 sheet as interim sources (Duelist, Sentinel, Reaper, Herald, Inquisitor, Vanguard). Mark them interim in the manifest; the final renders replace them with zero code changes.

**Body and rendering** (GDD section 10):
- Proportions: helm about 60% of the silhouette, chest at 0.6×, blade pauldrons, chunky fists, a thick sword with a gold crossguard and center gem, a short flame wisp.
- Wings folded behind the body at rest; they fan open during glide, jumps, and wing attacks.
- Materials: glossy black toon armor with rim light in the flame color, an emissive visor, a gold trim material, and an inverted-hull outline.
- Three.js `EffectComposer` + `UnrealBloomPass`, with bloom restricted to emissive layers.
- Camera about 30% closer, with dynamic zoom that keeps both Knights and the nearest ledge in frame.
- Restage the lighting on all 9 stages so the area behind the fighting plane is a light-to-mid value (fog, gradient sky, glow), keeping darks at the edges.
- Oath swap changes helm, flame palette, and trim metal per GDD section 5.

*Proof:*
- A side-by-side image of the in-game Knight (title pose) next to concept 01 Duelist.
- A gameplay screenshot on every stage at default camera.
- A 64px-tall render of each helm on the shared rig: each must be identifiable by silhouette alone (include the strip).
- Frame time on the bench scene (Step 6) doesn't regress by more than 15% from bloom and outlines.

### Step 4: Utility AI

Replace the scripted AI with a utility AI as in GDD section 9:

- Each 4f decision tick, score a fixed option set (approach, retreat, each normal by range, each special, grab, guard/evade, stance switch, feint, Kindle, edgeguard, recover) from sim-state considerations (distance, height, facing, opponent action, Strain, meter, stance, ledge state).
- CPU level controls reaction delay (30f → 6f), option breadth, DI quality, tech rate.
- **Personalities are weight tables in `content/ai/personalities.ts`**, not code branches.
- The Unsworn tracks the player's option frequencies and boosts the counters to the most-used ones.
- Stays deterministic and inside the sim.

*Proof:*
- Level 9 beats level 3 in at least 80% of 100 matches.
- For each Fracture personality, an option-usage histogram over 50 matches, showing its signature behavior at least 2× the Unsworn baseline (Ember: approach and aerials; Static: feints and Veil Step; Stillness: guard and parry; Gale: offstage edgeguards; Iron: Anchor and Charged Cleave; Hunger: grabs and pummels).
- 1,000-match soak, zero desyncs or crashes.

### Step 5: Close the unproven items

- **Pilgrimage:** one continuous traversable stage across 5 biome screens (reuse stage art), with right-of-way scrolling and respawn-ahead rules. *Proof:* a full Momentum match replay.
- **Gauntlet:** *Proof:* a bot clears all 7 fights on Squire, with the replay saved.
- **Vigil:** *Proof:* a scripted input run completes all 10 lessons; capture a screenshot of every lesson.
- **Online:** add room-code signaling with Supabase Realtime (Michael's connected Supabase account) plus public STUN servers; the existing WebRTC adapter carries the PF rollback session. TURN is a follow-up. *Proof:* a two-tab test passes locally, and `ONLINE_TEST.md` gives Michael a 5-minute two-machine test script.

### Step 6: Hardware bench for Michael

- A `?bench` URL mode: runs a fixed 60-second CPU-vs-CPU match on the heaviest stage and shows mean, p95, and worst frame time, sim step time, draw calls, and GPU renderer string, with a one-click copy.
- Gamepad diagnostics panel: mapping, deadzones, live input display, and per-button latency estimate.

*Proof:* the bench runs in the workspace browser; `BENCH.md` tells Michael how to run it on the 2019 MacBook Pro and what numbers pass (GDD section 14).

## 3. Michael's art drop-in (no code changes needed)

When these arrive, drop them in and rerun the trace script:

- 7 helms (Duelist, Sentinel, Reaper, Herald, Inquisitor, Vanguard, Static glitch crest): front view and side view each, solid black on white, flat, helm only → `art/source/helm/<name>-front.png`, `<name>-side.png`.
- Fist, sword, wing feather: front and side, same format → `art/source/<piece>-front.png`, `-side.png`.

## 4. When to stop and ask

Only for a contradiction in the player-facing spec, or a performance target that can't be met. Otherwise decide, log in `DECISIONS.md`, and continue.

## 5. Final report

- Branch, final commit, and preview URL.
- `spectris:check` results and the Step 1 hash-equality result.
- Every Proof artifact above, linked.
- The Duelist side-by-side and the 64px helm strip.
- AI personality histograms.
- An honest list of shortfalls and anything unproven.
