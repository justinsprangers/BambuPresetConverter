# BambuPresetConverter: rules
- Standalone offline tool: `index.html` + `converter.js` + generated `profiles.js`. No dependencies, no build step.
- Hard rule: never change nozzle size when retargeting a printer. Keep `checkNozzles` and the brute-force test.
- Bambu's system profiles are ground truth; never hard-code printer or base-preset names. Regenerate with `update-profiles.ps1`.
- Keep `README.md` and `tests/test.html` in sync with behavior changes.
- Testing in the Claude Browser pane: file:// pages load as data: URLs, so relative scripts fail. Inline them into a temp `_combined_*.html` (gitignored) and delete it after.
