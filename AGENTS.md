# HealthWiz Kingdom — coding instructions

## Project

- This is an existing static JavaScript health and wellness dashboard with a fantasy pixel-art RPG layer. Never rebuild it from scratch.
- Preserve existing health features, responsive layouts, and the pixel-inspired theme. Health tracking and clear data presentation take priority over game decoration.
- The app is a wellness tracker, not a medical device. Do not add diagnostic claims.

## Before and during changes

- Inspect the relevant files and their callers before editing. Read `README.md` and applicable guidance in `docs/`.
- Reuse existing modules, shared UI helpers, styles, and dependencies where possible. Avoid unrelated changes.
- Scripts under `js/` are classic scripts sharing a global scope; preserve their load order in `index.html`. When adding a script, also update the service worker precache in `sw.js`.
- Preserve saved-data compatibility. For schema changes, follow the migration process in `js/v6-schema.js` and add or update coverage.
- Follow `docs/PIXEL_STYLE.md` for visual changes and keep layouts usable on phones.

## Health and experiment data

- Never invent health measurements, device readings, user entries, or experimental results.
- Clearly distinguish measured, calculated, estimated, simulated, and missing data. Label estimates and show the method where appropriate; do not present game values as health measurements.
- For the F21 staircase experiment, use the latest approved Word report as the source of truth for verified results. Check changes against it; if the approved report is unavailable or a result is unclear, flag the uncertainty rather than guessing.

## Verification and reporting

- Verify affected calculations with worked examples and units. Test relevant interactions and check mobile layout for UI changes.
- Use the existing tests and `docs/TESTING.md` to choose relevant checks.
- Make only the requested changes. At completion, list every file created, changed, or deleted and the verification performed, including anything that could not be checked.
