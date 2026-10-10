# AGENTS.md: HealthWiz Kingdom

Persistent instructions for coding sessions in this repository. Read `README.md` (layout, accounts, tests) before
working; this file only adds the rules.

## What this is

An existing, working health dashboard with an RPG layer (Group 14, class F21, Kolej MARA Kulim), live at
https://healthwizkingom.github.io/Healthwiz-Kingdom/. It is a static site in plain JavaScript: `index.html` loads the
classic `<script>` files in `js/` in order, sharing one global scope. No framework, no bundler, no server code (the
optional cloud parts are in `supabase/`). It is a wellness tracker, not a medical device.

- **Never rebuild it from scratch** and never replace a working module with a new one. Edit the existing code.
- `legacy/HealthWiz_Kingdom_5-4-3.html` is the original source of truth: do not edit it, and do not re-run
  `npm run import` (it overwrites every later edit).
- Keep the app self-contained. The only dev dependencies are `playwright` and `acorn` (tests and build); do not add
  runtime libraries or CDNs.

## Priorities

1. Health information: correct, clear, labelled with units and ranges.
2. Dashboard usability on a phone.
3. Reliability and performance.
4. The fantasy pixel-art look and the RPG layer, which exist to support tracking and must never hide, distort or
   replace health data. Game scores, XP and kingdom states are never presented as medical measurements.

## Before you edit

- Inspect the files you will touch and what calls them (`js/hw-*` is the original app, `js/v6-*` the later modules;
  each `v6` file's purpose is listed in the README). Check `docs/EVENTS.md` before adding events.
- Reuse what exists: `HWUI` (`js/v6-ui.js`), `HWPixel` tokens, panels and icons (`js/v6-pixel.js`), pixel emoji
  (`js/v6-emoji.js`), charts (`js/v6-charts.js`), the "Log for…" control (`js/v6-when.js`), the shared tracker header
  (`js/v6-hall.js`), help buttons (`js/v6-help.js`), the button styles (`js/v6-buttons.js`).
- Follow `docs/PIXEL_STYLE.md` for any visual change: 4 px grid, square or stepped corners, hard shadows, theme tokens,
  `var(--fh)` pixel font for headings, pixel icons instead of emoji glyphs, stepped motion that honours reduced motion
  and the performance modes. Keep the layout responsive.
- Saved data lives in `localStorage` key `healthwiz` with schema version `sv`. Keep existing keys and entry shapes.
  A format change needs a step in `STEPS` in `js/v6-schema.js`, a raised `V`, and a test.

## Wiring rules that tests enforce

- A new `js/` file goes into `index.html` in the right load order **and** into `PRECACHE` in `sw.js`
  (`tests/20-pwa.test.mjs` fails otherwise). `npm run build` inlines it into `dist/healthwiz-standalone.html`.
- Changes to the original markup or stylesheet must be added to the `EDITS` list in `tests/00-fidelity.test.mjs`; no
  original function, constant, page or action may be removed.
- Keep each code file (`index.html`, `js/*.js`) under 64 KB, the reason the app was split (see README).
- Code stays within ES2018 (older Safari and Samsung Internet).
- Any page error or `console.error` fails the tests.

## Verify before calling it done

- Run `npm test` (builds, then all Playwright tests, about 10 minutes) or at least the relevant files, e.g.
  `node --test tests/33-stairs.test.mjs`. See `docs/TESTING.md` for which test covers what.
- Check every calculation you add or change against a worked example (BMI, pulse, kcal, VO₂, angles, totals), with
  units.
- Exercise the interaction in the real app (tap and keyboard), and check a phone width (360–390 px): no sideways scroll,
  tap targets at least 44 px, nothing hidden under the bottom tabs.
- Add or update a test for new behaviour, and add a section to `docs/ARCHITECTURE_AUDIT.md` like the existing ones.

## Health data rules

- **Never invent** health measurements, sensor readings, user entries or experimental results, and never fill a
  missing value with a plausible one. Use demo values only in tests.
- Label every value by kind, in the UI and in code comments:
  - **Measured**: typed in by the user, or read from a device (e.g. Bluetooth heart rate in `js/v6-hr.js`, GPS).
  - **Calculated**: derived exactly from measured values (BMI, sleep duration, θ = tan⁻¹(rise ÷ run)).
  - **Estimated**: formula-based approximations (calorie estimate, VO₂, 220 − age maximum); say "estimate" and show
    the method or range.
  - **Simulated**: game values (XP, levels, kingdom states, mini-game results); never shown as health data.
  - **Missing**: show nothing or an empty state that asks for the input, not a zero or a placeholder number.
- Do not diagnose. Keep the existing non-diagnostic notes and disclaimers, use standard units and ranges, and say when a
  result depends on the individual.

## F21 staircase experiment (Group 14 report)

- Reference for verified data: the latest Word report, currently `GROUP 14 F21 - Full Report (updated).docx` in the
  project's shared files (`report/`), not in this repo. **It has not yet been confirmed by the team as the approved
  version;** ask before treating new numbers from it as final.
- The app already holds the measured stairways in `STUDY` in `js/v6-stairs.js` (A Generator 28.52°, C Block Aisyah
  27.23°, B Block Kenanga 26.43°, with rise, run and hypotenuse) and the report's VO₂ method in `projectVO2`. These
  match the report as of 2026-10-10.
- Use only numbers that appear in the report, and check them against the repo before changing code. If the report and
  the app disagree, or a value is missing or flagged in the report, report it instead of guessing.
- The report ranks the three stairs against each other (mild / moderate / vigorous); the app's fixed angle bands put all
  three in "moderate". Keep both and keep the note that explains the difference.

## Scope and reporting

- Make only the change asked for. No unrelated refactors, renames, reformatting or dependency changes.
- Never commit secrets: only the publishable Supabase key belongs in `js/v6-cloud.js`; the Gemini key is a Supabase
  secret.
- When you finish, list **every file you created, modified or deleted**, the tests you ran with their result, and
  anything you could not verify.
