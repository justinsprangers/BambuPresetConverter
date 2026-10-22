# BambuPresetConverter: session notes

## Status
Built and unit-tested in the browser (all pass). Not yet tried on a real Bambu Studio export or import.

## Next steps
- Get a real `.bbsflmt` export, confirm layout (`bundle_structure.json`?), confirm import works.
- Confirm printer codes/nozzle lists (esp. H2D/H2S naming) against Bambu Studio.

## Decisions & gotchas
- Copies are additive; originals kept.
- Dropping `setting_id` on copies is a guess (avoids cloud ID clash); revisit if import misbehaves.
- Tests need a served/real-file context; the Browser pane renders file:// as data: so relative scripts fail there.

## Log
2026-10-22: initial build (converter.js, index.html, test.html, README)
