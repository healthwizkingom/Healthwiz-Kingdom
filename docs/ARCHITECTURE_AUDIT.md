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
