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
GPS. A stairway whose coordinates are still `null` (ST02, ST08, ST16, ST29 today; ST01 was removed in §34) is listed for manual logging
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

## 25. v6.18: installable app and offline support (§73–74, §87–88, §97 step 21)

HealthWiz can now be installed like an app and opens without internet. Nothing about saved data changes (no schema step):
it was already in `localStorage`, so logging, quests, XP, statistics, mini-games, the Kingdom, Medius's own lines and
achievements already worked offline once the page was open. What was missing was opening the page with no connection.

* *Manifest (§73):* `manifest.webmanifest` sets standalone display, `start_url`/`scope` `./` (works under the GitHub
  Pages sub-path), and the `#14204f` theme and background colours the original `theme-color` meta already used, which
  Android uses for the splash screen. The icons in `assets/icons/` are original pixel art (a heart wearing a wizard hat)
  drawn by `tools/make-icons.mjs` with no dependencies: 32 px favicon, 192/512 px, a 512 px maskable icon with the art
  inside the safe circle, and a 180 px Apple touch icon. `index.html` must stay byte-identical, so `js/v6-pwa.js` adds
  the `<link>` tags. The existing `apple-mobile-web-app-*` metas already cover iOS standalone mode.
* *Service worker (§74):* `sw.js` at the site root. Install pre-caches the whole app shell (every script, image, icon
  and the manifest), so the app opens offline even if some pages were never visited. App files are **network first**:
  with no build step to stamp versions, this keeps online visits on the latest deploy, and every good response refreshes
  the offline copy. If the network fails or takes more than 4 s, the cached copy is used. Google Fonts are
  stale-while-revalidate, with an empty response when offline and not yet cached (the system fonts take over). Other
  requests, including the Wizard's Counsel AI call (a POST), are never touched or cached. A navigation that fails before
  the first copy is saved gets a plain page that says what happened, that logs are safe, and what to do (§88).
* *Where it runs:* only on the multi-file site served over https or `http://localhost`. Opened from a file, or as the
  standalone single-file build (where the scripts are inline), `js/v6-pwa.js` adds no links and registers nothing.
  Those copies already run without internet, and the Settings card says so.
* *Offline status (§87):* an OFFLINE badge in the bottom-left corner while the device is offline (above the bottom
  navigation on phones; the longer "Your logs are still saved" text shows on wider screens and is in its label for
  screen readers). Medius gets one calm line when the connection drops (priority 50, 30 min cooldown, `HWMedius.rules`).
  A short toast confirms when the offline copy is first saved and when the connection returns.
* *Settings → APP & OFFLINE* (above Backup & Restore): connection, offline copy status, install, and storage.
  INSTALL HEALTHWIZ appears when the browser offers its install prompt (used once, as browsers require); iPhone/iPad get
  the Share → Add to Home Screen steps; installed copies say so. KEEP MY DATA asks the browser to persist storage, so
  site data is not cleared to free space (also requested quietly after install). The card reminds that backups are
  still the way to move devices.
* *Cloud queue:* §74 asks to queue cloud changes for later. There is no cloud sync yet, so there is nothing to queue;
  step 22 adds sync and its offline queue.
* *Events:* `network:changed {online}`, `app:offline-ready {first}`, `app:installed`.

Keep `PRECACHE` in `sw.js` in step with new files: `tests/20-pwa.test.mjs` fails when a script in `index.html` or a
file in `assets/` is missing from it, or when it lists a file that does not exist. The tests also check the manifest and
icon sizes, the file:// behaviour, and on a localhost server: the cached shell, a reload and a water log with the
network off, a never-fetched image served offline, the badge and event, the install prompt used once, and a 360 px badge.
128 tests in total.

## 26. v6.19: cloud save with Supabase (§74–76, §79, §83, §88, §91, §97 step 22)

`js/v6-cloud.js` (`HWCloud`) adds an optional cloud save. Until a project is configured and the user signs in, it makes
no network request and the app stays local-only, exactly as before. No schema change: the cloud stores the same save
the device keeps in `healthwiz` (schema 8), and the cloud's own state lives in separate keys.

* *Server (§75, §91):* `supabase/migrations/20261003000000_hw_cloud_save.sql` creates `hw_saves` = one row per account
  (`user_id`, `rev`, `sv`, `data` jsonb, `device`, timestamps) with Row Level Security (own row only, `authenticated`
  role only, nothing for `anon`), shape and 4 MB size checks, a trigger that owns `rev` and the timestamps, and
  `hw_delete_account()` (security definer, deletes only the caller). The app needs only the publishable key, and
  refuses a pasted `sb_secret_…` or service_role key. No library: Supabase Auth and PostgREST are called with `fetch`.
* *Accounts (§75, §79):* email + password. Sign-up with email confirmation returns through the address hash, which is
  read once and removed. Access tokens are refreshed; a refused refresh signs out and keeps all data. The session is in
  `healthwiz_cloud`, never in `healthwiz` or backups. Settings → CLOUD SAVE (above App & Offline): connect a project,
  sign in / create account, status, SYNC NOW, SIGN OUT, and under *Manage cloud data* DELETE CLOUD SAVE and DELETE
  ACCOUNT (two taps each; the device keeps its data). The card says health data goes only to the user's own save.
* *When it syncs:* when the app opens, 4 s after a change, every 30 s if something changed, every 5 min while visible,
  when the device comes back online, when the app comes back to the front and when it is hidden.
* *Offline queue (§74):* logs are always saved locally first. The copy from the last good sync is kept in
  `healthwiz_cloud_base`; whatever differs from it is the queue, and is sent on the next sync. The card shows
  *Offline… will sync when you are back online* / *Changes waiting to sync* / *Synced n min ago*.
* *Conflicts (§76):* every write is `PATCH …&rev=eq.<n>`, so a write based on an old copy changes no row; the app then
  reads again, merges, and retries (3 tries). The merge is three-way against the base copy:
  entries by id (adds from both kept; a delete on one side carried over; an edit on one side carried over; edited on
  one side and deleted on the other → kept; edited on both → this device), counters added (`xp`, `xd`, `mg.n`, `xl`:
  gains from both devices count once each), other values (targets, profile, badges, quests…) take the side that
  changed (this device if both did), lists (game history, Medius memory) are joined.
* *First sign-in on a device (§76):* an empty device just takes the cloud save; a device with data while the account
  also has a cloud save shows CLOUD vs THIS DEVICE (entries, XP, when and from which device) with MERGE BOTH
  (recommended; XP takes the larger side, since the two have no shared history), USE CLOUD SAVE or KEEP THIS DEVICE.
  Automatic syncs wait for the choice.
* *No silent loss (§76):* before a sync drops entries from this device, or writes a cloud save with fewer entries than
  the one it replaces, the replaced copy is stored as `healthwiz_backup_cloud_<time>` (same rotation as the schema
  backups: newest 3). RESET on a signed-in device signs it out and leaves the cloud save alone; restoring a backup
  with REPLACE starts the first-sign-in choice again instead of deleting cloud entries.
