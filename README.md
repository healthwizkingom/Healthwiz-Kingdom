# Healthwiz-Kingdom

**HealthWiz Kingdom** (by Group 14) is a pixel-art fantasy RPG that is also a health tracker.
You log water, meals, sleep, pulse, stairs and stress, and Medius, the Wizard King, guides you
as your actions restore the kingdom. It is a wellness tracker, not a medical device.

The app is the team's original **v5.4.3** build, split into files so it can live safely in git.
Changes since then are small, tested and listed in `docs/ARCHITECTURE_AUDIT.md`.

## Run it

It is a static site with no build step and no server code.

* **Open locally:** open `index.html` in a browser.
* **GitHub Pages:** serve the repository root.
* **One shareable file:** `npm run build` writes `dist/healthwiz-standalone.html`, with all scripts and images inlined.

Data is stored in the browser's `localStorage` (`healthwiz`). Use **Settings → Backup** to download or restore it.

## Project layout

```
index.html                 original markup + stylesheet (byte-identical), loads js/ in order
js/hw-01..07-*.js          the original script, cut only between top-level statements
js/v6-schema.js            saved-data versioning, migrations and damaged-data recovery
js/v6-events.js            event bus observing the app (catalog: docs/EVENTS.md)
js/v6-ui.js                shared UI helpers (injected styles, completion banner)
js/v6-motion.js            animation settings + performance modes (High / Balanced / Performance)
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
js/v6-water.js             Well Garden mini-game + living well scene (scenery by well stage, ripples, discoveries)
js/v6-food.js              Market Kitchen mini-game (pick foods from stalls, cook, build a balanced plate)
js/v6-trail.js             Adventure Trail mini-game (follow trail blazes at forks, climb the stairs in rhythm)
js/v6-grove.js             Calming Grove mini-game (follow a light over the pond as it grows and shrinks with your breath)
js/v6-night.js             Night Watch mini-game (match star-chart constellations in the night sky)
js/v6-safety.js            an error card instead of a blank screen
assets/img/                the 15 images that were embedded as base64 in the original
legacy/HealthWiz_Kingdom_5-4-3.html   the complete original single file (source of truth)
tools/import-original.mjs  one-time import of the original (re-running it overwrites later edits)
tools/build-standalone.mjs bundles everything back into one HTML file
tests/                     browser tests (Playwright + node:test), incl. a fidelity check
docs/                      architecture audit and plan
```

The scripts are classic `<script>` tags that share one global scope, so keep them in order.
`tests/00-fidelity.test.mjs` checks that the markup and stylesheet still match the original, and that
no original function, constant, page or action has been removed.

## Saved data and versions

Saved data carries a schema version (`sv`, currently **7**). On load, `js/v6-schema.js` upgrades
older data step by step, and restored backups go through the same steps. Before anything is
upgraded, repaired or discarded, the raw stored text is copied to a `healthwiz_backup_<reason>_<time>`
key (the newest 3 are kept). If data was saved by a newer app version, it is left as it is.
To change the data format, add a step to `STEPS` in `js/v6-schema.js`, raise `V`, and add a test.

**Why the split:** the original was a 1 MB single file with five 57–250 KB lines of embedded
images. Pasting it into GitHub cut it off at ~100 KB and left a blank site. No file here is
larger than 64 KB.

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
