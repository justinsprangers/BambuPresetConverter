# BambuPresetConverter

Copies your Bambu Studio **filament and process** presets to other Bambu printers (e.g. X2D -> A1, P1S, H2D). **Nozzle size is never changed.**

## Use
1. Open `index.html` in a browser (works offline).
2. Load presets: drop files or a folder on the page, or use **Choose files** / **Choose folder**. Accepted:
   - a `.3mf` project (its filament and process presets are pulled out),
   - preset `.json` files, or the whole `%APPDATA%\BambuStudio\user` folder (all your saved presets; duplicates and non-preset files are ignored),
   - a `.bbsflmt` bundle (File > Export > Export Preset Bundle).
3. Pick presets and target printers (select all / none links; your printer choice is remembered), click **Convert**.
4. Optional: open **preview** under any copy to compare your values with the copy's, setting by setting. Highlighted rows are changes the copy doesn't carry (e.g. a Bowden-only setting going to a direct-drive printer).
5. Download the single file (`.bbsflmt` for filaments only, `.zip` if processes are included). In Bambu Studio: File > Import > Import Configs, pick that file; no unzipping needed. Each preview also has a link to download that one preset as `.json`.

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
- Standalone custom presets (Bambu's `filament/base` folder, no `inherits`) and printer presets are skipped.

## Files
- `index.html`: the page. `converter.js`: logic. `profiles.js`: generated snapshot. `update-profiles.ps1`: makes the snapshot.
- `tests/test.html`: tests using real presets in `tests/fixtures.js`; every line should read PASS. Serve the folder (e.g. `python -m http.server`) and open `/tests/test.html`.


## License
AGPL-3.0 (see `LICENSE`). `profiles.js` is generated from the system presets that ship with [Bambu Studio](https://github.com/bambulab/BambuStudio), which is AGPL-3.0, so this project uses the same license.