* *Validation (§83, §88):* cloud data goes through `HWSchema.migrate` + `sanitize` like a backup. Data from a newer app
  version or a damaged save is refused and nothing changes on either side. Every error says what happened, that
  nothing on the device was lost, and what to do (SYNC NOW, sign in again, run the setup SQL…).
* *Other:* a pull that changes the device emits `data:imported {mode:'cloud'}`, so insights, the Kingdom, GPS and an
  open mini-game refresh as after a restore; Medius gets a one-line `cloud` reaction (30 min cooldown) instead of the
  restore line. `sw.js` never touches Supabase requests. `HWSchema.stash` is now exported for the backups above.
* *Events:* `cloud:signed-in`, `cloud:signed-out {why}`, `cloud:synced {how, rev}`, `cloud:choose`, `cloud:error {code}`.
* *Not in this step:* leaderboard (step 23, §27 below); password reset by email.
* *Project:* the app ships with the free-plan project `healthwiz-kingdom` (`wghkbrtwrdrejmoswhza`, ap-southeast-1) in `CFG`, so
  users do not paste anything; the Settings "Connect a Supabase project" form only shows when `CFG` is empty.

Tests: `tests/21-cloud.test.mjs` and `tests/22-cloud-sync.test.mjs`, against a fake Supabase in `tests/cloud-fake.mjs`
that applies the same `rev` and RLS rules. They cover: no requests before sign-in, refused secret keys, sign-up and
first upload, no tokens in the save or backups, two devices with concurrent adds, deletes and XP, a lost write race,
the first-sign-in choice and its backup copy, offline queue and unreachable cloud, newer / damaged / older cloud data,
reset and two-tap deletes, the merge rules, email confirmation, token refresh and expiry, and a 360 px layout.
The SQL was also run twice against a local PostgreSQL 16 with a stub `auth` schema: rev is set by the server, a stale
write updates no row, RLS hides other accounts, `anon` has no access, and `hw_delete_account()` removes the save. 136 tests in total.

## 27. v6.20: the Hall of Heroes leaderboard (§78–80, §36, §59–60, §88, §91, §97 step 23)

`js/v6-board.js` (`HWBoard`) adds an optional leaderboard, the **Hall of Heroes**, at the end of the Quest Board. It
builds on the cloud save: only signed-in players can join or see it, and a player who never joins is never shown. No
schema change; the board's local state is the device-only key `healthwiz_board` (never in the save or backups).

* *What is ranked (§78):* game progress only. Seven boards: **THIS WEEK** (XP since Monday, the default, so new players
  start level), ALL-TIME XP, QUESTS (daily + focus + weekly), BADGES, KINGDOM (% of region states restored), EXPLORER
  (regions, features, GPS stairways and mini-game finds discovered) and GENTLE STREAK (rest days allowed, §36). There is
  no column for BMI, weight, calories, entries, sleep, pulse, stress or location, so none can be ranked or shown (§59–60).
  Each row shows rank (🥇🥈🥉 for the top three, shared ranks for ties), hero name, level title and value.
* *Server (§91):* `supabase/migrations/20261004000000_hw_leaderboard.sql` creates `hw_board` (one row per joined
  account, cascade-deleted with the account). Nobody can insert or update it directly. `hw_board_publish(name, hidden,
  stats)` (security definer) writes only the caller's row: **XP and badges are read from the caller's own cloud save**,
  the other counts are clamped (kingdom ≤ 100, week XP ≤ total XP, sensible maxima), the name is checked again (3–20
  letters, numbers, spaces, `. _ ' -`), and it refuses a caller without a cloud save. `hw_board_top(board, week, limit)`
  returns the top 20 (max 50) plus the caller's own place, as `rank, name, value, xp, me`: never user ids, e-mail
  addresses or timestamps, and `name` is null for a hidden player unless it is the caller. Both functions are for the
  `authenticated` role only; `anon` has no access. RLS lets a player read and delete only their own row.
* *Privacy (§79):* joining is a deliberate step with a list of what is and is not shared, and a suggested fantasy hero
  name (never the profile name; the field says "not your real name"). HIDE MY NAME keeps the place but shows
  "🕶️ Hidden adventurer" to others. LEAVE THE BOARD (two taps) deletes the server entry. These controls are on the card
  (*Name & privacy*) and in Settings → **LEADERBOARD PRIVACY**, right under Cloud Save. Signing out forgets the board on
  that device but leaves the entry; DELETE ACCOUNT removes it.
* *Fairness and safety (§80, §30):* no prizes and no XP for rank. Week XP is the default view, the streak board uses the
  gentle streak, and the card is labelled GAME PROGRESS ONLY · NO HEALTH DATA · NO PRIZES. XP still follows the daily
  allowance from step 8, so the board cannot be climbed by logging more than the app already rewards.
* *Honest limit:* a player controls their own save, so a determined player could inflate their own numbers by editing
  it. The server limits what any entry can claim, the board has no rewards, and the project owner can delete a row.
* *Updates:* after each cloud sync (at most every 2 minutes), on JOIN, on REFRESH and on name/privacy changes. A board
  read is cached for a minute. A new sign-in asks the server whether the account has already joined (from another device).
