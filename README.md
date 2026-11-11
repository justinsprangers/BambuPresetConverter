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
5. Optional: click a copy's name in the **To** column to rename it. The new name is what Bambu Studio will show; duplicates and characters like `/` are rejected.
6. Download the single file (`.bbsflmt` for filaments only, `.zip` if processes are included). In Bambu Studio: File > Import > Import Configs, pick that file; no unzipping needed. Each preview also has a link to download that one preset as `.json`.

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
- **Bowden estimates** (X2D's auxiliary Bowden extruder, when the source had no Bowden values). Bambu treats the Bowden side as a hard limit, not a scaled-down copy: [its blog](https://blog.bambulab.com/two-extruders-one-purpose-what-is-x2d-direct-drive-extrusion-and-auxiliary-extrusion/) caps it at 200 mm/s and 1000 mm/s², and its profiles use one fixed Bowden value (e.g. outer wall always 50) whatever the direct-drive value. So:
  - speeds, accelerations and volumetric limits: your direct-drive value, **capped** at Bambu's Bowden value (your 80 outer wall becomes 50; your 40 stays 40);
  - flow ratio and pressure advance: **not copied** (Bowden's K is much higher); run Flow Dynamics and Flow Rate calibration on the aux nozzle. If your preset sets a single `pressure_advance`, it applies to both nozzles and the note warns you;
  - everything else: copied where Bambu uses the same value for both (e.g. temperatures), otherwise Bambu's Bowden default (e.g. retraction length, which is longer for Bowden).
  The copy's note says **ESTIMATED Bowden (aux nozzle) values** and lists them. Test print the aux nozzle before relying on them; tune in Bambu Studio by picking the Bowden extruder in the preset's extruder selector.
- Other extruder types the source never had (e.g. H2D's "Direct Drive TPU High Flow") keep Bambu's defaults; the note lists them.
- **Custom filaments** (made with "Create filament", e.g. `Polymaker PLA Basic @Bambu Lab P1S 0.4 nozzle`, or a vendor's preset inside a `.3mf`) aren't based on a Bambu system preset. They are re-based on Bambu's Generic preset of the same filament type (e.g. "Generic TPU") for the target, copying only the settings that differ from that Generic preset (their real tuning: vendor, temperatures, flow, speeds). Settings equal to Generic, settings Generic doesn't set, and blank values are left out; a blank value makes Bambu Studio silently skip the whole preset on import.
- Copies apply only to nozzle sizes the source applied to. If Bambu's base covers more sizes or printers, the copy gets an explicit `compatible_printers` lock. A final check aborts if any copy would reach another nozzle size.

## Limits
- Re-check flow ratio, pressure advance, max volumetric speed and speeds/accelerations on the new printer; they're copied as-is.
- If Bambu has no base of the same family for the target (e.g. a printer-specific profile), that copy is skipped.
- Printer presets are skipped. Custom filaments whose type has no Bambu Generic preset on their printer are skipped.
- Saved presets that inherit from one of your custom filaments (not from a Bambu preset) are skipped; convert the custom filament itself instead.

## Files
- `index.html`: the page. `converter.js`: logic. `profiles.js`: generated snapshot. `update-profiles.ps1`: makes the snapshot.
- `tests/test.html`: tests using real presets in `tests/fixtures.js`; every line should read PASS. Serve the folder (e.g. `python -m http.server`) and open `/tests/test.html`.


## License
AGPL-3.0 (see `LICENSE`). `profiles.js` is generated from the system presets that ship with [Bambu Studio](https://github.com/bambulab/BambuStudio), which is AGPL-3.0, so this project uses the same license.
