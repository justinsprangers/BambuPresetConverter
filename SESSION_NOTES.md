# BambuPresetConverter: session notes

## Status
v4: filament + process presets from .json, .3mf, .bbsflmt, or a whole folder. Settings preview per copy, single-file download (.bbsflmt / .zip). 41 tests pass (brute force: 134 copies, all nozzle-safe). Ran all 148 files in the user's Bambu user folder: 486 copies, no safety stops.
User confirmed a v2 filament import into Bambu Studio worked.

## Next steps
- Import a converted process preset and a .bbsflmt/.zip bundle in Bambu Studio; confirm both load.
- Possible: support standalone custom presets (`filament/base/*.json`, no `inherits`, full settings + explicit compatible_printers). The user has ~30 of these.
- Idea offered, not built: family fallback (e.g. "Bambu TPU 95A HF" -> "Generic TPU").

## Decisions & gotchas
- Match bases by compatible_printers + same family, never by name pattern (Bambu names are inconsistent).
- User presets are diffs over `inherits`; "nil" in a per-variant array = use base value. Process ids are a string (`print_settings_id`), filament ids an array.
- `print_extruder_id` etc. describe the source printer's extruder layout; never copied.
- .3mf: `inherits_group[0]`/`different_settings_to_system[0]` = process, `[i+1]` = filament i; `filament_self_index` maps per-variant slots. .3mf arrays are full, so values equal to the source base default (snapshot `d`) become "nil".
- Bambu import (PresetBundle::import_presets): reads every file in .bbsflmt/.bbscfg/.zip by basename, ignores bundle_structure.json, picks type from *_settings_id, version must parse as semver (we strip leading zeros).
- H2D variants repeat per extruder (DD Standard twice); values map by variant name.
- Name suffix: Bambu's "@BBL XX" only if the base is specific to the target; else "@BBL <printer>".

## Log
2026-10-22: v4 settings preview, single-file bundle output, folder input, skip non-Bambu/printer presets
2026-10-22: v3 process presets, default stripping, select all, remembered targets
2026-10-22: v2 rebuild on Bambu profile snapshot, .3mf input, extruder-variant mapping
2026-10-22: v1 initial build (name-based; replaced)
