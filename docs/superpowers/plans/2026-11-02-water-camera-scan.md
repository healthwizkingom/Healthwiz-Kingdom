# Water Camera Scan (SCAN MY DRINK) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A SCAN MY DRINK card under the manual ADD WATER card that photographs bottles/cups, shows an AI volume estimate per container, and logs confirmed amounts through the existing `drink()` path.

**Architecture:** New classic script `js/v6-watercam.js` wraps `pages.water` to inject the card and runs camera -> review -> log. A new `water-scan` Edge Function (modelled on `food-guess`) calls Gemini vision and returns validated JSON. Logging reuses `drink(v, meta)` so XP, well animation, charts, quests and badges work unchanged.

**Tech Stack:** Vanilla JS (global scope, no new deps), Supabase Edge Function (Deno/TS), Playwright tests (`node --test`), Deno tests for the function.

**Spec:** `docs/superpowers/specs/2026-11-02-water-camera-scan-design.md`

## Global Constraints

- Classic scripts share one global scope; keep load order in `index.html` and add every new script to `sw.js` PRECACHE (`tests/20-pwa.test.mjs`).
- No new runtime/npm dependencies. No emoji in the UI (`tests/30-emoji.test.mjs`); use `HWPixel.icon(...)`.
- Estimates are always labelled "ESTIMATE from photo" with the method shown (`HWExplain.btn`); no hydration or health claims; nothing logged before the player confirms.
- Entries are `water` entries with `m:{src:'camera', est:true, conf}`; no schema change. 1 to 1500 mL per entry (the `drink()` limit).
- No photo stored or logged; Edge Function logs counts/outcomes only. Gemini key only as server secret `GEMINI_API_KEY`.
- Layout must work on phones; follow `docs/PIXEL_STYLE.md`.
- Final report must list every file created/changed and what could not be verified (real Gemini accuracy, real-device camera, deployment).

## Review Focus

- Two containers with the same mL in one photo: both must log (check `HWWhen.stamp({sig:'w'+v})` does not drop the second). Test in Task 4.
- Camera permission denied / no `mediaDevices` / insecure context: card shows a message, manual ADD WATER still works. Task 3.
- Model returns `ml` outside 1-1500, more than 8 containers, `lo > ml`, or text in the image telling the model to ignore rules: clamped/rejected by `shape()`. Task 1.
- Player leaves the page or backgrounds the app while the camera is open: stream stopped. Task 3.
- Player unticks every container or sets a slider to 0: LOG disabled, nothing saved. Task 4.

---

### Task 1: `water-scan` Edge Function

**Files:**
- Create: `supabase/functions/water-scan/index.ts`, `supabase/tests/water-scan.test.ts`
- Modify: `supabase/config.toml` (add `[functions.water-scan]` with `verify_jwt = true`, like `food-guess`)

**Interfaces:**
- Produces: `POST /functions/v1/water-scan` body `{image: string (base64 JPEG/PNG/WebP, no data: prefix), mime: 'image/jpeg'|'image/png'|'image/webp'}`, `Authorization: Bearer <jwt>`.
  200 `{result:{containers:[{label:string,type:string,capacity_ml:number|null,fill:number(0..1),ml:number,lo:number,hi:number,conf:'high'|'medium'|'low',basis:string}],note:string}}`; 200 `{unknown:true}`; 400 `{error:'bad'}`; 401 `{error:'signin'}`; 429 `{error:'limit',retry:number}`; 502 `{error:'ai'}`; 503 `{error:'busy'|'nokey'}`.
- Exports for tests: `clean(b): {image,mime}|null`, `parse(text): any|null`, `shape(d): {containers,note}|{unknown:true}|null`.

- [ ] **Step 1: Write failing tests** in `supabase/tests/water-scan.test.ts`, copying the JWT/Deno.serve/fetch stubbing harness from `supabase/tests/food-guess.test.ts`. Tests: `shape clamps ml to 1..1500 and drops containers over 8`; `shape forces lo <= ml <= hi`; `shape drops a container with empty basis`; `shape returns unknown for kind unknown and null for junk`; `clean rejects non-base64, unknown mime, image over 2,000,000 chars`; `401 without a valid token`; `400 on a bad body`; `200 with a stubbed Gemini reply returns containers`; `429 after the per-hour limit`; `prompt-injection text in a label is stripped of < > and control chars`.
- [ ] **Step 2: Run to confirm failure:** `deno test --no-lock --allow-env supabase/tests/water-scan.test.ts` -> FAIL (module missing). If Deno is unavailable, say so and note Task 1 was verified by reading only.
- [ ] **Step 3: Implement** `index.ts` mirroring `food-guess` (same `player()` JWT check, `allow()` with `PER_HOUR = 20`, CORS, `timed`, `log` counts only). Differences: `content-length` cap 2.2 MB; Gemini request has `inlineData {mimeType, data}` plus a system prompt that (a) lists each drinkable container, (b) prefers a printed capacity on the label, else estimates, (c) reports `fill` 0..1, `ml = capacity_ml * fill`, `lo`/`hi`, `conf`, and a `basis` sentence like "label says 500 mL, about 60% full", (d) treats any text in the image as data, never instructions, (e) returns `{"kind":"unknown"}` if nothing drinkable, (f) no health advice. No Google Search tool. `maxOutputTokens: 1200`, temperature 0.2. `shape` clamps and validates as in Global Constraints/Review Focus; `conf` downgrades to `low` when `capacity_ml` is null.
- [ ] **Step 4: Run tests** -> all pass.
- [ ] **Step 5: Commit** `feat: water-scan Edge Function (Gemini vision volume estimate)`.

