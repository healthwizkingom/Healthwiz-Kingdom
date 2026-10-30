# Booth trailer (30-second loop)

`trailer/index.html` is a stand-alone 1920 x 1080 showcase that loops for a screen at an exhibition booth. It is not
part of the app: it is not in `index.html`, `sw.js` or the standalone build, and it changes no app code.

Open it from a web server at the repository root (it loads `../assets/`), for example:

    python3 -m http.server 8000      # then open http://localhost:8000/trailer/

## Files

| File | What it does |
|---|---|
| `index.html` | the seven scenes; every picture slot has an id starting with `asset-` |
| `trailer.css` | camera, scene and transition styles (clip-path unfurls and wipes, keyframes) |
| `trailer.js` | `TrailerDirector`: one requestAnimationFrame loop, the cue list, the camera, booth controls |

## Timeline

| Time | Scene | Art used |
|---|---|---|
| 0:00-0:04 | The Awakening: the orb drops and shatters, the map pins drop in, the camera dives into ST20 | CSS orb, placeholder map |
| 0:04-0:08 | The Council of Guides: three scrolls unfurl and their dialogue types out; Luna's green wind | `wiz.webp`, `luna-lab.webp` (cast), `luke-hires-1.webp` |
| 0:08-0:13 | The Ascent: Stair Details, ghost pacer, Pace & Breath, Workout chart; a heartbeat then a splash | `hall-stair.webp` |
| 0:13-0:17 | The Elixir & The Feast: the water vial fills, the food list scrolls; a sword slash | `hall-food.webp` |
| 0:17-0:23 | The Duel: the knight charges and strikes, the ogre bursts into XP coins that swirl into gold | `kn.webp`, `orc.webp` |
| 0:23-0:27 | The Final Score: the gauge counts 0 to 87, Medius nods, embers rise | `wiz.webp` |
| 0:27-0:30 | The Loop: logo and tagline; the logo turns into the orb, which leaves the top of the frame so 0:00 picks it up | `logo.webp` |

## Data shown, and where it comes from

- Staircase A (ST20): rise 0.169 m, run 0.311 m, angle 28.52 deg = atan(0.169 / 0.311), from the F21 report values the app
  already uses (`js/v6-trial.js`, `prototypes/campus-observatory/DATA_NOTES.md`).
- Foods, portions and kcal come from the app's food list (`js/hw-01-menu-data.js`); kJ = kcal x 4.184
  (260 kcal = 1088 kJ, 225 kcal = 941 kJ, 190 kcal = 795 kJ).
- Labelled as not measured: the heart-rate line ("illustrative shape"), the Health Score 87 ("Demo profile"), the
  W = mgh line ("e.g. 60 kg x 9.81 m/s^2 x 3.0 m = 1766 J") and +50 XP ("game reward").
- The campus map is a placeholder drawing. The pins use real staircase IDs, but their positions on it are illustrative. To use
  a real map, put an image inside `#asset-campus-map` (2400 x 1080).

## Controls

Space pause, F full screen, M music (`assets/audio/home-theme.mp3`), R restart, 1-7 jump to a scene.
`?t=13` starts at 13 s, `?debug` shows the timecode, `?music=1` starts the music on the first tap.

## Swapping art

Change the `background-image` of the slot in `trailer.css` (for example `.guide-luke`), or put an `<img>` inside the
`asset-` element. Cues only add and remove classes, so swapping art does not need any change to the timeline.
