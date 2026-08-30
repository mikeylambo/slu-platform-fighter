# Real Fighter Production Handoff

This is the recurring roster-production loop after the platform-fighter foundation is stable.

## 1. Seed the fighter pack

```bash
npm run fighter:seed -- <fighter-id> "Display Name"
```

For a batch roster, maintain the roster manifest and use `npm run roster:seed`.

The seed creates the standard gameplay envelope, explicit five-aerial landing surfaces, semantic palette channels, render pack, rig profile and all 85 animation-role slots.

## 2. Supply the character asset

Place the rigged runtime model at:

```text
fighters/<fighter-id>/assets/model.glb
```

Default route: `slu-humanoid-v1`. An unusual body may declare another validated profile in `content/rig-profiles/`; adding a custom rig profile is content/tooling work, not a new fighter simulation.

Root motion is presentation-disabled. Gameplay displacement belongs in authored fighter timelines (`velocity`, `impulse`, etc.).

## 3. Bind and audit animation

```bash
npm run fighter:autobind -- <fighter-id> --apply
npm run fighter:audit -- <fighter-id>
npm run roster:asset-audit -- <fighter-id>
```

Autobind applies only safe exact/alias mappings. Ambiguous clips remain unresolved. The Blender audit verifies armature, declared rig profile expectations, sockets/materials and actual action names.

## 4. Author/tune gameplay content

Edit only the fighter pack and owned-entity data for conventional character behavior. The standard authored envelope already supports normals, smashes, aerials, specials, grabs/pummels/throws, movement physics, recovery displacement, invulnerability windows, fighter-owned entities/projectiles and aerial landing behavior.

Use:

```bash
npm run fighter:frame-data -- <fighter-id>
npm run lab:movement
npm run lab:combat
```

Generic combat policies (armor/parry/cancels/modifiers), items and hazards are parameterized and must receive explicit ruleset/content values rather than hidden engine defaults.

## 5. Inspect readiness

```bash
npm run fighter:handoff -- <fighter-id>
npm run roster:report
```

The handoff report separates ENGINE, GAMEPLAY, MODEL/RIG, ANIMATION and CERTIFICATION blockers. A conventional fighter is not allowed to invent a fighter-specific engine blocker: if one appears, generalize the missing universal feature before continuing roster production.

## 6. Certify

```bash
npm run verify
```

Before publication, raise lifecycle status deliberately:

`draft -> playable -> certified -> release`

Release status must not be used to hide missing animation roles, bad provenance, invalid timeline data, malformed geometry or failed deterministic certification.

## Human/AI responsibility split

The human production loop should now concentrate on character design finalization, modeling, rigging, animation direction/authoring, move design, VFX/audio direction and feel tuning. AI/tooling can scaffold packs, bind obvious clips, validate content, generate reports, exercise scenario bots and run deterministic certification.

The first real fighter through this route is the final integration proof. After that proof, remaining roster work is content production unless a genuinely new archetype exposes a missing universal mechanic.
