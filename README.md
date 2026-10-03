# Healthwiz-Kingdom

**HealthWiz Kingdom** (by Group 14) is a gamified wellness tracker with a pixel-art kingdom. You log
water, meals, sleep, pulse, stair climbing and stress to restore the kingdom's regions and earn XP,
quests and badges. It is a wellness tracker, not a medical device.

## Run it

It is a static site with no build step and no server code.

* **Open locally:** open `index.html` in a browser (double-click works).
* **GitHub Pages:** serve the repository root.
* **One shareable file:** `npm run build` writes `dist/healthwiz-standalone.html`, with every script inlined.

Data is stored in the browser's `localStorage` under `healthwiz`. Use **Settings → Backup** to
download or restore it.

## Project layout

```
index.html              original markup + full stylesheet, loads the scripts below in order
js/menu-data.js         original KOLEJ MARA KULIM menu data (152 foods, 31 + 14 Ramadan menus)
js/legacy-core.js       original v5.4 core, welcome/food/water/sleep (verbatim)
js/reconstructed.js     RECONSTRUCTED runtime: router, nav, events, sprites, macros, modal, music
js/rc-home.js           RECONSTRUCTED kingdom home: quests, map, attributes, badges
js/rc-trackers.js       RECONSTRUCTED pulse, stairs, mind forest + counsel, BMI, goal forge
js/rc-system.js         RECONSTRUCTED stats, guide, settings, backup UI, reset
js/legacy-tail.js       original v5.3 tail: energy, trends, health connections, backup logic (verbatim)
legacy/                 byte-for-byte copies of the two original committed fragments
docs/ARCHITECTURE_AUDIT.md   audit of the original code and the repair plan
tests/                  browser tests (Playwright + node:test)
tools/build-standalone.mjs   single-file bundler
```

The scripts are classic `<script>` tags that share one global scope, so they must stay in this order.
Keep each file well under 100 KB. The original app was lost when a ~100 KB paste was cut off.

## Test

```
npm install   # only needed if Playwright isn't already installed globally
npm test      # builds the standalone file, then runs every browser test
```