* *States (§87–88):* checking, loading, offline ("updates when you are back online; your progress is saved on this
  device"), the cloud save not synced yet, the project without the leaderboard SQL, and network errors each say what
  happened and that nothing on the device changed.
* *Events:* `board:joined`, `board:left`, `board:updated {hidden}`. `HWCloud` now also exports `api()` and `who()` for
  signed-in requests.

Tests: `tests/23-board.test.mjs`, with the fake Supabase in `tests/cloud-fake.mjs` extended to apply the same rules.
They cover: no requests while signed out, name checks, the exact payload (no health values, profile name or e-mail),
XP and badges from the cloud save, ranks and tabs between two players, hidden names, the Settings privacy card, leaving
with two taps, the joined state found again on a new device, sign-out, offline, a project without the leaderboard SQL,
and a 360 px layout. The SQL was run twice against a local PostgreSQL 16 with a stub `auth` schema: direct inserts and
updates are refused, XP and badges come from `hw_saves`, out-of-range values are clamped, hidden names are masked for
others, `anon` cannot read or call anything, and deleting the user removes the row. 141 tests in total.

## 28. v6.21: optimisation (§92, §65–67, §88, §97 step 24)

Measured first, with a Playwright profiler (CPU profiles, `Performance.getMetrics`, storage-write and timer counters), on an
empty save and on a busy year of logs (≈5,000 entries, a 590 KB save: `yearOfLogs()` in `tests/helpers.mjs`). With an
empty save everything was already fast (1–4 ms per page). With a long history it was not: every page took 50–145 ms to
draw on a desktop CPU (several times that on a phone), and three quarters of it was the badge check scanning every entry
for every badge on every draw. Results (desktop Chromium, year of logs):

| | before | after |
|---|---|---|
| Draw Home / slowest other page / most pages | 144 / 110 / 51–100 ms | 11 / 7 / 2–5 ms |
| Log a pulse and redraw | 137 ms | 8 ms |
| Log water (tap → well animation starts) | 35 ms, 2 storage writes | 3 ms + 1 write (≈6 ms) |
| Storage writes per action (entry + XP + badge + quest) | 2–5 × the whole save | 1 |
| Main-thread work while idle on Home, 390×844 phone | 83 ms/s | 10 ms/s |
| The six PNG artworks | 354 KB | 179 KB (lossless WebP, same pixels) |
| 60 navigations: listeners / DOM nodes / timers | flat | flat (now guarded by a test) |

* *Entry index (`js/hw-02-core.js`):* `A(category, day)` filtered all entries on each call, and a page makes thousands of
  calls. `IX()` groups entries by category and day once per synchronous run (one render, one action) and is rebuilt when
  `st.e`, its length or `SV` (every `save()`) changes, then dropped at the end of the run, so it can never serve stale
  data. `A`, `ALL`, `LC`, `dys`, `cnt`, `tot` and the last-n-days lists (`rng`) use it; callers still get fresh arrays in the
  original order. A test compares every answer with a full scan, including edits in the same run.
* *Badges:* `chkB()` no longer re-evaluates badges already earned (same awards, same order).
* *One write per action:* `save()` still counts every call in `SV`, but writes `localStorage` once, at the end of the
  synchronous run, before the browser handles anything else (so nothing can be lost in between).
* *Storage full or blocked (§88):* the original silently kept data only in memory. Now the write is retried after removing
  the superseded `healthwiz_backup_pre-v…` copies (their entries are all in the current save); if it still fails, a toast says
  the change is not saved on this device, stays in the open tab, and to download a backup now (at most every 2 minutes),
  and `storage:failed` is emitted. Other safety copies (cloud, unreadable, newer) are never removed.
* *Battery (§92, §66):* looping scenery in a part of the page scrolled more than 200 px out of view is paused
  (`.hw-off`, one IntersectionObserver over the page's top-level cards, the same CSS rule as the hidden-tab pause). Position is
  compared directly, because the page-enter wipe briefly clips the page. Nothing visible changes; on Home the kingdom map's
  52 animations were running below the fold. Idle pages run no `requestAnimationFrame` loop (tested).
* *Assets:* `wiz`, `kn`, `knight-kbd/kcp/khr` and `orc` are lossless WebP (every visible pixel identical, checked with
  Pillow, with Chromium canvas reads at 1×, 0.37× and 2.6×, and with full-page screenshots before/after). WebP works on every
  target browser (Safari 14+). `sw.js` cache is now `hwk-shell-v2`, so installed copies drop the old PNGs.
  Re-running `tools/import-original.mjs` would bring the PNGs back (it already overwrites later edits, see its header).
* *Checked and left as is:* first load (≈330 ms to DOMContentLoaded from a cold local file; 33 small scripts, served by the
  service worker afterwards), renders per action (one), cloud and leaderboard requests (already throttled, none while signed
  out), the title scene (≈3,000 SVG nodes, ≈580 CSS animations; its cost is what step 13's Performance mode already reduces:
  ≈470 → ≈230 ms/s of main-thread work in headless software rendering).

Tests: `tests/24-performance.test.mjs` (page budgets with a year of logs, the index against full scans, one write per action
and a reload, storage full with and without freeable copies, off-screen pause and no idle frame loop, no leaks over 60
navigations, image formats and sizes). `tests/20-pwa.test.mjs` follows the new file names and cache. 148 tests in total.

## 29. v6.22: the test matrix (§77, §81–82, §93–96, §97 step 25)

Three new test files cover what the matrix in §93–96 asks for and the earlier per-feature tests did not; `docs/TESTING.md`
maps every item to its test and lists what still needs real devices.

* `tests/25-matrix.test.mjs`: every page at the seven §82 sizes (360×800 to 1920×1080) with a busy save and a 20-character
  name: no overflow, no error card, bottom navigation on phones (nothing hidden under it), side navigation on wider screens, a
  centred column on large displays; rotation and an open keyboard; both themes (device default, saved choice, every page,
  text contrast); touch (taps, swipes, edit/delete/undo, every control ≥ 24×24 px); keyboard (Tab order, focus ring, dialogs);
  long text; safe-area insets; window resizing.
* `tests/26-journey.test.mjs`: no broken references (handlers, page links, images, asset paths) on every page, onboarding
  step, dialog and game; a new player's first day on a phone end to end (registry, tutorial skip, every log type, edit, delete,
  undo, every page, every game, settings, backup, reload) with zero console errors; an old v5.4.3 save on every page; all five
  mini-games opened by tap and keyboard, closed by ✕ and Escape, restarted, with no timer or frame loop left; and the code's
  JavaScript level (ES2018, no newer APIs: Safari 12+, Chrome 64+, Firefox 78+, Samsung Internet 9+).

Found by these tests and fixed:
* **SKIP TUTORIAL did not work by mouse or touch.** The shared pressed style (`button:active{transform:translate(2px,2px)}`)
  replaced the button's centring transform, so it jumped half its width away under the pointer and the click landed on the
  overlay ("next step"). `.tsk:active` now keeps the centring (`js/v6-ui.js`).
* **Title screen in landscape:** the scene's 540 px minimum height pushed START below a landscape phone's screen. Short
  landscape screens now use their own height, with the title text capped by height (`js/v6-title.js`), down to 568×320.
* **Long unbroken notes or food names** widened the Food page by 878 px on a phone; entry rows now wrap them.
* **The edit dialog** (shared `#mo`, also the region panel) did not scroll, so SAVE could be off screen in landscape or with
  the keyboard open; it now scrolls. It is now labelled as a dialog, takes focus, keeps Tab inside, closes on Escape and
  returns focus to the button that opened it (§81).
* **The THEME choice was forgotten on reload;** it is now saved (`st.s.theme`, optional, no schema step; missing = follow
  the device as before).
* **The mini-game ✕** (the way out) is now at least 40×40 px on touch screens (was 27×32).

Known and left for the team: two original colour pairs are just under WCAG AA 4.5:1 — muted text on the darker parchment
(`--mut` on `--p2`, 4.45:1, light theme) and white on the violet badge chip (4.37:1). Body text is 8.9–15:1 everywhere.
Only Chromium is available here; the Safari, Firefox and Samsung Internet checks in `docs/TESTING.md` need real devices.
167 tests in total.

## 30. Visual foundation, session 1: hearts removed, pixel-art standard, audits

First of the visual-redesign sessions. Foundation and clean-up only: the Water Quest, Dream Battle, Stairs and Storm
Within redesigns come later. No saved-data change (no schema step), no page moved or removed.

**Decorative hearts removed.** Every page except Home showed two rows of hearts at the top, neither of which did
anything: three fixed hearts under "Your Health. Your Quest." in the header (`hdr()`, `js/hw-02-core.js`, always 3), and
1–5 unlabelled hearts on the right of the region banner (`ban()`, `js/hw-03-part.js`, the number of daily quests done,
but never fewer than 1, so it showed a heart with no quest done). Neither had a click handler, tooltip or label. Both
are gone, with the "· no hearts lost for missed days" note that explained them and the banner's `.hs` rule in the
stylesheet. Kept on purpose: the labelled five-heart quest tracker on Home's hero card ("n/5 quests", `.hrts`, `HEART()`),
and all heart-rate features (Pulse page, ECG, logging, Heartstone Hall, hub tile, statistics, badges).
* *Spacing:* the title block stacks its two lines with a 6 px gap, the banner text takes the width the hearts used, and
  on side-navigation layouts the header keeps 48 px clear on the right, so the fixed 🎵 button no longer covers the end
  of the XP bar (it did before, at widths up to about 1240 px). Phones are unchanged apart from the hearts.
* *Fidelity guard:* `tests/00-fidelity.test.mjs` still compares the markup and stylesheet with the original byte for byte,
  now after applying a short `EDITS` list of deliberate changes (only `.hs` so far). Each edit must apply exactly once.

**Pixel-art standard** (`js/v6-pixel.js`, `HWPixel`; guide: `docs/PIXEL_STYLE.md`). Direction: a modern pixel-art RPG,
not crude 8-bit or a generic dashboard. Tokens for the grid (4 px), borders, hard shadows, bevels, crisp pixel-font sizes
(8/16/24 px) and HUD colours, built on the original theme tokens so both themes work. Opt-in classes: `.pxp` panel (same
frame as `.card`), `.pxn` stepped corners, `.pxdk` dark HUD colours (re-points the tokens, so children follow), `.pxh`,
`.pxhud`/`.pxst`, `.pxtag`, `.pxi`. Nothing existing is restyled by them.
* *Icons:* 19 pixel icons on a 16×16 grid in one palette, drawn as crisp inline SVG (one path per colour) with the
  outline added by the builder: the required heart, water, food, sleep, stairs, running, stress, energy, achievement,
  warning, success, wizard and monster, plus balance, chart, scroll, gear, quest and map for the page banners.
  `icon()`, `glyph()` (icon or the emoji unchanged), `forEmoji()`, `region()`, `grid()` (drawable with the original
  `spr()`). First use: every page banner shows its region's icon at 2× instead of the emoji.
* *Character art:* the knight, avatars, Medius and the orc are detailed 180–292 px images shown smaller, so they keep
  smooth down-scaling (`.av`). Note for later: `.hero` (`kn.webp` in mini-games) is down-scaled with `pixelated`, which
  can shimmer; the standard says draw a small sprite and scale up instead.

**Emoji audit** (before this session): 757 emoji in the app code, 214 different ones; 433 in the original `hw-*` files
(page headings, nav, hub tiles, badges, menus, food names, toasts) and 324 in the v6 add-ons. Mapped to the required
icons: sleep 43, food 40, water 39, warning 26, success 25, stress 23, stairs 21, heart 15, achievement 13,
energy 13, wizard 10, running 7, monster 1. 🔥 (streak, vigorous pace, Energy Forge) and 📊 (Health Hall, Statistics)
are deliberately not mapped. Four add-ons place their card by searching for a heading that contains an emoji
(`💡 HEALTHWIZ GUIDE`, `⚙️ SETTINGS` ×2, `🔥 STREAK`); changing one of those headings moves the card to the page's top or
bottom, so change the search string with it. Typographic symbols (▶ ◀ ✓ ✕ ★ ⏸) are text, not emoji, and can stay.

**Data audit** (nothing changed, nothing migrated). `localStorage` keys:

| Key | What | Written by |
|---|---|---|
| `healthwiz` | the save, schema `sv` 8: `e[]` entries `{id,c,v,m,n,d,t}`, `s` settings, `p` profile, `xp`, `xd`, `xl`, `b` badges by name, `claimed`, `qx`, `qd`, `q6`, `en`, `ck`, `dqn`, `ex`, `md`, `mg`, `gp` | `save()`/`persist()` (one write per action) |
| `hwtut` | tutorial seen | `TUT` |
| `healthwiz_backup_<reason>_<time>` | safety copies (newest 3) | `HWSchema.stash`, cloud merge |
| `healthwiz_cloud`, `healthwiz_cloud_base` | cloud session; copy from the last sync | `js/v6-cloud.js` |
| `healthwiz_board` | leaderboard state on this device | `js/v6-board.js` |
| `healthwiz_runs`, `healthwiz_run_live` | GPS runs; the run being recorded | `js/v6-running.js` |

No code calls `localStorage.clear()`. Only deliberate user actions overwrite the save: Reset and restoring a backup with
REPLACE (two taps each). Found and left for later:
* **Runs are not in the JSON backup.** Backups export `st` only (`bkJSON()`), and runs live in `healthwiz_runs` (by design,
  outside the save, with their own cloud table). A backup-and-restore to a new device loses runs that were never
  synced to the cloud. A later step should add runs to the backup file, with a version field.
* **REPLACE restore keeps no safety copy.** `acts.impr` (`hw-06`) swaps the save for the backup after the second tap; the
  data it replaces is not stashed (the schema and cloud paths do stash). A later step could call `HWSchema.stash` first.
* **Duplicated systems** (each documented where it lives, no migration now): two daily-quest views of one list (`QD()`
  and `quests()`, which wraps it), plus focus and weekly quests (`st.q6`); two streaks (the original best run `streak()`
  and v6 current/gentle streaks); two achievement lists (the 76-badge `BG` with `st.b`, and the Water page's own `ACH`
  list computed on the fly); two icon systems (emoji and `spr()` canvas sprites, now joined by `HWPixel`); original
  region games next to the v6 mini-games (Well of Life + Well Garden; Dream Battle/Dream Quest + Night Watch; Storm Within
  + Calming Grove; Stair Quest pacing + Adventure Trail + GPS check-in). Several pages are defined and then wrapped
  again by add-ons (`pages.set` 6 times; `quests`, `kingdom` 4; `home`, `stats`, `guide`, `welcome` 3; `bmi`, `stair`,
  `water` 2), and the name `KN` is both the hero image (`hw-05`) and a block-scoped sprite grid (`hw-03`).
* `DEF()` has no `gp`; `js/v6-gps.js` creates it on first use, so a fresh save is fine.

**Navigation audit.** Five tabs (`NAV`: Home, Health, Quests, Kingdom, Settings). The Health Hall (`HUB`) opens Nutrition
(`food`), Water, Sleep, Pulse, Stairs (`stair`), Stress, BMI, Calories (`calc`), Statistics and Running (`run`, added by
`js/v6-running.js`); each has BACK TO HEALTH (`PAR`). Storm Within is the Stress page's quest (`pages.stress`, phase
`start`); Dream Battle is the Sleep page's first card (`#dbatc`, `dbat()` in `hw-05`). Pages are also reached from Home
tiles, the Kingdom map, quest cards and the tutorial. All of it works unchanged; `tests/28-foundation.test.mjs` taps every
tab and every hub tile, and back.

