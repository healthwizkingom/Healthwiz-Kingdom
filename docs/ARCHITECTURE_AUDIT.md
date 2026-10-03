# HealthWiz Kingdom — Architecture Audit (pre-v6)

Audit date: 2026-10-03. Scope: every file in the repository at commit `bd53041`.

## 1. Summary

The repository contains **one broken file**. `index.html` (100,223 bytes) is the
first ~100 KB of a larger single-file web app ("HEALTHWIZ KINGDOM — by Group 14",
internal version 5.4.3). It ends mid-statement inside `pages.sleep`, has no
closing `</script>`, and the browser therefore never runs the script: **the
live page is blank**. Verified in headless Chromium: `#main` is empty.

The two commits are two **non-overlapping halves** of the original file:

| Commit | Content | Size |
|---|---|---|
| `4316ee3` Create index.html | the *tail*: energy check-in, 7-day trends, health connections, JSON backup/restore, 3 extra badges, `render();`, closing tags | 8.6 KB |
| `bd53041` Update index.html | the *head*: all CSS, MENU data, helpers, welcome/food/water/sleep pages (truncated) | 100 KB |

The second commit replaced the first instead of appending to it. The **middle
of the app was never committed** and cannot be recovered from git. Both halves
are now preserved verbatim in `legacy/`.

## 2. Architecture of the original app

* **Delivery:** one static HTML file, no build step, no dependencies except the
  Google Font "Press Start 2P". Mobile-first (safe-area insets, PWA meta tags,
  bottom nav under 760 px). Light/dark themes via CSS custom properties.
* **State:** a single object `st` persisted to `localStorage['healthwiz']`
  (`save()` bumps a version counter `SV` used as a memo key).
  * `st.e[]` — log entries `{id, c, v, m, n, d, t}`; `c` ∈ food, water, sleep,
    pulse, stair, stress, bmi; `d` = `YYYY-MM-DD`, `t` = `HH:MM`, `m` = per-category metadata.
  * `st.s` settings (kcal, water targets, sound, `set`, `wrem`, `bk`); `st.p`
    profile (w, h, age, sex, act, days, goal); `st.xp`, `st.xd` (XP per day),
    `st.b` (badges), `st.claimed`, `st.en` (energy ratings), `st.ck` (sleep checklist), `st.dqn`.
* **UI state:** transient object `S` (current view `S.v`, food picker state, etc.).
* **Rendering:** string templates. `pages[name]()` returns HTML; `render()`
  writes it into `#main` and rebuilds `#nav`.
* **Events:** delegated. `data-a="x"` → `acts.x(dataset, target)`;
  `data-in="k"` → `INP`/`S[k]`; `data-ch="k"` → `CH.k(value, el)`.
* **Gamification:** XP + 6 levels (`LV`), 6 kingdom regions (`REG`) unlocked by
  first log in each category, daily quests (`QD`), badges (`BG`), animated
  pixel-art scenes (CSS keyframes + inline SVG + canvas sprites).

## 3. Feature inventory

### 3a. Survives intact (preserve as-is)

| Area | Pieces |
|---|---|
| CSS | Complete stylesheet for every module (≈400 lines), including styles for modules whose JS is lost. A few rule lines in the "study scene" block (lines 359–371) are blank — content lost. |
| Data | `MENU`: 152 Malaysian foods with kcal (KOLEJ MARA KULIM Dewan Selera 2022), 31 daily menus + 14 Ramadan menus. Intact once the injected newlines are removed (validated: all indices resolve). |
| Core | date helpers, `esc`, persistence, `sfx` (WebAudio), `toast`, `spr` (canvas sprite), `bar`, `chart`, `lvl`/`gain` (XP), entry queries (`A`, `sum`, `kc`, `wt`, `sp`, `rest`, `hr`, `str`), `add`, `bmi`, `bcat`, `score`, `desc`, `row`, `list`, disclaimers `DIS`. |
| Welcome | full animated title screen. |
| Food | full page: calories, 7-day chart, meal chips, menu-day picker, search, custom food form, serving/portion picker. |
| Water | full "Well of Life" quest: animated walk/carry/pour, flood FX, completion FX, graphs, world progression, achievements, reminders. |
| Sleep | scoring (`slpScore`, `slpDur`), log form logic, Dream Quest star mini-game actions, advisor text, checklist. Page template truncated at the awakenings chips. |
| Tail | energy check-in, trend card, health-connections analysis, backup export/import with validation and merge/replace, 3 badges. |

### 3b. Lost (referenced but not defined anywhere)

Helpers: `KN` (knight sprite image), `RGN`, `DOW`, `SR`, `cnt`, `emp`, `avatar`,
`QD`, `PMS`, `fprev`, `macLine`, `macPanel`, `macTable`, `mref`, `dmac`, `dys`,
`slH`, `sLo`, `xdy`, `dbat`, `sheepCard`, `BG`, `acts.exp`, `render`, the event
dispatcher, nav, the edit/delete modal (`#mo`, `UD`), music toggle (`#mus`).

Actions with buttons but no handler: `go`, `edit`, `del`, `pick`, `meal`, `cf`,
`savecf`, `qm`, `qp`, `pm`, `addfood`, `wa`, `wcu`, `dclose`, `mus`; inputs `q`,
`ck`; change `src`.

