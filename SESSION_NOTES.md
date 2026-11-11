# BambuPresetConverter: session notes

## Status
v5: filament + process presets from .json, .3mf, .bbsflmt, or a whole folder. Rename copies before download, settings preview, single-file download. Custom filaments (standalone or .3mf custom base) convert via Generic-of-type. Bowden values estimated on X2D. 49 tests pass (brute force: 134 copies, all nozzle-safe). User's full user folder + PEBall.3mf: 936 copies, no safety stops.
User confirmed a v2 filament import into Bambu Studio worked.
Own git repo (split out of C:\Claude with history), AGPL-3.0. Public repo: no personal info in these notes.

## Next steps
- Import a converted custom filament and an X2D copy with estimated Bowden values in Bambu Studio; confirm they load and print.
- Possible: user presets that inherit a custom filament (2 skipped); resolve the chain when both are loaded.
- Idea offered, not built: family fallback (e.g. "Bambu TPU 95A HF" -> "Generic TPU").

## Decisions & gotchas
- Match bases by compatible_printers + same family, never by name pattern (Bambu names are inconsistent).
- User presets are diffs over `inherits`; "nil" in a per-variant array = use base value. Process ids are a string (`print_settings_id`), filament ids an array.
- `print_extruder_id` etc. describe the source printer's extruder layout; never copied.
- .3mf: `inherits_group[0]`/`different_settings_to_system[0]` = process, `[i+1]` = filament i; `filament_self_index` maps per-variant slots. .3mf arrays are full, so values equal to the source base default (snapshot `d`) become "nil".
- Bambu import (PresetBundle::import_presets): reads every file in .bbsflmt/.bbscfg/.zip by basename, ignores bundle_structure.json, picks type from *_settings_id, version must parse as semver (we strip leading zeros).
- H2D variants repeat per extruder (DD Standard twice); values map by variant name.
- Name suffix: Bambu's "@BBL XX" only if the base is specific to the target; else "@BBL <printer>".
- Custom filaments ("Create filament", vendor presets in a .3mf) are not in any Bambu install. Re-based on the Generic (vendor field) preset with the same `filament_type` (snapshot `t`) covering the source printer. Only keys that Generic sets AND whose value differs are copied (snapshot `g` = indices into `gvals`, aligned with `filamentKeys`). Source printer for .3mf = printer_model + nozzle_diameter.
- Bambu import (PresetBundle::import_json_presets) silently skips a file if any value fails to parse, e.g. "" in an int/float option (PEBall.3mf had `filament_dev_ams_drying_ams_limitations` and `volumetric_speed_coefficients` = ""). Never write blank values. Its logs are encrypted, and the CLI (`bambu-studio.exe --slice`) returned -5 even for good presets, so it's no use for testing.
- Editing files in %APPDATA%\BambuStudio\user is fragile: on startup, cloud sync restores deleted presets and overwrites local edits when the cloud's updated_time is newer. Delete in Studio; edit with Studio closed and updated_time above the cloud's.
- Bowden estimate (only when source has no Bowden variant) is a CAP, not a ratio (user pushed back on linear scaling; confirmed): Bambu blog says aux max 200 mm/s, 1000 mm/s^2, much higher K; profiles show one fixed Bowden value per key (outer wall always 50 for DD 60..500). speed/accel/volumetric keys -> min(DD value, Bambu Bowden value); pressure_advance/flow_ratio never copied (calibrate); others copied only if Bambu's defaults are equal. Single pressure_advance shared by both nozzles -> warning note.
- Browser caches profiles.js; after regenerating, fetch with cache:'reload' before testing.
- License is AGPL-3.0 because profiles.js is derived from Bambu Studio's AGPL presets.

## Log
2026-11-11: custom filaments copy only real differences from Generic, never blanks (PEBA import fix; untested in Studio); 52 tests pass
2026-11-11: Bowden estimate changed from ratio scaling to Bambu's caps; flow/PA not copied; 51 tests pass
2026-11-11: v5 custom filaments, Bowden estimates, snapshot adds filament type + key list; 49 tests pass
2026-11-11: rename copies before download (renameFile); clear skip for .3mf custom bases
2026-10-22: split into its own repo (C:\Claude ignores it), added AGPL-3.0 license
2026-10-22: v4 settings preview, single-file bundle output, folder input, skip non-Bambu/printer presets
2026-10-22: v3 process presets, default stripping, select all, remembered targets
2026-10-22: v2 rebuild on Bambu profile snapshot, .3mf input, extruder-variant mapping
2026-10-22: v1 initial build (name-based; replaced)
