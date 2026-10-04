# Healthwiz-Kingdom

**HealthWiz Kingdom** (by Group 14) is a pixel-art fantasy RPG that is also a health tracker.
You log water, meals, sleep, stairs (with workout heart rate), runs and stress, and Medius, the Wizard King, guides you
as your actions restore the kingdom. It is a wellness tracker, not a medical device.

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
js/v6-emoji.js             every emoji the app shows drawn as pixel art (hand-drawn icon or the emoji pixelated)
js/v6-provisions.js        Nutrition & Hydration as one page (the Provisions Hall): 'food' and 'water' are its two halves
js/v6-stairs.js            the Stairs page: casual climbing (GPS + by hand), stair workout (heart rate before/after, calorie estimate), running; one session model
js/v6-motion.js            animation settings + performance modes (High / Balanced / Performance), off-screen pause
js/v6-particles.js         one shared canvas particle system (level-up, badges, quests)
js/v6-insights.js          "Medius notices": insights from your own baselines and trends
js/v6-quests.js            adaptive daily focus quest + weekly quests
js/v6-streaks.js           current + gentle streaks, week view, new achievements
js/v6-xp.js                fair XP: daily logging allowance, exploration reward
js/v6-kingdom.js           five region states (incl. Flourishing) and region detail panel
js/v6-medius.js            Medius reacts to events (speech bubbles with cooldowns)
js/v6-charts.js            touch/keyboard/screen-reader charts, empty states, week-vs-week stats
js/v6-world.js             visible world progression on the map + kingdom chronicle
js/v6-title.js             title screen: time of day, weather, returning-player ribbon, tap reactions
js/v6-games.js             mini-game framework: scene, HUD, character, timers, rewards, completion
js/v6-water.js             Well Garden mini-game; well stage, discoveries, ripples and sprites used by the Water Quest scene
js/v6-rig.js               character rig: the knight and orc cut into jointed parts with pose classes; pixel-art scene painter
js/v6-waterquest.js        Water Quest: layered valley scene by time of day and the knight's walk → drink → carry → pour sequence
js/v6-dream.js             Dream Battle: continuous sleep → strength, torch-lit dungeon, princess, deterministic battle
js/v6-storm.js             Storm Within: the knight's face, posture and surroundings follow the stress rating, smoothly
js/v6-ambient.js           the living world behind every page (themed by region) and the shared finish for buttons, cards, bars
js/v6-food.js              Market Kitchen mini-game (pick foods from stalls, cook, build a balanced plate)
js/v6-trail.js             Adventure Trail mini-game (follow trail blazes at forks, climb the stairs in rhythm)
js/v6-grove.js             Calming Grove mini-game (follow a light over the pond as it grows and shrinks with your breath)
js/v6-night.js             Night Watch mini-game (match star-chart constellations in the night sky)
js/v6-badges.js            badge audit: duplicates retired, own icons, running / workout / Dream Battle badges
js/v6-gps.js               GPS check-in on the Stairs page (one reading on tap, nearest stairway, confirm, discovery)
js/v6-pwa.js               install as an app + offline: manifest/icon links, service worker, offline badge, Settings card
js/v6-cloud.js             optional Supabase cloud save: sign-in, sync with offline queue, three-way merge, Settings card
js/v6-board.js             Hall of Heroes: opt-in leaderboard of game progress only (Quest Board card + Settings privacy card)
supabase/migrations/       SQL for the cloud save and the leaderboard (Row Level Security) — run each file once in the Supabase project
sw.js                      service worker: pre-caches the app, network first, works offline (keep PRECACHE in sync)
manifest.webmanifest       web app manifest (name, colours, standalone display, icons)
js/v6-safety.js            an error card instead of a blank screen
assets/img/                the 15 images that were embedded as base64 in the original (the PNG art re-encoded as lossless WebP)
assets/icons/              app icons (original pixel art, drawn by tools/make-icons.mjs)
legacy/HealthWiz_Kingdom_5-4-3.html   the complete original single file (source of truth)
tools/import-original.mjs  one-time import of the original (re-running it overwrites later edits)
tools/build-standalone.mjs bundles everything back into one HTML file
tools/make-icons.mjs       redraws the app icons
tests/                     browser tests (Playwright + node:test): fidelity, every feature, performance budgets, device matrix
docs/                      architecture audit and plan, event catalog, testing guide (docs/TESTING.md), pixel-art standard (docs/PIXEL_STYLE.md)
```

The scripts are classic `<script>` tags that share one global scope, so keep them in order.
`tests/00-fidelity.test.mjs` checks that the markup and stylesheet still match the original (apart from its short
`EDITS` list of deliberate changes), and that no original function, constant, page or action has been removed.

## Saved data and versions

Saved data carries a schema version (`sv`, currently **8**). On load, `js/v6-schema.js` upgrades
older data step by step, and restored backups go through the same steps. Before anything is
upgraded, repaired or discarded, the raw stored text is copied to a `healthwiz_backup_<reason>_<time>`
key (the newest 3 are kept). If data was saved by a newer app version, it is left as it is.
To change the data format, add a step to `STEPS` in `js/v6-schema.js`, raise `V`, and add a test.

**Why the split:** the original was a 1 MB single file with five 57–250 KB lines of embedded
images. Pasting it into GitHub cut it off at ~100 KB and left a blank site. No file here is
larger than 64 KB.

## Cloud save (optional for users)

The app is connected to the free-plan Supabase project **healthwiz-kingdom** (`wghkbrtwrdrejmoswhza`, Singapore).
Users who never sign in stay local-only: no cloud request is made. Signed-in users get a private cloud save that syncs
between devices (Settings → Cloud Save).

* Project URL and **publishable** key are in `CFG` at the top of `js/v6-cloud.js`. The publishable key is public by
  design; Row Level Security keeps every save private. The app refuses secret / service_role keys; never commit one.
* Database: `supabase/migrations/20261003000000_hw_cloud_save.sql` (table `hw_saves`, RLS policies, `rev` trigger,
  `hw_delete_account()`). It must have been run once in the project (SQL editor, or `supabase db push`).
* Leaderboard: `supabase/migrations/20261004000000_hw_leaderboard.sql` (table `hw_board`, written only by
  `hw_board_publish()` and read only through `hw_board_top()`). Run it after the cloud-save SQL.
* Auth → URL Configuration: set the Site URL / redirect URLs to the GitHub Pages address, so the email confirmation link
  brings users back signed in.
* Free plan limits: 500 MB database, 50,000 monthly active users, and a project paused after 7 days without activity
  (restore it from the dashboard; nothing is lost, and the app keeps working offline meanwhile).

To use another project, replace `CFG` (or clear it and paste a project in Settings → Cloud Save).
Logs are always saved on the device first; offline changes sync later and edits from two devices are merged
(`docs/ARCHITECTURE_AUDIT.md` §26). The session is kept in `healthwiz_cloud`, never in the save or backups.

## Medius AI

The Wizard's Counsel calls the Anthropic API directly from the browser, with no key. That only
works when the page runs inside Claude. Elsewhere (GitHub Pages, opened locally) it shows
its built-in offline message. A real deployment needs a small backend that holds the key
(master prompt §42); the key must never go into this repo.

## Test

```
npm install   # only if Playwright / acorn are not already available
npm test      # builds the standalone file, then runs every browser test
```

`docs/TESTING.md` maps the master prompt's test matrix (§92–96) to the test files and lists the checks that still
need real phones and browsers (Safari, Firefox, Samsung Internet, screen readers, GPS outdoors).