Pages (named in `DIS` / CSS but missing): `home`, `pulse`, `stair`, `stress`,
`bmi`, `calc`, `stats`, `guide`, `set`; plus onboarding (`.onbm`), tutorial
(`#tut`), Wizard's Counsel AI chat (`.cslog`), study/bedroom photo scenes
(`.cns2` — images were embedded data and are unrecoverable).

## 4. Technical limitations / risks

1. **Data-loss in source control** — the web-editor paste workflow truncated
   at ~100 KB and overwrote prior content. Any rebuild must keep files well
   under that or the next paste will break it again (see §6).
2. **Single 100 KB+ file with very long lines** — hard to diff/review; a
   single syntax error blanks the entire app (no error boundary).
3. **No tests, no CI.**
4. **String-template rendering re-creates the whole page** on most actions
   (loses scroll/focus; fine at this scale, inputs that need focus use partial updates).
5. **`innerHTML` everywhere** — user text is escaped via `esc()` in surviving
   code; reconstructed code must keep that discipline (toasts use raw HTML).
6. **localStorage only** — per-browser, ~5 MB; backup/restore exists (tail).
7. **Wizard's Counsel** depended on an AI endpoint (likely `window.claude`
   inside a Claude artifact) that does not exist on a plain static host.
8. **Health-claims safety** — the original is careful (disclaimers per page,
   "game visual, not medical"). Reconstructed pages must keep that tone.

## 5. What is preserved vs rebuilt

* **Preserved verbatim:** all CSS, MENU data, every surviving JS line (the
  head through the truncation point, and the whole tail). Only change to
  surviving code: removing the 2 injected newlines in MENU, and finishing the
  truncated `pages.sleep` line by *appending* to it.
* **Reconstructed** (clearly marked `RECONSTRUCTED` in the source): every
  missing symbol listed in §3b, written to match the contracts the surviving
  code and CSS imply (function signatures, class names, `st` fields, `data-a`
  names). Where the original behaviour is unknowable (e.g. exact quest list),
  the reconstruction is a reasonable equivalent and is noted.
* **Not rebuilt now:** photo-based study/bedroom scenes (images lost),
  guided tutorial overlay, full onboarding flow. The AI counsel is replaced
  by an offline reflective listener (uses `window.claude.complete` if the
  page is ever run where it exists).

## 6. Implementation order (safest first)

| Phase | Work | Gate before next phase |
|---|---|---|
| 0 | Preserve fragments in `legacy/`, this audit, Playwright test harness | baseline test documents blank page |
| 1 | Boot repair: fix MENU, add core runtime (helpers, render, nav, event dispatch, modal, music), finish `pages.sleep`, reattach tail | welcome, food, water, sleep pages render and log entries with zero page errors |
| 2 | Home hub: header, profile, today tiles, quests, kingdom map, energy/trends/connections, badges + popup | home tests pass; Phase 1 tests still pass |
| 3 | Tracker pages: pulse, stair, stress (+ counsel), BMI, goal calculator | per-page log tests pass |
| 4 | Stats, guide, settings (targets, theme, sound, backup UI wired to surviving code, reset) | backup round-trip test passes |
| 5 (future) | Split into `src/` modules + tiny build that emits one `index.html`; onboarding and tutorial; recover originals if the full source turns up | — |

**If the complete original `index.html` still exists on someone's device**,
it should replace the reconstructed sections; the `RECONSTRUCTED` markers make
that swap mechanical.

## 7. Status after the v6 repair (2026-10-03)

| Phase | Result | Tests |
|---|---|---|
| 0 | Fragments in `legacy/` (verified byte-identical to `bd53041` / `4316ee3`); this audit; harness | baseline documented blank page |
| 1 | App boots; welcome, food (incl. custom food + macros), water, sleep restored | `00-boot`, `01-core-pages` |
| 2 | Home: profile, attributes, today tiles, 6 daily quests, kingdom map, hub, badges + popup; original energy/trends/connections shown | `02-home` |
| 3 | Pulse, stairs, mind forest + calm games + counsel, BMI/profile, goal forge | `03-trackers` |
| 4 | Stats, guide, settings, backup UI (original logic), reset, standalone bundle | `04-system`, `05-standalone` |

25 browser tests, zero page/console errors, no horizontal overflow at 360 px on any page.

Behaviour fixes made while rebuilding (all in reconstructed code):
* A page that throws now shows an error card rather than a blank screen.
* Choice chips (goal, pulse context, stair pace) update in place so typed form values survive.
* Page timers (pulse count, pacing beat) stop when you navigate away.
* Counsel chat is session-only and never written to storage.

Still open / future (Phase 5): guided tutorial overlay (`#tut` CSS exists), onboarding
flow (`.onbm` CSS exists), study/bedroom photo scenes (`.cns2`, images lost), optional
`src/` module split. If the complete original file turns up, compare each
`RECONSTRUCTED` block against it and keep whichever behaviour the team prefers.

## 8. v6.1: the complete original restored (supersedes §5–§7)

