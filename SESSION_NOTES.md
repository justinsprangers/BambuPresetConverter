# BambuPresetConverter: session notes

## Status
v2 works on real data: user preset .json, .3mf projects, .bbsflmt bundles. 20 tests pass (incl. brute force of every fixture to every printer, 69 copies, all nozzle-safe). Not yet imported into Bambu Studio.

## Next steps
- Import a converted preset in Bambu Studio; confirm it loads and the `compatible_printers` lock hides it on other nozzle sizes.
- Try a real `.bbsflmt` export (none tested yet).

## Decisions & gotchas
- v1 matched on names ("@BBL X1C 0.2 nozzle"); wrong. Bambu base names are inconsistent (P1S TPU = "Generic TPU"; X2D has "@BBL X2D 0.4 nozzle" for 0.4 and "@BBL X2D" for 0.6/0.8). Match by compatible_printers instead.
- User presets are diffs over `inherits`; "nil" in a per-variant array = use base value.
- .3mf: `inherits_group[i+1]` = base, `different_settings_to_system[i+1]` = changed keys, `filament_self_index` maps per-variant array slots to filaments.
- Copy names: stem + base's "@..." suffix, else "@BBL <printer>".

## Log
2026-10-22: v2 rebuild on Bambu profile snapshot, .3mf input, extruder-variant mapping
2026-10-22: v1 initial build (name-based; replaced)
