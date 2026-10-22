# BambuPresetConverter

Copies Bambu Studio filament presets from one Bambu printer to others (e.g. X1C -> P1S, A1 mini), **without ever changing nozzle size**.

## Use
1. In Bambu Studio export your filament presets (File > Export > Export Preset Bundle, or Export Configs). 
2. Open `index.html` in a browser (works offline).
3. Drop in the `.bbsflmt` bundle (or a `.zip` of preset `.json` files, or loose `.json` files).
4. Tick the target printers, click **Convert**, review the table, download.
5. In Bambu Studio: File > Import > Import Configs (or Import Preset Bundle).

## What it changes
In each copy: `name`, `inherits`, `filament_settings_id` and `compatible_printers` get the new printer; `setting_id` is dropped. Originals are kept untouched.

## Nozzle safety
- Only the printer part of each tag changes; the nozzle text ("0.2 nozzle", or none = 0.4) is copied verbatim.
- If the target has no such nozzle, that copy is skipped.
- A built-in check aborts the conversion if the set of nozzle sizes in a copy differs from its source.

## Limits
- Printer-specific values (flow ratio, pressure advance, max volumetric speed) are copied as-is. Re-tune on the new printer.
- Only Bambu printers listed in `converter.js` (`PRINTERS`) are recognised; add new ones there.
- Not yet tested against a real Bambu Studio export. File layout inside `.bbsflmt` is assumed from forum reports.

## Tests
Open `test.html` in a browser served from this folder (needs `converter.js` beside it); all lines should read PASS.