Tests: `tests/28-foundation.test.mjs` (no hearts on any page, titles and banners kept, Home's quest hearts kept; pulse
features; the navigation audit; every icon: size, palette, outline, crisp SVG, labels, emoji mapping and fallback;
every storage key and entry unchanged through all pages and a reload; five screen sizes with no sideways scrolling and the
music button clear of the XP bar). 179 tests in total.

Known, not caused by this session: `tests/08-medius.test.mjs` "new insight and kingdom change reach Medius" fails on
Sundays. Its six seeded stress entries (1–6 days ago) then all fall in the current Monday–Sunday week, so the water log
completes the weekly "w-mind" quest and a level-up, whose higher-priority bubbles fill the 9.5 s window the test waits.
Fix in the test: seed the entries outside the current week, or wait for the queued bubble.

## 31. Visual redesign, session 2: Nutrition and Hydration as one page

The Nutrition page and the Water page are now one page, **Nutrition & Hydration** (banner: *Provisions Hall*), built by
`js/v6-provisions.js` (`HWProvisions`). No saved data changed (no schema step).

**Routes.** The two old routes stay, as the page's two halves: `food` (Nutrition Village) and `water` (Water Valley and the
Well of Life). `pages.food` and `pages.water` both draw the whole page, each with its own half. So everything that already
linked to them now opens the right half with no change: Home's Water and Calories tiles and *Log a glass of water* / *Open
nutrition log*, the Kingdom map (Water Valley and Nutrition Village stay two regions with their own states), the region
panel's ENTER button, daily, focus and weekly quests, insights, the water reminder toast and the tutorial. The original
code that checks `S.v==='water'` keeps its meaning: `drink()` still plays the walk-fill-carry-pour animation (`wqFlow`)
instead of the full-screen fallback, the water music still plays, exploration XP is still given once per region, and the
mini-game launch cards still refresh. No old route can break, because none was removed.

