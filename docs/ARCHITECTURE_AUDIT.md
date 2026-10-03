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
