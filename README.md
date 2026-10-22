# BambuPresetConverter

Copies your Bambu Studio **filament and process** presets to other Bambu printers (e.g. X2D -> A1, P1S, H2D). **Nozzle size is never changed.**

## Use
1. Open `index.html` in a browser (works offline).
2. Drop in any of:
   - a `.3mf` project (its filament and process presets are pulled out),
   - preset `.json` files from `%APPDATA%\BambuStudio\user\<id>\filament` or `\process`,
   - a `.bbsflmt` bundle (File > Export > Export Preset Bundle).
3. Pick presets and target printers (select all / none links; your printer choice is remembered), click **Convert**, download.
4. In Bambu Studio: File > Import > Import Configs, pick the `.json` files (unzip first if you got a `.zip`).

## After a Bambu Studio update
Bambu adds printers and renames base presets. Refresh the snapshot the page uses:
```
powershell -ExecutionPolicy Bypass -File update-profiles.ps1
```
It reads `C:\Program Files\Bambu Studio\resources\profiles\BBL` and rewrites `profiles.js` (~1 min). The page footer shows the snapshot version.

## How it works
- Your preset only stores what you changed from a Bambu base preset (`inherits`).
- For the target printer, it finds Bambu's base preset of the same family ("Generic TPU", "0.20mm Standard") that supports that printer **at the same nozzle size**, and re-bases your changes onto it.
- Dual-extruder printers (X2D, H2D...) store some settings once per extruder type. Values are matched by extruder type (e.g. "Direct Drive Standard"). Values you never changed (equal to Bambu's default) are dropped so the target's own defaults apply.
- Copies apply only to nozzle sizes the source applied to. If Bambu's base covers more sizes or printers, the copy gets an explicit `compatible_printers` lock. A final check aborts if any copy would reach another nozzle size.

## Limits
- Re-check flow ratio, pressure advance, max volumetric speed and speeds/accelerations on the new printer; they're copied as-is.
- If Bambu has no base of the same family for the target (e.g. a printer-specific profile), that copy is skipped.
- Process `.json` import is tested only from `.3mf` data; no saved user process file was available to check the format.

## Files
- `index.html`: the page. `converter.js`: logic. `profiles.js`: generated snapshot. `update-profiles.ps1`: makes the snapshot.
- `tests/test.html`: tests using real presets in `tests/fixtures.js`; every line should read PASS. Serve the folder (e.g. `python -m http.server`) and open `/tests/test.html`.
