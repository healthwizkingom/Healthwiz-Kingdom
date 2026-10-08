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
js/v6-stairs.js            the Stairs page: casual climbing (GPS + by hand), stair workout (heart rate before/after, calorie estimate), running (with calories burned, js/v6-running.js); one session model
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
js/v6-looks.js             themes (THEMES map, Settings swatches), the onboarding chamber, the Shadow Keep (title + Kingdom)
js/v6-gps.js               GPS check-in on the Stairs page (one reading on tap, nearest stairway, confirm, discovery)
js/v6-pwa.js               install as an app + offline: manifest/icon links, service worker, offline badge, Settings card
js/v6-cloud.js             optional account engine: email magic link / 6-digit code and Google sign-in, user_data sync (offline queue, merge)
js/v6-account.js           the account's screens: Settings → ACCOUNT, "What happens when you sign in", sign-in steps, onboarding offer
js/v6-counsel.js           the Wizard's Counsel → medius-chat Edge Function (signed in), crisis help for everyone, Medius's reactions
js/v6-board.js             Hall of Heroes: opt-in leaderboard of game progress only (Quest Board card + Settings privacy card)
js/v6-live.js              live weather + haze (jerebu) for Kolej MARA Kulim from Open-Meteo: title sky, Home chip + JEREBU CHECK, hazeBanner() + heat tip above Running, Settings → LIVE DATA
js/v6-alarm.js             wake-up alarm on the Sleep page: in-app alarm (sounds, snooze, bedside clock), Android Clock intent, iPhone steps, .ics reminder
js/v6-hr.js                smartwatch / chest-strap heart rate over Web Bluetooth (0x180D/0x2A37, battery 0x180F) for the Workout on the Stairs page; "Will my watch work?" sheet
js/v6-runboard.js          Runners' Board: opt-in running leaderboard (nickname + weekly totals only) under Running; rows follow the account when signed in
js/v6-sheep.js             the Counting Sheep dream on the Sleep page: one animated pixel-art canvas scene, full screen
js/v6-map.js               the Kingdom map as a living pixel-art map (layered canvases + CSS-animated details, zoom to a region)
js/v6-score.js             Health Score page (Health Hall): five indicators weighted into one 0–100 score, fruit & veg servings, recommendations in five areas
js/v6-foodsel.js           pick several foods, then LOG SELECTED once (selection kept while searching; no duplicate logs)
js/v6-expbar.js            every progress bar in one modern style (changed values flow in); the EXP bar as flowing mana with level-up glow
supabase/migrations/       SQL for accounts, cloud save, leaderboards and Medius limits (Row Level Security) — run each file once, in order
supabase/functions/        medius-chat: the Edge Function that talks to Google Gemini for the Wizard's Counsel
supabase/tests/            SQL behaviour checks (tools/test-sql.sh, local PostgreSQL) and Deno tests for medius-chat
sw.js                      service worker: pre-caches the app, network first, works offline (keep PRECACHE in sync)
manifest.webmanifest       web app manifest (name, colours, standalone display, icons)
js/v6-safety.js            an error card instead of a blank screen
assets/img/                the 15 images that were embedded as base64 in the original (the PNG art re-encoded as lossless WebP)
assets/icons/              app icons (original pixel art, drawn by tools/make-icons.mjs)
legacy/HealthWiz_Kingdom_5-4-3.html   the complete original single file (source of truth)
tools/import-original.mjs  one-time import of the original (re-running it overwrites later edits)
tools/build-standalone.mjs bundles everything back into one HTML file
tools/make-icons.mjs       redraws the app icons
tools/art/                 Python scripts that made assets/img/bedroom.webp, sleeper-react.webp and medius-reactions.webp
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

## Accounts and cloud sync (optional)

