# SPECTRIS DUELLUM — Game Design Document (living)

Working title. Fallback: **Dark Mirror Duelist**. Final name pending a USPTO/Steam search.
SLU (Soulfire Legends Universe). Built on `mikeylambo/slu-platform-fighter`.

---

## 1. Vision

**Logline:** A one-character platform fighter. Two soul-flame knights in empty armor duel across the sky, and the only thing that separates them is the decisions they make.

**Tagline:** *Face the knight who knows every move you know.*

**Platforms:** Web first (desktop browser, gamepad plus keyboard). Steam wrapper later.

**Pillars**
1. **True Mirror.** Both players have identical tools. Reads, spacing, and nerve decide every match.
2. **The sky is the arena.** Aerial movement, offstage chases, and recovery mixups are the core of the game, not a side feature.
3. **Every crack tells the story.** The helm is the life bar. You can read the state of the match from two helms.

**Competitive position:** The feel is closest to the Brawl Meta Knight ditto (fast, aerial, read-heavy). It differs in three ways:
- **Verb:** stance-switching between Wings (offense, flight) and Cape (defense, deception).
- **Payoff:** cracking and shattering a helm instead of racking up percent.
- **Space:** open-sky and platform stages built for offstage play.

Nidhogg is the reference for Momentum mode, Bushido Blade for the lethality of the Shatter moment.

**Design laws**
- No useless options: every move, stance, and throw has a job.
- Every threat is telegraphed and readable at gameplay camera distance.
- Verified, not reported: a feature exists when it's proven in a running build.
- The ditto stays pure. Anything that changes the kit is opt-in (Oath rulesets).

## 2. Fiction & tone

**Premise:** The Knight is an empty suit of armor held together by a soul-flame. Its soul broke into **Fractures**, echoes of itself that each swore a different **Oath**. To become whole, the Knight has to duel each one and take the shard back. The last opponent is the **Unsworn**: a perfect mirror that swore nothing.

**Tone:** Severe, elegant, mythic. Few words. The Knight never speaks during fights. Each round opens with one masked line and closes with one line from the reflection, spoken as a distorted version of the same voice.

**Palette meaning:** The flame color is the self. The helm and armor stay dark steel, and every color on screen comes from a soul-flame. Color = identity.

**How modes map to the fiction:**
- Versus: two Knights at the same level of wholeness.
- Fracture Gauntlet: reclaiming yourself.
- Momentum: a pilgrimage duel across the realm.

## 3. The Knight: body, movement, combat

### 3.1 Body plan