The team later provided the complete original, `HealthWiz_Kingdom_5-4-3.html` (1.06 MB).
The repo's broken first half is an exact prefix of it (apart from the injected MENU line
breaks), and the old tail fragment is its exact ending. It contains every page that §3b
listed as lost, plus onboarding (Traveller's Registry), the tutorial, Medius, the
study/bedroom scenes and all artwork.

**Change:** all reconstructed code (`js/reconstructed.js`, `js/rc-*.js`) was removed and
replaced with the original, imported by `tools/import-original.mjs`:

* 15 base64 images (804 KB) → `assets/img/` (no canvas reads them, so file paths are safe).
* The 204 KB script is split with a JS parser only between top-level statements: 7 files,
  each ≤ 58 KB. Load order is preserved. All 18 original pages render with no load-time errors.
* Markup and stylesheet are byte-identical. `tests/00-fidelity.test.mjs` proves that the
  files reassemble into exactly the original code.
* Only addition: `js/v6-safety.js` (error card if a page or `render()` throws). From the
  v6 rebuild, the tests and the standalone build were kept; the original already stops
  its timers in `go()`.

**Known issues in the original, left unchanged for later phases** (master prompt §97 order):
* Region names "Heart Temple" / "Balance Shrine" conflict with master prompt §16 (no
  religious framing). Rename early in the next phase.
* Medius AI calls `api.anthropic.com` directly from the browser. It works only inside
  Claude and needs a backend for real deployment (§42).
* No schema version in saved data yet (§23). This is the next step.

## 9. v6.2: schema versioning (§23–24) and neutral place names (§16)

**Schema versioning** (`js/v6-schema.js`, loaded before core):
* State is stamped `sv` (current **2**). `HWSchema.load(DEF)` replaces the original
  `JSON.parse` + `Object.assign(DEF(), st)` in `hw-02-core.js`. `DEF()` includes `sv`, so a reset also gets a version.
* Ordered migrations in `STEPS`, applied one after another. Version 1 means unversioned v5.4.3 data.
* Safety: the raw stored text is copied to `healthwiz_backup_<reason>_<time>` (newest 3 kept)
  before an upgrade (`pre-v2`), a repair (`repaired`), an unreadable reset (`unreadable`) or
  newer-version data (`newer`). The original silently overwrote unreadable data with defaults on the next save; now it is kept and the user is told.
* Shape repair: non-object entries are dropped; missing ids, `m` and notes are filled in; `s`/`p` are merged
  with defaults instead of replaced wholesale; bad maps and negative XP are reset.
* Backups: `impParse` (hw-06) runs the same migration and refuses backups from a newer app version.

**Rename** (no religious framing): Heart Temple → **Heartstone Hall**, Balance Shrine →
**Balance Tower**, badges Shrine Visitor/Regular → **Tower Visitor/Regular**. Earned badges
are keyed by name in `st.b`, so migration step 1→2 moves those keys and keeps their unlock
dates. Without it, the badges would be awarded again with today's date and extra XP.

**Fidelity guard changed:** now that the original is edited on purpose, the byte-for-byte JS
check is replaced by "no original top-level function/constant, page, action, input or change
handler removed". Markup and CSS are still checked byte-for-byte.

Tests: `tests/02-schema.test.mjs` covers fresh install, v1→v2 upgrade (with an exact backup
copy and no re-award), unreadable data, damaged shapes, newer-version data, old and newer
backup restore, and the rename in code and UI. 25 tests in total.

## 10. v6.3: event system (§97 step 4)

`js/v6-events.js` adds `HWEvents`, an in-browser event bus. It is the connection point for
the master prompt's loop (data → insight → Medius → quest → XP → kingdom → statistics), so
the coming systems subscribe to events instead of being wired into the original code.

* **Zero behaviour change:** it wraps the original global functions (`add`, `gain`, `go`,
  `render`) and `acts.esave/del/undo/ener/impm/impr/rst`. No original line was edited, and all
  25 earlier tests pass unchanged.
* **Awards made inside `render()`:** quests (`st.qx`), all-quests (`st.claimed`) and badges
  (`st.b`) are detected by comparing against a baseline. Imports, resets and the initial load
  update that baseline silently, so old awards are never announced as new.
* **Ordering:** events raised during an action are delivered cause → effect.
* **Isolation:** a listener that throws is logged and never breaks the app.
* 15 event types, documented in `docs/EVENTS.md`. `tests/03-events.test.mjs` covers the bus API,
  boot/migration, logging order, quests, level-up, edit/delete/undo, navigation, energy,
  import and reset. 31 tests in total.

The event log is in memory only (last 200). Persistent history for Medius cooldowns
(§41) and inactivity detection will be added with those features, through a schema step.

## 11. v6.4: insight engine (§25–27, §97 step 5)

The original already has `insights()` (7-day averages vs targets), `anomalies()` (unusual
entries), an end-of-day report and "tomorrow's quest". All of them are kept unchanged.
`js/v6-insights.js` adds what the master prompt asks for on top:

* **Personal baselines (§27):** this week vs the previous week (water, sleep, stress, stair
  sessions), today vs your own typical day (water, only after 15:00, never as a morning nag),
  consistency (target days met, bedtime spread), the strongest pattern from the original 30-day
  health connections, and a logging streak. Comparisons use completed days only, because today is partial.
* **Priority (§26):** each insight has a priority. The top list keeps at most one per area.
  Home shows 2 and the guide shows 5 ("Medius notices"), above the original guide cards.
* **Wording (§25, §84):** observational and grounded in your data ("based on 7 + 7 logged days").
  No diagnoses, no praise for eating less, no guilt after gaps ("Nothing was lost"), estimates labelled.
* **Events:** `insights:updated` after any data change, and `insight:new` when an insight newly
  enters the top 3 (never at boot). Medius reactions (step 9) will subscribe to it. Event
  delivery is now breadth-first, so direct effects of an action come before reactions to them.

Tests: `tests/04-insights.test.mjs` (empty state, baseline comparison, priority and per-area limit,
sleep/stress wording, time-of-day guard with a fixed clock, insight events and ordering). 37 tests in total.

## 12. v6.5: adaptive quests (§29–33, §97 step 6)

The original five daily quests, their XP, the +100 "all five" bonus and the badges built on
them are unchanged. `js/v6-quests.js` adds alongside them:

* **Daily focus quest (§29):** picked from the insight engine's notices (low water → a personal
  water goal halfway between your most recent week and your target; partial meal logging →
  log 3 meals; low fiber (estimated) → one fiber-rich food; short or irregular sleep → a
  wind-down ritual; high stress → a calming practice; quiet stairs → two easy climbs). With
  nothing to address, it picks a quiet corner of the kingdom. Fixed for the day once chosen.
  Each quest shows why it was chosen.
