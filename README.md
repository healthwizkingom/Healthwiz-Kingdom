# Healthwiz-Kingdom

**HealthWiz Kingdom** (by Group 14) is a pixel-art fantasy RPG that is also a health tracker.
You log water, meals, sleep, pulse, stairs and stress, and Medius, the Wizard King, guides you
as your actions restore the kingdom. It is a wellness tracker, not a medical device.

The app is the team's original **v5.4.3** build, unchanged, split into files so it can live safely in git.

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
js/v6-safety.js            the one addition: an error card instead of a blank screen
assets/img/                the 15 images that were embedded as base64 in the original
legacy/HealthWiz_Kingdom_5-4-3.html   the complete original single file (source of truth)
tools/import-original.mjs  regenerates index.html, js/hw-*.js and assets/img from the original
tools/build-standalone.mjs bundles everything back into one HTML file
tests/                     browser tests (Playwright + node:test), incl. a fidelity check
docs/                      architecture audit and plan
```

The scripts are classic `<script>` tags that share one global scope, so keep them in order.
`tests/00-fidelity.test.mjs` fails if the split code no longer matches the original. Once you
start editing `js/hw-*.js` on purpose, update or retire that check in the same change.

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
