# Decision Log

## 2026-08-30 — Foundation decisions

### D001 — Fighter presentation dimensionality
**Decision:** 3D models presented on a 2D gameplay plane.

**Consequences:**
- Shared humanoid rig and animation retargeting are default production assumptions.
- Fighter-specific rigs remain supported for non-humanoid designs.
- Hurtbox anchors may derive from bones; attack hitboxes remain authored gameplay data.
- Palette customization should use semantic material channels.

### D002 — Engine / ship path
**Decision:** Web laboratory first; final production/shipping engine deliberately deferred.

**Reason:** Browser-based iteration is currently the preferred rapid design/development surface. The project will avoid double-build risk through a pure, engine-agnostic simulation core and golden deterministic certification vectors.

**Revisit gate:** Before the Product Frame becomes production-runtime dependent and no later than the point at which first-real-fighter throughput and console/Steam production requirements can be measured with evidence.

### D003 — Simulation authority
**Decision:** Fixed 60 Hz, deterministic, custom kinematic platform-fighter simulation.

General-purpose physics middleware has no authority over fighter movement, combat, knockback, stage collision, ledges, or match outcome. Physics middleware may later be used for non-authoritative presentation/environmental effects.

### D004 — Deterministic port contract
**Decision:** Authoritative simulation must use an explicitly owned deterministic numeric/math strategy, stable iteration order, seeded RNG, snapshots, restore, and per-frame hashes.

Golden certification runs record input streams + seeds + hashes. A later engine port must reproduce certified vectors rather than be manually re-tuned to approximate the reference implementation.

### D005 — Reference hygiene
**Decision:**
- Decompiled Nintendo code is excluded from the shipping repository.
- PFE Core is a behavioral systems/checklist reference unless its license explicitly permits a specific use.
- Claude Bros contributes architectural patterns only; no copied implementation.
- Public frame-data facts are research/statistical inputs rather than source-code dependencies.

### D006 — Scope semantics
**Decision:** Kernel, certification, vertical-slice, public-test, 1.0, Steam/PC, and console scope are distinct terms.

The small roster/stage counts used during certification do not establish or imply the flagship's intended release scope. Release content targets will be informed by measured production throughput after the first certified real fighter and stage-production pipeline.

### D007 — Canonical coordination
**Decision:** Repository specs + certification tests are canonical across GPT, Claude, Gemini, humans, and other development agents. Chat logs are context, not specification authority.

### D008 — Havok / middleware status
**Decision:** No physics middleware is required by the kernel. Havok is neither required nor prohibited for later non-authoritative environmental/presentation use. Engine-native physics choices are deferred with the production engine decision.