* **Weekly quests:** three per Monday–Sunday week, picked from the areas logged least last week.
* **Difficulty (§30):** the water goal is never above your plan and never below 750 mL. Activity
  is one or two easy sessions. Nothing rewards eating less or extra intake.
* **UI (§32) and feedback (§33):** title, quest type, description, reason, progress, reward and
  completion state, shown under the original adventure card on Quests and Home. Completion
  shows a short banner with XP sparkles (no sparkles under reduced motion) and emits
  `quest:completed` with `kind:'focus'|'weekly'`. The original daily quests now emit `kind:'daily'`.
* **Schema v3:** adds `st.q6` (focus picks and weekly state). Older saves are upgraded with a backup copy.
* `js/v6-ui.js`: shared helpers. Styles are injected from JS so index.html stays identical to the original.

Tests: `tests/05-quests.test.mjs` (v2→v3 migration, adaptive pick and target, stable for the day,
difficulty guard, award once with banner and event, weekly picks and completion, variety pick). 43 total.

## 13. v6.6: streaks and achievements (§34–36, §97 step 7)

The original `streak()` (your best run of consecutive days), its "best streak" card and the
streak badges are unchanged. `js/v6-streaks.js` adds:

* **Current streak:** consecutive logged days ending today. While today is still open, yesterday
  keeps it alive.
* **Gentle streak (§36):** one rest day per Monday–Sunday week doesn't break it; two missed days in
  a row end it. Missed days are called rest days ("Rest days are part of the journey — nothing is lost").
* **Consistency card** under the original streak card on the Quest Board: current streak, gentle
  streak, days logged this week, and a 7-day view (logged / rest / today / upcoming, with an accessible label).
* **8 new achievements (§34),** added to the original `BG` list so the original `chkB` awards them
  with its popup and +30 XP: Focus Finder, Focused Adventurer, Week Warden, Steady Seasons, Rest Is
  Strength, Returning Hero, Curious Scholar (feature discovery) and Kingdom Steward. A test checks
  that no badge rewards body size, weight or eating less.
* **Schema v4:** adds `st.ex.p` (first visit per feature page) for discovery.

Tests: `tests/06-streaks.test.mjs`. 48 in total.

## 14. v6.7: fair XP and the living kingdom (§16–19, §37, §97 step 8)

**XP (`js/v6-xp.js`):** the original awarded XP for every saved entry, so add/delete loops farmed XP.
* **Daily allowance** of XP-earning logs per category (water 8, food 6, sleep 2, pulse 3, stairs 4,
  stress 3, BMI 1). It's counted by when the log happens, so backfilling old days can't farm, and
  deleting never refunds. Over the allowance the entry is still saved, with one gentle note per category per day.
* `gain(0)` is now silent (no "+0 XP" toast, no event).
* **Exploration:** +5 XP once for the first visit to each region page.
* **Schema v5:** `st.xl` stores the allowance used per day (kept for 14 days).

**Kingdom (`js/v6-kingdom.js`):**
* **State names (§16):** Ruined → Recovering → Developing → Thriving (original `KS` labels renamed, same
  thresholds), plus a fifth tier, **Flourishing**, for regions Thriving this week and last week.
  Balance Tower (BMI) and the Energy Forge (calories) top out at Thriving, so nothing rewards
  weighing more often or calorie control. Flourishing regions glow on the map (✿).
* **Region detail (§19):** ℹ on each region opens state, progress to the next state, a 7-day view,
  related stats, related daily/focus/weekly quests, and an Enter button (which closes the panel first).
* **Event:** `kingdom:state` when a log, edit or delete changes a region's state (for Medius in step 9).

Tests: `tests/07-xp-kingdom.test.mjs`. 54 in total.

## 15. v6.8: Medius reacts (§39–41, §97 step 9)

Medius already guides onboarding, the tutorial and the Wizard's Counsel AI chat; those are
unchanged. `js/v6-medius.js` adds short speech bubbles (his portrait plus one line) driven by
events: level-ups, all-daily-quests, focus/weekly quests, badges (shown after the original
popup), new insights, region improvements, first logs per region, gentle-streak milestones
(3/7/14/30/60/100), comebacks after a gap, restored backups and a once-a-day greeting.

