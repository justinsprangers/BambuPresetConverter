# BambuPresetConverter: rules
- Standalone offline tool: `index.html` + `converter.js`, no dependencies, no build step.
- Hard rule: never change nozzle size when retargeting a printer. Keep the nozzle check in `convertPreset`.
- Keep `README.md` and `test.html` in sync with behavior changes.