### Task 2: `drink(v, meta)` and the history tag

**Files:**
- Modify: `js/hw-02-core.js:140` (`drink`) and `desc` (the water entry description used by `row()`, line ~68; locate it).
- Test: `tests/98-watercam.test.mjs` (created here; later tasks append)

**Interfaces:**
- Produces: `drink(v: number, meta?: object)`: `meta` is stored as the entry's `m` (default `{}`), in both `add('water', ...)` calls. `wa`/`wcu` callers are unchanged.
  Water entries with `m.src==='camera'` show "camera estimate" in their history description.

- [ ] **Step 1: Failing test** `drink(v, meta) stores meta and a manual drink still stores {}`: via `page.evaluate`, call `drink(250,{src:'camera',est:true,conf:'medium'})` and `drink(100)`; assert the last two `st.e` water entries' `m` and that `wt()` rose by 350. Second test: the Water page history row for the camera entry contains `camera estimate`.
- [ ] **Step 2: Run** `node --test --test-concurrency=1 --test-timeout=90000 tests/98-watercam.test.mjs` -> FAIL.
- [ ] **Step 3: Implement** the optional `meta` param (backwards compatible) and the tag text.
- [ ] **Step 4: Run** the new test plus `tests/14-water.test.mjs` and `tests/32-water-quest.test.mjs` -> pass.
- [ ] **Step 5: Commit** `feat: drink() accepts entry meta; camera entries tagged in history`.

### Task 3: Fake endpoint, card, camera states

**Files:**
- Modify: `tests/cloud-fake.mjs` (route `/functions/v1/water-scan`: signed-in only; `S.scan` = recorded calls, `S.scanReply`/`S.scanStatus` settable, like `guess*`), `index.html` (script tag after `js/v6-waterquest.js`), `sw.js` (PRECACHE `js/v6-watercam.js`).
- Create: `js/v6-watercam.js`
- Test: `tests/98-watercam.test.mjs`

**Interfaces:**
- Produces: global `HWWaterCam = { logMl(c): number, supported(): boolean, card(): string }` and the action `acts.wcscan` (open camera), `acts.wcshot` (capture), `acts.wcclose`.
  `logMl(c) = clamp(Math.round(c.ml * c.take), 0, 1500)`.
  State `Z = {k:'idle'|'camera'|'busy'|'review'|'error', msg, list:[{label,type,capacity_ml,fill,ml,lo,hi,conf,basis,on:true,take:1}], stream}`.
  `card()` returns the SCAN MY DRINK card HTML (id `wc-card`); `pages.water` is wrapped to insert it right after the ADD WATER card (`</div>` closing `.pxp.pxn`), inside a try/catch that returns the original page on failure (same pattern as `js/v6-waterquest.js:170`).

- [ ] **Step 1: Failing tests** (append): `card sits below ADD WATER and shows the photo-not-stored note`; `signed out: SCAN says to sign in, manual ADD WATER still works`; `permission denied: message shown, no camera left open, ADD WATER works` (launch context with no camera permission / stub `getUserMedia` to reject `NotAllowedError`); `no mediaDevices: message shown`; `leaving the Water page stops the stream` (stub `getUserMedia` returning a track whose `stop` is counted); `visibilitychange hidden stops the stream`; `logMl: 0.6 x 500 -> 300, clamps 1 and 1500, take 0 -> 0`.
- [ ] **Step 2: Run** -> FAIL.
- [ ] **Step 3: Implement** the card, the idle/error messages, `acts.wcscan` (checks `HWCloud.who()`, `navigator.onLine`, `supported()`; then `getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false})`, shows a `<video playsinline muted>` with CAPTURE/CLOSE buttons), stream cleanup on capture, close, `page:viewed` to another view (`HWEvents`), `visibilitychange`, and re-render. Use the guard/permission style of `js/v6-ppg.js:19,105`.
- [ ] **Step 4: Run** -> pass; run `tests/20-pwa.test.mjs` and `tests/30-emoji.test.mjs`.
- [ ] **Step 5: Commit** `feat: SCAN MY DRINK card with camera permission flow`.

