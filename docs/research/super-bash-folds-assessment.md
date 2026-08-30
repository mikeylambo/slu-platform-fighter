# Super Bash Folds Assessment

Reference: `blancmathis/Super_Bash_Folds` (also published as `Swarek/Super_Bash_Folds`)
Reviewed: 2026-08-30

## Why this reference matters

Super Bash Folds is a current web platform-fighter implementation built in TypeScript/Three.js with an unusually mature content-pipeline layer. Its public documentation reports keyboard/controller input, configurable controls, CPU opponents, shields, rolls, air dodges, grabs, throws, ledges, projectiles, items, stock/timed matches, sudden death, portable fighter/stage packs, an Animation Lab, and automated content/build/performance validation.

The main value to SLU is not to replace our deterministic kernel. It is evidence and reference architecture for **production throughput**: fighter/stage pack generation, validation, animation-slot contracts, generated registries, content readiness states, provenance, and automated certification.

## Adopt as SLU requirements

### 1. Folder-is-source-of-truth fighter packs

A fighter must be addable without editing the simulation registry or central engine source. Desired SLU structure:

```text
fighters/<fighter-id>/
  fighter.json
  render.json
  moves/
  assets/
  provenance.json
```

Generated runtime registries are outputs, never hand-maintained source.

### 2. Explicit fighter lifecycle

Use at least:

- `draft` — incomplete and excluded from production rosters;
- `playable` — can run through certification but may use temporary presentation;
- `certified` — complete engine/gameplay contract passes;
- `release` — content/presentation/provenance requirements pass.

This is intentionally stricter than Super Bash Folds' draft/ready distinction because gameplay certification and release-quality content are separate concerns for SLU.

### 3. Animation contract

Every fighter must declare all required animation roles rather than silently falling back. For each role the authoring pipeline should classify the source as something equivalent to:

- dedicated/direct;
- adapted/retargeted;
- author-required/missing.

The exact number of roles is ours to determine; do not inherit Super Bash Folds' 50-slot list as a hard limit. The important principle is **an explicit complete contract that automation can validate**.

### 4. Render definition separate from gameplay definition

`FighterDefinition` remains authoritative for simulation-facing character data. A separate render/rig definition owns model, skeleton, animation mappings, palette/material channels, sockets, visual scale/orientation, and presentation-only metadata. This prevents asset-pipeline concerns from contaminating deterministic simulation data.

### 5. Pack generators and validators

Future commands should include equivalents of:

```text
fighter:new
fighter:build
fighter:check
stage:new
stage:build
stage:check
```

The commands should generate templates, schemas, registries/manifests, and certification reports.

### 6. Provenance as first-class metadata

All third-party source assets require source URL, author/attribution, license identifier/URL, transformation record, and checksums where appropriate. Generated derivatives should retain traceability to their source pack.

### 7. Generated registry model

Content registration must be derived from validated packs. Adding a normal fighter or stage must not require modifying a central switch statement, enum, or hand-authored registry.

### 8. Animation Lab / Fighter Forge convergence

Super Bash Folds validates the value of a dedicated Animation Lab. SLU should absorb this into the planned Fighter Forge rather than create two unrelated tools. Fighter Forge should eventually cover:

- animation preview and frame scrubbing;
- rig/retarget inspection;
- animation-role mapping;
- hitbox/hurtbox timelines;
- movement impulses/cancel windows;
- sockets/owned-entity spawn markers;
- palette/material channels;
- certification status and missing-role reports.

### 9. CI must validate content as well as code

`npm run verify` should eventually encompass deterministic kernel certification plus fighter/stage schema validation, generated-output freshness, asset/provenance checks, tests, and performance budgets.

## Do not adopt blindly

- Super Bash Folds' current two-player `PlayerSlot = 0 | 1` shape is below our 1–4+ participant / Squad Strike requirements.
- Its input frames use JavaScript `Set` and floating directional values; our authoritative sim needs deterministic representation suitable for rollback and future cross-platform ports.
- Its current fighter schema exposes only a relatively small gameplay surface and four specials; our move timelines, universal contexts, owned entities, guide metadata, AI metadata, bone-driven hurtboxes, and advanced mechanics require a richer schema.
- Its standard-attack logic is still engine-shared according to its own fighter-pack documentation. Our target is stronger content/data isolation so normal move authoring does not require kernel edits.
- Its engine implementation is a large application-level TypeScript module; our `sim/` remains a smaller headless deterministic kernel with presentation and content tooling outside it.
- Do not import its roster/assets wholesale. Asset licenses and provenance remain per-asset concerns even though the repository code is MIT.

## Legal/use status

Repository code is MIT-licensed as of review. Code reuse is permitted subject to the MIT notice/conditions. Asset rights are separately tracked by the upstream project and must be evaluated individually before reuse.

For SLU, prefer translating the architecture into our contracts rather than copying large implementation sections unless a specific MIT component is clearly valuable and attribution is retained.

## Immediate effect on roadmap

K0 deterministic certification remains unchanged.

Before the first real fighter, add a **Content Pack Foundation** milestone:

1. machine-readable FighterDefinition schema;
2. machine-readable RenderDefinition schema;
3. StageDefinition schema;
4. generated registries;
5. fighter/stage scaffold commands;
6. lifecycle status validation;
7. animation-role completeness report;
8. provenance schema;
9. pack certification runner.

This should be developed alongside K1/K2 rather than deferred until roster production begins.
