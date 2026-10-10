# Testing HealthWiz Kingdom

```
npm test                                   # builds the standalone file, then runs every test file in tests/
node --test tests/25-matrix.test.mjs       # one file
node --test --test-name-pattern="touch" tests/25-matrix-input.test.mjs   # one test
```

The tests drive the real app in headless Chromium (Playwright) from `index.html` on disk, or from a small localhost
server for the offline tests. External requests are stubbed, so the suite runs without internet. `tests/cloud-fake.mjs` is a
fake Supabase with the same rules as the real one. Every test collects page errors and `console.error` output and fails on
any. The suite takes about 10 minutes.

Useful helpers in `tests/helpers.mjs`: `openApp({ seed, fresh, viewport, context, before })`, `go(page, view)`,
`state(page)`, `entry(...)`, `daysAgo(n)`, and `yearOfLogs(days)`, a busy history of ≈13 entries a day, for performance and
compatibility tests.

## Where each item of the master prompt's test matrix is covered

### §93 Testing matrix

| Item | Tests |
|---|---|
| navigation | `34-final-polish` (every action and route on every page, four sizes, tutorial targets), `01-original-app`, `25-matrix-input` (tabs by tap and keyboard), `26-journey`, `28-foundation` (every tab and Health Hall tile, and back), `29-provisions` (old Nutrition/Water links, halves, tutorial), `33-stairs` (old Pulse and Running routes open their Stairs sections) |
| data logging | `01-original-app`, `26-journey` (every log type through the UI), `29-provisions` (food and water on the merged page), `33-stairs` (casual climbs by hand and GPS, workouts with heart rate, LOG BPM before/after counted and linked to a sealed workout, one session model, calorie estimate behind ?) |
| editing, deleting | `01-original-app`, `03-events`, `25-matrix-input` (by touch and keyboard), `26-journey` |
| calculations | `01-original-app` (sleep duration, BMI, pulse range), `04-insights` (baselines), `24-performance` (the entry index against full scans) |
| quests | `05-quests`, `03-events`, `34-final-polish` (weekly activity quest counts runs; badge audit and new badges) |
| XP, levels | `07-xp-kingdom`, `03-events` |
| Kingdom | `07-xp-kingdom`, `10-world`, `42-kingdom-map` (painted map, same buttons, zoom → card, colour burst, no frame loop) |
| suggestions | `04-insights` |
| Medius | `08-medius`, `39-accounts-medius` (mood tags, reactions, crisis stays calm/concerned) |
| statistics | `09-charts` |
| backup, restore | `01-original-app` (download, erase, restore from file), `02-schema` (old and newer backups) |
| reset | `01-original-app` (two taps), `03-events` |
| theme | `25-matrix` (device default, saved choice, every page, contrast), `35-looks` (every theme's contrast and health colours, swatches, Match system) |
| responsive layouts | `01-original-app`, `25-matrix` (seven sizes), the 360 px checks in `13`–`23` |
| touch | `25-matrix-input`, `26-journey`, the game tests |
| authentication, cloud sync | `21-cloud`, `22-cloud-sync`, `39-accounts-medius` (onboarding offer, Medius AI signed in/out); SQL: `tools/test-sql.sh`; Edge Function: `40-medius-function` (Deno) |
| leaderboard | `23-board`, `38-hr-runboard`, `39-accounts-medius` (Runners' Board rows follow the account) |
| location permissions, GPS fallback | `19-gps`, `33-stairs` (GPS check-in writes the unified session) |
| offline mode | `20-pwa`, `36-live` (weather and haze unavailable, last good copy, nothing sent while Live Data is off) |
| wake-up alarm, running calories | `37-alarm-kcal` (suggested wake time, st.s.alarm, ringing after a tap only, snooze/STOP, bedside clock, Android intent + fallback, .ics; MET by speed, kcal on old and new runs, totals, % of goal, Nutrition line, weight prompt, haze above Running) |
| live weather, haze | `36-live` (Open-Meteo stubbed: WMO → sky, chip, heat tip, haze bands and advice, Settings card) |
| console errors | every test; `26-journey` runs a whole first day without one |
| pixel art, no emoji glyphs | `34-final-polish` (new icons, ambient world, Storm Within expressions), `28-foundation` (icons), `30-emoji` (no emoji drawn as text on any page, toast, dialog or game) |
| broken references | `26-journey` (handlers, page links, images, asset paths), `20-pwa` (the offline file list) |
| existing data compatibility | `02-schema`, `26-journey` (an old v5.4.3 save on every page), `28-foundation` (every storage key and entry unchanged through every page and a reload), `33-stairs` (old stair and pulse entries kept untouched, read through the session model) |

### §94 Mobile

| Item | Tests |
|---|---|
| taps, scrolling | `25-matrix-input` (taps, finger swipes: vertical scroll, no sideways scroll), `26-journey` |
| modals | `25-matrix` (edit dialog by tap, rotated, keyboard open), `13-games` |
| keyboard opening | `25-matrix` (the edit dialog at 390×500 and 640×300 still reaches SAVE) |
| orientation changes | `25-matrix` (title, pages and dialog at 844×390 and 568×320) |
| safe areas | `25-matrix-input` (viewport-fit=cover and the inset rules); real notch: manual |
| bottom navigation | `25-matrix` (pinned, five tabs, nothing hidden under it) |
| long text | `25-matrix-input` (20-character name, very long food name and note) |
| chart interaction | `09-charts` |
| GPS permission | `19-gps` |
| offline transitions | `20-pwa` |

### §95 Desktop

| Item | Tests |
|---|---|
| mouse, hover | most tests; chart tooltips in `09-charts` |
| keyboard | `25-matrix-input` (Tab order, focus ring, dialogs), `09-charts`, `13-games` |
| window resizing, multiple navigation layouts | `25-matrix-input`, `25-matrix` |
| large displays | `25-matrix` (1920×1080: centred column) |

### §96 Mini-games (one is left: Calming Grove; Well Garden, Market Kitchen, Adventure Trail and Night Watch were removed)

| Item | Tests |
|---|---|
| start, controls, completion | `17-grove` (a full game, by keyboard), `13-games` |
| cancellation, restart | `13-games`, `26-journey` (✕ and Escape, three times per game) |
| reward, XP | `13-games` and `17-grove` (XP once a day, discoveries, nothing logged) |
| statistics integration | `13-games` (stats card) |
| mobile usability | `17-grove` (360 px), `26-journey` (opened by tap, fits, 40 px ✕) |
| reduced-motion mode | `17-grove`, `26-journey` |
| performance | `13-games` (timers stop), `26-journey` (no timer or frame loop left after leaving) |
| Counting Sheep dream | `41-sheep-dream` (canvas scene, counting and Medius reaction, daily reward, pauses off screen, reduced motion, full screen, layout) |

### RPG upgrades (Water Quest, Dream Battle)

`31-dream-battle` (five sleep levels, gradual strength, battle outcomes, replay, reduced motion, phone layouts) and
`32-water-quest` (scene layers and lighting, the knight's sequence, persistence, six screen sizes, reduced motion).

### Wizard's Training Hall (Exercise page)

`51-exercise` (the EXERCISE tile beside Stairs; goal picker and kept numbers in `st.s.xg`; muscle map taps, partner muscles,
brachialis + brachioradialis lit together; the merged Muscle & move screen with the tutorial under it, sprite and its still frame with reduced motion;
Calisthenics offers bodyweight moves only, the seven moves added without a sprite row and Abdominals without a map mask; Running Road on this page; sets, rest countdown, finish
card with the kcal / VO₂ / kJ estimates; XP cap of two rewarded sessions a day; "I feel dizzy" / "Chest pain" stop and log nothing;
doctor-note gate on sets to failure; 360 px fit). The sprite sheets are made by `tools/art/make_exercise.py`.

### §92 Performance

`24-performance`: page budgets with a year of logs, one storage write per action, storage-full handling, looping scenery
paused when scrolled out of view, no frame loop while idle, no leaks over 60 navigations, image formats and sizes.

## What still needs real devices

Only Chromium is available to the automated suite. `26-journey` checks the code itself stays within ES2018 with no newer
APIs (Safari 12+, Chrome 64+, Firefox 78+, Samsung Internet 9+), but these checks need a person and a device before a
release:

- [ ] **iPhone (Safari)**: open from the Home Screen icon; the notch and home bar do not cover the header or bottom tabs;
      sound starts after the first tap; the edit dialog with the keyboard open; rotate on the title screen.
- [ ] **iPad (Safari)**: portrait and landscape, side navigation, a mini-game with touch.
- [ ] **Wake-up alarm**: on an Android phone, SET IN CLOCK APP opens Clock with the time; on iPhone the in-app alarm rings only with HealthWiz on screen; the bedside clock keeps the screen on; the .ics opens in the calendar.
- [ ] **Live data**: compare the 🌫️ JEREBU CHECK and the weather chip with APIMS and the sky outside; confirm `KMK` on Google Maps.
- [ ] **Android (Chrome and Samsung Internet)**: install prompt, offline start, back button, GPS permission prompt.
- [ ] **Firefox (desktop and Android)**: every page once, a mini-game, backup download and restore.
- [ ] **Screen reader**: VoiceOver or TalkBack through Home, a log, the edit dialog and one mini-game.
- [ ] **GPS outdoors**: a check-in at Block Kenanga, Block Aisha and Generator stairs; denied permission falls back to manual logging.
- [ ] **Cloud**: sign up, confirm by email, sync between two real devices, leaderboard join and leave (live Supabase project).
- [ ] **Battery and heat**: 10 minutes on the title screen and on Home on an older phone, in Auto and Performance modes.
- [ ] **Slow network**: first visit on a throttled 3G connection, then offline.
