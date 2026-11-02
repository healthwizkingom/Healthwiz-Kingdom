# Water camera scan (SCAN MY DRINK) - design

Status: awaiting owner review. No code written yet.

## Goal
Below the manual ADD WATER card on the Water (Hydration) page, let the player scan bottles/cups with the camera, get an
estimated volume of water in each, and log them through the same path as manual entries, so the well animation, stats,
charts, quests and badges all work unchanged.

## Decisions (owner-approved)
- Estimation: AI vision via a new `water-scan` Supabase Edge Function (Gemini), modelled on `food-guess`. Signed-in only.
- Default logs the full detected amount; a per-container fill slider allows partial amounts.
- Several containers in one photo become one water entry each.
- Permission is asked only when the player taps SCAN. No photo is stored; it is sent for estimation and discarded.

## Components
1. `js/v6-watercam.js` (classic script, loaded after `v6-waterquest.js`; added to `sw.js` PRECACHE and `index.html`).
   Wraps `pages.water` to inject the SCAN MY DRINK card after the ADD WATER card. No edit to `js/hw-02-core.js`.
   State machine: idle -> camera -> capturing -> estimating -> review -> logged | error.
   Downscales the frame to ~1024 px JPEG, calls `HWCloud.api('/functions/v1/water-scan', ...)`.
   The camera stream is stopped on capture, close, page change and visibility hidden.
2. `supabase/functions/water-scan/index.ts`: JWT check, per-hour limit, Gemini vision call, strict JSON parse + `shape()`.
   Exports `clean`, `parse`, `shape` for unit tests. Logs counts/outcomes only.
3. Review sheet: per container label, type, capacity, fill fraction, estimated mL, low-high range, basis text, confidence;
   editable mL, untick, retake, fill slider. `HWExplain` button shows the method.
4. Logging: `drink(v)` once per ticked container (existing XP, `wqFlow`, charts, quests). Entries carry
   `m:{src:'camera', est:true, conf}`; no schema change (older readers ignore extra fields). History shows a CAMERA ESTIMATE tag.

## Edge Function contract
POST `{ image: <base64 JPEG>, mime }`, `Authorization: Bearer <access token>`.
200 `{ result: { containers: [{ label, type, capacity_ml, fill, ml, lo, hi, conf, basis }], note } }`
200 `{ unknown: true }` (no drinkable containers seen) · 400 bad · 401 signin · 429 limit · 502 ai · 503 busy/nokey.
Validation: 1-1500 mL per container, at most 8 containers, lo <= ml <= hi, every number has a stated basis
(e.g. "label says 500 mL, about 60% full"). Image text is data, never instructions.

## Honesty / labelling
Everything is labelled "ESTIMATE from photo", with the method shown. Nothing is logged until the player confirms.
"An estimate of what is in the container, not a measurement." No hydration or health claims.

## Errors
Signed out, offline, no camera, permission denied, 401/429/502/503: plain message; manual ADD WATER stays available.

## Tests
- `supabase/tests/water-scan.test.ts`: clean/parse/shape (clamps, range, unknown, injection text).
- `tests/98-watercam.test.mjs` (Playwright, fake camera + stubbed endpoint): permission denied, review, logging, well total, tag.
- Existing: 30-emoji, 20-pwa, 24-performance, mobile-width check.

## Not verifiable here
Real Gemini accuracy and real-device camera behaviour. The function must be deployed by the owner:
`supabase functions deploy water-scan` (reuses the `GEMINI_API_KEY` secret).
