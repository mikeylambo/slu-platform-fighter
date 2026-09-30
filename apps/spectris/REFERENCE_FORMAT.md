# Independent Brawl reference

Michael supplied the public **Super Smash Bros. Brawl frame data directory 2.0**, Meta Knight tab (`gid=481003737`). The raw CSV is committed at `reference/brawl-mk-source.csv`. `node scripts/spectris-import-reference.mjs` produces `reference/brawl-mk.json`, schema version 2, with attribution, retrieval date, CSV checksum, original strings, source row numbers, 54 move records, and 12 attributes.

Blank cells remain unknown or not applicable, never zero. Asterisks and question marks remain visible. CSV does not include cell comments. Source labels such as “Messed Up air” are retained, with explicit mappings to Spectris move names in the comparison script. This is community frame data, not a new independent measurement.

After compiling the game, `npm run spectris:reference` validates and compares the source with all 32 authored move entries and nine movement attributes. It writes `REFERENCE_COMPARISON.md` and `proofs/reference-comparison.json`. This report is reproducible and does not modify source or game tuning.

`npm run spectris:check` still exits 2 at the feel gate: the missing-source issue is resolved, but accepted role budgets and controller feel are not established by a data comparison. No implementation-derived ranges have been introduced to force a pass. Source timings and Spectris design choices must remain separate.

Full glide physics, ambiguous source footnotes, and controller movement review remain open. The current build is still a foundation/feel build.
