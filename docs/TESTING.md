# Testing HealthWiz Kingdom

```
npm test                                   # builds the standalone file, then runs every test file in tests/
node --test tests/25-matrix.test.mjs       # one file
node --test --test-name-pattern="touch" tests/25-matrix.test.mjs   # one test
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
| navigation | `01-original-app`, `25-matrix` (tabs by tap and keyboard), `26-journey` |
| data logging | `01-original-app`, `26-journey` (every log type through the UI) |
| editing, deleting | `01-original-app`, `03-events`, `25-matrix` (by touch and keyboard), `26-journey` |
| calculations | `01-original-app` (sleep duration, BMI, pulse range), `04-insights` (baselines), `24-performance` (the entry index against full scans) |
| quests | `05-quests`, `03-events` |
| XP, levels | `07-xp-kingdom`, `03-events` |
| Kingdom | `07-xp-kingdom`, `10-world` |
| suggestions | `04-insights` |
| Medius | `08-medius` |
| statistics | `09-charts` |
| backup, restore | `01-original-app` (download, erase, restore from file), `02-schema` (old and newer backups) |
| reset | `01-original-app` (two taps), `03-events` |
| theme | `25-matrix` (device default, saved choice, every page, contrast) |
| responsive layouts | `01-original-app`, `25-matrix` (seven sizes), the 360 px checks in `13`–`23` |
| touch | `25-matrix`, `26-journey`, the game tests |
| authentication, cloud sync | `21-cloud`, `22-cloud-sync` |
| leaderboard | `23-board` |
| location permissions, GPS fallback | `19-gps` |
| offline mode | `20-pwa` |
| console errors | every test; `26-journey` runs a whole first day without one |
| broken references | `26-journey` (handlers, page links, images, asset paths), `20-pwa` (the offline file list) |
| existing data compatibility | `02-schema`, `26-journey` (an old v5.4.3 save on every page) |

### §94 Mobile

| Item | Tests |
|---|---|
| taps, scrolling | `25-matrix` (taps, finger swipes: vertical scroll, no sideways scroll), `26-journey` |
| modals | `25-matrix` (edit dialog by tap, rotated, keyboard open), `13-games` |
| keyboard opening | `25-matrix` (the edit dialog at 390×500 and 640×300 still reaches SAVE) |
| orientation changes | `25-matrix` (title, pages and dialog at 844×390 and 568×320) |
| safe areas | `25-matrix` (viewport-fit=cover and the inset rules); real notch: manual |
| bottom navigation | `25-matrix` (pinned, five tabs, nothing hidden under it) |
| long text | `25-matrix` (20-character name, very long food name and note) |
| chart interaction | `09-charts` |
| GPS permission | `19-gps` |
| offline transitions | `20-pwa` |

### §95 Desktop

| Item | Tests |
|---|---|
| mouse, hover | most tests; chart tooltips in `09-charts` |
| keyboard | `25-matrix` (Tab order, focus ring, dialogs), `09-charts`, `13-games` |
| window resizing, multiple navigation layouts | `25-matrix` |
| large displays | `25-matrix` (1920×1080: centred column) |

### §96 Mini-games (all five: Well Garden, Market Kitchen, Adventure Trail, Calming Grove, Night Watch)

| Item | Tests |
|---|---|
| start, controls, completion | `14`–`18` (a full game each, by keyboard), `13-games` |
| cancellation, restart | `13-games`, `26-journey` (✕ and Escape, three times per game) |
| reward, XP | `13-games` and `14`–`18` (XP once a day, discoveries, nothing logged) |
| statistics integration | `13-games` (stats card) |
| mobile usability | `14`–`18` (360 px), `26-journey` (opened by tap, fits, 40 px ✕) |
| reduced-motion mode | `14`–`18`, `26-journey` |
| performance | `13-games` (timers stop), `26-journey` (no timer or frame loop left after leaving) |

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
- [ ] **Android (Chrome and Samsung Internet)**: install prompt, offline start, back button, GPS permission prompt.
- [ ] **Firefox (desktop and Android)**: every page once, a mini-game, backup download and restore.
- [ ] **Screen reader**: VoiceOver or TalkBack through Home, a log, the edit dialog and one mini-game.
- [ ] **GPS outdoors**: a check-in at Block Kenanga, Block Aisha and Generator stairs; denied permission falls back to manual logging.
- [ ] **Cloud**: sign up, confirm by email, sync between two real devices, leaderboard join and leave (live Supabase project).
- [ ] **Battery and heat**: 10 minutes on the title screen and on Home on an older phone, in Auto and Performance modes.
- [ ] **Slow network**: first visit on a throttled 3G connection, then offline.
