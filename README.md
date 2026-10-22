# BambuPresetConverter

Copies your Bambu Studio filament presets to other Bambu printers (e.g. X2D -> A1, P1S, H2D). **Nozzle size is never changed.**

## Use
1. Open `index.html` in a browser (works offline).
2. Drop in any of:
   - a `.3mf` project (filament presets are pulled out of it),
   - preset `.json` files from `%APPDATA%\BambuStudio\user\<id>\filament`,
   - a `.bbsflmt` bundle (File > Export > Export Preset Bundle).
3. Untick presets you don't want, tick target printers, click **Convert**, download.
4. In Bambu Studio: File > Import > Import Configs, pick the `.json` (unzip first if you got a `.zip`).

## After a Bambu Studio update
Bambu adds printers and renames base presets. Refresh the snapshot the page uses:
```
powershell -ExecutionPolicy Bypass -File update-profiles.ps1
```
It reads `C:\Program Files\Bambu Studio\resources\profiles\BBL` and rewrites `profiles.js` (~45 s). The page footer shows the snapshot version.

## How it works
- Your preset only stores what you changed from a Bambu base preset (`inherits`).
- For the target printer, it finds Bambu's base preset of the same family (e.g. "Generic TPU") that supports that printer **at the same nozzle size**, and re-bases your changes onto it.
- Dual-extruder printers (X2D, H2D...) store some settings once per extruder type. Values are matched by extruder type (e.g. "Direct Drive Standard"); types the source didn't have use Bambu's defaults (noted in the table).
- Copies apply only to nozzle sizes the source applied to. If Bambu's base covers more sizes, the copy gets an explicit `compatible_printers` lock. A final check aborts if any copy would reach another nozzle size.

## Limits
- Re-check flow ratio, pressure advance and max volumetric speed on the new printer; they're copied as-is.
- From a `.3mf`, per-extruder values the source never changed are copied as the source printer's defaults.
- Not yet verified: that Bambu Studio honours the `compatible_printers` lock on imported user presets. Check after importing that the copy doesn't show up for other nozzle sizes.

## Files
- `index.html`: the page. `converter.js`: logic. `profiles.js`: generated snapshot. `update-profiles.ps1`: makes the snapshot.
- `tests/test.html`: tests using real presets in `tests/fixtures.js`; every line should read PASS. Open it from a local web server or a normal browser (the relative scripts must load).
