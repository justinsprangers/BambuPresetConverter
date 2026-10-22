# BambuPresetConverter: session notes

## Status
v3: filament + process presets from .json, .3mf, .bbsflmt. 30 tests pass (brute force: 121 copies, all nozzle-safe). User confirmed a v2 filament import into Bambu Studio worked.

## Next steps
- Import a converted process preset; confirm it loads and lands on the right printer/nozzle.
- Try a real `.bbsflmt` export (none tested yet).
- Ideas offered to user (not built): settings diff preview, family fallback (e.g. "Bambu TPU 95A HF" -> "Generic TPU"), .bbsflmt output, drag-in whole user folder.

## Decisions & gotchas
- Match bases by compatible_printers + same family, never by name pattern (Bambu names are inconsistent).
- User presets are diffs over `inherits`; "nil" in a per-variant array = use base value.
- .3mf: `inherits_group[0]`/`different_settings_to_system[0]` = process, `[i+1]` = filament i; `filament_self_index` maps per-variant slots to filaments. .3mf arrays are full, so values equal to the source base default (snapshot `d`) become "nil".
- Process values are arrays even on single-extruder printers (`["120"]`); scalars like `line_width` stay strings.
- H2D variants repeat per extruder (DD Standard twice); values map by variant name, so both get the edit.
- Name suffix: Bambu's "@BBL XX" only if the base is specific to the target; else "@BBL <printer>".

## Log
2026-10-22: v3 process presets, default stripping, select all, remembered targets
2026-10-22: v2 rebuild on Bambu profile snapshot, .3mf input, extruder-variant mapping
2026-10-22: v1 initial build (name-based; replaced)
