# Campus Health Observatory: prototype

A standalone test of the look and controls for a future Campus Health Observatory at Kolej MARA Kulim:

- the campus drawn from your OpenStreetMap export, with the 32 staircases from the HealthWiz stair list;
- **illustrative terrain**: the two areas you circled rise gently from the base campus (Middle Elevation, then Highest
  Elevation), so buildings, paths and staircase markers sit on raised ground at their exact coordinates;
- a **Fantasy / Realistic** switch (same data, terrain and positions; different presentation). Fantasy opens first;
- a searchable staircase list and a details panel in three groups (Location, Staircase profile, Data quality);
- an **illustrative 3D staircase preview that opens automatically** whenever a staircase is selected;
- desktop and phone layouts.

It is **separate from HealthWiz**. It does not read, change or deploy anything in the HealthWiz repository or website.
It uses no API keys, no paid services and no map tile server: everything it needs is in this folder.

## Run it

You need a small local web server, because browsers block data files on pages opened straight from the disk
(`file://`). Either of these works, from inside this folder:

```sh
# Python 3 (macOS and Linux have it; on Windows install it from python.org)
python3 -m http.server 8000

# or Node.js
npx --yes http-server -p 8000
```

Then open **http://localhost:8000** in Chrome, Edge, Firefox or Safari.

**On your phone (same Wi-Fi as the computer):** start the server with `python3 -m http.server 8000 --bind 0.0.0.0`,
find the computer's local IP address (for example `192.168.1.20`), and open `http://192.168.1.20:8000` on the phone.

The map and the 3D preview need WebGL, which every current browser has. If WebGL is off, the list and details still work.

**If the page stays blank or says the data could not be loaded:**
- Make sure the address starts with `http://localhost:8000`, not `file://`.
- On some Windows computers, Python serves `.js` files with the wrong type and the browser refuses them (the browser
  console shows "Failed to load module script … MIME type"). Use `npx --yes http-server -p 8000` instead.

## Use it

- **Mode:** the Realistic / Fantasy switch in the header. Your choice is remembered on this device.
- **Map:** drag to move, pinch or scroll to zoom, two-finger twist to rotate, two-finger drag up or down to tilt.
  Buttons on the right: zoom, north up, 2D/3D tilt, terrain on/off, raised buildings on/off, whole campus.
- **Staircases:** tap a marker (hover or keyboard focus shows its name), or search and filter the list. Markers close
  together merge into a numbered bubble: tap it to zoom in. A marker with ×2 or ×3 stands for staircases that store
  the same coordinate; tap it, then pick one.
- **Selecting a staircase** (marker, list, or a link in the details) highlights it on the map, fills the details and
  **opens its 3D preview**: a side panel on a wide screen, the top of the bottom sheet on a phone. Picking another
  staircase updates both. The bar at the top of the map names the selection, has **Campus view** to see everything
  again, and **×** to clear the selection. Closing the preview keeps the selection ("Show 3D preview" reopens it).
- **3D preview:** drag to rotate, pinch or scroll to zoom, or use the buttons (turn left/right, zoom in/out, Reset,
  Spin). Pick a demonstration shape (straight, with landing, L-turn, U-turn). Escape closes it.
- **?** in the header: where every piece of data comes from, what each label means, and **Reduce motion**.
  The system "reduce motion" setting is also respected.

## Files

