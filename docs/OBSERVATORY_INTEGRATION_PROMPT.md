# Task: integrate the Campus Health Observatory prototype into HealthWiz Kingdom

Paste one phase at a time into Claude Code. Each phase begins only after the owner approves the previous one.
**Phase 0 is done** (findings and the owner's decisions are below): the next one to run is **Phase 1**.

---

## Phase 0 results (2026-10-20) and the owner's decisions

Findings from reading the code (read-only; file:line references are to the code at that date):

- **Staircase records:** `STAIRS` (js/hw-02-core.js:226) has 32 records, ST02 to ST33, with fields
  `{id, cat, name, floor, angle, lat, lng}`. ST02, ST08, ST16 and ST29 have no coordinates. A script comparison found
  them identical to `prototypes/campus-observatory/data/staircases.json` (same IDs, names, floor labels, categories,
  coordinates and angles). The F21 step sizes already live in `HWStairs.STUDY` (js/v6-stairs.js:92) with the same values.
  So keep no second copy: build the Observatory's records at run time from `STAIRS` + `HWStairs.STUDY` +
  `data/stair-survey.json`. Statuses and shared points are computed. The prototype's `staircases.json` is reference only.
- **Sessions already store the staircase ID:** every stair entry carries `m.sid` (hand log, workout, GPS check-in; see
  `record()` in js/v6-stairs.js). Per-staircase counts need **no schema migration**. Duplicate saves are already blocked
  (`HWWhen.stamp`, 2.5 s; forms cleared; the GPS confirm state). Pulse entries are separate; leave them alone.
- **Existing bug to fix in Phase 1:** the Stairs page selects through its private `pick` (js/v6-stairs.js:97, 105). But
  the current Observatory's CLIMB HERE (`acts.cmpstair`, js/v6-observatory.js:110) and the Stair Plan's START
  (`acts.plstart`, js/v6-plan.js:122) only set `S.loc`/`S.cat`, so the Stairs page opens with no staircase chosen.
  `tests/66-campus` only checks `S.loc`. Add a public `HWStairs.choose(id)` and use it in every link.
- **Navigation:** no router. `go(name)` re-renders `#main` (js/hw-04-part.js:77); routes take no parameters; no
  `pushState`/`popstate`; a refresh always returns to the title screen; the only hash is `#vault=`. `render()` replaces
  `#main`'s HTML on every redraw (also on `live:updated`). So a live WebGL map must be kept alive and re-attached after
  each render, and fully disposed when leaving the page.
- **Current Observatory entry points:** the door card on the Health page (wrapping `pages.health`) and Luna's feature
  finder (js/v6-luna.js:108). Not in `NAV`. `PAR.campus='health'`.
- **Build and tests:**
  - **`file://`:** most tests open the app from `file://` (tests/helpers.mjs). ES modules and `fetch()` do not work
    there, so the new map can only load over http(s).
  - **Single-file build:** `tests/99-standalone` fails on any `file:` request.
  - **`tests/00-fidelity`:** the HTML before the first `<script src=` must stay identical (no import map in the head).
    Files in `js/` must stay under 64 KB and named `hw-`/`v6-`. So put module code and libraries outside `js/` (for
    example `observatory/` and `vendor/`), and rewrite the Three.js add-ons' `'three'` imports to relative paths with a
    small tool script instead of an import map.
  - **`tests/26-journey`:** every `index.html` script must parse as classic ES2018.
  - **`tests/24-performance`:** requires no animation loop while idle and no leaks over 60 navigations.
  - **`tests/20-pwa`:** reads the cache by its name `hwk-shell-v2`; bumping the version means updating that name there.
  - **Deploy:** GitHub Pages from the repo root, no build step. It serves `.glb` correctly. `sw.js` is network-first and
    already caches same-origin files on first use.
  - **Map tests:** run them against a local http server (the pattern in `tests/20-pwa`) with the WebGL software flags
    the prototype's `qa/smoke.mjs` uses.

**Owner decisions (2026-10-20):**
1. **Delete the old 2D Observatory** (`js/v6-observatory.js`) once the new one passes. Where the new map cannot run
   (opened from `file://`, the single-file build, no WebGL), the campus page shows a clear message plus the staircase
   list and details, without a map. Nothing on the page may request a `file:` URL or throw there.
2. **Location only on tap.** Remove the automatic locate on opening. Update `tests/66-campus` to this approved behaviour.
3. **Keep all the Blender models**: staircases (about 5.4 MB), buildings and Tom. They load only on the campus page and
   are cached on first use.
4. **Refresh and Back keep today's behaviour** (no new browser history). Remember the selected staircase, map view, mode
   and panel state in sessionStorage, so going back to the Observatory restores them.
5. **F21:** the Group 14 F21 Full Written Report (v4) used by the prototype is the latest approved version (the owner
   confirmed nothing newer exists). Its values for ST14, ST19 and ST20 match `HWStairs.STUDY`.

---

## Shared rules (apply to every phase)

**Sources**
- The prototype is committed at `prototypes/campus-observatory/`. Read its `README.md`, `DATA_NOTES.md` and
  `UPDATE_DATA.md` first. It is the visual and functional reference. Reuse its code where it fits; adapt it to HealthWiz.
- The existing Observatory is `js/v6-observatory.js` (route `campus`, global `HWCampus`). The canonical staircase list is
  `STAIRS` in `js/hw-02-core.js`. Stair logging and sessions are in `js/v6-stairs.js`; location is `HWGps`
  (`js/v6-gps.js`); weather and haze are `HWLive` (`js/v6-live.js`).
- Follow `AGENTS.md` in full. In particular: classic scripts sharing one global scope (preserve load order in
  `index.html`), add every new script to the `sw.js` precache, no emoji in the UI, no new npm dependencies, saved-data
  changes only through the `js/v6-schema.js` migration process with tests, and never skip or weaken a test.

**Owner authorisations and decisions**
- **Vendored libraries are authorised:** MapLibre GL JS 4.7.1 and Three.js r169 with the add-ons the prototype uses, as
  files under `vendor/` (copied from the prototype). No npm install, no CDN, no API keys or tile servers.
- **Loading:** the Observatory is loaded lazily with dynamic `import()` when the `campus` route opens. A thin classic-script
  shim keeps the `HWCampus` entry point and the `campus` route working. The rest of the app must not load or wait for
  MapLibre or Three.js.
- **Caching:** the vendored libraries and 3D models are cached on first use (runtime caching in `sw.js`), not added to the
  install-time precache. Bump the cache version.
- **Asset budget:** the 3D models live in `assets/models/`, outside the `assets/img/` budget in
  `tests/24-performance.test.mjs`. Add a separate budget test for `assets/models/` and `vendor/`, set at the committed size
  plus 10 %, and report the numbers.
- **Location:** ask for the device's location only when the player taps the locate button, never when the page opens.
  This replaces the current Observatory's automatic locate. Use `HWGps` for the position. The prototype's
  "Tom follows your GPS" avatar (`js/avatar.js`, `assets/models/tom.glb`) comes in Phase 5.
- **One Observatory:** replace the current one; do not add a second route or menu entry. Delete `js/v6-observatory.js`
  once its replacement passes the tests (decision 1 above: no 2D fallback map; list and details only where WebGL or
  http(s) is unavailable).

**Data honesty (non-negotiable)**
- Never invent measurements, coordinates, step counts, floor heights, sessions or progress. Keep "estimated",
  "measured", "calculated", "illustrative" and "missing" distinct and visible, using the prototype's labels.
- Staircase step sizes for ST14, ST19 and ST20 come from the Group 14 F21 report. Check them against the latest approved
  Word report. If that report is not available or a value is unclear, flag it in the report rather than guessing.
- A staircase with no coordinates is listed and selectable but never placed on the map.
- The illustrative terrain comes from `prototypes/campus-observatory/data/elevation-zones.geojson` exactly as supplied.
  Its heights only show order (base, middle, highest); they are not survey data and must say so.

**Survey data from the Word sheet (keep this path working)**
- The owner measures the stairs into the Word sheet `prototypes/campus-observatory/data/source/HealthWiz_Campus_Stair_Data_Sheet.docx`.
  `prototypes/campus-observatory/tools/import_stair_sheet.py` turns it into `stair-survey.json` plus a report. Keep that tool and that file format. The
  integrated Observatory and the Stair Page must read `stair-survey.json` as an overlay on `STAIRS`, using the prototype's
  `js/survey.js` rules: measured position replaces the estimate, angle calculated per flight, a 3D model built from
  complete flights. Never write survey values into `STAIRS` itself. Updating the data must stay: fill the sheet, run one
  command, refresh.

**Working method**
- Work on the designated branch. Commit after each phase with a clear message and push to that branch. Do not open a pull
  request unless asked.
- Before claiming a test passed, run it. `npm test` builds `dist/` and runs every `tests/*.test.mjs`. The first Playwright
  run after install can time out once; run it again before treating that as a failure. WebGL in headless Chromium is
  software-rendered (slow): keep 3D tests short and use the reduced-motion setting.
- If a phase cannot pass its tests, revert that phase's changes and report why, rather than patching around it.
- End each phase with a report: files created, changed and deleted; tests run and their results; what could not be checked.

---

## Phase 0: inspect and plan (no edits) (done 2026-10-20; results above)

Read the code and the prototype, then write a short integration plan as a reply. **Do not change any file.** Answer:

1. **Staircase data:** what fields does `STAIRS` have, and how do they map to the prototype's `data/staircases.json`? Are
   the IDs the same (ST02 to ST33)? Which prototype fields (`measuredStep`, `notes`, `appFloorLabel`, statuses) already
   exist in HealthWiz, which are new, and where should new ones live without duplicating `STAIRS`?
2. **The stair workflow:** how does the Stair Page start, log and save a session today (check-in, manual log, pulse
   entry, `st.*` storage)? Is there a single "start" entry point to link to? Does a saved session record the staircase ID?
   If not, per-staircase activity in Phase 5 needs a schema change; propose it with its migration, or propose showing only
   what already exists.
3. **Navigation:** how do routes and route parameters work (for example `#campus?stair=ST14`)? How can the Observatory
   open the Stair Page with a staircase selected, and the Stair Page open the Observatory on one? What survives a refresh
   and the back button, and how can duplicate sessions be prevented?
4. **The current Observatory:** list everything `js/v6-observatory.js` does today (auto-locate, nearest staircase, weather
   and haze, unmapped list, visits, scale bar, the campus-activity note). For each, say keep, move or drop on purpose.
5. **Build, tests and deployment:** how is the app deployed (static host, Vite, the standalone build in
   `tools/build-standalone.mjs`)? Does the host serve `.glb` files with a usable type? What happens to the single-file
   standalone build: does the Observatory stay online-only, or degrade to the old view there? Which existing tests touch
   the Observatory or stairs (`tests/33-stairs`, `tests/42-kingdom-map`, ...)?
6. **Conflicts and risks**, and the **smallest safe plan** for Phases 1 to 5, with the files each phase touches.

Stop and wait for the owner's approval.

---

## Phase 1: shared data and two-way navigation (no new visuals yet)

Concretely (from Phase 0). This works with the current 2D Observatory, which stays until Phase 2 replaces it:
- **Select properly:** add `HWStairs.choose(id)`, which sets `pick`, `S.loc` and `S.cat` and nothing else. Use it in
  CLIMB HERE (renamed **Start Stair Session**), in the Stair Plan's START and in any new link. Extend `tests/66-campus`
  and `tests/33-stairs` so they check that the Stairs page really shows the staircase as chosen.
- **Records adapter:** add a new classic script, `js/v6-campusdata.js` (in `index.html` load order and the `sw.js`
  precache). It builds the Observatory records from `STAIRS` + `HWStairs.STUDY` + the survey overlay, following the
  prototype's `js/survey.js` rules and labels. It also gives per-staircase activity from existing entries by `m.sid`
  (read-only).
- **Survey path at the repo root:**
  - add `data/stair-survey.json` (empty: `"stairs": {}`, as in the prototype);
  - add `tools/import_stair_sheet.py`, adapted to compare against `STAIRS` in `js/hw-02-core.js` instead of the
    prototype's `staircases.json`;
  - load the survey with `fetch()` only over http(s); from `file://` skip it silently, with no error and no `file:` request;
  - add a short section to `README.md` that points to `prototypes/campus-observatory/UPDATE_DATA.md`.
- **Links:**
  - **Find on Observatory** on the Stairs page, shown when a staircase is chosen;
  - **Return to Observatory** after a genuinely saved stair session, offered only when the session started from the
    Observatory (the context is kept in sessionStorage).

- The Observatory reads staircases from `STAIRS` at run time, plus `stair-survey.json` as an overlay. Keep no second copy
  of the records. Prototype-only fields that HealthWiz needs (F21 step size, notes, statuses) go where Phase 0 decided,
  with sources.
- **Observatory → Stair Page:** a **Start Stair Session** action on a selected staircase opens the existing stair flow
  with that staircase selected. It never starts a session by itself: the player starts it explicitly. No second timer,
  pulse logger or recorder.
- **Stair Page → Observatory:** a **Find on Observatory** action selects the same staircase. It centres the map on it,
  or, with no coordinates, shows its details without moving the map. It opens the preview.
- **After a saved session:** a **Return to Observatory** action restores the selected staircase and map view. Effects
  and progress appear only after a session is genuinely saved.
- **State:** the selected staircase ID can go in the route. Keep map view, mode and panel state in session storage. No
  health data goes in URLs.
- **Tests:** add `tests/NN-observatory.test.mjs` for the round trip (select → start → save → return). Cover back and
  refresh creating no duplicate session, a staircase without coordinates, and existing records and history unchanged.

## Phase 2: the map and terrain

- Replace the old map with the prototype's MapLibre map: OSM data, realistic and fantasy modes, the illustrative terrain
  with gradual contours, markers with clustering, search and list, the details panel, and responsive desktop and mobile
  layouts. Keep OSM attribution.
- Both modes use the same records and positions. Switching mode changes no data.
- Fallbacks: no WebGL means the list and details still work. Data that fails to load gives a clear message.

## Phase 3: the automatic 3D preview

- Selecting a staircase (marker or list) opens or updates its preview, framed and labelled. Closing it keeps the
  selection.
- Illustrative staircases use the prototype's Blender models; a staircase with complete survey flights uses the
  survey-built model. Keep the labels: "Illustrative model — actual dimensions not surveyed." or "Built from survey
  measurements · finishes illustrative".
- Never size a model from an estimated angle.

## Phase 4: fantasy look and polish

- The prototype's fantasy treatment: pixel textures, Blender buildings with real-time shadows, paths, lanterns,
  particles and panels. Follow `docs/PIXEL_STYLE.md`.
- Health information stays more prominent than decoration, and reduced motion is respected. Use only original art: no
  Zelda or Mario characters, sprites, logos or recognisable places.

## Phase 5: activity feedback and the GPS avatar

- **Activity:** show only what saved data supports, per the Phase 0 answer: recent stair sessions, counts and weekly
  progress from existing history. No new XP, badges or progress store unless the owner approves a design, and nothing
  that double-counts the existing XP and badge systems.
- **Tom (GPS avatar):** opt-in via the locate button and `HWGps`. Show the accuracy circle, the far-from-campus message
  and the labelled demo walk. Never store or send the position.

---

## Final report (after Phase 5)

- Files created, changed and deleted.
- How staircase records, IDs and the survey overlay are handled.
- Navigation in both directions, and how back and refresh behave.
- How the preview is triggered.
- Session completion and return.
- Tests run and their results.
- Remaining limitations, and the measurements still needed (see `data/stair-survey-report.md`).

Priority if time runs short: shared staircase data → reliable two-way navigation → continuity with the existing workout
system → Observatory design → terrain and visual polish.
