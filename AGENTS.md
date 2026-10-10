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

## Commands

    npm install            # dev deps only: acorn, playwright
    npm test               # builds dist/ then runs every tests/*.test.mjs (Playwright, one at a time)
    node --test --test-concurrency=1 --test-timeout=90000 tests/51-exercise.test.mjs   # one file

The first Playwright run after a fresh install can time out once while the browser starts; run it again before
treating a failure as real.

## Asset and build rules

- No new runtime or npm dependencies. No emoji in the UI (`tests/30-emoji.test.mjs`).
- Images: lossless WebP, no image over 100 KB, all of `assets/img/` (subfolders included) at most 540 KB
  (`tests/24-performance.test.mjs`). Keep file names: they are listed in `sw.js` PRECACHE and embedded by the build.
- Visual style: modern pixel-art RPG, see `docs/PIXEL_STYLE.md`.
- Never skip or weaken a test to get green.

## Training Hall (exercise page) art

The page is `js/v6-exercise.js`. Its art is two sprite sheets plus a tap map; layout and limits are in
`docs/EXERCISE_BLENDER_HANDOFF.md` (`moves.webp` 384 x 2112, `muscles.webp` 128 x 1920, 22 moves, 19 muscle masks,
28-colour palette). Only the `MAP-DATA` block of `js/v6-exercise.js` may be rewritten by the art tools.

The knight is a real 3D model, built headless in Blender 4.2 LTS with the MPFB 2 add-on (MakeHuman CC0 assets):

| File | What it is |
|---|---|
| `tools/art/make_exercise_blender.py` | driver and 2D packer: exports poses, runs Blender, shades and packs the sheets |
| `tools/art/blender_exercise_render.py` | Blender side of the sprite pipeline: builds and poses the knight, renders data passes |
| `tools/art/exercise_knight.blend` | saved sprite scene (one collection per move, map pose at frame 900) |
| `tools/art/blender_knight_portrait.py` | studio render of the same model: real eyes, materials, lights, Cycles |
| `tools/art/knight_hq.blend` | saved studio scene |
| `tools/art/make_exercise.py` | the original stand-in ray-marcher; `PAL`, `outline()`, `rle()`, `write_js()` |

Run (Blender with MPFB installed as the `user_default` extension):

    BLENDER=/path/to/blender python3 tools/art/make_exercise_blender.py          # sprites; --no-blender repacks
    blender -b --addons bl_ext.user_default.mpfb tools/art/exercise_knight.blend \
        -P tools/art/blender_knight_portrait.py -- OUT_DIR                        # studio renders

Character identity: original HealthWiz knight (not a copy of any game character). Auburn hair with long forehead
bangs and ear-length sides, amber eyes, silver-white armour with gold trim, dark coat, red cape, blue gem.

State of the art work:

- The committed sprite sheets in `assets/img/exercise/` are the pixel-RPG version from commit `dad4796`; the
  anime-face sprite work after it is in the pipeline scripts but has not been packed into the sheets yet.
- `knight_hq.blend` (studio scene only) has the 3D face fixes: the cornea shell no longer hides the iris, real lights
  and materials, an anime-fantasy face shape from MakeHuman targets (larger eyes set wider, small nose and mouth,
  smooth narrow jaw, level brows), bangs cut into layered locks, and the cloth hidden under the bracers and boot
  shafts so nothing clips. Waiting on the owner's approval of this look before the sprite sheets are rebuilt from
  it. Still open: the face is shaped with targets, not sculpted, and the lips rest slightly parted.
- Open question for the owner: the KMKU school gym's equipment list, so the props match what students can use.