```
index.html                  the page
css/app.css                 all styles; the two modes are two sets of colour tokens plus decoration
js/app.js                   data loading, list, filters, details, mode switch, panels
js/map.js                   MapLibre map from the OSM data: layers, both styles, markers, clusters, labels, camera
js/terrain.js               the illustrative terrain: a height map generated in the browser from data/elevation-zones.geojson
js/textures.js              fantasy pixel textures and sprites (forest, lawn, walls with lit windows, roofs, cobbles, trees, lanterns)
js/deco.js                  where the decorative trees go (open ground only, never near a staircase)
js/models3d.js              draws the Blender buildings (assets/models/campus-fantasy.glb) on the map through a Three.js layer,
                            each one lifted onto the illustrative terrain, lit by moonlight with real-time soft shadows
js/buildings.js             the simpler stand-in buildings (stepped roofs), shown while the Blender model loads or if it cannot
assets/models/campus-fantasy.glb  the fantasy buildings, modelled in Blender from the OSM outlines (1.7 MB)
tools/blender_buildings.py  the Blender script that makes that GLB
js/viewer3d.js              the illustrative 3D staircase preview (Three.js, loaded only when first opened): loads the
                            Blender staircase models, with soft shadows, filmic tone mapping, reflections and bloom
assets/models/stairs/       the staircase models, modelled in Blender: <set>-<style>.glb (four shapes each) and pedestals.glb
tools/blender_stairs.py     the Blender script that makes them
js/locate.js                your position for the avatar: the browser's GPS (only after you tap the locate button) or a demo walk
js/avatar.js                Tom, the character who stands at your position and walks as you move (Three.js map layer)
assets/models/tom.glb       Tom: your supplied character model, reduced to 14,000 triangles and given a skeleton, an idle and a walk
tools/blender_tom.py        the Blender script that makes tom.glb from the supplied model
js/fx.js                    fantasy-mode particles and the selection burst (decoration only)
js/geo.js                   small geometry helpers (centroid, distance to an outline)
js/pixel.js                 the original pixel-art sprites (wizard hat, crystal marker, icons)
data/staircases.json        THE STAIRCASE RECORDS: edit this file by hand
data/stair-survey.json      survey values from the Word sheet (made by tools/import_stair_sheet.py; empty until you import)
data/source/HealthWiz_Campus_Stair_Data_Sheet.docx  the blank Word data sheet to fill in
tools/import_stair_sheet.py reads the filled sheet into data/stair-survey.json and writes a report (no installs)
js/survey.js                lays the survey values over the records, labelled measured or calculated
data/demo-geometry.json     demonstration dimensions for the 3D model only (not campus data)
data/elevation-zones.geojson  the two raised areas (traced from your annotated screenshot) and their ILLUSTRATIVE heights
data/campus-osm.geojson     the OSM export converted for the map (regenerate with the tool below)
data/source/kmk-map.osm     your original OpenStreetMap export, unchanged
tools/osm_to_geojson.py     converts data/source/kmk-map.osm into data/campus-osm.geojson (Python 3, no packages)
vendor/maplibre-gl/         MapLibre GL JS 4.7.1 (BSD-3-Clause), pinned copy
vendor/three/               Three.js r169 (MIT) with OrbitControls, GLTFLoader, BufferGeometryUtils, RoomEnvironment and the
                            bloom post-processing passes, pinned copy
fonts/                      Pixelify Sans (SIL Open Font License), used for fantasy-mode headings
DATA_NOTES.md               what the OSM file contains, what came from your information, placeholders and limits
```

## Edit the data

- **Survey data from the Word sheet:** see **UPDATE_DATA.md**. Fill in `data/source/HealthWiz_Campus_Stair_Data_Sheet.docx`,
  run `python3 tools/import_stair_sheet.py your-sheet.docx`, read `data/stair-survey-report.md`, refresh the page.

- **Staircases:** open `data/staircases.json`. Use `null` for anything unknown; never put a guess in a field. Fields for future
  survey data (`endpoints`, `flights`, `landings`, `dimensions`, `photos`, `survey`, `verification`) are already there, empty.
  When a record gains real values (for example `orientationDeg`, `stepCount`), the details panel shows them in place of
  "not surveyed" without any code change. The JSON's `about.fields` block lists what each field means.
- **3D demonstration shape and sizes:** `data/demo-geometry.json`.
- **Terrain:** `data/elevation-zones.geojson`. Each zone has an outline, `illustrativeHeight_m` (now 12 and 24) and
  `slopeWidth_m` (how far the gentle rise extends outside the outline). Replace them with surveyed elevations later.
- **A new OpenStreetMap export:** save it as `data/source/kmk-map.osm`, then run `python3 tools/osm_to_geojson.py`,
  then rebuild the buildings (next item).
- **The fantasy buildings (Blender):** install Blender 4.2 LTS (blender.org, no add-ons needed) and run, from this folder:

  ```sh
  blender -b --factory-startup -P tools/blender_buildings.py -- data/campus-osm.geojson assets/models/campus-fantasy.glb
  ```

  It models every OSM building: walls on the real outline with a stone plinth and storey bands, gold eaves, a sloped
  hipped roof (made by insetting the roof upward until it closes, so courtyard buildings get roofs around the
  courtyard), chimneys, spired corner turrets on the large halls, a gold dome on the Surau, a pointed roof on the water
  towers, and terracotta cottages for the houses. Textures are pixel art made by the script; the windows glow. Wall heights,
  roofs, turrets and domes are illustrative. Takes a few seconds.
