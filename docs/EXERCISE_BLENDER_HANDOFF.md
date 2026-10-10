# Training Hall art: Blender handoff

The Exercise page (`js/v6-exercise.js`) is finished and tested. Its art comes from a stand-in, `tools/art/make_exercise.py`
(a small Python ray-marcher), because the Blender connector could not be reached from the session that built the page.
This note is for the next session, where Blender is connected. Only the two sprite sheets and the tap map change; the page
code reads them by position, so it needs no edits as long as the layout below is kept.

## Start here (Blender connector steps)

1. `get_blendfile_summary_path_info` and `get_objects_summary`. Stop and report if Blender is not reachable.
2. Look up unfamiliar API with `search_api_docs` / `get_python_api_docs` before scripting.
3. Build the knight in a new .blend with `execute_blender_code`. Colours of `assets/img/kn.webp`: maroon-brown cape,
   steel-grey armour, gold trim (collar, belt buckle, elbows, knees), blue shield with gold rim, brown hair and boots.
   The stand-in's proportions are a good reference: `knight()` in `tools/art/make_exercise.py`.
4. `get_screenshot_of_area_as_image` on the 3D viewport; fix the pose.
5. Keyframe each move with 2 keyframes (start, end) using `execute_blender_code`; render the middle frame as well.
6. `device_request_folder_access` for a folder inside the repo, then `render_viewport_to_path` one frame at a time,
   about 96 px tall, orthographic camera, no anti-aliasing (Workbench or EEVEE with filter size 0, flat or toon shading).
7. Quantise every frame to the palette below with no dithering or smoothing, and pack the sheets (layout below).
   Reuse `PAL`, `outline()`, `to_img()`, `check_palette()` and `save()` from `tools/art/make_exercise.py`.
8. Render the muscle map with the same settings: the knight plus one flat-colour mask per muscle group.
9. Report the .blend path, the sheet paths and any step that failed.

## What the page expects

### `assets/img/exercise/moves.webp`: 384 × 2112, lossless WebP, transparent background

One row per move, 96 px tall, in this order (row index = `MOVES[id][1]` in `js/v6-exercise.js`). Each row has 4 frames of
96 × 96: **start, middle, end, middle**. The page plays them with CSS `steps(4)` at 1.6 s per loop, and shows frame 1 still
with reduced motion. Keep the knight in the same place across a row's frames.

| row | id | move | camera in the stand-in |
|---|---|---|---|
| 0 | shrug | dumbbell shrug | ¾ front |
| 1 | row_sup | dumbbell row, palms forward (supinated) | side |
| 2 | row_neu | dumbbell row, palms in (neutral) | side |
| 3 | back_raise | back raise on a 45° bench | side |
| 4 | press | shoulder press | front |
| 5 | front_raise | front raise | ¾ side |
| 6 | lat_raise | lateral raise | front |
| 7 | rear_fly | dumbbell rear delt fly (bent over) | ¾ front |
| 8 | curl | bicep curl | ¾ side |
| 9 | hammer | hammer curl | ¾ side |
| 10 | wrist_ext | dumbbell wrist extension (seated, palms down) | ¾ side |
| 11 | wrist_curl | dumbbell wrist curl (seated, palms up) | ¾ side |
| 12 | pushdown | triceps pushdown at a cable | side |
| 13 | oh_ext | overhead dumbbell extension | side |
| 14 | skull | skullcrusher on a flat bench | side |
| 15 | incline | incline dumbbell press | side |
| 16 | flat | flat dumbbell press | side |
| 17 | dips | dips on parallel bars | ¾ side |
| 18 | squat | squat with dumbbells | side |
| 19 | leg_ext | leg extension machine | side |
| 20 | leg_curl | lying leg curl | side |
| 21 | calf | calf raise on a step | side |

### `assets/img/exercise/muscles.webp`: 128 × 1920, lossless WebP

Two columns of 64 × 96: column 0 **front** view, column 1 **back** view, the knight in a relaxed A-pose, **no cape and
no shield** (so the back muscles show). Row 0 is the knight; row 1 + i is the mask of muscle i, in this order:

`traps, upperback, lats, erectors, frontdelt, sidedelt, reardelt, biceps, brachialis, brachioradialis, forearmext,
forearmflex, triceps, upperchest, midchest, lowerchest, quads, hamstrings, calves`

Masks are mana-teal on transparent, using these 3 tones only (shade by the base render's brightness): `#1aa596`,
`#3ee6d0`, `#aafff0`. The page lays a mask over row 0 to light a muscle, and at 45% opacity for the muscles that work with it.

### Tap map (`MAP-DATA` block in `js/v6-exercise.js`)

The page picks the muscle under the finger from a run-length-encoded 64 × 96 grid per view (`'.'` = none, `'a' + index`
= muscle). `write_js()` in `tools/art/make_exercise.py` rewrites the block. From Blender, build the same grid from the mask
renders (a pixel is muscle i where mask i is opaque) and pass it to `rle()` and `write_js()`.

### Palette (28 colours, from `PAL` in `tools/art/make_exercise.py`)

ink `#1b1626` · steel `#2e313b #5d5f61 #828c91 #bcc2c5 #dfded8` · white `#f8f9f3` · iron `#38444e` ·
skin `#6e3e2e #935c45 #c5a68d #e3c4a6` · hair `#29121b #5b3932 #8a5434 #b07a4a` ·
cape `#3e191e #7b181c #99392e #c0503a` · gold `#6b4a12 #a8781e #d9a62e #f2d26a` · blue `#14284a #3f6fae #8fb4e0` ·
leather `#3a2418`. Add a 1-pixel ink outline around the silhouette (`outline()`).

## Limits the tests check

* `tests/24-performance.test.mjs`: lossless WebP (VP8L), no image over 100 KB, all of `assets/img/` (subfolders included)
  ≤ 540 KB. The stand-in sheets are about 23 KB together; there is about 10 KB of room, so keep the sheets near that size.
* `tests/51-exercise.test.mjs`: the sheet sizes above (384 × 2112 and 128 × 1920), every muscle has map pixels, one
  sprite row per move.
* Keep the file names: they are listed in `sw.js` PRECACHE and embedded by `tools/build-standalone.mjs`.

## Still open

* The KMKU equipment list: which dumbbells, benches, cable and machines the school gym actually has. The props in the
  sprites (flat and incline bench, hyperextension bench, cable, dip bars, leg extension, leg curl bench, step) should match
  it, and any move without equipment there may need a swap.