* **Personality (§40):** concise and playful, in the original's "thee/thy" voice. A test runs every
  rule and checks that no line contains guilt, shame or diagnostic language.
* **Restraint (§41):** priorities, per-type cooldowns, an 8-second minimum gap (important moments queue
  rather than drop), 12 bubbles a day, the same line at most once a day, one waiting line per type, and
  nothing on the title screen, onboarding or tutorial.
* **Settings:** Chatty / Calm (default: important moments only) / Off. The guide shows his recent words.
* **Schema v6:** `st.md` stores the cooldown and seen-line memory and the last 20 lines.
* **Event bus fix:** a payload field named `type` could overwrite the event's name. The event name now always wins.

Tests: `tests/08-medius.test.mjs`. 62 in total. (General tests run with Medius off so bubbles
never cover the controls being tested.)

## 16. v6.9: interactive statistics (§61–62, §89, §97 step 10)

Every chart in the app comes from the original `chart()`. `js/v6-charts.js` wraps it once, so
all charts (stats, home trends, food, water, sleep, quests…) gain:
* **Reading values:** tap or hover a bar, or focus the chart and use ← → Home End, to read "Tue 30 Sep: 1,200 mL"
  in a live region. The original only showed values in a desktop hover tooltip.
* **Labels:** sparse date labels (first, middle, last) on charts with more than 7 bars.
* **Accessibility:** `role="img"` plus a spoken summary (days with data, average, peak, target).
* **Empty state:** an explanation ("NO STAIR STEPS YET — log stair steps…") instead of an empty box.

The Statistics page keeps Day/Week/Month and gains **This week vs last week** (completed days,
averages on days with data, stair steps as totals, neutral ▲ higher / ▼ lower / → about the same).
It fits a 360 px screen without sideways scrolling.

Tests: `tests/09-charts.test.mjs`. 67 in total.

## 17. v6.10: world progression (§18, §20, §21, §97 step 11)

`js/v6-world.js` adds a decoration layer inside the original map's SVG (map, nodes and paths
unchanged). Each region's surroundings follow its state: cracked stones and a bare tree (Ruined),
sprouts (Recovering), a cottage and a young tree (Developing), a flag, flowers and a strolling
villager (Thriving), and a flower ring, sparkles and a second villager (Flourishing). A fog over the
map thins as regions recover. The props sit beside each icon, mirrored near the right edge, so the
original labels stay readable. The home mini-map shows the same world.

**Kingdom chronicle:** region changes are recorded in `st.ex.ch` (last 20, inside the existing
`ex` object, so no schema step) and listed on the Kingdom page. A region going quiet is
described kindly ("It will recover when you return").

Animations reuse the original classes, so the original reduced-motion rule turns them off.
Tests: `tests/10-world.test.mjs`. 70 in total.

## 18. v6.11: title screen (§5, §9–15, §97 step 12)

The original layered title scene and its Start/Continue button are unchanged. `js/v6-title.js` adds on top:
* **Time of day (§14):** morning, afternoon, evening or night light over the scene, from the local clock.
* **Weather (§15):** sunny, cloudy, light rain or mist, fixed for each calendar day. It is only visual.
* **Returning players (§13):** a ribbon with level, regions restored and gentle streak, plus a lantern on the
  riverbank for every restored region. New players see the original screen.
* **Interaction (§9, §10):** tap the castle, dark tower, village or waterfall for a short reaction
  (`title:interact`). A Settings button sits beside Start/Continue.
* **Motion (§5, §12):** gentle pointer parallax and a short zoom transition on entering. Both are skipped under
  reduced motion, and parallax already applied is dropped if reduced motion is switched on mid-session.

**Test-runner OOM fixed.** `tests/11-title.test.mjs` sometimes made Node use ~14 GB. Cause: in a browser that
had already been clicked in by earlier tests, Chromium sends a pointer move at (0,0) as a new page loads.
The test turned on reduced motion only after loading, so that move applied parallax first. The check
`assert.equal(await page.$(sel), null)` then failed, and Node's assertion diff walked the whole Playwright
`ElementHandle` object graph, synchronously and without end. Fixes: tests now compare element counts
(`locator(sel).count()`), never handles (10 places); the reduced-motion test emulates before loading; the
app drops parallax when reduced motion turns on; error capture in `tests/helpers.mjs` is capped at 50 messages.

Tests: `tests/11-title.test.mjs`, plus an event-loop guard test in `tests/03-events.test.mjs`. 77 in total.

## 19. v6.12: animation system and performance modes (§64–67, §97 step 13)

The original title scene runs about 580 CSS animations at once (240 of them twinkling stars), and its only
motion control was the device's reduced-motion setting. `js/v6-motion.js` adds one place that decides how much moves:
* **Settings (§66):** Animations On/Off, Motion Follow device/Reduce, Visual quality Auto/High/Balanced/Performance.
  Stored as optional `st.s.anim`, `st.s.rm`, `st.s.perf` (missing or invalid = default), so no schema step.
* **Performance modes (§67):** *Balanced* is the original look. *High* adds a few birds and butterflies to the title
  and draws particles at full count and resolution. *Performance* stops the busiest decorative loops (stars, pine sway,
  lightning, shooting stars, most fireflies, map villagers), cuts title rain from 40 to 14 drops, drops parallax,
  thins the original water and quest confetti through CSS, and draws particles at 25% and 1× resolution. On the title
  screen that is ≈200 animations instead of ≈580. *Auto* uses Performance on weak devices (≤2 cores, ≤2 GB, data saver,
  or a slow frame probe after boot, which can only downgrade) and Balanced elsewhere.