- **The 3D staircase models (Blender):** after changing `data/demo-geometry.json` or a measured step size in
  `data/staircases.json`, run:

  ```sh
  blender -b --factory-startup -P tools/blender_stairs.py -- data/demo-geometry.json data/staircases.json assets/models/stairs
  ```

  It makes one file per step size (`demo`, and ST14, ST19, ST20 with their measured F21 rise and run) and style, each with
  the four demonstration shapes, plus the two pedestals. Realistic: concrete flights and landings with nosings and steel
  railings. Fantasy: stone flights with glowing rune strips on the step edges, gold handrails, balusters and crystals on
  the newel posts (coloured in the browser by the app category). If a file cannot load, the preview builds the same
  staircase in code instead.

## You on the map (Tom)

Tap the locate button (the target at the top of the map controls). The browser asks for permission to use your location;
when you allow it, Tom appears at your GPS position, the camera follows him (like a game camera), and he walks toward each
new GPS fix, turning to face the way you are going, and stands idle (breathing, looking around) when you stop.

- **The blue circle** is the device's own accuracy estimate for the fix (±metres in the status bar). GPS on phones is often
  5 to 20 m off, worse between buildings; Tom stands at the reported point, not necessarily where you are.
- **Drag the map** to look around: following stops, and **Follow me** in the status bar brings the camera back. Picking a
  staircase also stops following.
- **Away from campus** (outside the map's area), Tom is not shown; the status bar says how far you are from campus and offers
  **Demo walk**: Tom walks along the longest campus road at 1.3 m/s. That position is simulated and labelled so.
- **Privacy:** the position is used only in this browser tab. It is not saved, not sent anywhere, and forgotten when you tap
  × or leave the page. Nothing asks for location until you tap the button.
- **Where it works:** location needs a secure page: `https://` or `http://localhost` (the local server in "Run it" counts).
  Opened from a plain `http://` address on another device, the browser refuses, and the status bar says so. Some embedded
  viewers (an app's in-page preview) are not allowed to ask for location at all; open the page in the phone's browser.
- **Size:** Tom is drawn about 110 pixels tall at any zoom so he can be seen, much larger than life when zoomed out. His
  size and his walk speed are a game look; they do not measure anything.
- **The model:** `tools/blender_tom.py` makes `tom.glb` from the model you supplied (Tom in school uniform, 252,000 triangles,
  16 MB). It stands him on the ground at 1.8 m, reduces him to 14,000 triangles, bakes his colours onto one 1024-pixel
  texture, adds a skeleton with automatic skin weights, sets a normal standing pose (feet under the hips, level shoulders,
  upper body and face turned square to the front, arms at the sides, head up and level, in place of the source's wide,
  braced and twisted stance), and keys the idle and walk loops. The source
  file is not included in this folder; to rebuild:

  ```sh
  blender -b --factory-startup -P tools/blender_tom.py -- path/to/Lit_Tom_...texture.glb assets/models/tom.glb
  ```

## Lighting

- **Map buildings:** a moonlight key light from the north-west casts soft shadows (4096 px shadow map, 2048 on phones) that
  fall from the buildings onto each other and onto the terrain, with a cool sky fill, a warm rim light and filmic (ACES)
  tone mapping; the windows glow. The scene never moves, so the shadows are computed once and again only when the terrain
  is switched, which keeps panning smooth. The light direction is decorative, not the real sun or moon position.
- **3D preview:** a key light with soft shadows, a fill light, studio reflections (Three.js RoomEnvironment, generated in
  the browser, no image download), filmic tone mapping and bloom, strong in fantasy (runes, crystals and gold glow) and
  faint in realistic.

Reload the page after editing (the server sends the new file; if the browser keeps an old copy, use a hard reload).

## Licences and attribution

Map data © OpenStreetMap contributors, available under the Open Database License (ODbL 1.0): the map shows this
attribution. MapLibre GL JS: BSD-3-Clause (`vendor/maplibre-gl/LICENSE.txt`). Three.js: MIT (`vendor/three/LICENSE`).
Pixelify Sans: SIL Open Font License 1.1 (`fonts/OFL-PixelifySans.txt`). All pixel art and textures are drawn by the
code in `js/pixel.js`, `js/map.js` and `js/viewer3d.js`; no game assets are used.

## Checks (qa/)

From the repository root, after `npm install` (Playwright is already a dev dependency of HealthWiz):

```sh
node prototypes/campus-observatory/qa/smoke.mjs   # 28 checks: map, modes, markers, terrain, preview, phone layout
node prototypes/campus-observatory/qa/me.mjs      # Tom and GPS with simulated positions: walk, stop, far away, demo walk
```

They start a small local server on the prototype folder, run headless Chromium with software WebGL (slow: a few minutes)
and write screenshots to `qa/shots/` (not committed). The GPS positions in `me.mjs` are made-up test values.