**Layout.** Shared by both halves: the title, the banner (both systems' pixel icons), BACK, and two **system cards**:
today's calories against the target with meals logged, and today's water against the target with what is left. Each
card is the switch to its half (`aria-current="page"` on the open one, gold frame and pointer). Below them: a section
header (the system's title, its region and kingdom state, one line), then the system's cards, a GO TO button for the other
half, and one footnote with both disclaimers.
* *Nutrition* (`pages.food` body in `js/hw-02-core.js`, rearranged): Calories and Macronutrients side by side on wide
  screens, stacked on phones; Pick a food; Today's food log; Market Kitchen; 7-day nutrition log. Same content, ids and
  actions as before; headings use pixel icons.
* *Hydration* (`pages.water` body): the Water Quest exactly as before (progress, Well of Life scene, Add water, stats,
  history, graph, Well Garden, world progression, Well Keeper, achievements, reminders). Only its title and line moved
  into the section header and its headings use pixel icons. Its redesign is session 3.
* *Switching* is a navigation (`page:viewed`), but the system cards stay at the same place on screen, focus moves to the
  card just chosen, and the page does not replay its enter animation: only the content below the cards animates in (the
  water half keeps the original water wipe, `trw`). Reduced motion and Animations Off are honoured.
* Every card stays a direct child of the page, so `js/v6-motion.js` still pauses the well's scenery when it is scrolled
  away. (Wrapping the half in a container would have stopped that.) A `<nav>` element is not used for the switch: the
  original stylesheet makes every `nav` the bottom bar on phones.

**Navigation.** The Health Hall's Nutrition and Water tiles are replaced by one **Food & Water** tile (first, showing
today's kcal and mL). Bottom navigation had no entry for either. The tutorial's Health Hall line now names the one tile,
and its first Nutrition and first Water steps explain the two halves. Its other steps, and all spotlight targets, are
unchanged.

**Anchors.** The mini-game launch cards were placed by searching for emoji headings (`📋 7-DAY NUTRITION LOG`,
`🌱 WORLD PROGRESSION`, see §30). They now use card ids: `#fwk` and `#wworld`. New ids on the page: `#fcal`, `#fpick`,
`#flog`, `#fwk`, `#wworld` (plus the existing `#fmac`, `#det`, `#fl`, `#fprev`, `#wq`, `#wqch`…). One new pixel icon,
`bell` (Reminders).

Tests: `tests/29-provisions.test.mjs` (one tile; both system cards with today's values; switching by card, GO TO and
keyboard with the cards kept in place and focus moved; nutrition logging; water logging with the well animation, graph and
reminder; launch cards in place; saved entries, targets and reminder unchanged through both halves and a reload; every old
link: Home, Kingdom map, region panel, tutorial; five screen sizes). Updated for the new layout: `13-games` (marker),
`27-running` (Health Hall tile list) and `28-foundation` (two banner icons here, one tile). 186 tests in total.

**For session 3 (Water Quest).** The water half is `HYD()` in `js/v6-provisions.js`, the original `pages.water` body in
`js/hw-02-core.js`. `js/v6-water.js` wraps the page (scenery inserted before `<div class="wqch" id="wqch">`, ripples via
`splashAt`, Well Garden before `#wworld`). `drink()` animates only while `S.v==='water'` and `#wqch` exists. The water
progress card repeats the Hydration system card and could go in the redesign.

## 32. Every emoji drawn as pixel art

Requested after session 2: no emoji should look like a smooth Apple or Android emoji anywhere. `js/v6-emoji.js`
(`HWEmoji`, loaded right after `js/v6-pixel.js`) converts them all, without editing the ~750 strings that hold them.

* *How:* a MutationObserver on `<body>` (plus one pass at load) finds text nodes with emoji (`\p{Emoji_Presentation}`,
  or any emoji symbol followed by U+FE0F, with skin tones, keycaps and ZWJ joins) and wraps each emoji in
  `<span class="pxe pxeN"><span>emoji</span></span>`. The inner text is kept at opacity 0; the outer span shows the
  picture as a background (one CSS class per distinct emoji, so the picture data is stored once). Conversion runs in
  the observer's microtask, before the browser paints, so the emoji glyph never shows.
* *Pictures:* the hand-drawn icon where one shows the same object (`SAME`), otherwise the emoji pixelated on a canvas:
  drawn at 112 px, averaged into a 14×14 grid (cells less than 45% covered are left empty), snapped to the icon palette
  plus pink, magenta and teal, and given the 1-pixel ink outline. 16×16 PNGs, made once per emoji per visit.
* *Size:* from the font size around the emoji, 1.2 em rounded to 8 px steps, at least 16 px, so pixels stay even.
* *Unchanged:* `textContent`, so the tutorial's text search, the add-ons' string anchors (§30), screen readers and every
  test that reads text see the same characters. Strings in code still contain emoji.
* *Not converted:* `<option>` text and form fields (cannot hold pictures; none contain emoji today), SVG, and
  typographic symbols drawn as text (✓ ✕ ▶ ◀ ★ ✿). A device that cannot draw an emoji keeps it as it is, and an engine
  without Unicode property escapes keeps all emoji (the regex is built at run time inside try/catch).
* *Differences between devices:* the pixelated pictures come from the device's own emoji font, so they look a little
  different on an iPhone, an Android phone and Windows. Hand-drawn icons are the same everywhere; drawing more of them
  (most used first, §30) removes that difference one emoji at a time.

The device matrix is now two files, `tests/25-matrix.test.mjs` (sizes, rotation, themes) and
`tests/25-matrix-input.test.mjs` (touch, keyboard, long text, safe areas, window resizing): as one file it already took
88.5 s before these sessions, so a little extra work per page pushed it past the runner's 90 s limit per file.

Tests: `tests/30-emoji.test.mjs` (no emoji drawn as text on the title screen, any page, a toast, a celebration, changed
text, the region dialog or any mini-game; the text is kept; hand-drawn icons used for the same objects; pixelated
pictures are 16×16, palette-only and outlined; sizes in 8 px steps; no overflow at 360 px). 190 tests in total.

## 33. RPG upgrades: Water Quest scene and Dream Battle

**Character rig (`js/v6-rig.js`).** The existing knight (`kn.webp`) and orc (`orc.webp`) are animated as cut-out puppets:
one image per character, cut by SVG clip paths into parts (knight: cape, body, legs, shield, head, sword hand; orc: body,
legs, head, axe hand). Parts rotate on their joints, and the body layer has the parts cut out (even-odd clip), so nothing
is drawn twice. Poses are CSS classes (`s-idle`, `s-walk`, `s-kneel`, `s-scoop`, `s-drink`, `s-carry`, `s-pour`, `s-cel`,
`s-ready`, `s-attack`, `s-block`, `s-hurt`, `s-tired`, `s-down`, `s-win`; orc `s-idle`, `s-walk`, `s-attack`, `s-hurt`,
`s-taunt`, `s-defeat`), so idle animation costs no JavaScript and reduced motion shows the pose still. Turning is a short
stepped squash through the middle. Class names are prefixed (`hwr`, `r-*`, `rgk`, `rgo`, `rgw`, `rgl`) because the
original stylesheet already uses `.rg`, `.sw`, `.pp`, `.bd`, `.ax` and `.fl`.
`HWRig.paint()` draws scene layers as real pixel art: hard-edged polygons and ellipses on a 320×180 canvas, cached as a
data: URL for the session and shown scaled up with `image-rendering: pixelated`.

**Water Quest (`js/v6-waterquest.js`).** The Well of Life block (`#wq`) is replaced by a 16:9 stage (bottom-anchored,
cropped at the sides on narrow screens and at the sky on short landscape ones): painted far / mid / foreground layers
(sky by time of day from `HWTitle.phase`, mountains, tree line, cliff and waterfall, a pond with shallows, depths and
reflections, a jetty, a path and a stone well), animated life on top (waterfall, foam, shimmer, a fish, mist, motes or
fireflies, sun rays, clouds, birds), the original well stages and Well Garden discoveries (`js/v6-water.js` keeps
`stage()`, `finds()`, `ripple()` and the sprites), the knight and his reflection, a tint and a vignette.
`wqFlow` is replaced: idle → turn → walk to the jetty → kneel → scoop (ripples, splash) → drink → carry → turn → walk to
the well → pour (stream, ripples, the well's water and gauge rise) → celebrate → the original `flood2` and re-render. A
second log during the sequence only updates the meters. The original `complete()` banner waits until the sequence ends.
Leaving the page stops the sequence (every step checks the scene is still on the page).

**Dream Battle (`js/v6-dream.js`).** `dbat()` and `dbState()` are replaced. Strength is continuous (formula in the file
header): duration against the age goal (blended 75/25 with up to two earlier nights) × (0.7 + 0.3 × quality from
restfulness, awakenings and time to fall asleep). The battle is deterministic: up to four swings of 25·S/0.70 damage, so
S ≥ 0.70 defeats the orc and stronger knights win in fewer swings; below that the orc keeps what is left. Swing speed,
reach, hit size, glow and blocking also scale with S. The dungeon has torchlight baked into each wall block plus flickering
glow (opacity and scale only) and swaying shadows; the original princess (Princess Lyra of the Dream Realm, a 32×48
sprite drawn in the file) waits behind a portcullis that rises when the knight wins. The card shows the strength, a
five-zone scale with the winning line, a REPLAY button and "How sleep becomes strength". It plays once per logged night
per visit; nothing is saved.

Tests: `tests/31-dream-battle.test.mjs` (the five sleep levels rise gradually and only adequate and very good sleep
win; every quarter hour changes strength without a jump; quality, earlier nights and age matter; each level's battle on
the page ends as planned; replay; reduced motion; no sleep logged; phone portrait and landscape) and
`tests/32-water-quest.test.mjs` (painted layers and lighting by time of day; the full knight sequence; saved once and
after a reload; a second log mid-sequence; the target banner waits; six screen sizes; leaving mid-sequence; reduced motion).

## 34. Stairs refactor: Pulse and Running move into one Stairs page, one session model

**Why.** Stair activity was logged two ways (GPS check-in and a manual form) and heart rate a third way (the Pulse
page), and the manual stair form copied its after-workout heart rate into a separate `pulse` entry, so the same
reading lived twice. Running had its own page. Now one page holds all of it and one record shape holds every session.

**The page (`js/v6-stairs.js`, `HWStairs`, loaded right after `js/v6-provisions.js`).** `pages.stair` is rebuilt as a
HUD (steps today, sessions and workouts this week, last workout heart rate, daily-climb bar, jump buttons) and three
sections, each with a fantasy name and a plain label:
1. **Wanderer's Stairs · casual stair climbing**: the GPS CHECK-IN card (`HWGps.card()`, no longer injected by
   `js/v6-gps.js` itself) and LOG A CLIMB BY HAND (stairway picker, steps per climb × climbs, date and time).
2. **Trial of Breath · stair workout**: PACE & BREATHE (the original rhythm guide and climber, now also the workout
   clock, plus a stairway list), HEART RATE · THIS WORKOUT (BEFORE and AFTER, each a typed BPM and its own animated
   trace in blue / red), SEAL THE WORKOUT (steps, minutes from the timer or typed, the calorie estimate, SAVE), then
   HEART RATE · RECENT WORKOUTS (before ● and after ■ per workout, legend, hover titles, table view; the two series
   colours pass the palette validator in light and dark) and the SESSION CHRONICLE (every session as a card with
   WORKOUT/CASUAL and GPS/BY HAND tags, pace, minutes, estimate, before/after bars, edit and delete).
   The Adventure Trail launch card sits after the chronicle (marker `<!--stair-games-->`).
3. **Running Road · running**: the run tracker from `js/v6-running.js` (`HWRun.section()`), unchanged in behaviour.
   Its map (Leaflet + OSM tiles) loads only when Running is wanted (the old `run` route, the Running jump button,
   a run started or in progress, or SHOW MAP) and once it is on screen, so logging stairs never downloads a map.

**Retired.** The Pulse page (BPM, activity, date/time, notes, SAVE PULSE, its ECG and its history) and the Health Hall
tiles for Pulse and Running. The old routes stay valid: `go('pulse')` opens the Workout section and `go('run')` the
Running section, so the kingdom map node, quest links, the home tile and saved links all still work. Removed from the
stair forms: Notes and the free Duration field (workout minutes now come from the timer and can be corrected).
No pulse entries are created any more. `pages.pulse`, `acts.savepulse`, `ecg()` and the original form code remain in
`js/hw-02-core.js` (the fidelity test keeps every original name); they are overridden or unused.

**One session model.** Every session is a `stair` entry (`v` = total steps); `m` gains `kind` ('casual' | 'workout'),
`src` ('gps' | 'manual'), `hrS` ('manual': heart rate counted and typed by the user) and `kcal` ({v, lo, hi, m} at save
time). Older entries are read through `HWStairs.session()`, which infers `kind` (heart rate or minutes → workout) and
`src` (`chk:'gps'` → gps). Nothing is rewritten in storage, so there is no schema step (`sv` stays 8): old backups,
cloud merges and other devices keep working.

**Old pulse data.** Kept as is, in the save and in backups, never deleted; no longer listed (Settings' entry list hides
them and drops the `pulse` filter). Everything that read pulse now reads workout heart rates: `rest(d)` = average
before-workout BPM, `hr(d)` = average after-workout BPM (Statistics, Guide, insights' "check your data"), the home
Heart rate tile (last after-workout BPM, opens the Workout), Heartstone Hall's restoration (`logd('pulse')`: a day with
an old pulse entry or a workout heart rate, so past progress is kept), its region panel, the daily score, the focus quest
(now "Heart check": before and after in one workout), the badges (heart-rate readings = workouts with a heart rate + old
standalone pulse entries, not the copies stair sessions used to make) and the tutorial steps.

**Calorie estimate (`HWStairs.estimate`).** Shown only when the profile was confirmed by the user (onboarding sealed, or
age, sex, height and weight saved in the Workout's own small form, which sets `st.p.cfm`; the app's default 60 kg /
165 cm / 16 y never count) and a workout time exists. Method A: 2024 Adult Compendium MET for stair climbing at the chosen
pace (Easy 4.5 = 17133 slow, Moderate 6.8 = 17131 general, Vigorous 9.3 = 17134 fast) × the person's resting energy
per minute (Mifflin-St Jeor BMR ÷ 1440) × minutes. Method B, only with an after-workout heart rate of 90–180 BPM:
Keytel et al. 2005 (J Sports Sci 23:289), kJ/min from heart rate, weight, age and sex, ÷ 4.184 × minutes. The estimate
is the mean of the methods used, with their spread as a range; it is labelled an estimate, and a rough guide for
under-18s (both formulas come from adult data).

**Demo stairway.** ST01 "Tangga Selangkah Menara Gading" (7.26°) was a placeholder in the shipped code, not user data:
the same name as ST02, no coordinates, and shown pre-selected on every visit. It is gone, and no stairway is chosen until
the user picks one or checks in by GPS. Sessions already logged there keep their own name and numbers.

**Never fabricated.** A trace shows a BPM only when one was typed in ("NOT ENTERED" otherwise); nothing claims to come
from a device. Traces animate only while they have a BPM and are on screen (battery); reduced motion draws them still.

Tests: `tests/33-stairs.test.mjs` (section order and names, no Pulse page / pulse form / demo stairway / pre-selection,
routes, manual and GPS sessions with one record shape, the workout end to end with both traces, the timer and a refresh,
the estimate against hand-worked numbers, missing profile and invalid input, old data kept untouched and read through
the model, 360 px). Updated: `01`, `02`, `03`, `16`, `19`, `24`, `25-matrix-input`, `26`, `27`, `28` (they used the
Pulse page, the Running tile or ST01).


## 35. Final polish and QA

The last session: polish, test, fix, stabilise. No new systems, no saved-data change (no schema step, `sv` stays 8),
no page removed. Three add-ons (`js/v6-storm.js`, `js/v6-ambient.js`, `js/v6-badges.js`) and small edits.

**Storm Within (`js/v6-storm.js`).** The knight in the stress scene is the same art, now through the character rig, with a
small face layer drawn in kn.webp's own pixel grid inside the head part (skin patches over the original eyes and mouth,
then brows, lids, eyes, a seven-segment mouth, teeth, sweat, cheeks, under-eye shadow, furrow). Each feature is a CSS
custom property on the scene (`.qs`), interpolated from five reference expressions (calm, slightly concerned, tense,
distressed, overwhelmed) so every rating 1–10 gives its own face and CSS transitions blend between them. Breathing
quickens, the posture crouches and leans, the shield rises and a faint tremble starts near the top; a light behind the
knight cools and flowers droop. A 2× portrait in the scene's corner makes the face readable on phones, and the meter
names the mood in words ("KNIGHT: TENSE"), so nothing depends on colour or motion. The slider no longer rebuilds the
scene (`sqPaint`): the weather is swapped and the knight, portrait, light and flowers are kept, so the face transitions.
Before a rating the knight is "slightly concerned". The storm creatures make room for the portrait.

**Living world (`js/v6-ambient.js`).** One fixed layer behind the app (`z-index:-1`, no pointer events, `contain:strict`),
themed by region: meadow, water, night, mountain, forest and hall. Two painted pixel strips per theme (HWRig.paint,
cached; they tile seamlessly) give depth, with scroll-driven parallax where supported (no JavaScript). Moving parts are
a few CSS elements (clouds, motes, fireflies, stars, lake shimmer, falling leaves, torches with flickering glow),
transform and opacity only. Hidden on the title and onboarding screens. Performance mode stops most of them, reduced
motion and Animations Off stop all of them, a hidden tab pauses them. The page footnote gets a backing so text never
sits on scenery. **Finish:** buttons get a light bevel and hover / pressed / disabled states, cards a sheen and a rule
under their first heading, progress bars a gem-like highlight, the current tab a gold ring, clickable tiles lift on hover.

**Icons.** Eight more hand-drawn icons in `HWPixel`: workout, pulse (heart rate), badge, home, flame, star, mind, game.
`HWEmoji` draws 19 more emoji with them (🏋️ 💪 💓 🫀 🏅 🎖️ 🏠 🔥 ⭐ 🌟 ✨ 🧠 🎮 🧗 🪜 🥤 😴 🛏️ 🍽️), including every bottom-nav
and Health Hall tile emoji, so those look the same on every device.

**Badges and quests (`js/v6-badges.js`).** 'First Drop' was an exact duplicate of 'First Sip' and is retired from the badge
list (the Water page's own list keeps it; an earned one stays in the save). Five badges that shared an icon with another
get their own (names are unchanged, since earned badges are stored by name). New, from data already saved: First Run,
Road Runner (10 km), Long Road (42 km) from `healthwiz_runs`; Trial of Breath and Workout Regular (10) from stair
sessions of kind `workout`; Dream Champion when a logged night is strong enough to win the Dream Battle. The weekly
"Mountain paths" quest now counts runs as well as stair sessions.

**Tutorial.** Every step's target was checked on the current pages (all present). Updated: the Health Hall line (Running
lives in Stairs), the Water Quest step (the knight's walk, drink, carry, pour), the Dream Battle step (strength from
duration and quality), the stress step (the Storm Within follows the rating), and a new Running Road step.

**Bugs fixed.**
* Badge cards ran the description into the date ("Log water onceUnlocked 2026-…"): each line is now its own block.
* Unlocked badge cards were partly transparent (a gradient to a translucent gold), so whatever lay behind showed through.
* A burst of toasts (a day's quests completing together, e.g. after a sync) could cover a phone screen: at most three
  show at once, newest kept.
* `tests/08-medius.test.mjs` failed on Sundays (§30): its stress check-ins are now seeded before the current week.

**Audits with nothing to fix.** Navigation: every `data-a` on every page has an action and every route is a real page
(old `pulse` / `run` / `water` routes still land in the right place); no page scrolls sideways at 360×740, 740×360,
820×1180 or 1440×900. Timers: every interval found is tied to a running activity (workout clock, breathing, run tracker,
music, cloud sync) and stops with it; the new animation is all CSS.

Tests: `tests/34-final-polish.test.mjs` (the expression at every rating: ten distinct, gradual, monotonic where it
should be, words for every band, the knight kept while sliding, reduced motion; the ambient theme per page, no clicks
intercepted, fewer moving parts in Performance, none with Animations Off; the new icons and emoji mapping; toasts
capped; readable opaque badge cards; no duplicate badge names or icons, the new badges' progress and award; the weekly
quest counting runs; every tutorial step's target; the navigation audit at four sizes).

**Follow-up (after review on a phone).**
* *Kingdom map icons were blank squares.* The map's label style `.kn span` (cream box, 2 px border, padding) also matched
  the spans `js/v6-emoji.js` uses to draw each emoji, and its `background` shorthand removed the picture. The emoji rules
  now use a doubled class (`.pxe.pxe`, `.pxe.pxe.pxeN`) and reset border, padding and margin, so any component that
  styles every `span` leaves the pictures alone. Home's mini map had the same fault.
* *Removed the "Time to fall asleep" card* on the Sleep page (four static stages and the last logged minutes). The
  "Minutes to fall asleep" field in LOG SLEEP stays: the Dream Battle's sleep quality uses it.
Tests: `tests/34-final-polish.test.mjs` (all eight region icons drawn on the Kingdom page and Home, no fall-asleep card).
* *Updates reached phones up to 10 minutes late.* GitHub Pages sends `Cache-Control: max-age=600`, and the service
  worker's network-first fetch went through the browser's HTTP cache, so after a deploy a phone could keep running the
  previous scripts (the map fix above looked "not fixed" right after it was merged). App files are now fetched with
  `cache: 'no-cache'` (revalidated, a cheap 304 when unchanged); offline behaviour is unchanged.

## 36. Looks: more themes, the onboarding chamber, the Shadow Keep

All in `js/v6-looks.js` (loaded after `js/v6-badges.js`; added to `sw.js` PRECACHE).

**Themes.** One `THEMES` map of CSS-variable sets (`--bg --pn --p2 --ink --mut --ln`). `light` (Parchment) and `dark`
(Night Keep) mirror the original stylesheet's sets exactly and still come from it; the five new themes (Enchanted
Forest, Crystal Cavern, Ember Forge, Frost Citadel, Desert Oasis) are injected as `:root[data-skin=…]` rules. Each theme
has a base (`light`/`dark`) that goes in `data-theme`, so every existing light/dark rule keeps working under it. Health
colours (`--red --blue --grn --vio --gold`) are not part of any theme, so they read the same everywhere. Contrast of the
new themes: text 9.9–16.2:1 and muted text 5.6–10:1 on `--bg`, `--pn` and `--p2`; each health colour against `--p2` is
at least as far apart as in the original theme with the same base. (Unchanged and noted: the original Parchment muted
text on `--p2` is 4.45:1.) Saved as `st.s.theme` (optional string, no schema step): missing or `auto` = match the
device as before, `light`/`dark` as before, or a new theme key. Settings → Theme is a swatch grid (each swatch drawn in
its own colours, with the health colours) plus *Match system*; a tap applies at once. The original THEME button still
toggles light/dark.

**Onboarding chamber** (`pages.onb`). A fixed CSS/SVG layer shown only on the Traveller's Registry (the ambient layer is
hidden there): blue-violet gradient, brick wall and three stone arches (crisp SVG), two flickering torches, ten rising
motes and two fog bands. A gold rune circle turns slowly behind Medius; its six runes light as the six steps are done.
The form and Medius's speech box use their own parchment colours (a scroll with rolled ends), so they stay dark-on-light
and high-contrast in every theme. Sealing the registry adds a light burst and a two-note chime after the existing
fanfare (`sfx`, so the sound setting applies). 17 animated elements, transform/opacity only; none under reduced motion
or Animations Off; Performance mode drops a fog band and half the motes.

**The Shadow Keep.** The villain's fortress lived only in the title scene, where the right-hand turret of the old dark
tower ended at y = 74 while the slope beneath it dropped to y ≈ 80–89, so it floated. It is redrawn as pixel art (SVG
rects, `crispEdges`): a rocky cliff base with a cast shadow, a plinth on the ground line that every tower, the keep and
both walls stand on (all end at its top, y = 56 local), crooked spires, broken battlements, red and violet windows
that flicker, the keep's great eye, a dark gate with a red glow and a half-raised toothed portcullis, chains, tattered
banners, cracks, moss, three bats and two rings of storm clouds circling it. `js/hw-03-part.js` now draws
`HWLooks.title()` in place of the old tower and bats (the scene's seeded random numbers are still drawn, so the rest of
the scene is byte-for-byte the same); the title's tap area for the tower follows the new outline. The Kingdom page shows
the same keep in a *Shadow Keep* card above the chronicle. Its storm strength is `1 − restored/8` (min 12%): fainter
and slower as regions are restored. Game layer only; labelled so.

Tests: `tests/35-looks.test.mjs` (every theme: applied, base, text and muted contrast, health colours unchanged, saved,
survives a reload; THEME button and Match system; runes per step, the chamber only on the registry, under 30 animated
parts, burst and chime, the scroll stays dark-on-light in the dark theme, nothing moving under reduced motion; the keep
on the title and Kingdom page, every tower and wall ending on the plinth, crisp edges, a weaker storm with restored
regions).