* **Reduced motion:** every `prefers-reduced-motion` block, original and v6, is mirrored under `html.hw-rm`, so the
  in-app switch gives exactly the original reduced look. `HWUI.reduced()` now follows it. Animations Off also drops transitions.
* **Battery (§92):** all animation pauses while the tab is hidden.
* **Particles (§64):** `js/v6-particles.js` is one canvas with one `requestAnimationFrame` loop that runs only while particles
  are alive, then removes the canvas. Counts are scaled and capped per mode (300 / 150 / 50) and are zero under reduced
  motion. Used for level-up, badge, quest and all-quests moments and title-scene taps. The original effects keep their CSS particles.
* **Choice of technique (§65):** CSS for looping scenery (as the original), canvas for bursts of many short-lived particles,
  no new per-frame JavaScript while idle.
* **Event:** `motion:changed`.

Tests: `tests/12-motion.test.mjs`. 87 in total.

## 20. v6.13: mini-game framework (§63, §68, §96, §97 step 14)

`js/v6-games.js` (`HWGames`) holds the parts every mini-game shares, so the five region games
(steps 15–19) only describe their own scene and rules:
* **GameScene / GameHUD:** a full-screen dialog with a short pixel-wipe in and out. It has a title, a live status line for
  screen readers, and a ✕ button (Escape works too). While it is open the app behind it is `inert` and focus stays inside.
  On leaving, focus goes back to where it was. Navigation, reset and import close it first.
* **GameCharacter:** the original hero sprite (`HERO()`) with idle, walk, carry, full-bucket, celebrate and calm poses. Moves
  are stepped CSS transitions.
* **GameTimer:** `after`, `every` (skips while the tab is hidden) and `frame`. All three stop when the game ends or is left,
  so nothing keeps running in the background. `T()` gives pacing time and `A()` gives animation waits (0 under reduced
  motion). `HWGames.timeScale` speeds pacing up for tests.
* **GameParticles / GameAudio:** bursts go through the shared `HWFX` canvas, so quality scaling applies and reduced motion
  shows none. Sound cues go through the original `sfx()`, so they follow the Sound setting.
* **GameReward (§37, §68):** modest XP (default 10) for the first completion of each game per day. Replays are free and
  still counted. The first daily completion also unlocks the game's next discovery (lore or a decoration). Nothing rewards
  drinking more, eating less or pushing harder, and games never log health data.
* **GameCompletion:** a result card with the hero celebrating, a particle burst, XP (or a kind note that today's XP is
  already earned), the discovery, and Play again / Done. A game that throws on start shows a snag card instead of a blank screen.
* **Entry points:** each registered game adds a launch card to its region page, a Kingdom Games hub on the Kingdom page
  and a Mini-games card on Statistics (plays this week, days played). Both appear only once a game exists.
* **Medius:** a new `game` reaction (shown in Calm mode, 30-min cooldown). Bubbles stay quiet while a game is open and
  appear after the player leaves it.
* **Schema v7:** `st.mg` = `{xp, n, h, c}` (daily XP record kept for 14 days, play counts, last 60 plays, per-game discoveries).
* **Events:** `game:started`, `game:completed`, `game:cancelled`.

Tests: `tests/13-games.test.mjs` registers a small test game and checks the v6→v7 migration, open/inert/Escape, XP and
discovery once a day, replay counting, events, launch/hub/stats cards, timers stopping on navigation, reduced motion, the
snag card, a 360 px layout and the Medius timing. 95 tests in total.

## 21. v6.14: water mini-game and well scene (§48–49, §68, §85, §97 step 15)