| Part | Notes |
|---|---|
| **Helm** | Flame-crest helm (concept #8). The crest *is* the flame. About 40% of the silhouette (chibi). Carries all crack and life readouts. |
| **Chest shell + pauldrons** | Compact, rigid, and floating. The soul-flame shows through the gaps. |
| **Flame wisp** | Replaces legs. A shader plus particles, driven by velocity. |
| **Two gauntlets** | Disembodied and floating. They hold one longsword. Four hand poses: grip, open, fist, grab. |
| **Longsword** | One weapon only. Thickened blade with a glow edge for readability. |
| **Wings** (Wing stance) | 6 large blade-feathers per wing, rigid planes that fan open and closed. |
| **Cape** (Cape stance) | Presentation-only verlet ribbon, tinted by the flame palette. |

### 3.2 Controls

| Action | Gamepad | Keyboard |
|---|---|---|
| Move | Left stick | WASD |
| Attack | A | J |
| Special | B | K |
| Jump | X / Y | Space |
| Guard (Cape) / Evade (Wings) | R | L |
| Grab | Z / RB | U |
| **Stance** | LB | I |
| Feint | Attack + Special | J + K |
| Kindle | Special + Guard (full meter) | K + L |
| Tilt stick | Right stick (optional) | — |

Buffer window: 5f for all actions. Stance input can be buffered out of dash, jump squat, and landing.

### 3.3 Stances

| | **Wings** | **Cape** |
|---|---|---|
| Identity | Offense, flight, one-handed fencing | Defense, deception, two-handed cuts |
| Jumps | Ground + 3 midair | Ground + 2 midair |
| Air speed | 1.30 | 1.05 |
| Fall speed / fast fall | 1.40 / 2.20 | 1.65 / 2.60 |
| Glide | Yes (hold Jump after the last midair jump) | No |
| Defense | **Evade**: roll, spot dodge, air dodge (each leaves an afterimage) | **Guard**: directional, with parry on the first frames |
| Aerial startup | Fast (see 3.8) | +3–5f vs Wings, more landing lag |

**Stance switch:** 6f unfurl. The Knight can act on frame 7 and is vulnerable during frames 1–6.
- **Offstage:** one switch per airborne stint. The switch refreshes on landing, ledge grab, or being hit.
- **Flash Unfurl:** costs 25 meter and cancels the 6f window. Usable any time the Knight could otherwise switch.
- **During a grab:** switching swaps the available throw set, and the 6f window gives the victim an escape window at double mash rate.

### 3.4 Physics baseline (starting values; the sim uses fixed-point)

| Stat | Value |
|---|---|
| Weight | 0.85 (light) |
| Walk / run | 1.10 / 1.85 |
| Jump height (full / short) | 34 / 16 units |
| Midair jump height | 26 units |
| Gravity | 0.095 |
| Glide duration | 120f max; pitch ±35°; speed builds on dives, bleeds on climbs |
| Glide attack | Available at any point in the glide, ends the glide |
| Glide cancel | Landing during a glide = 8f landing lag |
| Ledge | Intangible for 30f on the first grab. Zero intangibility on a regrab until the Knight touches the stage. |

Calibrate these against the Brawl Meta Knight data file in `/reference/`. Target the feel, not exact values.

### 3.5 Damage model: Strain & Fractures

- **Strain** works like percent (0–999). It raises knockback and shows as cracks spreading across the helm at 25 / 50 / 100 / 150.
- **A Fracture is taken** in either of two ways:
  1. The Knight is launched past a blast zone.
  2. A **Shatter-class** hit lands while the Knight's Strain is ≥ 100.
- **On a Fracture:** Strain resets to 0, the Knight respawns with 90f intangibility, and one Fracture pip breaks.
- **4 Fractures** and the round is lost.
- **Knockback:** use the PF sim's knockback formula with Strain as the percent input.

**Shatter-class moves:** F-smash, U-smash, Cape Fair (sweetspot), Charged Cleave (full charge), Anchor (grounded), any Shatter Throw, and the Kindle finisher.

**Shatter presentation:** 8f hitstop, helm burst VFX, flame flares white, stage backdrop crack, music layer step.

### 3.6 Guard (Cape stance)

- **Guard Integrity** runs 0–100, shown as hairline cracks on the helm, drawn in a different color from Strain cracks.
- **Directional:** guard covers the facing direction only. A hit from behind is a clean hit.
- **Parry:** the first 4f of guard is a parry. The attacker takes +12f of recovery and the parrier gains +20 meter.
- **Chip:** a blocked hit costs Integrity equal to the move's Strain × 1.0. It also adds Strain × 0.15 to the defender.
- **Regen:** after 60f without blocking, Integrity regenerates 0.25/frame.
- **Guard break** at 0 Integrity: 120f stagger, then Integrity resets to 50.
- **Bare-gauntlet guard** (while the sword is out, see Blade Sling): Integrity cost is doubled.
- **Shielding** releases in 6f; jump and grab out of guard are both allowed.

### 3.7 Evade (Wings stance)

| Evade | Frames | Intangible |
|---|---|---|
| Spot dodge | 22 | 3–16 |
| Roll | 28 | 4–17 |
| Air dodge (directional, one per airtime) | 30 | 3–20; then helpless if used below the ledge |

Each evade leaves an afterimage at its start position that fades over 20f. It's cosmetic, but it plants a doubt.

### 3.8 Moveset

Starting frame data at 60fps. Strain equals damage. KB is written as base/growth (0–100 scale). **Calibrate by role against the Brawl MK data: jab, fair, nair, uair, landing lag, and glide are the feel anchors.**

**Ground (shared by both stances; the grip changes visually only)**

| Move | Name | Startup | Active | FAF | Strain | KB | Notes |
|---|---|---|---|---|---|---|---|
| Jab 1/2/3 | Gauntlet Flurry | 2 / 2 / 4 | 1 each | 18 | 2 / 2 / 3 | 20/20 | Chains into rapid jab (1/hit, +3 finisher) |
| F-tilt | Triple Thrust | 5 / 11 / 17 | 2 each | 30 | 4 / 4 / 6 | 40/60 on the 3rd | Spacing |
| U-tilt | Crown Arc | 6 | 7 | 26 | 8 | 50/70 | Anti-air, starts juggles |
| D-tilt | Ankle Cut | 4 | 2 | 16 | 6 | 35/40 | Low launch, tech-chase starter |
| Dash | Lunge | 7 | 5 | 34 | 10 | 60/60 | Safe when spaced |
| F-smash | Longreach | 14 | 4 | 48 | 18 | 45/98 | Gauntlet extends the blade on a tether, snaps back. **Shatter** |
| U-smash | Orbit | 10 | 13 (multi) | 44 | 16 | 50/95 | Blade spirals around the body. **Shatter** |
| D-smash | Twin Cut | 7 / 13 | 2 / 2 | 40 | 13 | 40/90 | Front, then back |

**Aerials: Wings**

| Move | Name | Startup | Active | Landing lag | Strain | Notes |
|---|---|---|---|---|---|---|
| Nair | Blade Orbit | 4 | 4–20 (4 hits) | 8 | 2×3 + 3 | Combo glue |
| Fair | Tri-Lunge | 5 / 12 / 19 | 2 each | 9 | 3 / 3 / 4 | Offstage wall |
| Bair | Reverse Cut | 6 | 4 | 10 | 12 | Kill (KB 40/100) |
| Uair | Rising Flick | 3 | 4 | 7 | 6 | Juggle loops |
| Dair | Dive Stab | 5 | 4 | 12 | 9 | Tip spikes |

**Aerials: Cape**

| Move | Name | Startup | Active | Landing lag | Strain | Notes |
|---|---|---|---|---|---|---|
| Nair | Veil Spin | 8 | 7 | 14 | 10 | Strong push, defensive reset |
| Fair | Cleave | 10 | 4 | 18 | 15 | Sweetspot meteor. **Shatter** |
| Bair | Cape Lash | 9 | 4 | 14 | 12 | Large disjoint |
| Uair | Greatslash | 9 | 5 | 15 | 14 | Top kill |
| Dair | Drop Stab | 7 | 3 | 12 | 10 | Sweetspot spike |

**Specials**

| Input | Wings | Cape |
|---|---|---|
| **Neutral** | **Blade Sling.** 12f startup. A gauntlet throws the sword forward (travel 40f, range 3.5 body lengths), 11 Strain. The Knight is **swordless** until it returns: Attack becomes a single gauntlet punch (3 Strain, 5f), grab works, guard is bare-gauntlet. The sword returns automatically 30f after it hits or whiffs. Pressing Special again recalls it early with a **return hitbox** (7 Strain). | **Charged Cleave.** Hold up to 60f. Strain 12 → 24. Armor at full charge (absorbs up to 12). Full charge is **Shatter**. |
| **Side** | **Gale Lunge.** 8f startup, a horizontal dash cut, 9 Strain. Horizontal recovery, once per airtime. | **Veil Step.** The Knight phases forward through the opponent (intangible 6–18). Press Attack on reappearing for a 7 Strain cut. |
| **Up** | **Ascend.** A wing burst with a rising arc strike, 8 Strain. Leaves the Knight helpless. | **Rift.** A directional teleport (8 directions, 2.5 body lengths). Attack on emerge for 6 Strain. Helpless unless the emerge attack hits. |
| **Down** | **Stoop.** A diving plunge (6 Strain), cancellable into glide from frame 12. | **Anchor.** Grounded: the sword is planted with a shockwave on both sides, armored for frames 1–9, 14 Strain, Guard Integrity cost ×2.0. **Shatter.** Aerial: a fast plunge into the same shockwave, 26f landing lag on whiff. |

### 3.9 Grab game

| Grab | Startup | Notes |
|---|---|---|
| Standing / dash / pivot | 6 / 8 / 10 | Gauntlets reach 1.2 body lengths |
| Air grab (**Wing Carry**, Wings only) | 9 | Costs a midair jump. Carries the victim 2 body lengths in the held direction, then releases (both players actionable, the victim is in 10f hitstun) |
| **Pummel: Siphon** | 3f | 3 Strain. Steals 4 meter per pummel. |

**Throws**

| | Wings (launch) | Cape (position) |
|---|---|---|
| Forward | Launch 45/75, 8 Strain | **Cape Carry**: both Knights vanish and reappear up to 2 body lengths in the chosen direction, then release with a 10f advantage |
| Back | Launch 50/85, 10 Strain (kill throw) | Reverse Carry, puts the victim on the far side |
| Up | Launcher 70/40, 6 Strain. Combo starter | Low pop 30/40, 5 Strain |
| Down | Bounce 60/30, 7 Strain | Knockdown (forces a tech), 6 Strain |

- **Shatter Throw:** if the victim's Guard Integrity is ≤ 40 when grabbed, the throw becomes Shatter-class.
- **Escape:** mash. Base hold is 90f minus the victim's Strain × 0.4. Each consecutive regrab within 180f cuts escape time by 30%. Every throw can be DI'd.

### 3.10 Clash

Hitboxes colliding within ±2 Strain of each other cause a **clash**:
- Both Knights freeze for 12f, and each picks **Press** (forward), **Parry** (back), or **Slip** (down).
- Parry beats Press, Press beats Slip, Slip beats Parry. A tie makes both Knights recoil to neutral.
- **Winner:** +15 meter and a 20f advantage. **Loser:** 15 Integrity chip. With no input, the choice defaults to Press.
- Presentation: sword-lock sparks, a camera push-in, and a clash stinger in the music.

Clashes with a Strain gap larger than 2 go to the heavier hit, with the lighter hit recoiling (Smash rules).

### 3.11 Meter

Range 0–100, three segments, carried between Fractures, and reset at the start of each round.

| Gain | Amount |
|---|---|
| Parry | +20 |
| Clash won / lost | +15 / +5 |
| Siphon pummel | +4 (taken from the opponent) |
| Landing a hit | +Strain × 0.3 |
| Taking a hit | +Strain × 0.2 |

| Spend | Cost |
|---|---|
| **Feint** | 25 |
| **Flash Unfurl** | 25 |
| **Kindle** | 100 |

**Feint:** throws out an afterimage of the Knight's last attack.
- **Tap:** the ghost has no hitbox and the Knight is actionable in 8f.
- **Hold:** the ghost has a real hitbox at 50% Strain and the Knight commits for 20f.
- The two look identical to the opponent.

### 3.12 Kindle (the Soulfire buff state)

Implemented as the generic **Soulfire** buff-state module in `slu-platform-fighter` with per-character parameter packs. This Knight is its first consumer.

- **Cost:** 100 meter. **Duration:** 480f. Activation: 18f with intangibility.
- **Presentation:** the flame burns white-hot, afterimages trail every move, the music adds a lead layer.
- **Base effects (True Mirror):** double Guard Integrity chip, Feint costs nothing, one free Flash Unfurl, no meter gain while Kindled.
- **Finisher:** Special + Guard again during Kindle ends it with a flame cut (24 Strain, **Shatter**).
- **Double Kindle:** if both Knights are Kindled at the same moment, the flames clash (a forced clash, section 3.10) and the winner keeps the state while the loser's is cancelled.

**Oath rulesets change what Kindle does** (see section 5).

## 4. Rulesets & modes

| Setting | Options (default first) |
|---|---|
| Kit | **True Mirror** / Oaths |
| Format | **Rounds** (Bo3, Bo5; Fractures per round 4) / **Continuous** (single round, Fractures 4–8, meter carries through) |
| Timer | **6:00** / 4:00 / 8:00 / off |
| Timeout | **Sudden Death**: both Knights drop to 1 Fracture left, blast zones shrink 1%/s, the next Fracture wins |
| Stage list | Competitive / All / Random |

**Modes**
- **Versus:** local 1v1 (players or CPU level 1–9). Online 1v1 via the PF rollback netcode over WebRTC.
- **Momentum:** Pilgrimage stage (section 7). Win a Fracture exchange to earn right of way, the camera scrolls toward the opponent's end, and the opponent respawns ahead. The first Knight to reach the final screen wins.
- **Fracture Gauntlet:** solo mode (section 6).
- **Training:** frame data overlay, hitbox and hurtbox view, input display, CPU record/playback (5 slots), Strain and meter set, stance lock, frame-advance, replay save.
- **Replays:** deterministic input replays with a free camera and speed control (the TAS Theatre foundation).

## 5. Oaths

Every Oath changes exactly **three things**: one special per stance, the Kindle effect, and the flame palette plus its VFX. Everything else stays identical.

| Oath | Palette | Wings special | Cape special | Kindle effect | Fracture helm |
|---|---|---|---|---|---|
| **Ember** | Red / black / orange | Gale Lunge chains twice | Charged Cleave charges ×2 speed | Hits leave burning trails: +4 Strain after 60f | Horned (#19) |
| **Static** | BSOD blue / cyan / white | Stoop leaves a decoy Knight | Veil Step leaves an attacking afterimage | Feints stay free and chain | Crested (#5) |
| **Stillness** | White / pale blue / silver | Ascend gains a 4f parry | **Riposte counter** (replaces Anchor) | Parry window becomes 8f | Halo (#20) |
| **Gale** | Teal / white / mint | Ascend is not helpless | Rift usable twice | +1 midair jump, glide 180f | Winged crest (#9) |
| **Iron** | Gunmetal / amber | Blade Sling gains armor | Anchor shockwave range ×1.5 | Super armor on smashes (up to 15) | Crown (#3) |
| **Hunger** | Violet / black / magenta | Blade Sling siphons 10 meter on hit | Siphon steals ×2 | Hits drain 5 meter from the opponent | Hooded (#10) |
| **Unsworn** | Player's own | — | — | True Mirror | Cracked (#14) |

## 6. Fracture Gauntlet (solo)

- A 7-fight ladder: six Oath Fractures in any order (chosen from a star-map select), then the Unsworn.
- Each Fracture is fought on its home stage, in its Oath, with its helm, and with an **AI personality**:

| Fracture | AI personality |
|---|---|
| Ember | Rushdown, high aggression, few defensive options |
| Static | Feint-heavy, cross-ups, Veil Step mixups |
| Stillness | Patient, parry and counter focused |
| Gale | Offstage hunter, edgeguards and aerial chases |
| Iron | Armored trades, Anchor pressure |
| Hunger | Grab-heavy, meter denial |
| Unsworn | Level 9 mirror; adapts by weighting whichever option the player uses most |

- **Reward per Fracture:** the Oath (for Oath rulesets), its flame palette, and its helm as a cosmetic.
- **Difficulty ladder:** Squire / Knight / Paragon. Paragon unlocks after clearing Knight.
- **Result screen:** time, Fractures lost, clashes won, parries, and a shareable card.

## 7. Stages

Every stage has **no gameplay gimmicks**. Only moving platforms change the layout. **Reactive backdrops:** each Fracture spreads cracks through the background, tilts the lighting toward the leading Knight's flame, and steps the music up a layer.

| Stage | Layout | Blast zones (L/R/T/B, from center) | Oath home | Legal |
|---|---|---|---|---|
| **Mirror Sanctum** | Main floor + 3 platforms (Battlefield) | 224 / 224 / 200 / 140 | Starter | Starter |
| **Eclipse** | Flat | 230 / 230 / 200 / 140 | Ember | Starter |
| **Fault Screen** | Main floor + 2 platforms | 224 / 224 / 190 / 140 | Static | Starter |
| **Stillwater** | Flat + 1 center platform | 224 / 224 / 200 / 140 | Stillness | Starter |
| **Bell Foundry** | Main floor + 1 platform on a track (12s loop) | 220 / 220 / 190 / 140 | Iron | Starter |
| **Skyreach** | Small main floor + 2 drifting platforms | 260 / 260 / 220 / 150 | Gale | Counterpick |
| **Hollow Throne** | Flat | 210 / 210 / 185 / 135 | Hunger | Counterpick |
| **Unsworn** | Mirror Sanctum, shattered | as Sanctum | Unsworn | Solo only |
| **Pilgrimage** | 5 scrolling screens mixing the biomes above | — | — | Momentum only |

Main floor widths (units): Sanctum 160, Eclipse 190, Fault 170, Stillwater 185, Foundry 175, Skyreach 110, Throne 200.

## 8. Match flow

1. Rules → stage select (star map) → palette select (Oath select when Oaths are on).
2. Intro: both Knights ignite, the round's masked line plays, then "DUEL".
3. Fractures → round end with the reflection's line → next round (stage counterpick in Rounds format).
4. Results: stats, replay save, rematch.

## 9. AI

- Utility AI that reads sim state (positions, Strain, stance, meter, facing, ledge state) and scores options each 4f decision tick.
- CPU levels 1–9 change reaction delay (30f → 6f), option breadth, DI quality, and tech rates.
- Personality weights (section 6) sit on top of the level.
- Runs inside the deterministic sim so replays and rollback stay in sync.

## 10. Presentation

- **Art direction:** dark steel armor, painterly-stylized shading (toon ramp plus rim light). All color comes from the soul-flame.
- **Readability law:** at gameplay camera distance, the helm, blade, and flame must each read on their own. Helm scale is 1.25× relative to the concept sheet. Blade width is doubled, with a glow edge.
- **Two Knights, same color:** player 2 gets an automatic alternate flame palette. In the same Oath, the palette shifts 60° in hue.
- **Game feel:**
  - Hitstop: 3f + Strain × 0.25, capped at 12f; Shatter hits get a flat 8f bonus.
  - Screen shake only on Shatter and Fracture events (magnitude cap 6px).
  - DI and tech inputs show a 1-frame flash on the Knight in training mode.
- **Deaths:** the helm bursts outward in pieces, the flame goes out, the armor clatters, and the pieces reassemble on respawn.

## 11. Audio

**Principle:** the music is the match's pulse. It escalates with Fractures, not with time.

**Adaptive OST:** each stage track has 4 layers (base → percussion → lead → Kindle/Sudden Death). Each Fracture taken by either player unlocks the next layer. Clash stingers are quantized to the next beat (maximum delay 100ms).

| SFX category | Cues |
|---|---|
| Blade | swing (light/heavy), hit (light/heavy/Shatter), clash lock, clash win |
| Armor | helm crack (Strain tier), hairline chip, guard break, helm shatter |
| Flame | ignite, stance unfurl (wings/cape), Kindle start/loop/end, respawn ignite |
| Movement | jump, midair jump, glide loop, landing, ledge grab |
| Specials | Blade Sling throw/return, Rift, Veil Step, Anchor shockwave |
| UI | menu move/confirm/back, Fracture pip break, round win, results |

**Voice (recorded by Michael):** 8 round-start lines, 8 matching reflection lines (distortion applied in-engine), 4 Kindle cries, and a death breath.

**Mix:** blade and armor hits sit above the music. Music ducks 4 dB on Shatter hits for 500ms.

## 12. UI / HUD / UX

- **HUD:** two helm icons in the corners (live Strain cracks and hairlines), 4 Fracture pips under each, a 3-segment meter bar, and a stance glyph. Nothing else.
- **Menus:** a star-map UI, with each stage and Fracture shown as a star.
- **Options:** controls remapping, tap-jump toggle, buffer 3–8f, stick deadzone, colorblind flame palettes, screen shake off, music/SFX/voice volumes, and a netcode input-delay setting.
- **Accessibility:** a high-contrast outline mode so each Knight has a solid-color silhouette edge.

## 13. Onboarding

**Vigil** (a first-launch tutorial, 5 minutes, each prompt fades once used):
1. Movement, then jumps.
2. Glide.
3. Stance switch.
4. Guard and parry.
5. Evade.
6. Grab and throw.
7. Clash (against a scripted dummy).
8. Blade Sling and recall.
9. Offstage recovery with the one-switch rule.
10. Kindle.

It ends with a Level 3 CPU duel on Mirror Sanctum.

## 14. Platform & tech

- **Stack:** the `slu-platform-fighter` monorepo (TypeScript). The game lives as a new app package. Use the PF sim, deterministic math, rollback/replay, input, training, and presentation packages.
- **Renderer:** the PF presentation package's renderer. If none has been chosen, use Babylon.js.
- **New shared PF modules** (built generic, with this game as the first consumer): Soulfire buff state, stance system, the life-system abstraction (Strain + Fractures as one implementation), and clash resolution.
- **Performance budget:** 60fps locked on a 2019 Intel MacBook Pro in Chrome; sim step ≤ 2ms; rollback of 8 frames ≤ 8ms; initial load ≤ 15MB.
- **Deploy:** Vercel.

## 15. Verification & tooling

- **Dev panel:** live-edit any move's frame data, physics values, and meter numbers; hot reload data files.
- **Overlay:** hitboxes, hurtboxes, frame counter, Strain/Integrity/meter numbers, sim hash.
- **Automated checks:** determinism (the same inputs give the same hash across 10k frames), a rollback check (resim equals live), a frame-data certification gate (every move within its role budget), a replay round-trip check, and bot-vs-bot soak tests (1,000 matches, no desync or crash).
- **Acceptance rule:** a feature is done only when it's proven in a running build, with a screenshot or replay as evidence.

## 16. Open items (working defaults in use)

| Item | Working default |
|---|---|
| Final title | SPECTRIS DUELLUM, pending a name search |
| Clash window length | 12f; tune in playtest |
| Continuous format Fracture count | 6 |
| Pilgrimage length | 5 screens |
| Wing-stance air speed vs Cape | 1.30 vs 1.05; tune in the feel gate |
| Oath → helm assignments | As in section 5 |