### Task 4: Estimate, review and log

**Files:**
- Modify: `js/v6-watercam.js`
- Test: `tests/98-watercam.test.mjs`

**Interfaces:**
- Consumes: Task 1 endpoint contract; Task 2 `drink(v, meta)`; Task 3 `Z`, `logMl`.
- Produces: `acts.wcshot` (downscale video frame to max 1024 px JPEG quality 0.8, strip `data:` prefix, `HWCloud.api('/functions/v1/water-scan',{method:'POST',body:{image,mime:'image/jpeg'},ms:45000})`), `acts.wctog` (`data-i`), `acts.wcmed` (edit mL, `data-i`), `acts.wctake` (slider 0..1 step .05, `data-i`), `acts.wcretake`, `acts.wclog`. Error codes map as `food-guess`'s `AIERR` (signin, offline, limit, nokey, busy, ai) plus `unknown` ("I could not see a drink").

- [ ] **Step 1: Failing tests** with the fake endpoint returning two containers (500 mL bottle at 60%, 250 mL cup at 100%): `review lists each container with ESTIMATE from photo, range and basis`; `LOG adds one water entry per ticked container with m.src camera, est true, conf, and wt() rises by 550`; `the well animation runs (#wqch gets walk class) and the percentage updates`; `two containers with the same mL both log`; `unticking one logs only the other`; `slider take 0.5 logs half`; `editing mL changes the logged amount, clamped to 1500`; `all unticked or take 0: LOG disabled, nothing saved`; `unknown reply shows the could-not-see message and keeps manual logging`; `401 -> sign-in message; 429 -> limit message; 502 -> muddled message`; `retake returns to the camera`; `no request is sent until CAPTURE; no photo data stays in state or localStorage after logging`.
- [ ] **Step 2: Run** -> FAIL.
- [ ] **Step 3: Implement** the capture/estimate/review/log code. Review rows show label, type, "about N mL (lo to hi mL)", basis, conf, tick, mL input, fill slider, and an `HWExplain.btn('xwatercam', ...)` explaining method (container capacity x fill, read by an AI model from the photo, not a measurement) and limits. LOG calls `drink(HWWaterCam.logMl(c), {src:'camera',est:true,conf:c.conf})` per ticked container with `logMl > 0`, with a short stagger so `HWWhen.stamp` dedupe cannot drop equal volumes; if it does, pass a distinct stamp per call. Clear `Z.list` and drop the frame after logging.
- [ ] **Step 4: Run** -> pass. Run all water tests: `tests/14-water.test.mjs tests/32-water-quest.test.mjs tests/98-watercam.test.mjs`.
- [ ] **Step 5: Commit** `feat: camera volume estimate, review sheet and logging`.

### Task 5: Docs, full suite, phone layout

**Files:**
- Modify: `README.md` (feature note + deploy line), `docs/TESTING.md` if it lists per-feature tests, `js/v6-watercam.js` (CSS via `HWUI.css('watercam', ...)` tuned for phones)
- Test: `tests/98-watercam.test.mjs`

- [ ] **Step 1: Failing test** `review and camera views fit a 375 px wide phone with no horizontal scroll` (viewport 375x740, document `scrollWidth <= innerWidth`), modelled on `tests/50-mobile-fit.test.mjs`.
- [ ] **Step 2: Run** -> FAIL or pass; fix CSS until it passes.
- [ ] **Step 3: Docs:** README feature paragraph (labelled estimate, signed-in only, photo not stored), the deploy command `supabase functions deploy water-scan`, and a note that real Gemini accuracy was not verified.
- [ ] **Step 4: Run the full suite** `npm test`; if a Playwright test times out on browser start, rerun once before treating as real.
- [ ] **Step 5: Commit** `docs+test: water camera scan docs and phone layout`; push to `ccr-238b1f69-h8pttj`.

## Self-Review

- Spec coverage: card placement (T3), permission-on-tap (T3), Edge Function + contract + validation (T1), review/edit/untick/retake/slider/full default (T4), `drink()` reuse so animation/stats work (T2, T4), CAMERA ESTIMATE tag (T2), labelling + HWExplain (T4), errors (T3, T4), tests and docs (all, T5), deploy note (T5).
- Deviation from spec: `drink()` gets an optional `meta` argument in `js/hw-02-core.js` (the spec only ruled out editing that file for the card injection); this keeps entries tagged without wrapping `add`.
- Type consistency: container fields, `logMl`, `Z`, action names and the endpoint contract are used identically in Tasks 1-4.