`js/v6-water.js` (`HWWater`). The original water logging is unchanged: the +100/+250/+500/+750 mL buttons, custom input,
the Well of Life scene (#wq) and its animation (walk, fill, carry, pour, splash, flood), the fill screen used elsewhere,
the hydration-quest finale and reminders. Added on top:
* **Living well scene (§49):** the scene follows the original six well stages, which count water *tracking days* and never
  the amount in one day: a bare tree and dry cracks (Old Well), sprouts, trees and bushes, fireflies, a deer and a rabbit,
  then flowers. The well's stones are cracked at first, gain moss, and get a flower ring once restored. Two slow clouds drift by.
* **Pour feedback (§49, §85):** when the bucket is poured, rings spread across the well, water droplets jump (shared `HWFX`
  canvas) and the plants and animals hop. Filling the bucket at the spring gives a small splash. Done by wrapping the
  original `splashAt()`, so the original timing decides when they appear.
* **Well Garden mini-game (§49, §68):** a top-down garden with the well and five dry patches. Tap a patch (or press 1–5, or
  *Water the next patch*) and the hero walks to the well, fills the bucket, carries it over and pours; the soil darkens,
  sprouts, then blooms. Taps queue, so nothing is lost or doubled. No timer and no score. Patches are labelled buttons whose
  names report their state; the HUD status reads *Watered n / 5*.
* **Rewards:** framework XP (10, once a day) and one discovery per first daily completion: a frog, a herb planter,
  butterflies, a path lantern, then a piece of lore. Discoveries appear in the game and in the Water page scene.
  The garden's scenery follows the same well stage. The game never logs water, and its note says so.
* **Motion:** static scenery under reduced motion (no ripples, no particles, instant moves); Performance mode stops the
  looping clouds, sway and butterflies and halves the fireflies.
* **State:** `st.mg.c.water` = `{f: discoveries, b: gardens bloomed}` inside the existing mini-game record, so no schema step.

Tests: `tests/14-water.test.mjs` (scene by stage, discoveries on the page, the original log flow plus ripples, reduced
motion, a full keyboard game with XP once and no water logged, labelled patches, a reduced-motion 360 px run). The framework test that expected no registered games now checks the hub and the stats empty state. 102 tests in total.

## 22. v6.15: nutrition mini-game (§50–51, §59–60, §68, §85, §97 step 16)

`js/v6-food.js` (`HWFood`). The original Nutrition page (food menu, servings, portion sizes, custom foods, macros,
7-day log) is unchanged. Added:
* **Market Kitchen (§51):** a market square with five stalls (vegetables, fruit, grains, protein, drinks), a kitchen pot,
  a cook and a table with a plate and a cup. Tap a stall (or press 1–5) and choose one of three foods (1–3). The hero
  walks to the stall, picks the food up, cooks it at the pot (steam) and serves it onto the plate; the cook reacts.
  Picking again from a stall swaps that part.
* **Real foods, inspected (§50):** choices come from the original menu (`MENU.foods`), grouped by the original dish types
  (`fcat`). Each choice shows its serving, kcal and estimated macros from the original `estMac()`, tagged EST.
  Choices favour foods not tried yet (variety); water is always offered at the drinks stall.
* **Balance, not restriction (§51, §60):** the plate follows the Malaysian Healthy Plate idea (half vegetables and fruit,
  a quarter grains, a quarter protein). Serving needs the four parts; a drink is optional. No score, timer, calorie
  target or "bad" food. The result card lists the plate, its estimated total and how many foods were new.
* **World:** the square follows the Nutrition Village state (days with a meal logged, never what was eaten): torn
  awnings while Ruined, then villagers, flower boxes and festival lights when Flourishing.
* **Rewards:** framework XP (10, once a day) and one discovery per first daily completion: spice rack, bunting, a market
  cat, herb pots, then lore. Discoveries appear in the market. The game never logs food, and its note says so.
* **Motion:** static under reduced motion (no steam, no particles, instant moves); Performance mode halves the steam.
* **State:** `st.mg.c.food` = `{f: discoveries, m: meals served, t: food names tried}`, so no schema step.

Tests: `tests/15-food.test.mjs` (stall groups from the real menu and variety-first choices, a full keyboard game with
XP once and no food logged, swapping and labelled stalls, the square by region state, a reduced-motion 360 px run).

Also: the title screen's mist (§15) is drawn inside the scene below the knight's boots instead of as a full-screen
overlay, so it no longer covers the knight; `tests/11-title.test.mjs` checks the boot line at three screen sizes. 108 tests in total.

## 23. v6.16: activity, stress and sleep mini-games (§52–57, §68, §84–85, §97 steps 17–19)

Each region game now exists. All three use the mini-game framework (§20) for the scene, HUD, hero, timers, particles,
sound, XP (10, once a day) and the result card. None of them logs health data, and each says so in its note. Each
first daily completion unlocks the next of five discoveries (four decorations, then a piece of lore), shown in the game's
scene. Each scene follows its region's state, which counts *days logged*, never amounts. Class names are prefixed
(`v6t…`, `v6o…`, `v6n…`) because the original stylesheet already styles generic names such as `.orb`, `.sky` and `.bg`.

**Adventure Trail** (`js/v6-trail.js`, `HWTrail`, Stair Quest page, §52–53). A top-down trail: forest, a river bridge, a
hill and a short stone stairway to a lookout, with four checkpoints.
* *Navigation:* at three forks, three posts carry trail blazes (shape, colour and name, never colour alone). Follow
  today's blaze by tapping a post, a button, ← ↑ → or 1–3. A wrong path loops back to the sign and is marked
  "leads back here". There is no penalty; the result card calls it a friendly detour.
* *Rhythm:* tap STEP UP (or ↑) eight times to climb the stairs. A lantern glows on a slow beat, and a step taken with it
  shows "In step!". Any pace works and nothing is timed. Under reduced motion there is no beat ("step when ready").
* *World:* Ruined has a missing bridge plank, a broken rail, a fallen log and bare trees. Later states add sprouts,
  checkpoint flags, hikers and flowers. Discoveries: signposts, butterflies, a hilltop bench, stair lanterns, lore.
* *State:* `st.mg.c.trail` = `{f, r: trails walked}`.

**Calming Grove** (`js/v6-grove.js`, `HWGrove`, Stress page, §54–55). The original Storm Within check-in and its tools
are unchanged. Added: a pond at dusk with trees, a moon and its reflection, fireflies and slow drifting motes.
* *Breathing:* a soft light over the pond grows on the in-breath and shrinks on the out-breath, with a countdown.
  You can choose a pace (Gentle: in 4, out 6; or Even: in 4, out 4) and a length (3, 5 or 8 breaths). Pause/Resume and
  End here are always available. Each breath opens a water lily, sends a ripple across the pond and wakes a firefly.
* *No pressure:* no score and no streak. Ending early still counts, and the XP needs only one breath. Ending before the
  first breath shows a kind card with no XP. The result never comments on how the player feels. It points to the real
  check-in, and the note suggests talking to someone you trust or a qualified professional.
* *World:* Ruined is a murky pond with heavy mist and bare trees. The mist thins as the region recovers, and reeds,
  fireflies, a deer and flowers appear. Discoveries: water lilies, an owl, a wind chime, stepping stones, lore.
* *Motion:* under reduced motion the light stays still and shows only the countdown, with no motes or ripples.
* *State:* `st.mg.c.grove` = `{f, b: breaths, s: sessions}`.

**Night Watch** (`js/v6-night.js`, `HWNight`, Sleep page, §56–57). A night over the village: moon, stars, clouds,
rooftops, lanterns and fireflies.
* *Observation:* a star chart shows a constellation (its shape, name and a plain description). The sky holds three
  star groups. Find the matching one by tapping it or pressing 1–3. Each group's label carries the same kind of
  description, so the game also works with a screen reader. A wrong group just dims. There is no timer and no fast
  reaction.
* *Memory and exploration:* there are seven original constellations. A watch has three, and charts favour ones not
  charted yet. A found constellation draws its lines, reveals its name and lights a village lantern. The result card
  shows a line of its lore and the star atlas (n of 7).
* *World:* Ruined has clouds low over the village and dark windows. Later states clear the clouds and light the
  windows, then add fireflies and night flowers. Discoveries: an owl, a telescope, a moon garden, sheep, lore. The
  note says the stars are not a sleep measurement, and that a short, quiet play is kindest near bedtime.
* *State:* `st.mg.c.night` = `{f, w: watches, n: [constellations charted]}`.

None of the games needs a schema step. Their records live in the existing mini-game record (`st.mg.c`). Medius already
had a line for each of them (§20). The Kingdom Games hub and the Statistics card now list all five region games.

Tests: `tests/16-trail.test.mjs`, `tests/17-grove.test.mjs`, `tests/18-night.test.mjs`. They cover a full keyboard game with
XP once a day and no health data logged, the wrong-choice behaviour, labelled controls, scenery by region state, pause
and early ending (grove), atlas variety (night), and a reduced-motion run at 360 px. 119 tests in total.

Also fixed: `app:ready` was emitted from a zero-delay timer set by `js/v6-events.js`. The browser may run that timer
between two script files, before later add-ons (insights, Medius…) have subscribed. When it did, the day's first
insights and the Medius greeting were silently skipped, which made `tests/08-medius.test.mjs` fail now and then. It
now waits for `DOMContentLoaded`, which comes after every script and the first render, as `docs/EVENTS.md` describes.

## 24. v6.17: GPS activity check-in (§43–47, §79, §88, §97 step 20)

`js/v6-gps.js` (`HWGps`) adds a **GPS CHECK-IN** card under the Stair Quest heading. It uses the original `STAIRS`
list in `js/hw-02-core.js`, so there is only one place for stairway data. A stairway with `lat`/`lng` can be found by
GPS. A stairway whose coordinates are still `null` (ST01, ST02, ST08, ST16, ST29 today) is listed for manual logging
only, and joins GPS check-in as soon as its coordinates are filled in there.

* *Flow (§44):* FIND STAIRS NEAR ME → the first time, a short explanation (why, read once, never stored) with ALLOW
  LOCATION / NOT NOW → the browser asks for permission → one `getCurrentPosition` reading (never `watchPosition`) →
  up to five stairways within 400 m with their approximate distance → CHECK IN on one marked "you are here" → steps
  per climb (remembered from the last visit there), climbs and pace → CONFIRM. This saves a normal stair entry
  (`m.chk = 'gps'`, note "GPS check-in", 25 XP within the daily allowance), so quests, statistics and Stair Mountain
  update exactly as for a manual log. The manual form below then points at that stairway.
* *Accuracy (§45):* the activation radius is 35 m plus the reported accuracy, capped at 100 m in total. A reading worse
  than ±150 m lists distances but pauses check-in, with a tip about indoor signal. A reading older than 10 minutes
  must be refreshed before confirming. Denied permission, no fix, a timeout, no geolocation support and a non-https
  page each show a plain message that says nothing was saved and points to the manual form.
* *Safety and privacy (§46, §79):* the confirm step asks the user to stand still and not use the phone on the stairs.
  The user's position stays in memory for the card only. It is never saved, logged, sent or shown, and it is dropped
  on leaving the page, import or reset. TURN OFF LOCATION forgets the agreement, so the explanation shows again.
* *Exploration (§47):* the first GPS-verified check-in at each stairway is a discovery: +5 XP once, a banner, and a
  "discovered n / 28" count. Manual logs never count as discoveries.
* *State:* `st.gp` = `{ok, v: {stairId: firstCheckInDate}}`, added by schema step 7 → 8.
* *Event:* `activity:checkin {sid, name, cat, first}`.

Tests: `tests/19-gps.test.mjs` (Playwright geolocation): the full flow with the explanation, input checks, XP and the
discovery once, and no stored position; weak signal, far away and denied permission; stairways without coordinates,
the distance and radius maths, v7 → v8 migration and a 360 px layout. 122 tests in total.
