# Healthwiz-Kingdom

**HealthWiz Kingdom** (by Group 14) is a pixel-art fantasy RPG that is also a health tracker.
You log water, meals, sleep, stairs (with workout heart rate), runs and stress, and Medius, the Wizard King, guides you
as your actions restore the kingdom, with Luna, an apprentice witch, as your everyday companion. It is a wellness tracker, not a medical device.

The app is the team's original **v5.4.3** build, split into files so it can live safely in git.
Changes since then are small, tested and listed in `docs/ARCHITECTURE_AUDIT.md`.

## Run it

It is a static site with no build step and no server code.

* **Open locally:** open `index.html` in a browser.
* **GitHub Pages:** serve the repository root.
* **Install / offline:** on the GitHub Pages site, use the browser's *Install app* / *Add to Home Screen* (or Settings → App & Offline). After the first visit it opens without internet.
* **One shareable file:** `npm run build` writes `dist/healthwiz-standalone.html`, with all scripts and images inlined.

Data is stored in the browser's `localStorage` (`healthwiz`). Use **Settings → Backup** to download or restore it.

## Project layout

```
index.html                 original markup + stylesheet (byte-identical apart from listed deliberate edits), loads js/ in order
js/hw-01..07-*.js          the original script, cut only between top-level statements
js/v6-schema.js            saved-data versioning, migrations and damaged-data recovery
js/v6-events.js            event bus observing the app (catalog: docs/EVENTS.md)
js/v6-ui.js                shared UI helpers (injected styles, completion banner, keyboard-friendly dialogs, saved theme)
js/v6-pixel.js             pixel-art standard: design tokens, panel/HUD classes, crisp pixel icons (guide: docs/PIXEL_STYLE.md)
js/v6-sources.js           verified source records (HWSources) and the worked "?" explanation (HWExplain): inputs, formula, your numbers step by step, sources, limits (audit: docs/CALCULATIONS.md)
js/v6-calcx.js             the Stairs page's worked explanations (stair workout energy, our project's VO₂ method, peak heart rate)
js/v6-f21.js               the Group 14 F21 study's raw measurements, every report table worked out from them (tests/61-f21)
js/v6-lab.js               the Science Laboratory (route 'lab'): Be Your Own Experiment, page shell, the concept-sheet lab scene
js/v6-trial.js             the Evidence Trial: reasoning questions built from real data, answers worked out from the data
js/v6-vault.js             the Evidence Vault: every source on shelves, source → claim → HealthWiz's use → where you see it; calculation cards opened from a "?" by `#vault=<id>`
js/v6-uncert.js            the Uncertainty Engine: how unmeasured assumptions move an estimate (no made-up error margins)
js/v6-plan.js              Stair Prescription on the Stairs page: a weekly stair plan the player chooses (st.s.pl); not a prescription
js/v6-time.js              the Health Time Machine (route 'time', door on Statistics): saved records on a day / week / month timeline
js/v6-monument.js          The Ascent Monument (route 'monument', door on Statistics right under the Time Machine's): vertical ascent from the saved stair sessions (steps × measured or surveyed step rise), stages, the acknowledged state st.s.mon, landmark comparisons with sources, fun facts, ledger
js/v6-monument-scene.js    the monument's scene: an isometric voxel tower in pixel art on one canvas (real faces, cast shadows, AO, glow, floating island), construction animation, skip, reduced motion
js/v6-monument-css.js      the monument's styles
js/v6-campus-data.js        the Observatory's staircase records (STAIRS + the F21 step sizes + data/stair-survey.json), its links with the Stairs page
js/v6-campus-stairs.js     the collapsible "Stairs" section under the Observatory on the Campus page (the history: summary, heart-rate chart, measured stairways, Session Chronicle), the `stair` and `pulse` routes and the address `#stairs`, which open the Campus page at the top with the Observatory's Details; events `stairs:opened` / `stairs:closed`
js/v6-campus.js            the Campus Health Observatory (route 'campus', door in the Health Hall): the full-width map with its search, the list and the Details below it, where a staircase's climbs and workouts are logged (LOG A CLIMB HERE); fallback; loads the map over https
js/v6-campus-css.js        the Observatory's styles (split from v6-campus.js to keep each file under 64 KB)
js/v6-addfood.js           Add More Food: Luke (the apprentice) searches the web (Gemini + Google Search via food-guess) for any food, portion and changes, with a source per part; signed out, the canteen menu
js/v6-arcane.js            the magical, modern look: Arcane Night default theme, glowing rounded panels and controls (docs/PIXEL_STYLE.md)
js/v6-emoji.js             every emoji the app shows drawn as pixel art (hand-drawn icon or the emoji pixelated)
js/v6-provisions.js        Nutrition & Hydration as one page (the Provisions Hall): 'food' and 'water' are its two halves
js/v6-stairs.js            the Stairs features: the logging forms shown in the Observatory's Details for the staircase picked on the map (HWStairs.logPanel), and the history in the Stairs section (see v6-campus-stairs.js): two halves side by side, casual stairs (GPS check-in first, then by hand) and workout & heart rate (LOG BPM before/after, f, T, ω of the pulse, calorie estimate and our project's VO₂ / kJ method behind a ? button), the Group 14 measured-stairways table; one session model
js/v6-stairs-css.js        the Stairs features' styles (split from v6-stairs.js to keep each file under 64 KB)
js/v6-hrlog.js             hrLast(): the newest counted heart rate (logged BPM or a workout), used by the hub tile, kingdom panel and Stairs page
js/v6-conditions.js        "Anything that affects your activity?": the conditions question in the registry, one rule table (quest order, stair goals behind a doctor note, pace note), st.p.conds
js/v6-motion.js            animation settings + performance modes (High / Balanced / Performance), off-screen pause
js/v6-particles.js         one shared canvas particle system (level-up, badges, quests)
js/v6-insights.js          "Medius notices": insights from your own baselines and trends
js/v6-quests.js            adaptive daily focus quest + weekly quests
js/v6-streaks.js           current + gentle streaks, week view, new achievements
js/v6-xp.js                fair XP: daily logging allowance, exploration reward
js/v6-kingdom.js           five region states (incl. Flourishing) and region detail panel
js/v6-luna.js              Luna, the apprentice witch, from the owner's character design sheet: 12 expression portraits (luna-faces.webp) and
                           her 21 poses (luna-poses.webp): each moment picks a pose, bubbles walk in, CSS motion, Meet Luna in Settings (all poses and her things),
                           Talk with Luna (luna-chat, Gemini) with a portrait that follows the chat,
                           Ask Luna (find a feature, open the page's "?" explanations; no AI), her preferences (st.s.lst, st.s.lsz)
js/v6-medius.js            the companion reacts to events (speech bubbles with cooldowns), spoken by Luna; Medius keeps the tutorial voice
js/v6-charts.js            touch/keyboard/screen-reader charts, empty states, week-vs-week stats
js/v6-world.js             visible world progression on the map + kingdom chronicle
js/v6-title.js             title screen: time of day, weather, returning-player ribbon, tap reactions
js/v6-games.js             mini-game framework: scene, HUD, character, timers, rewards, completion
js/v6-water.js             well stage, earlier discoveries, ripples and sprites used by the Water Quest scene (the Well Garden game was removed)
js/v6-rig.js               character rig: the knight and orc cut into jointed parts with pose classes; pixel-art scene painter
js/v6-waterquest.js        Water Quest: layered valley scene by time of day and the knight's walk → drink → carry → pour sequence
js/v6-dream.js             Dream Battle: continuous sleep → strength, torch-lit dungeon, princess, deterministic battle
js/v6-storm.js             Storm Within: the knight's face, posture and surroundings follow the stress rating, smoothly
js/v6-ambient.js           the living world behind every page (themed by region) and the shared finish for buttons, cards, bars
js/v6-grove.js             Calming Grove mini-game (follow a light over the pond as it grows and shrinks with your breath)
js/v6-dass.js              Stress Quest check-in: the 21 DASS-21 statements (0–3, over the past week), the three scale scores (× 2, 0–42, no severity labels), the storm level from the total, the help numbers; saved as before with an optional m.dass
js/v6-relief.js            Stress Quest activity collection: illustrated cards replace the "what would help you handle this?" options (Shake It Off, Empower Yourself, Arrow Focus, Reaction Focus, Calming Sounds + the original tools)
js/v6-badges.js            badge audit: duplicates retired, own icons, running / workout / Dream Battle badges
js/v6-looks.js             themes (THEMES map, Settings swatches), the onboarding chamber, the Shadow Keep (title + Kingdom)
js/v6-gps.js               GPS check-in on the Stairs page (one reading on tap, nearest stairway, confirm, discovery)
js/v6-pwa.js               install as an app + offline: manifest/icon links, service worker, offline badge, Settings card
js/v6-cloud.js             optional account engine: email magic link / code and Google sign-in, user_data sync (offline queue, merge)
js/v6-account.js           the account's screens: Settings → ACCOUNT, "What happens when you sign in", sign-in steps, onboarding offer
js/v6-counsel.js           the Wizard's Counsel → medius-chat Edge Function (signed in), crisis help for everyone, Medius's reactions
js/v6-board.js             Hall of Heroes: opt-in leaderboard of game progress only (Quest Board card + Settings privacy card)
js/v6-live.js              live weather + haze (jerebu) for Kolej MARA Kulim from Open-Meteo: title sky, Home chip + JEREBU CHECK, hazeBanner() + heat tip above Running, Settings → LIVE DATA
js/v6-alarm.js             wake-up alarm on the Sleep page: in-app alarm (sounds, snooze, bedside clock), Android Clock intent, iPhone steps, .ics reminder
js/v6-ppg.js               Pulse Wave Lab: camera pulse estimate (photoplethysmography) for the Heartstone Hall card on the Stairs page; live wave, BPM from the median beat interval, f / T / ω, USE AS BEFORE / AFTER / 1 MIN AFTER (saved as m.src 'camera' by LOG BPM or SEAL THE WORKOUT); video never stored
js/v6-hr.js                smartwatch / chest-strap heart rate over Web Bluetooth (0x180D/0x2A37, battery 0x180F) for the Workout on the Stairs page (and BPM logged in Heartstone Hall); "Will my watch work?" sheet
js/v6-runboard.js          Runners' Board: opt-in running leaderboard (nickname + weekly totals only) under Running Road on the Training Hall; rows follow the account when signed in
js/v6-running.js           GPS run tracker (RUNNING ROAD on the Training Hall page): distance, moving time, pace, calories burned estimate
js/v6-exercise.js          the Wizard's Training Hall: goal (Calisthenics is bodyweight only), one Muscle & move screen with the tutorial, session, Running Road
js/v6-sheep.js             the Counting Sheep dream on the Sleep page: one animated pixel-art canvas scene, full screen
js/v6-map.js               the Kingdom map as a living pixel-art map (layered canvases + CSS-animated details, zoom to a region)
js/v6-score.js             Health Score page (Health Hall): five indicators weighted into one 0–100 score, fruit & veg servings, recommendations in five areas
js/v6-orb.js               the Health Orb on the Health Score page: Medius reads the orb in a pixel-art scene (mana particles, charge, burst), then the recommendations appear as ranked quest cards (Start Here / Next Step / Keep Going) built from the same indicators as the score; skip, replay and reduced-motion supported
js/v6-foodsel.js           pick several foods, then LOG SELECTED once (selection kept while searching; no duplicate logs)
js/v6-expbar.js            every progress bar in one modern style (changed values flow in); the EXP bar as flowing mana with level-up glow
supabase/migrations/       SQL for accounts, cloud save, leaderboards and Medius limits (Row Level Security) — run each file once, in order
supabase/functions/        medius-chat: the Edge Function that talks to Google Gemini for the Wizard's Counsel;
                           luna-chat: Luna's chat in Ask Luna, through Google Gemini (the same GEMINI_API_KEY as medius-chat);
                           food-guess: the Wizard's web search for calories and macros (Gemini with Google Search, the GEMINI_API_KEY secret)
supabase/tests/            SQL behaviour checks (tools/test-sql.sh, local PostgreSQL) and Deno tests for medius-chat and luna-chat
sw.js                      service worker: pre-caches the app, network first, works offline (keep PRECACHE in sync)
manifest.webmanifest       web app manifest (name, colours, standalone display, icons)
js/v6-help.js              contextual "?" help buttons (tap, click, keyboard; small panel with Escape / CLOSE); the moved explanations live here
js/v6-buttons.js           button hierarchy: primary gold, quiet secondary with a visible edge in dark themes, clear disabled/hover/focus states, LOG A MEAL / LOG LAST NIGHT'S SLEEP jump buttons
js/v6-when.js              "Log for…": one shared control to log for yesterday or an earlier date and time (never the future), used by Nutrition, Water, Sleep, Stairs, Stress, BMI and the energy check-in
js/v6-body.js              Body & Energy: BMI + daily energy + macros as one page ('bmi' and 'calc' open it at their section)
js/v6-log.js               Settings → ALL ENTRIES grouped by day (collapsible, totals), 14-day date chips, date picker, category filter
js/v6-hall.js              usability: one shared 3-line header (what this is / what to enter / why) on every tracker, Health Hall tiles with today's value and the one input, a Next step line, example lines under empty inputs
js/v6-safety.js            an error card instead of a blank screen
observatory/               the Observatory's map, ES modules loaded only on the campus page over http(s) with WebGL: MapLibre map from the OSM data, both modes, illustrative terrain (from prototypes/campus-observatory)
vendor/maplibre-gl/        MapLibre GL JS 4.7.1 (BSD-3-Clause), pinned copy; loaded only by the map; budget in tests/73-observatory-budget
vendor/three/              Three.js r169 (MIT) and the 3D preview's add-ons, copied by tools/vendor-three.mjs (bare 'three' imports made relative)
assets/models/stairs/      the Blender staircase models for the 3D preview (from the prototype; demonstration shapes, F21 step sizes)
assets/models/avatars/     the map avatars: Tom, the anime school boy and girl (CC BY 4.0, suzuart): sources, licences and changes in CREDITS.md
tools/blender_avatar.py    makes an avatar (reduced, one texture, skeleton, idle and walk) from a character model; tools/get-blender.sh installs Blender 4.2
assets/models/campus-realistic.glb, campus-fantasy.glb  the campus buildings for each look, modelled in Blender from the OSM outlines in the look of the owner's drone video (tools/blender_campus.py, data/campus-looks.json); appearance is observed or campus-typical, heights estimated
tools/blender_campus.py    makes those two GLBs: footprints from data/campus-osm.geojson, roof and wall colours, storeys and details from data/campus-looks.json; the KM KULIM sign
assets/models/campus-props-realistic.glb, campus-props-fantasy.glb  the ground details for each look: roads with red-and-white kerbs and a centre line, drains and manholes, street lights, goal posts and pitch lines, the tennis net and fence, car parks
tools/blender_campus_props.py  makes those two GLBs (run through tools/blender_campus.py --props); data/campus-props.json says where each comes from (car park places estimated)
tools/make_elevation_zones.py  writes data/elevation-zones.geojson: the estimated, illustrative terrain levels and the evidence for each
observatory/landmarks.js   landmarks: optional markers for places mapped in OSM (gate, named buildings, squares, pitches, water towers), the discovery animation
js/v6-campus-magic.js      the landmark card and discovery (device only), the Map journal, the Layers panel, a saved session's feedback, staircase sigils, the map's instrument-style buttons
observatory/stops3d.js     the staircase stops as solid 3D models on the map (assets/models/heart-stop.glb), hidden by buildings in front, with a slight glow
js/v6-campus-stop.js       the staircase stop on the Campus map: the disc that zooms out of a staircase's heart (name, ID, category, photo frame)
js/v6-campus-hud.js        the Campus map's HUD: the HealthWiz button and its menu (every map button, the search, the Legend), the Details sheet inside the map (Stairs and Workout tabs), NEAREST STAIRS (the wave and the GPS check-in), the Stay Aware notice; redraws of the same page without the entrance fade
js/v6-loader.js            the loading screen: the HealthWiz heart filled pixel by pixel while the app and the welcome page load, with the percentage
observatory/sky.js         the map's sky: live Kulim weather and modelled haze plus the time of day from the clock (or a preview) → sky, light, a tint, fog, rain
tools/campus-clip.mjs      cuts the prototype's OpenStreetMap export to Kolej MARA Kulim (data/campus-osm.geojson): lines clipped to the export's bounds, features outside the campus dropped
data/                      campus-osm.geojson (the prototype's OSM export cut to the campus by tools/campus-clip.mjs), elevation-zones.geojson (copied unchanged), campus-looks.json (each building's look from the drone video, with its frames and a confidence) and stair-survey.json
assets/img/                the 15 images that were embedded as base64 in the original (the PNG art re-encoded as lossless WebP)
assets/icons/              app icons (original pixel art, drawn by tools/make-icons.mjs)
legacy/HealthWiz_Kingdom_5-4-3.html   the complete original single file (source of truth)
tools/import-original.mjs  one-time import of the original (re-running it overwrites later edits)
tools/build-standalone.mjs bundles everything back into one HTML file
tools/make-icons.mjs       redraws the app icons
tools/art/                 Python scripts that made assets/img/bedroom.webp, sleeper-react.webp, medius-reactions.webp, luna-faces.webp,
                           luna-poses.webp, luna-lab.webp (make_luna_poses.py), luna-props.webp (make_luna_props.py), lab-scene.webp and Luke's luke-*.webp (make_luke.py),
                           heart-spin.webp and assets/models/heart-stop.glb (make_heart_sprite.py, Blender)
tests/                     browser tests (Playwright + node:test): fidelity, every feature, performance budgets, device matrix
docs/                      architecture audit and plan, event catalog, testing guide (docs/TESTING.md), pixel-art standard (docs/PIXEL_STYLE.md)
```

The scripts are classic `<script>` tags that share one global scope, so keep them in order.
`tests/00-fidelity.test.mjs` checks that the markup and stylesheet still match the original (apart from its short
`EDITS` list of deliberate changes), and that no original function, constant, page or action has been removed.

## Campus Health Observatory (map)

**Stairs is a section of this page.** Where the file list above says "the Stairs page", it means the collapsible "Stairs" section under the Observatory (`js/v6-campus-stairs.js`). The Health Hall card "Stairs" opens this page with the section open; the Campus door shows it collapsed. The routes `stair` and `pulse` and the address `#stairs` open it too. The data is unchanged: the same `stair` and `pulse` entries and the same storage keys.

The 'campus' page (`js/v6-campus.js`) shows the campus staircases on a MapLibre map drawn from the OpenStreetMap export,
with a Realistic and a Fantasy look, the illustrative terrain (heights only show the order of the two raised areas; they
are not measured), markers that cluster, search, filters, the details in three groups and a full-screen option. The map
needs the app to be served over https (GitHub Pages) or `http://localhost`, and WebGL. Selecting a staircase opens its
3D preview (Three.js): the prototype's Blender models, labelled "Illustrative model — actual dimensions not surveyed.", or
for a staircase with complete survey flights a model built from them ("Built from survey measurements · finishes
illustrative"); a model is never sized from an estimated angle.
The locate button (asked only when tapped) first lets the player choose an avatar (Tom, the anime school boy or the anime
school girl; the one matching the profile is suggested first). The avatar stands at the device's GPS position with its
accuracy circle; away from campus a labelled demo walk is offered. The position is never saved or sent. The page also
shows the player's own stair activity from their saved sessions (no new points or badges). Avatar credits:
[`assets/models/avatars/CREDITS.md`](assets/models/avatars/CREDITS.md). Opened from the file or as the
single-file build, the page says so and lists the staircases with their details, without requesting anything. The map's
files (`observatory/`, `vendor/`, `assets/models/`, `data/*.geojson`) load only when the page opens and are cached on first use.
Map data © OpenStreetMap contributors (ODbL); the map shows the attribution.

**Logging in the Observatory, and a lighter map (2026-10-20).** Stair climbs and workouts are logged in the Observatory:
pick a staircase on the map (tap its marker, or type in the search on the map, which keeps only the matching markers and
offers them as buttons), and its Details open with LOG A CLIMB HERE: GPS check-in, a climb logged by hand, and the workout
with heart rate, for that staircase. There is no stairway list to scroll. With nothing picked, Details offer the GPS
check-in, which picks the nearest staircase itself. The Stairs card (and `#stairs`) opens the Campus page at the top. On a
computer the map spans the page's width and Staircases and Details sit below it. The Stairs section under the
Observatory keeps the history. The map no longer redraws itself while it sits still (the Fantasy walkways and plateau
rims used to animate on a timer, which made the whole 3D scene redraw about five times a second), draws at most 1.5×
the screen's pixel ratio, uses a 2048-pixel shadow map, and stays inside the OpenStreetMap export's own area.

**A fantasy map to explore (2026-10-20).** The Fantasy look takes its mood from a fan-made fantasy town video the owner
chose (a reference only; every model is an original design): the small buildings are timber-framed with lit windows,
the academic halls carry red banners and the hostels blue ones, and a gatehouse with two crenellated towers stands at
the gate OpenStreetMap maps (Realistic shows the red portal of the drone video there). Signposts at road junctions,
notice boards and rune waystones with blue crystals in the squares are labelled decoration (`data/campus-props.json`).
Seventeen optional landmark markers point to mapped places only: the gate, the named buildings, the squares and the
Astaka, the pitches and the water towers. Opening one plays a discovery animation the first time, and its card says what
it is, its OSM id, its level and the nearest staircases. The Map journal counts discoveries and explored areas. Both are
kept on the device, apart from the save: exploring is not climbing, and it gives no XP, badges or sigils. A Layers
panel hides staircase markers, landmarks, building labels, contours, paths or the decorative effects. The selected
staircase stands on a bright rune circle, with fireflies, glowing leaves and sparks around it (fewer motes when zoomed
out). A saved stair session lights a sigil over its marker and, in Fantasy, sends a short pulse of light along the
nearest path: feedback for a real save, never a loop. The map's buttons are small instruments: a compass whose needle
shows north, rotate left and right, zoom, 2D/3D and layers. Staircase sigils mark recorded sessions (1, 5, 10, 25, 50)
and different staircases (3, 8); at most two sessions a day count, and they give no XP.

**A more detailed map: terrain, ground details, sky and avatar (2026-10-20).** The raised ground has three levels: the
north (middle), a terrace at Blok C and the south (highest). Which area is higher is the owner's annotation; where each
slope starts and ends was estimated from the drone video and the climbing staircases in the STAIRS list, and each level in
`data/elevation-zones.geojson` names its evidence (`tools/make_elevation_zones.py`). Heights stay illustrative. The
contour lines (every 2 m, every 10 m thicker) are traced from the height map itself, so terraces and banks get the right
lines. Blender ground details in the look of the video sit on that terrain: the roads with red-and-white kerbs and a
centre line, drains with manhole covers, street lights, goal posts and pitch lines on the Padang and the south-west
field, the tennis net and fence, and three car parks with bay lines and a few parked cars (their places estimated). The
map's sky follows the live Kulim weather and modelled haze (Settings, Live data) and the time of day from the clock (the
sun's height at the campus): dawn and dusk tint the map, night darkens it and lights the street lamps, rain falls, fog and
haze veil it. A Sky button previews a clear day, dusk, night, rain, fog or haze. These are pictures, not forecasts, and
are plain CSS layers over the map (the map does not redraw for them; the rain is still with reduced motion). The avatar
follows the profile: the anime school boy for a male profile and the school girl for a female one; only without a sex in
the profile does the player pick (Tom, the boy or the girl).

**Only Kolej MARA Kulim, in the look of the drone video (2026-10-20).** The map's data is cut to the campus
(`tools/campus-clip.mjs`): the main road, river and housing that ran up to 6 km beyond it are gone, and the map no longer
pans more than about 130 m past the campus, so there is less to draw. Both looks show Blender buildings
(`tools/blender_campus.py`): Realistic in daylight, Fantasy at night. Their roof and wall colours, storeys and a few details
follow a drone video of the campus by @ikraMRahim, used with the creator's permission: the large academic block's blue roof
with its striped skylight panel, rooftop tank and red entrance portal, the Surau's pale roof, the red-roofed blocks, the red
gazebos and the covered walkways (a red roof on white posts). `data/campus-looks.json` lists, for every building, what was
seen and in which frames, with a confidence (*high*, *medium*, or *campus-typical* for buildings the video does not clearly
show, which get the red-roof, white-wall look most of the campus has). Footprints and positions are the OpenStreetMap
outlines, unchanged; wall heights (storeys × 3.6 m + 0.6 m), roof pitches and the walkway width are estimates. Colours are
the medians measured across the video's frames, so they are as filmed. The Fantasy look keeps its own additions (turrets,
chimneys, gold trim), which are decoration, not real structures. To rebuild after editing the looks:
`blender -b --factory-startup -P tools/blender_campus.py -- --style realistic` (and `--style fantasy`).

**Staircase stops (2026-10-21).** On the map every staircase is a heart spinning on a post, in its difficulty colour
(Mild, Moderate, Vigorous: the app's category), with the category number on the post. The heart is one Blender model
(`tools/art/make_heart_sprite.py`), rendered as 16 white-and-grey frames in `assets/img/heart-spin.webp` and tinted in CSS.
Tapping a heart, or picking a staircase in the search on the map, zooms a disc out of it (`js/v6-campus-stop.js`): the
staircase's name, its ID, category and whether its place is measured or estimated, and a photo frame. No photos of the
staircases have been taken yet, so the frame says "No photo yet" rather than showing a made-up picture. At the same time
the Details pop up right below the map, with nothing in between: one card with the stair illustration first, then the
forms to log a climb and the workout, your climbs, and the staircase's location, profile and data quality; ALL STAIRCASES
at its end shows the list. LOG A CLIMB HERE closes the disc and goes to the forms. With reduced motion the hearts stand still
and the disc simply appears. The elevation toggle reuses terrain heights it has already worked out instead of sampling
the terrain again, the stair illustration (3D viewer) only redraws while something moves and draws fewer pixels on phones
and small devices, and on a phone the map's buttons wrap into columns so all of them, full screen included, stay on screen.
On the 3D map the stops are solid models, like a Pokestop (`observatory/stops3d.js`): a silver post on a stone base
with a gold rim and the heart floating above it, modelled in the same Blender script (`--glb`, `assets/models/heart-stop.glb`,
71 KB). They share the map's depth buffer, so a building in front of a stop hides it, and they stand on the ground the map
draws, where their markers (still the tap targets and labels) are. Each keeps a steady size on screen and has a slight
glow in its difficulty colour: the heart lights itself a little, with a soft halo around it and a pool of light under it,
which buildings hide too. The selected heart spins, redrawing the map about 12 times a second only while a staircase is
selected (never with reduced motion, still mode or Performance mode, when the hearts face the viewer instead). If the
model cannot load, the drawn hearts stay.

**Owner's corrections (2026-10-22).** The stair illustration is back at the top of Details, above the step ranges, the climb
form and Stair Sense, and opens with the pick; Full screen is its own button on the map again; the Sky panel has a x; the
sky caption sits bottom left, clear of the HealthWiz button; the white layer beyond the campus is gone; the sheet follows
the app's theme; the terrain switch flattens the terrain instead of removing it, so nothing has to be redrawn into the
terrain's tiles.

**A map like a game, inside one screen (2026-10-21).** After two screen recordings of Pokemon GO the owner sent (a
reference for the mechanics and the look; every drawing is original), the map's buttons down the right, the search and
the Legend are in one HealthWiz button at the bottom middle of the map (`js/v6-campus-hud.js`): it opens a mint menu over
the map with the search on top and every button as a round icon under its name; the round x at the bottom, Escape or any
button in it closes it. The Details are inside the map: a sheet rises from the bottom with two tabs, STAIRS (the forms to
log a climb, the staircase's 3D preview on request, its data) and WORKOUT (the workout with heart rate). It opens a fifth
of the screen high and is dragged (or its handle tapped) to half the map or the whole map; its content scrolls inside it; its x closes it and
the selection bar's Details button opens it again. Opened without the map (from the device, or without WebGL) the page
keeps the Details below the map as before. NEAREST STAIRS replaces the GPS check-in section: a round button sends a
wave out of the avatar and opens the closest staircases, with CHECK IN for one you stand at (one position, never saved;
a demo walk's position is simulated and never checks in). The avatar now shows by itself when the map opens; the
browser still asks for location the first time, which no web page can skip, and without a sex in the profile Tom
stands in until one is picked. Each time the map opens a notice asks the player to stay aware of their surroundings.
Switching a map feature (terrain, buildings, the look) no longer redraws the page, and no redraw of the same page
replays the page's entrance fade, which made it look as if the screen reloaded. The terrain switch swaps two ready
position buffers for the ground details instead of rewriting every vertex, the map resizes only when its size changes,
and the 3D stair preview, on phones, draws without anti-aliasing or bloom at up to 30 frames a
second. The map stays within Kolej MARA Kulim (it pans no further than the campus data). The
Fantasy buildings follow the owner's architecture design sheets (a style reference only): a coursed-stone ground storey
under jettied timber-framed storeys, steeper roofs in teal shingles or terracotta tiles (slate for the maroon and white
roofs) and teal-coned turrets; Realistic keeps the colours filmed. The KM KULIM sign ("Selangkah ke Menara Gading") from
the owner's photo stands on the lawn the owner circled, in front of the large academic block's west face, north of its
entrance, in both looks: its place is estimated from that screenshot (it is not in OpenStreetMap), the crests are plain
discs, and it is drawn 1.6 times larger than life so it can be read on the map. A loading screen (`js/v6-loader.js`)
shows the HealthWiz heart in its wizard hat with an ECG line, an empty grey outline that tiny pixels fill in pinkish red
as the app, the fonts and the welcome page's images load, with the percentage under it; it fades out once they are
ready.

## Campus stair survey data

The Campus Health Observatory and the Stairs page lay `data/stair-survey.json` over the app's own stair list (`STAIRS`
in `js/hw-02-core.js`, which is never changed). Measured values are labelled measured or calculated; anything not in
the survey keeps the app's value and label. The committed file is empty (`"stairs": {}`), which shows the app data
alone. To update it: fill in the Word sheet, run one command from the repository root, refresh.

```sh
python3 tools/import_stair_sheet.py path/to/your-filled-sheet.docx   # writes data/stair-survey.json and data/stair-survey-report.md
```

The blank sheet, what each column means and what the report checks are in
[`prototypes/campus-observatory/UPDATE_DATA.md`](prototypes/campus-observatory/UPDATE_DATA.md). The survey file is read
only when the app is served over http(s); opened from the device (`file://`) or as the single-file build, the app's own
values are shown and the page says the survey was not loaded.

## Saved data and versions

Saved data carries a schema version (`sv`, currently **9**). On load, `js/v6-schema.js` upgrades
older data step by step, and restored backups go through the same steps. Before anything is
upgraded, repaired or discarded, the raw stored text is copied to a `healthwiz_backup_<reason>_<time>`
key (the newest 3 are kept). If data was saved by a newer app version, it is left as it is.
To change the data format, add a step to `STEPS` in `js/v6-schema.js`, raise `V`, and add a test.

**Why the split:** the original was a 1 MB single file with five 57–250 KB lines of embedded
images. Pasting it into GitHub cut it off at ~100 KB and left a blank site. No file here is
larger than 64 KB.

## Accounts and cloud sync (optional)

Signing in is optional. Without an account everything works on this device only and no account request is made.
With a free account (Settings → ACCOUNT, or the offer after the Traveller's Registry) the save is backed up and synced
between devices, the Runners' Board row follows the account, and the Wizard's Counsel can talk with Medius AI.
Health data is private: Row Level Security lets each account read and write only its own row; nobody else, including
other students, can see it. The Wizard's Counsel chat is never synced or stored.

The app uses the free-plan Supabase project **healthwiz-kingdom** (`wghkbrtwrdrejmoswhza`, Singapore). The project URL and
**publishable** key are in `CFG` at the top of `js/v6-cloud.js` (public by design; the app refuses secret /
service_role keys, never commit one).

### Database: run the SQL once, in order

Dashboard → SQL Editor → New query → paste a file → Run (or `supabase db push`). Every file is safe to run again.

1. `20261003000000_hw_cloud_save.sql` · 2. `20261004000000_hw_leaderboard.sql` · 3. `20261005000000_hw_runs.sql` ·
   4. `20261006000000_run_scores.sql` (the earlier files; skip any that were already run)
5. `20261007000000_user_data.sql`: table `user_data` (`user_id` = `auth.uid()` primary key, `data` jsonb, `updated_at`),
   RLS "own row only", the server-side `updated_at` stamp, a one-time copy of any old `hw_saves` rows, and
   `hw_delete_account()` (deletes the cloud row, then the account). `hw_saves` is no longer used by the app.
6. `20261007000100_run_scores_accounts.sql`: Runners' Board rows tied to `user_id` when signed in; the device's row moves
   to the account on first sign-in.
7. `20261007000200_medius_usage.sql`: per-player message counts for Medius AI's limits (counts only, never text).

Local checks without a project: `tools/test-sql.sh` (PostgreSQL 16) runs `supabase/tests/rls_checks.sql`.

### Sign-in: dashboard steps

**Email magic link (no password)**

1. Authentication → Sign In / Providers → Email: enabled. "Confirm email" can stay on.
2. Authentication → URL Configuration: Site URL `https://healthwizkingom.github.io/Healthwiz-Kingdom/`; add the same
   address to Redirect URLs (plus `http://localhost:8080/**` if you test locally).
3. Authentication → Emails → Templates → **Magic Link** (and **Confirm signup**): keep the link and add the code, so
   people using the installed app can type it instead:
   ```
   <h2>Your HealthWiz sign-in</h2>
   <p><a href="{{ .ConfirmationURL }}">Sign in to HealthWiz</a></p>
   <p>Or type this code in the app: <b>{{ .Token }}</b></p>
   ```
4. Authentication → Emails → SMTP Settings: the built-in sender only delivers to the project's team members and a few
   emails per hour. For students, turn on **Custom SMTP** (any provider: Resend, Brevo, SendGrid, your school's mail
   server) with a sender address, then raise Authentication → Rate Limits → emails per hour as needed.

**Google (optional)**

1. Google Cloud Console → APIs & Services → Credentials → Create credentials → OAuth client ID → Web application.
   Authorized JavaScript origins: `https://healthwizkingom.github.io`. Authorized redirect URI:
   `https://wghkbrtwrdrejmoswhza.supabase.co/auth/v1/callback`. (OAuth consent screen: External, app name HealthWiz.)
2. Supabase → Authentication → Sign In / Providers → Google: enable, paste the Client ID and Client Secret, save.
3. The app shows CONTINUE WITH GOOGLE only when the project reports Google as enabled.

**Delete everything**: Settings → ACCOUNT → DELETE ACCOUNT & CLOUD DATA (two taps) removes the cloud row and the account;
the data on the device stays. RESET on a device only signs that device out.

Sync: on app start, about 10 s after a change, when the app goes to the background or back online. Offline, the card
says "Offline: will sync later"; otherwise "Synced at 14:32". First sign-in with data on both sides asks: KEEP THIS
DEVICE'S DATA / KEEP CLOUD DATA / MERGE (MERGE uses the backup restore's merge). Free plan: 500 MB database, 50,000
monthly active users; an inactive project pauses after 7 days (restore it from the dashboard, nothing is lost).

## Medius AI (the Wizard's Counsel)

Signed-in players talk with Medius through the Edge Function `supabase/functions/medius-chat/index.ts` (the code is
in the repo). The app sends the player's session token and the conversation; the function checks the token, applies
the limits (30 messages an hour, 100 a day per player, with a friendly message), adds Medius's persona and safety
rules, calls Google Gemini (model in the one constant `MODEL`) and returns the reply. Blocked or empty replies become
a gentle fallback with the crisis numbers. Nothing is stored; the function logs counts only. There is no AI key in
`index.html` or anywhere in the app. Signed out, the Counsel scene and breathing still work and it says "Sign in to
talk with Medius". Crisis numbers are always shown.

Deploy (Supabase CLI, from the repo root):

```
supabase login
supabase link --project-ref wghkbrtwrdrejmoswhza
supabase secrets set GEMINI_API_KEY=your-key-from-aistudio.google.com
supabase functions deploy medius-chat
```

The secret can also be set in Dashboard → Edge Functions → Secrets (Manage secrets) → Add `GEMINI_API_KEY`.
`supabase/config.toml` keeps `verify_jwt = true`, so only signed-in players reach the function. Run the SQL file
`20261007000200_medius_usage.sql` first. Tests: `deno test --no-lock --allow-env supabase/tests/medius-chat.test.ts`.

## Test

```
npm install   # only if Playwright / acorn are not already available
npm test      # builds the standalone file, then runs every browser test
```

`docs/TESTING.md` maps the master prompt's test matrix (§92–96) to the test files and lists the checks that still
need real phones and browsers (Safari, Firefox, Samsung Internet, screen readers, GPS outdoors).
