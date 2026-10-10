# HealthWiz Kingdom: notes for coding agents

A single-file, gamified wellness tracker (PWA). Plain JavaScript modules in `js/`, no framework, built into one
standalone HTML file by `tools/build-standalone.mjs`. Read `README.md`, `docs/ARCHITECTURE_AUDIT.md` and
`docs/PIXEL_STYLE.md` before changing screens.

## Commands

    npm install            # dev deps only: acorn, playwright
    npm test               # builds dist/ then runs every tests/*.test.mjs (Playwright, one at a time)
    node --test --test-concurrency=1 --test-timeout=90000 tests/51-exercise.test.mjs   # one file

The first Playwright run after a fresh install can time out once while the browser starts; run it again before
treating a failure as real.

## Rules

* No new runtime or npm dependencies. No emoji in the UI (`tests/30-emoji.test.mjs`).
* Images: lossless WebP, no image over 100 KB, all of `assets/img/` (subfolders included) at most 540 KB
  (`tests/24-performance.test.mjs`). Keep file names: they are listed in `sw.js` PRECACHE and embedded by the build.
* Visual style: modern pixel-art RPG, see `docs/PIXEL_STYLE.md`.
* Never skip or weaken a test to get green.

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

* The committed sprite sheets in `assets/img/exercise/` are the pixel-RPG version from commit `dad4796`; the
  anime-face sprite work after it is in the pipeline scripts but has not been packed into the sheets yet.
* `knight_hq.blend` fixes the 3D face (the cornea shell hid the iris; there were no lights or materials). Still open:
  the face is close to a realistic MakeHuman face (a stronger anime look needs sculpting), the bangs are one sheet
  rather than layered strands, and the bracer ends and boot shafts clip through the coat and trousers.
* Open question for the owner: the KMKU school gym's equipment list, so the props match what students can use.
