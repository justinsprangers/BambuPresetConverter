# BambuPresetConverter: rules
- Standalone offline tool: `index.html` + `converter.js` + generated `profiles.js`. No dependencies, no build step.
- Hard rule: never change nozzle size when retargeting a printer. Keep `checkNozzles` and the brute-force test.
- Bambu's system profiles are ground truth; never hard-code printer or base-preset names. Regenerate with `update-profiles.ps1`.
- Keep `README.md` and `tests/test.html` in sync with behavior changes.
- Testing: `preview_start` the `bambupresets` server (port 8804, in `C:\Claude\.claude\launch.json`), open `/tests/test.html`. file:// pages don't load relative scripts in the Browser pane.
