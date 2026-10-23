# Pokestop heart (Blender prototype)

A standalone 3D prototype, not wired into the app. It is not loaded by `index.html` or `sw.js`.

## Animation (240 frames at 24 fps, a 10 s seamless loop)

| Frames | What happens |
|---|---|
| 1-60 | A solid 3D pentagonal prism tumbles on all three axes inside two white dashed orbit rings. |
| 50-90 | The prism flattens and morphs into a flat Pokestop-style circle. |
| 85-105 | The white and cyan rims and the inner circle expand outward and a white heart pops in. |
| 105-217 | The heart pulses; the white orbit keeps spinning. |
| 217-241 | Everything reverses to the prism so the loop restarts cleanly. |

## Files

| File | What it is |
|---|---|
| `pokestop_heart.blend` | Blender 5.1 scene with the animation. |
| `pokestop_heart.glb` | The same model exported with the morph and spins. |
| `build_heart_pokestop.py` | Rebuilds the scene and renders preview stills. |
| `contact_sheet.png` | Frames 1, 30, 60, 80, 90, 105, 150 side by side. |

## Rebuild

    blender -b --python build_heart_pokestop.py -- <out_dir>

Only still frames were rendered and checked; the full loop was not played back or rendered to video.
