# Independent feel reference

The build brief names `reference/brawl-mk.json` as Michael-supplied. It was absent from the attachments and repository. No substitute data has been invented.

The cert runner accepts schema version 1 with `source` (attribution) and `budgets`. Each budget is keyed by a compiled move ID, e.g. `wings:jab`, and contains inclusive two-number ranges for `startup`, `faf`, and `landing` in frames. There must be one entry per authored move ID, including stance variants and jab follow-ups. The ranges are role budgets; they are not assertions that Spectris frame data matches Meta Knight exactly.

Adapt the importer if the supplied file uses another schema. Do not simply generate matching ranges from Spectris itself: that would make the reference check circular. Runtime validity and actual hits already have independent local checks.

Movement/glide feel also needs human controller playtesting before closing Step 2. Automated movement proofs establish behavior, not subjective feel.
