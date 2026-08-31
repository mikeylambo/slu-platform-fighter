# Character Production Loop

Status: foundation-complete; real model/skin/rig import proof passed. Character production is now the primary path.

This document is the canonical handoff from engine development to roster production. A conventional fighter should not require simulation, rollback, networking, stage, shell, camera, replay, input, or generic combat edits.

## 1. Seed the fighter

Use the full certified gameplay envelope rather than an empty hand-written folder:

```bash
npm run fighter:seed -- <fighter-id> "Display Name"
```

For a batch, put the roster in the roster manifest consumed by `roster:seed` and scaffold them together.

## 2. Import the rigged GLB

```bash
node scripts/import-fighter-model.mjs <fighter-id> <file-or-url> [rig-profile] \
  --author="..." --license="..." [--license-url="..."]
```

The importer:

- requires GLB v2,
- copies the asset into `fighters/<id>/assets/model.glb`,
- records SHA-256 provenance,
- updates `fighter.json` and `render.json` to the declared rig profile,
- installs known semantic socket mappings for the shared SLU and Mixamo humanoid profiles.

Use `slu-humanoid-v1` for the preferred shared roster rig. `mixamo-humanoid-v1` is supported as a legitimate import/retargeting path. Custom body plans may declare their own validated rig profile under `content/rig-profiles/`.

## 3. Inspect and auto-bind what is safe

```bash
npm run fighter:autobind -- <fighter-id>
npm run fighter:autobind -- <fighter-id> --apply
```

Only exact/explicit aliases are safe to auto-bind. Ambiguous animation matches stay unresolved. The pipeline must never hide missing authored animation by mapping a generic clip everywhere.

## 4. Audit the physical asset

```bash
npm run fighter:audit -- <fighter-id>
```

The Blender audit checks the real imported file against the declared production contract: armature, required bones, semantic sockets, material channels, and animation clip names.

For remote/cross-repository candidate assets, the separate `real-asset-pilot` workflow can validate GLB structure/skin/bones and build a browser pilot before committing the binary into a roster pack.

## 5. Animate against semantic roles

The authoritative list is `content/animation-contract.json`. It currently contains 85 semantic roles.

The roles are intentionally semantic rather than engine-specific. Examples:

- locomotion: idle, walk, initial dash, run, turn, crouch, jumps, fall, landing;
- normals: jab chain, rapid jab, tilts, smashes, aerials;
- specials: neutral/side/up/down special;
- defense: shield, parry, dodges, rolls;
- grabs: grab, hold, pummel, release, four throws;
- reactions: light/heavy/high/low hit, tumble, wall/ground bounce, downed, techs;
- ledges/walls: ledge hang/options, wall jump/cling;
- presentation: entrance, respawn, taunts, victories, defeat.

Animation binding grades remain explicit:

- `dedicated`
- `retargeted`
- `adapted`
- `procedural`
- `author_required`

`author_required` is a blocker, not a silent fallback.

## 6. Author/tune move data

The fighter pack owns ordinary character behavior:

- movement and body dimensions,
- attack timelines/hitboxes,
- landing lag/autocancel,
- jab/follow-up sequencing,
- smash charge curves,
- grabs/pummels/throws,
- move impulses/forced velocity,
- armor/invulnerability/hurtbox keyframes,
- cancel windows,
- fighter-owned entities and commands,
- palettes/material semantics.

Use:

```bash
npm run fighter:frame-data -- <fighter-id>
```

and Combat/Movement Lab telemetry to tune rather than counting frames manually.

## 7. Run the handoff report

```bash
npm run fighter:handoff -- <fighter-id>
```

The report separates blockers into:

- ENGINE
- GAMEPLAY
- MODEL/RIG
- ANIMATION
- CERTIFICATION

For a conventional fighter, **ENGINE must remain READY**. If adding a roster fighter creates an engine blocker, treat it as a reusable-system design question rather than immediately adding fighter-specific TypeScript.

## 8. Promote through lifecycle

```text
draft → playable → certified → release
```

- `draft`: incomplete content is expected.
- `playable`: all required runtime content exists; placeholder/retargeted presentation may remain where policy permits.
- `certified`: fighter passes content, gameplay, deterministic/rollback, mixed-roster, and production audits.
- `release`: only release-permitted animation grades/assets/provenance remain.

## Physical proof completed

The non-canon `riven-real` pilot from `mikeylambo/witch-hunter-x` proved the physical model path against a genuine SLU rigged character asset:

- GLB v2
- 4,519,372 bytes
- SHA-256 `3bb70f428f06a61c1257ab27d554568d12c9a39262abac1b291c5287ccecde3f`
- 165 nodes
- 1 mesh
- 1 skin
- required Mixamo core bones verified
- material `mat0`
- one source animation clip: `mixamo.com`

The conservative worklist correctly reported **0/85 safely auto-bindable** and **85/85 requiring authored/retargeted animation**. That result is not a pipeline failure; it proves the pipeline distinguishes a valid rigged model from an animation-complete roster fighter.

The real-asset workflow also proved an ephemeral import of that GLB into a fighter pack, conversion to `mixamo-humanoid-v1`, SHA/provenance/socket generation, fighter-pack validation, rig-profile validation, and production Asset Pilot Lab build.

## Production rule from this point

For normal roster characters, the recurring human/art workload should now be:

**model → rig → animate/retarget → author character data → tune → certify**

—not rebuilding platform-fighter infrastructure.