Signing in is optional. Without an account everything works on this device only and no account request is made.
With a free account (Settings → ACCOUNT, or the offer after the Traveller's Registry) the save is backed up and synced
between devices, the Runners' Board row follows the account, and the Wizard's Counsel can talk with Medius AI.
Health data is private: Row Level Security lets each account read and write only its own row; nobody else, including
other students, can see it. The Wizard's Counsel chat is never synced or stored.

The app uses the free-plan Supabase project **healthwiz-kingdom** (`wghkbrtwrdrejmoswhza`, Singapore). The project URL and
**publishable** key are in `CFG` at the top of `js/v6-cloud.js` (public by design; the app refuses secret /
service_role keys, never commit one).

### Database: run the SQL once, in order

Dashboard → SQL Editor → New query → paste a file → Run (or `supabase db push`). Every file is safe to run again.

1. `20261003000000_hw_cloud_save.sql` · 2. `20261004000000_hw_leaderboard.sql` · 3. `20261005000000_hw_runs.sql` ·
   4. `20261006000000_run_scores.sql` (the earlier files; skip any that were already run)
5. `20261007000000_user_data.sql`: table `user_data` (`user_id` = `auth.uid()` primary key, `data` jsonb, `updated_at`),
   RLS "own row only", the server-side `updated_at` stamp, a one-time copy of any old `hw_saves` rows, and
   `hw_delete_account()` (deletes the cloud row, then the account). `hw_saves` is no longer used by the app.
6. `20261007000100_run_scores_accounts.sql`: Runners' Board rows tied to `user_id` when signed in; the device's row moves
   to the account on first sign-in.
7. `20261007000200_medius_usage.sql`: per-player message counts for Medius AI's limits (counts only, never text).

Local checks without a project: `tools/test-sql.sh` (PostgreSQL 16) runs `supabase/tests/rls_checks.sql`.

### Sign-in: dashboard steps

**Email magic link (no password)**

1. Authentication → Sign In / Providers → Email: enabled. "Confirm email" can stay on.
2. Authentication → URL Configuration: Site URL `https://healthwizkingom.github.io/Healthwiz-Kingdom/`; add the same
   address to Redirect URLs (plus `http://localhost:8080/**` if you test locally).
3. Authentication → Emails → Templates → **Magic Link** (and **Confirm signup**): keep the link and add the code, so
   people using the installed app can type it instead:
   ```
   <h2>Your HealthWiz sign-in</h2>
   <p><a href="{{ .ConfirmationURL }}">Sign in to HealthWiz</a></p>
   <p>Or type this code in the app: <b>{{ .Token }}</b></p>
   ```
4. Authentication → Emails → SMTP Settings: the built-in sender only delivers to the project's team members and a few
   emails per hour. For students, turn on **Custom SMTP** (any provider: Resend, Brevo, SendGrid, your school's mail
   server) with a sender address, then raise Authentication → Rate Limits → emails per hour as needed.

**Google (optional)**

1. Google Cloud Console → APIs & Services → Credentials → Create credentials → OAuth client ID → Web application.
   Authorized JavaScript origins: `https://healthwizkingom.github.io`. Authorized redirect URI:
   `https://wghkbrtwrdrejmoswhza.supabase.co/auth/v1/callback`. (OAuth consent screen: External, app name HealthWiz.)
2. Supabase → Authentication → Sign In / Providers → Google: enable, paste the Client ID and Client Secret, save.
3. The app shows CONTINUE WITH GOOGLE only when the project reports Google as enabled.

**Delete everything**: Settings → ACCOUNT → DELETE ACCOUNT & CLOUD DATA (two taps) removes the cloud row and the account;
the data on the device stays. RESET on a device only signs that device out.

Sync: on app start, about 10 s after a change, when the app goes to the background or back online. Offline, the card
says "Offline: will sync later"; otherwise "Synced at 14:32". First sign-in with data on both sides asks: KEEP THIS
DEVICE'S DATA / KEEP CLOUD DATA / MERGE (MERGE uses the backup restore's merge). Free plan: 500 MB database, 50,000
monthly active users; an inactive project pauses after 7 days (restore it from the dashboard, nothing is lost).

## Medius AI (the Wizard's Counsel)

Signed-in players talk with Medius through the Edge Function `supabase/functions/medius-chat/index.ts` (the code is
in the repo). The app sends the player's session token and the conversation; the function checks the token, applies
the limits (30 messages an hour, 100 a day per player, with a friendly message), adds Medius's persona and safety
rules, calls Google Gemini (model in the one constant `MODEL`) and returns the reply. Blocked or empty replies become
a gentle fallback with the crisis numbers. Nothing is stored; the function logs counts only. There is no AI key in
`index.html` or anywhere in the app. Signed out, the Counsel scene and breathing still work and it says "Sign in to
talk with Medius". Crisis numbers are always shown.

Deploy (Supabase CLI, from the repo root):

```
supabase login
supabase link --project-ref wghkbrtwrdrejmoswhza
supabase secrets set GEMINI_API_KEY=your-key-from-aistudio.google.com
supabase functions deploy medius-chat
```

The secret can also be set in Dashboard → Edge Functions → Secrets (Manage secrets) → Add `GEMINI_API_KEY`.
`supabase/config.toml` keeps `verify_jwt = true`, so only signed-in players reach the function. Run the SQL file
`20261007000200_medius_usage.sql` first. Tests: `deno test --no-lock --allow-env supabase/tests/medius-chat.test.ts`.

## Test

```
npm install   # only if Playwright / acorn are not already available
npm test      # builds the standalone file, then runs every browser test
```

`docs/TESTING.md` maps the master prompt's test matrix (§92–96) to the test files and lists the checks that still
need real phones and browsers (Safari, Firefox, Samsung Internet, screen readers, GPS outdoors).
