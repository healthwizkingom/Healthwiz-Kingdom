# HealthWiz Kingdom — Features, Calculations, Sources and Cybersecurity

*Prepared 2 Nov 2026 from the repository at `healthwizkingom/Healthwiz-Kingdom`, branch `claude/app-features-security-docs-3bafwm`.*

## 0. How this document was made (read this first)

* **What I did:** read the source code (`js/`, `supabase/`, `sw.js`, `index.html`), the project's own audit documents (`README.md`, `AGENTS.md`, `docs/CALCULATIONS.md`, `docs/ARCHITECTURE_AUDIT.md`, `docs/DISCLAIMERS.md`) and re-computed the worked examples below with a short Node script.
* **What I did not do:** I did not run the live app, did not run the Playwright test suite, did not deploy or probe the Supabase project, and did not attempt any exploit. "Security findings" in §5 are **code-review observations**, not penetration-test results.
* **Evidence labels used below:**
  * **[code]** — I read the formula or control in the source file named.
  * **[docs]** — taken from the project's own documentation (`docs/CALCULATIONS.md`) and not re-derived by me. The module is real, but I did not open its code.
  * **[mine]** — my own analysis or judgement.
* **The app's own rule:** it is *a wellness tracker, not a medical device* (`AGENTS.md`). Every estimate is supposed to be labelled as measured / calculated / estimated / simulated / missing, with its method shown behind a "?" button. This document follows the same rule.

---

## 1. What the app is

**HealthWiz Kingdom** (Group 14) is a pixel-art fantasy RPG that is also a health tracker for students at Kolej MARA Kulim (Malaysia). The user logs water, food, sleep, stair climbs (with heart rate), runs and stress. Medius (the Wizard King) and Luna (an apprentice witch) react to those logs, and the "kingdom" map recovers as habits improve.

| Property | Fact | Evidence |
|---|---|---|
| Type | Static website / PWA. **No build step and no app server.** | `README.md` |
| Code | ~120 classic JavaScript files in `js/` sharing one global scope, loaded in a fixed order by `index.html` | `AGENTS.md` |
| Local storage | The whole save is one JSON object in the browser's `localStorage` under the key `healthwiz` | [code] `v6-schema.js` |
| Optional cloud | Supabase (Postgres + Auth + 4 Edge Functions). Nothing touches the network until the user signs in. | [code] `v6-cloud.js` header |
| Outside services | Open-Meteo (weather, air quality), OpenStreetMap tiles, unpkg (Leaflet), Google Gemini (only through the Edge Functions) | [code] CSP in `index.html` |
| Install | GitHub Pages, "Add to Home Screen", or one inlined file from `npm run build` | `README.md` |

### 1.1 How data moves

```
                    ┌──────────── the user's phone / browser ────────────┐
 typed entries ───▶ │ localStorage "healthwiz"  (plain JSON, schema v10) │
 sensors (opt-in)─▶ │ GPS · camera · motion · mic · Bluetooth HR         │
                    │ memory-only: PPG frames, mic level, live HR stream │
                    └───────┬────────────────────────────────┬───────────┘
                            │ only after sign-in             │ always allowed
                            ▼                                ▼
              Supabase (RLS, own rows only)          Open-Meteo / OSM tiles
   user_data · hw_runs · hw_board · hw_guild ·       (fixed campus point only,
   run_scores · run_members · medius_usage            never health data)
                            │
                            ▼ JWT-checked Edge Functions (Gemini key lives here)
        medius-chat · luna-chat · food-guess · water-scan ─▶ Google Gemini
```

---

## 2. Master source table

Every number in the app comes from one of: (a) what the user typed, (b) a device sensor, (c) a published formula, (d) the app's own game rule, or (e) a model/AI estimate. The project keeps verified source records in `js/v6-sources.js` (`HWSources`) and per-calculation cards in the Evidence Vault (`js/v6-vault.js`).

| Source id | What it is | Used for |
|---|---|---|
| `mifflin` | Mifflin–St Jeor equation | BMR; stair-workout resting energy |
| `faopal` | FAO/WHO/UNU Physical Activity Level categories | Activity factor (TDEE = BMR × PAL) |
| `hall` | Hall et al. energy-balance reference | Energy goal context |
| `cdcbmi`, `asianbmi` | CDC adult BMI categories; Asian BMI cut-offs | BMI category and healthy-weight range |
| `iomdri`, `whodiet` | IOM Dietary Reference Intakes; WHO diet guidance | Protein, carb, fat ranges (AMDR), fibre 14 g / 1,000 kcal |
| `whofv` | WHO ≥ 400 g fruit & vegetables a day | The 80 g "portion" |
| `efsawater` | EFSA water reference | Comparison only (35 mL/kg is the app's own rule) |
| `compwalk`, `comprun`, `compendium`, `compcond` | 2024 Adult Compendium of Physical Activities | MET values for stairs, walking, running, training |
| `keytel` | Keytel et al. 2005, J Sports Sci 23:289 | Heart-rate-based energy (kJ/min) |
| `uth` | Uth et al. 2004 | VO₂max ≈ 15.3 × HRmax ÷ HRrest |
| `mcardle`, `weir`, `nistcal` | McArdle (kJ per L O₂), Weir, NIST calorie definition | 20.1 kJ/L; 1 kcal = 4.184 kJ |
| `tanaka` | Tanaka 2001 | Max heart rate = 208 − 0.7 × age |
| `cole` | Cole et al. | 1-minute heart-rate recovery |
| `allen` | Allen 2007 | Camera pulse (PPG) principle |
| `aasm`, `aasmkids`, `nsf` | AASM; National Sleep Foundation | Recommended sleep range by age |
| `dassfaq`, `lovibond95`, `henry05` | DASS-21 scoring rules and papers | Stress Quest scores |
| `blanchard83` | Caffeine half-life spread (2.7–9.9 h) | Night-sync caffeine range |
| `nistwater`, `nistg` | NIST latent heat of water; standard gravity | Hydrate & Cool; work against gravity |
| `noaasol`, `noaaeq` | NOAA solar calculator equations | Astral Navigator (sun position) |
| `f21` | **Group 14's own F21 staircase study** (Word report, Tables 2, 7, 8, 9, 11) | Measured stairway geometry, VO₂ method, study tables |
| `fao77` | FAO energy conversion (Atwater factors) | Food-estimate sanity check |
| `myfcd` | Malaysian Food Composition Database | Comparison only |
| *(none)* | The Kolej MARA Kulim canteen menu list (2022) | Food kcal — "no online source" **[docs]** |

**Source-handling rule [docs]:** a source is only cited after it was opened and read; Wikipedia is not allowed; HealthWiz's own choices are kept apart from source claims; and the Vault test (`tests/68`) fails if a "?" links to a non-existent Vault entry.

---

## 3. Features, how each works, and how each number is calculated

Conventions: `st.p` = the user's profile (age, sex, height, weight, activity), `st.s` = settings and goals, entries are `{id, c: category, v: value, d: date, t: time, m: metadata}`.

### 3.1 Profile, body and energy goals

#### BMI **[code]** `js/hw-03-part.js` `acts.savebmi`, `js/hw-05…` `computeGoals`
* **Formula:** `BMI = weight(kg) ÷ height(m)²`, rounded to 1 decimal.
* **Categories** (adults): < 18.5 underweight · 18.5–24.9 healthy · 25–29.9 overweight · ≥ 30 obese. Under 18 the app deliberately shows "BMI-for-age needed" instead of a category.
* **Healthy weight range:** `18.5 × h²` to `24.9 × h²`.
* **Input limits:** height 100–230 cm, weight 20–300 kg, age 10–100.
* **Source:** CDC (`cdcbmi`), Asian cut-offs (`asianbmi`). Note **[docs]**: the app shows adult categories from age 18; CDC uses 20+.
* **Worked example:** female, 160 cm, 55 kg → 55 ÷ 1.6² = **21.5** (healthy).

#### BMR, TDEE and the daily calorie goal **[code]** `hw-03-part.js` `calc()`, `hw-05…` `computeGoals()`
1. **BMR (Mifflin–St Jeor):** `10 × kg + 6.25 × cm − 5 × age + 5` (male) or `− 161` (female).
2. **TDEE = BMR × PAL.** Since schema v10 (18 Oct 2026) the activity factor is one of three FAO/WHO/UNU categories, at the middle of each range: **1.55** (sedentary/light), **1.85** (active/moderate), **2.2** (vigorous). The "middle value" is HealthWiz's choice.
3. **Goal mode** (HealthWiz's own rule, *no source*):
   * under 18 → maintenance (still growing);
   * BMI < 18.5 → surplus: `min(TDEE + 300, TDEE × 1.15)`;
   * BMI ≥ 25 → deficit: `max(TDEE − 400, floor, TDEE × 0.8)` where `floor = max(BMR, 1500 male / 1200 female)`;
   * otherwise → maintenance.
   The result is rounded to the nearest 10 kcal.
* **Worked example (checked):** female, 20 y, 160 cm, 55 kg, PAL 1.55 → BMR = 550 + 1000 − 100 − 161 = **1,289**; TDEE = **1,998** → goal **2,000 kcal**. A 30-year-old male, 175 cm, 80 kg (BMI 26.1): BMR 1,749, TDEE 2,711, deficit goal = max(2,311, 1,749, 2,168) = **2,310 kcal**.
* **Limit:** population equations; not a prescription (`plannote` "?").

#### Macronutrient and fibre goals **[code]** `js/hw-06…` `mref()`
* **Protein:** `pk × weight`, with `pk` = 0.95 g/kg (age < 14), 0.85 (14–18), 0.80 (adult), and at least 1.1 g/kg during a deficit (HealthWiz's choice). Capped at 30 % (under 19) or 35 % of kcal ÷ 4.
* **Fat:** 30 % of kcal ÷ 9. **Carbohydrate:** the rest, `(kcal − 4·protein − 9·fat) ÷ 4`.
* **Fibre:** `kcal × 14 ÷ 1000` g. **Typical ranges (AMDR):** protein 10–30/35 %, carbs 45–65 %, fat 25–35 % (kids) or 20–35 %.
* **Source:** IOM DRI, WHO (`iomdri`, `whodiet`). **[docs]** The AMDR/fibre table values themselves could not be machine-checked (NIH pages blocked) and are flagged unverified.
* **Worked example:** 2,000 kcal, 55 kg adult → protein min(44, 175) = **44 g**; fat **67 g**; carbs **305 g**; fibre **28 g**.

#### Water goal **[code]** `computeGoals`
* `water = 35 mL × kg (+300 mL if PAL ≥ 1.7, +500 mL if PAL ≥ 2.0)`, rounded to 50 mL and clamped to **1,500–3,500 mL**.
* **Source:** none — 35 mL/kg is HealthWiz's rule (EFSA is shown for comparison only).
* **Worked example:** 55 kg → 1,925 → **1,950 mL**.

### 3.2 Nutrition and hydration (the "Provisions Hall")

| Feature | How it works | Calculation / source |
|---|---|---|
| **Menu logging** | Foods come from the Kolej MARA Kulim canteen list (`hw-01-menu-data.js`: name, stated portion, kcal). Portion multiples scale kcal. | kcal = menu kcal × portions. Protein/carb/fat are **estimates by dish type** (`estMac`), tagged EST. No online source for the menu **[docs]**. |
| **Add More Food** (`v6-addfood.js` + Edge Function `food-guess`) | Signed-in only. The user describes a meal; Gemini with Google Search grounding splits it into parts with grams, kcal, macros and a **named source per part**. | Total = Σ parts × the player's adjustment (0–4 in ½ steps). **Server sanity check [code]:** kcal vs Atwater `4P + 4C + 9F`; flagged if off by > 25 kcal **and** > 25 %. A part with no citation has its micronutrients dropped (`no citation, no number`); confidence is forced to "low" if fewer than half the parts are sourced. Example: 20 g P, 50 g C, 10 g F → Atwater 370 kcal. Labelled "AI estimate from web sources". |
| **Minerals in your food** (`v6-micro.js`) | 7-day card for sodium, potassium, magnesium (mg) saved from Add More Food. | Sums only foods that had a value — a minimum, never a zero; no target line. |
| **Menu micronutrient layer** (`v6-menu-nutrients.js`) | Magnesium/tryptophan/caffeine for 23 of 152 single-food menu rows from published tables; every other row is "unavailable", never 0. | Data only; exports JSON/CSV; provenance in `data/menu_micronutrient_dataset.json`. |
| **After your meal** (`v6-postmeal.js`) | Optional 5/10/15-min easy-walk timer within 3 h of a logged meal. | Timer only; **no glucose/calorie/benefit claim**; nothing saved. |
| **Water log / Water Quest** (`v6-water*.js`) | Logging volume in mL; a knight scene walks → drinks → carries → pours by time of day. | Progress = logged mL ÷ goal. Game visuals, not health claims. |
| **SCAN MY DRINK** (`v6-watercam.js` + `water-scan`) | Photo → Gemini vision estimates the liquid in each container; the user **reviews** before it is logged as a "camera estimate". | Estimate only; the photo is not stored. |
| **Hydrate & Cool** (`v6-hydrate.js`) | Estimated fluid deficit under the workout card. | `heat = energy × (1 − 0.20)`; `sweat (kg) = heat ÷ (0.80 × 2,426 kJ/kg)`; × 1000 = mL. η = 0.20 and α = 0.80 are **HealthWiz's own assumptions** (stated on the card); 2,426 kJ/kg is NIST for pure water. Example: 300 kJ → 240 ÷ 1,940.8 → **≈ 124 mL**. No drinking/dehydration advice. |
| **Nightly Alchemical Sync** (`v6-nightsync.js`) | Descriptive table on the Sleep page: caffeine that might remain at bedtime. | `mg × 0.5^(hours ÷ half-life)` at 2.7 h and 9.9 h → a **range** (Blanchard 1983). 95 mg, 8 h → **12–54 mg**. No score, no cause claim. |
| **Elemental Thermometer** (`v6-arcana.js`) | Home: water progress as a potion; opt-in weather. | Weather from Open-Meteo for the fixed campus point only. |

### 3.3 Sleep

| Feature | Calculation (all **[code]** `hw-02-core.js` unless noted) |
|---|---|
| **Duration** | `slpDur(bed, wake)`: minutes between times, +24 h if wake ≤ bed, rounded to 0.1 h. Accepted 0 < h ≤ 20. |
| **Recommended range** | By age: < 13 → 9–12 h · 13–17 → 8–10 · 18–64 → 7–9 · 65+ → 7–8. Source: AASM (children/teens), NSF (adults). **[docs]** corrected on 18 Oct: the adult 7–9 range is NSF's, not AASM's. |
| **Dream (Sleep) Score — a game value, not medical** | `min(100, D + A + L + R + C)` with **D** duration (40 if inside range, else `40 − 40 × deficit_h ÷ 3`, floor 0), **A** awakenings (0→20, 1→14, 2→8, 3+→4), **L** time to fall asleep (≤15 min→15, ≤30→11, ≤45→7, else 4), **R** restfulness `rating ÷ 5 × 15`, **C** bedtime consistency over the last 7 bedtimes (< 3 logs → 5; SD ≤ 30 min → 10; ≤ 60 → 6; else 3). *Example: 7.5 h, 1 awakening, 20 min, rested 4/5, SD 20 min → 40+14+11+12+10 = **87**.* Weights are HealthWiz's own (no source). |
| **Sleep Now / Trance** (`v6-trance.js`) | Phone on the mattress; motion sensor read in 5-minute epochs; labels Awake/Restless, Light ("Astral Drift"), Deep ("Abyssal Slumber"), REM *estimate* ("Astral Weave") from variance thresholds that are **uncalibrated defaults**. Phone cannot see brain waves, so these are not sleep stages. "Restored Mana" = `min(100, hours ÷ low end of goal × 100)`. Saves nothing under 90 min asleep. Audio level only (a spike count) — no recording. |
| **Alarm** (`v6-alarm.js`) | In-app alarm + Android Clock intent + iPhone steps + `.ics` file. Smart wake rings in a restless epoch inside a 15/20/30-min window. |
| **Dream Battle / Counting Sheep** | Game visuals driven by the Dream Score. |

### 3.4 Heart rate inputs

| Input | How it works | Rules |
|---|---|---|
| **Manual** | User types a number (BPM). | Accepted 30–220 (effort/HRRI) or 30–230 (devices). |
| **Bluetooth** (`v6-hr.js`) | Web Bluetooth, Heart Rate Service `0x180D`, characteristic `0x2A37`; flag bit 0 selects uint8 or uint16 value. | Readings < 30 or > 230 discarded. "Use this reading" = average of the last 15 s, offered once ≥ 10 s of readings vary ≤ 15 BPM. Auto-reconnect back-off 1, 2, 4, 8, 16, 30 s. Only the device id/name is remembered (`healthwiz_hr`). |
| **Camera pulse / PPG** (`v6-ppg.js`) | Fingertip over camera+flash ~20 s. Mean red value of each frame (40×30 canvas) → resample to 30 Hz → detrend (1 s moving average) → 2nd-order Butterworth band-pass **0.7–3.5 Hz** (42–210 BPM) forward-and-back → peak detection → `BPM = 60 ÷ median R-R interval`. | Quality gates in the code: at least 12 beats (`MIN_BEATS`), beat-interval spread (IQR) ≤ 0.15 (`MAX_IQR`), plus usable-fraction (0.8) and repeatability (0.5) thresholds; I did not trace exactly how the last two are applied. Max 35 s. **Video never stored**; one number per frame in memory; camera tracks stopped on finish/cancel/hidden page. Marked "camera estimate". Method source (`allen`) is the principle only; **[docs]** a full method source is still to be added. |

### 3.5 Stairs (the project's core science)

All staircases are on the Kolej MARA Kulim campus. The **F21 study** by Group 14 measured three stairways (ST14, ST19, ST20) — rise 0.149 / 0.157 / 0.169 m **[docs]**.

| Calculation | Formula **[code]** `v6-stairs.js` | Source | Worked example |
|---|---|---|---|
| **Stair-workout energy, method A (MET)** | `kcal = MET × (BMR ÷ 1440) × minutes`; MET Easy 4.5 / Moderate 6.8 / Vigorous 9.3 | 2024 Compendium (`compwalk`), Mifflin | BMR 1,289, Moderate, 10 min → 6.8 × 0.8951 × 10 = **60.9 kcal** |
| **Method B (heart rate)** — only if pulse-after is 90–180 | Keytel: male `−55.0969 + 0.6309·HR + 0.1988·kg + 0.2017·age`; female `−20.4022 + 0.4472·HR − 0.1263·kg + 0.074·age` kJ/min; ÷ 4.184 × min | Keytel 2005 | 140 BPM, 55 kg, 20 y female → 87.8 kcal / 10 min |
| **Reported estimate** | mean of the methods used; low–high = their spread | — | (60.9 + 87.8) ÷ 2 = **74.3 kcal** (range 61–88) |
| **"Our project's VO₂ / kJ method"** (Group 14 report §3.1) | `VO₂ (mL/kg/min) = 15.3 × pulse after ÷ pulse before`; `L/min = VO₂ × kg ÷ 1000`; `kJ = L/min × minutes × 20.1`; `kcal = kJ ÷ 4.184`. **Not valid if pulse after < pulse before** (report §4.4) → shown as "not valid". Never saved or scored. | Uth 2004, McArdle, Weir | HR 70→150, 55 kg, 10 min → 32.8 mL/kg/min; 1.80 L/min; **362 kJ ≈ 87 kcal** |
| **Pulse as periodic motion** | `f = BPM ÷ 60` (Hz); `T = 1 ÷ f` (s); `ω = 2πf` (rad/s) | physics definitions | 150 BPM → 2.5 Hz, 0.4 s, 15.71 rad/s |
| **Peak heart rate vs maximum** | `peak ÷ (220 − age)`; Tanaka `208 − 0.7·age` shown beside it | Tanaka 2001 | age 20: Tanaka max 194; 150 BPM = 77 % |
| **Estimated effort band** (`v6-effort.js`) | `share = peak ÷ (208 − 0.7·age) × 100`; < 64 % below moderate · 64–76 moderate · 77–95 vigorous · ≥ 96 near-maximal | Tanaka; cut-offs from tables attributed to ACSM, **not yet checked against ACSM [docs]** | 150 BPM, age 20 → 77 % → **Vigorous** |
| **Heart-Rate Response Index** | `peak ÷ pulse before` (one decimal), unavailable if a number is missing | Uth (context only) | 150 ÷ 70 = 2.1 |
| **Heart-rate recovery** | `pulse after − pulse 1 min after` (Recover Now timer) | Cole | — |
| **Cardiac drift index** (`v6-drift.js`) | `(mean pulse 2nd half − 1st half) ÷ 1st half × 100`, after ≥ 8:00 unbroken guided pace with a Bluetooth device, 2:00 warm-up excluded | HealthWiz's own rules; **no alert or risk claim** | — |
| **Rise from angle** | `rise = tread × tan θ` | F21 Table 2 | — |
| **Stair Sense** (`v6-gravity.js`) | `h = n × r`; `W = m·g·h` (g = 9.80665); `P = W ÷ t`; `E = W ÷ 1000`. Steps counted from phone motion: magnitude √(x²+y²+z²), 0.5 s moving-average gravity removed, step when above 1.1 m/s² and ≥ 300 ms from the last. User reviews steps before saving. | NIST g | 28 steps × 0.169 m = 4.732 m; 60 kg → **W ≈ 2,784 J**; in 90 s P = 30.9 W *(the project docs print 2,784.4 J; my re-computation gives 2,784.3 J — rounding only)* |

**Further stair features [docs — described in `CALCULATIONS.md`, code not re-opened by me]:**
* **Spire of Trials:** GPS-verified climb (one location check, accuracy ≤ 25 m, never saved); vertical speed `v = h ÷ t`.
* **Dueling Arena:** race a replay of your own earlier climb; `W = m·9.80665·h`, `P = W ÷ t`; rise taken from the first available of: saved Stair Sense h, F21 rise, survey rise, angle estimate; per-step rise outside 5–30 cm rejected.
* **Ascent Monument:** `H = Σ steps × rise`; landmark ratio `H ÷ landmark`; `W = m·g·H`; summit air `T = 15.04 − 0.00649·h`, `p = 101.29 × ((T+273.1)/288.08)^5.256` (NASA Glenn); stones = `floor(H ÷ 0.25 m)`. No rise → height unavailable, never guessed.
* **Astral Navigator:** NOAA solar-position equations, checked by the project against NREL SPA within 0.014° elevation / 0.035° azimuth.
* **Gravity Anomaly:** `g = 9.780327·(1 + 0.0053024·sin²φ − 0.0000058·sin²2φ) − 3.086×10⁻⁶·h` → Kulim (5.365°, 50 m) ≈ **9.7806 m/s²** [code, my check].
* **Metabolic Forge:** `kJ = VO₂(L/min) × min × kJ-per-L-O₂`, factor chosen from the last meal: mixed 20.1, high-carb 21.1, low-carb/fasting 19.6.
* **Caloric Ledger / Alchemy Workshop:** teaches that food energy, work against gravity and metabolic energy are not interchangeable; efficiency **assumed** 25 % / 20 % for illustration. Saves nothing. 1 kcal = 4.184 kJ.
* **Royal Surveyors:** re-measure a stair, `angle = atan(riser ÷ tread)`.
* **Stair Sight / 3D Stair Sight:** camera step-edge detection; WebXR depth measurement (Android Chrome + ARCore).
* **Stair Prescription (`v6-plan.js`):** a weekly plan the player chooses — not a prescription.
* **GPS check-in (`v6-gps.js`):** one position reading on tap; Haversine distance `2R·asin√(…)` (R = 6,371 km) to stairways; radius = 35 m + up to 65 m by reported accuracy; worse than ±150 m never allowed; position kept in memory only.
* **Stair survey data:** `data/stair-survey.json` and `STAIRS` list; Campus Health Observatory (MapLibre/Leaflet + three.js) shows maps, 3D, sun position.

### 3.6 Running (`v6-running.js`) **[code]**
* **Tracking:** `watchPosition` (high accuracy) only while a run records. Fixes worse than ±35 m are ignored; steps shorter than max(5 m, ½ accuracy) wait; steps faster than 12 m/s are dropped as GPS jumps; pauses start a new route segment.
* **Distance:** sum of Haversine segments. **Pace** = moving time ÷ distance. **Speed** `km/h = km ÷ hours`.
* **Calories:** `kcal = MET × kg × hours`. MET is linearly interpolated from the 2024 Compendium points: walking (< 6 km/h) 2.3–4.8, running (≥ 6 km/h) 6.5 at 6.4 km/h … 14.8 at ≥ 15 km/h; flat above 16.1 km/h so a GPS jump can't inflate it. Needs a **confirmed** weight; otherwise asked, never guessed.
* **Worked example:** 5 km in 30 min = 10 km/h → MET = 9.3 + (10.5 − 9.3)·(10 − 9.7)/(10.8 − 9.7) = 9.63 → rounded 9.6 → 9.6 × 55 × 0.5 = **264 kcal**.
* **Storage:** local `healthwiz_runs` first; signed-in users also get a private row in `hw_runs`; run id made on the device so retried uploads can't duplicate.

### 3.7 Training Hall (`v6-exercise.js`)
Bodyweight "Calisthenics" goal, 22 moves, 19 muscle masks, a 3D-rendered knight sprite sheet. Calories: `MET × kg × hours` and `VO₂ ≈ MET × 3.5`. **[docs]** The earlier "±25 %" band had no source and was removed.

### 3.8 Stress (Stress Quest)

| Item | Calculation |
|---|---|
| **DASS-21 check-in** (`v6-dass.js`) **[docs]** | 21 statements scored 0–3 (past week). Each scale (Depression / Anxiety / Stress) = sum of its 7 answers **× 2** (0–42). No severity labels are shown (the manual that defines them was not opened). |
| **Storm level (game)** | `1 + round(9 × total ÷ 63)`, total = sum of all 21 answers. All answers 1 → total 21 → level 1 + 3 = **4**. |
| **Relief cards, Calming Grove, paced breathing** | Games/exercises; breathing is clock-based 4 s in / 6 s out; pulse before/after fields are memory only. |
| **Crisis help** | Help numbers are always on the card (Emergency 999; Befrienders KL 03-7627 2929; Talian Kasih 15999). |

### 3.9 Health Score and Orb (`v6-score.js`, `v6-orb.js`) **[code]**
**Score = Σ(weight × sub-score) ÷ Σ(weights of indicators that have data)**, so a missing log never lowers the score. Weights (HealthWiz's judgement, "not a validated clinical formula"):

| Indicator | Weight | Sub-score (0–100) |
|---|---:|---|
| Fruit & veg | 10 | `portions ÷ 5 × 100` (portion = 80 g, dried 30 g) |
| Water | 5 | `logged ÷ goal × 100` |
| Calories | 5 | 100 within ±10 % of goal, then −2.5 per 1 % further away |
| Macros | 5 | `100 − 5 × Σ(percentage points outside AMDR range)` |
| Stairs | 15 | effort-steps ÷ 100 × 100 (Mild ×1, Moderate ×1.5, Vigorous ×2) |
| Kcal burned | 10 | `burned ÷ 150 × 100` (stairs + runs + training) |
| Heart rate (resting) | 15 | ≤ 80 BPM → 100; 80–100 → `100 − 2.5 × (bpm − 80)`; > 100 → `50 − 2 × (bpm − 100)` |
| Sleep | 15 | 100 in range; below: `−25 per hour`; above: `−15 per hour` |
| BMI | 10 | 100 in 18.5–24.9; below `−15 per unit`; above `−10 per unit` |
| Stress | 10 | `(10 − rating) ÷ 9 × 100` |

Bands: ≥ 80 Excellent · ≥ 60 Good · ≥ 40 Fair · else Needs attention. BMI alone never creates a score. *Examples: resting 90 BPM → 75; BMI 27 → 79; stress 3/10 → 77.8.* **[docs]** Not yet source-checked: AHA 60–100 BPM, ACSM "≈ 1,000 kcal a week" (the abstract says 500–1000 MET·min). The Orb reuses the same indicators to rank recommendations (Start Here / Next Step / Keep Going).

### 3.10 Oracle readiness index (`v6-arcana.js`, `v6-readiness.js`) **[code]**
* **Base:** `0.4 × min(sleep h ÷ 8, 1) + 0.3 × (1 − DASS total ÷ 63) + 0.3 × min(1-min HR drop ÷ 40, 1)` (all × 100). Example: 7 h, DASS 21, drop 25 → 87.5, 66.7, 62.5 → **73.8**.
* **Adjustments (HealthWiz's own, labelled):** resting pulse above your own 14-day average −1 per BPM (max −10); deep-sleep estimate vs your own 30-night average ±5; yesterday's climbing work > 1.5× your average −5. Total range −20…+5, final 0–100. Bands Light < 50, Moderate 50–69, Full 70+. A game index, not a medical measure.

### 3.11 Game systems (never health measurements)
| System | Rule | Source |
|---|---|---|
| **XP** (`v6-xp.js`) **[code]** | Daily allowance per category — water 8, food 6, sleep 2, pulse 3, stair 4, stress 3, BMI 1, exercise 2. Over the cap the entry is saved but XP skipped; deleting doesn't refund; backfilling can't farm (counted by when logged). | App design |
| **Quests** (`v6-quests.js`) | Daily focus quest from the user's own insights; 3 weekly quests tilted to least-logged areas; targets never exceed the user's plan. | App design |
| **Insights "Medius notices"** (`v6-insights.js`) | Compares you with *your own* last two 7-day windows; observational wording, no diagnoses, no praise for eating less. | App design |
| **Streaks, kingdom regions, badges, world, title screen** | Gentle streaks (rest days allowed); 5 region states; badges audited for duplicates. | App design |
| **Weekly report, What-if, Time Machine, charts** | What-if scores simulated values with the *same* sub-score functions as the real score. | App design |

### 3.12 Science and evidence layer
* **Science Laboratory (`v6-lab.js`), Evidence Trial (`v6-trial.js`), Evidence Vault (`v6-vault.js`):** experiments built on the user's own entries; trial answers computed from the data; every "?" can open its Vault card (source → claim → app use).
* **Group 14 F21 study (`v6-f21.js`):** raw measurements; tables recomputed in `tests/61-f21`. **[docs]** Flags: Table 9 rounding (22.95 vs printed 22.9), and the report's claim "vigorous gave the highest energy for every participant" holds for 5 of 6 (P2: moderate 87.5 kJ > vigorous 85.1 kJ).
* **Uncertainty Engine (`v6-uncert.js`):** shows how unmeasured assumptions move an estimate — no invented error margins.
* **Verified-source discipline:** `AGENTS.md` forbids inventing measurements and requires the approved Word report as the source of truth for F21.

### 3.13 Companions
* **Medius / Wizard's Counsel** (`v6-counsel.js` + Edge Function `medius-chat`) and **Luna** (`v6-luna.js` + `luna-chat`): AI chat for signed-in users only. The persona and safety rules are set **on the server**, so the Gemini key can't be used as a general chatbot. Crisis phrases (English/Malay) force the help card; blocked/empty answers return a safe fallback. "Ask Luna" feature search needs no AI.
* Chat text is **never synced or saved** (kept only in the open page).

### 3.14 Social and cloud features
| Feature | What is shared | Controls |
|---|---|---|
| **Cloud save** (`v6-cloud.js`) | The whole save, one private row | Passwordless sign-in (email link/code, Google PKCE); three-way merge; user chooses on first conflict |
| **Hall of Heroes** (`v6-board.js`) | Hero name + game counts only (XP, week XP, quests, badges, kingdom %, discoveries, streak) | Opt-in; hide-name option; leave deletes row |
| **Runners' Board** (`v6-runboard.js`) | Nickname + weekly distance, runs, best 5K | Opt-in; no location, no health data |
| **Guild War of Joules** (`v6-arcana.js`) | Block name + weekly work (J) and energy (kJ) | Opt-in; block shown only if ≥ 3 players |
| **Live data** (`v6-live.js`) | Nothing about the user — fixed campus coordinates sent to Open-Meteo; 15-min weather / 30-min air cache; haze is **modelled** (CAMS) | Settings toggle |
| **PWA / offline** (`v6-pwa.js`, `sw.js`) | — | Network-first cache; Supabase calls never cached |

---

## 4. Where data lives (inventory)

| Store | Content | Sensitivity |
|---|---|---|
| `localStorage["healthwiz"]` | Entire health log, profile (age, sex, height, weight), settings | **High** — plain JSON |
| `localStorage["healthwiz_cloud"]` | Supabase session (access/refresh tokens), user id | **High** — account takeover if stolen |
| `healthwiz_cloud_base`, `healthwiz_backup_*` | Last-synced copy; pre-migration/repair/cloud-choice backups (newest 3) | High |
| `healthwiz_runs`, `healthwiz_run_live` | GPS routes and run summaries | **High** — location trace |
| `healthwiz_cache` | Weather/air cache | Low |
| `hw_lock` | Salted PBKDF2 PIN hash | Medium |
| `healthwiz_hr`, `healthwiz_board` | Bluetooth device id/name; leaderboard membership | Low–medium |
| Memory only | Camera pulse frames, mic level, live HR stream, GPS position for check-in, Counsel chat | Never persisted |
| Supabase `user_data` | Full save copy | High |
| Supabase `hw_runs` | Runs including route points | **High** |
| Supabase `hw_board`, `hw_guild`, `run_scores`, `run_members`, `medius_usage` | Game counts, nicknames, usage counters | Low |

---

## 5. Cybersecurity

### 5.1 Threat model (my framing **[mine]**)
Users are students on shared phones/laptops. Assets: personal health data, GPS routes, account tokens, the Gemini API budget, leaderboard integrity. Realistic adversaries: someone who borrows an unlocked device; a malicious classmate abusing public endpoints; a crafted backup file or tampered cloud copy; a compromised third-party script; cost abuse of the AI endpoints.

### 5.2 Controls in place

#### Layer 1 — Browser / client
| Control | Detail | Evidence |
|---|---|---|
| **Content-Security-Policy** (meta tag) | `default-src 'self'`; scripts/styles also from `unpkg.com`; `connect-src` limited to self, `*.supabase.co`, Open-Meteo, OSM; `object-src 'none'`; `base-uri 'self'`; `form-action 'self'`; no `unsafe-eval`; `worker-src 'self' blob:` | [code] `index.html` |
| **Output escaping** | `esc()` escapes `& < > "`; text fields (food names, notes) escaped where shown | [code] `hw-02-core.js:8` |
| **Stored-XSS hardening on load** | `HWSchema.cleanEntry` validates every entry on load, cloud merge and backup import: id shape `^[\w.:-]{1,80}$`, category `^[a-z0-9_]{1,24}$`, date/time formats, numeric fields forced numeric, meal/kind keys plain words; markup-bearing values replaced and counted as "repaired" | [code] `v6-schema.js` |
| **Privacy Lock** (`v6-lock.js`) | Optional 4–8 digit PIN; only a **salted PBKDF2-SHA256 (150,000 rounds)** hash stored; constant-time compare; 5 misses then wait 30 s, doubling to 15 min, survives refresh; auto-lock timers; "erase this device's data" for a forgotten PIN. **Honestly labelled a screen lock, not encryption.** | [code] |
| **Link guard** (`v6-guard.js`) | External links forced to `rel="noopener noreferrer"`; `javascript:`, `vbscript:`, `data:text/html` links/forms blocked, including links added later (MutationObserver + capture-phase handlers) | [code] |
| **SRI** | Leaflet from unpkg loaded with sha256 integrity hashes and pinned version | [code] `v6-running.js` |
| **Data-validation on migration** | Raw text is copied to `healthwiz_backup_<reason>_<time>` before any upgrade/repair; data from a newer app is refused, not overwritten | [code] `v6-schema.js` |
| **Secret-key refusal** | The cloud setup rejects `sb_secret_…` or `service_role` JWTs; only publishable/anon keys allowed | [code] `v6-cloud.js` `checkProject` |
| **Safety net** | Page render failures show a card instead of a blank screen; saved data untouched | [code] `v6-safety.js` |
| **Service worker** | Network-first; Supabase/AI requests never cached; health data never passes through it; registered only on https/localhost | [code] `sw.js` |

#### Layer 2 — Authentication and transport
* **Passwordless:** email magic link/6-digit code, or Google with **PKCE (S256)**; plain `fetch` to Supabase Auth, no third-party SDK. **[code]**
* All backend URLs are https; the project URL check rejects non-https (except localhost).
* Session is stored under its own key, **not** in the save or in backups. **[code]**
* "Reset on this device" signs out locally and leaves the cloud untouched; account deletion goes through `hw_delete_account()`.

#### Layer 3 — Database (Supabase Postgres) **[code]** `supabase/migrations/`
| Table / function | Protection |
|---|---|
| `user_data` (cloud save) | RLS on; four policies `auth.uid() = user_id` (select/insert/update/delete); **all privileges revoked from `anon` and `authenticated`, then only the needed ones granted**; check constraints: JSON object with array `e`, size ≤ 4,000,000 bytes; trigger makes `updated_at` strictly increasing, owner immutable; writes use `updated_at=eq.<last seen>` → **optimistic concurrency, no blind overwrites** |
| `hw_runs` | RLS own rows; no update policy (runs are immutable); distance ≤ 1,000 km, duration ≤ 7 days; route JSON ≤ 2 MB; id from device → idempotent |
| `hw_board` (leaderboard) | No direct insert/update; `hw_board_publish()` writes the caller's row only, **reads XP/badges from the caller's own cloud save**, clamps every other number; name regex `^[[:alnum:]][[:alnum:] ._'-]*$`, 3–20 chars; read only through `hw_board_top()`, which returns no user ids/emails/timestamps and masks hidden players |
| `hw_guild` | Block must be one of a fixed list; week within ±8 days; values clamped; totals visible **only for blocks with ≥ 3 players** (k-anonymity) |
| `run_scores` / `run_members` / `run_submits` | RLS on; public may read only nickname + stat columns (no `device_id`, no `user_id`); writes only through validated functions; nickname profanity filter (English + Malay, leet-speak folded); weekly distance ≤ 100 km, runs ≤ 50, pace 2:30–15:00 min/km enforced; one submit per minute per device |
| `medius_usage` | RLS, no grants at all; only counts per hour; atomic advisory lock per user; 30/hour and 100/24 h |
| All `SECURITY DEFINER` functions | `set search_path = ''` (blocks search-path hijack); `revoke … from public, anon`; execute granted only to `authenticated` (or `anon` where the public board needs it) |
| `hw_delete_account()` | Deletes **only** `auth.uid()`; cascade removes all owned rows |
| Tests | `supabase/tests/rls_checks.sql`, `tests/21-cloud`, `22-cloud-sync` (with a fake Supabase obeying the same rules) |

#### Layer 4 — Edge Functions (`supabase/functions/*`, all `verify_jwt = true`) **[code]**
| Function | Input limits | Rate limit | Notes |
|---|---|---|---|
| `medius-chat`, `luna-chat` | body ≤ 64 KB; last 30 messages; 1,500 chars each; 12,000 total; name stripped to letters/digits | **Durable**: `medius_take()` 30/h, 100/24 h per user, shared by both | Persona + safety in server prompt; mood tag; crisis regex; reply capped 4,000 chars |
| `food-guess` | body ≤ 4,000 bytes; at most 15 parts; field length caps; numeric ranges | In-memory 40/h per user per instance | Output validated by `shape()`; only `https://` source links kept; Atwater check |
| `water-scan` | body ≤ image max + 2 KB; base64 regex; MIME allow-list (jpeg/png/webp) | In-memory 20/h per user per instance | Photo not stored |
* **Double JWT check:** platform `verify_jwt` **and** in-function verification: ES256/RS256 signature against the project's JWKS (cached 10 min), `exp`, `role = authenticated`, `iss`; any other algorithm (including a forged `alg: none`) falls through to asking Supabase Auth to validate the token, which rejects it. **[mine, from code]**
* **Gemini key** exists only as an Edge Function secret; the app never sees it.
* **Logs hold counts and outcomes only — never message text, food text or images.**
* Timeouts on every outbound call (5–25 s).

#### Layer 5 — Privacy by design
* No sign-in → **no network traffic** from the cloud engine; the app is local-only.
* Leaderboards contain **no BMI, weight, calories, entries, location or email** by schema design (there is no column for them).
* Sensors are permission-gated and bounded: location only while a run records or on a GPS tap; camera/flash stopped on finish/cancel/hidden page/35 s; motion listener attached only during a climb; microphone gives a level only, never audio; Bluetooth is explicit-connect.
* Weather requests send only the college's fixed coordinates.

#### Layer 6 — Safety / content
* Not a medical device; disclaimers behind "?" on every page (`docs/DISCLAIMERS.md`, `tests/69`).
* No diagnostic claims; DASS severity bands deliberately not shown; hydration and drift features carry no advice or risk wording.
* Counsel includes crisis numbers for everyone and never diagnoses or gives medication advice.

### 5.3 Observations, gaps and recommendations **[mine — from code reading, not tested]**

| # | Severity | Observation | Why it matters | Recommendation |
|---|---|---|---|---|
| 1 | **Medium** | CSP still allows `script-src 'unsafe-inline'` (the app builds pages as HTML strings with inline handlers; also acknowledged in the project's own audit). | If any output path fails to escape, injected inline script would not be blocked by CSP — escaping is the only defense. | Long-term: move inline handlers to delegated `data-a` events and use nonces/hashes; short-term: keep the existing `cleanEntry` validation and add tests for every `innerHTML` site (151 uses). |
| 2 | **Medium** | `esc()` does not escape the single quote `'`. | Safe in double-quoted attributes and text, but unsafe if any template places user text inside a single-quoted attribute or JS string. I did not find or test such a case. | Escape `'` (as `&#39;`) in `esc()` and audit templates that use single-quoted attributes. |
| 3 | **Medium** | All health data **and** the Supabase session tokens sit in plain `localStorage`. | Any XSS, malicious browser extension or shared-device access reads everything and can hijack the account. The PIN lock is a screen lock only (the project says so). | Keep the honest label; consider encrypting with a key derived from the PIN/passphrase; store tokens with shorter lifetimes; offer "sign out everywhere". |
| 4 | **Medium** | `food-guess` and `water-scan` rate limits are an in-memory `Map` per Edge Function instance, unlike the durable DB counter used by the chat functions. | Cold starts and multiple instances reset/split the counter, so a signed-in user can exceed the hourly limit; with open magic-link sign-up, an attacker could also create many accounts. This can run up the Gemini bill. | Reuse a DB-backed counter (like `medius_take`) for all four functions; add an overall daily spend cap and a billing alert on the Gemini key. |
| 5 | **Low–Med** | Public `submit_run_score()` is callable with the anon key and the caller chooses `device_id`; the 1-per-minute limit is keyed on that id. | Anyone can rotate ids to spam the public Runners' Board (values are bounded by pace/distance checks, nicknames are filtered). | Add an IP/anon-session-level limit or require sign-in; keep the existing value checks. |
| 6 | **Low** | Leaderboard/Guild integrity is self-attested: XP is read from the player's own cloud save, which the player can edit; guild kJ/J values are only clamped. | Cheating possible; no effect on other users' data. The design says no prizes, so impact is cosmetic. | Document as "friendly comparison"; optionally compute XP server-side if prizes are ever added. |
| 7 | **Low** | CORS is `Access-Control-Allow-Origin: *` on all Edge Functions. | Mitigated: every call needs a valid bearer token and nothing is cookie-based. | Acceptable; restrict to the deployed origin(s) if the app is only served from known hosts. |
| 8 | **Info** | AI privacy: Counsel messages (with the sanitised first name), food descriptions and drink **photos** are sent to Google Gemini via the Edge Functions. | Third-party processing of sensitive wellbeing content. The functions don't store it, but Google's retention depends on the API tier/terms — I did not check which tier is used. | Disclose clearly in the sign-in sheet; check the Gemini plan's data-use terms; consider EXIF stripping and downscaling photos. |
| 9 | **Info** | Signed-in runs upload the full GPS route (`hw_runs.route`, up to 2 MB). | Location traces of a student's habits are sensitive even with RLS. | Offer "summary only" upload, or trim route ends (home/dorm) before upload. |
| 10 | **Info** | The crisis detector is a fixed English/Malay regex. | Misses other languages, slang or indirect wording; the model's own safety filter and persona are the backstop. | Keep the always-visible help card; consider a second-pass classifier and more Malay variants. |
| 11 | **Info** | Legacy table `hw_saves` is left in place "unused" (migration comment says to drop it). | Extra RLS surface to maintain. | Drop it once nothing depends on it. |
| 12 | **Info (hygiene)** | Nine `.whl` Python packages are tracked at the repository root, and `third_party/` vendors large external repos. | Unreviewed binaries/vendored code enlarge the supply-chain surface even if not used at runtime. | Confirm provenance/purpose; remove if unused; pin and scan (e.g. GitHub secret scanning, Dependabot, CodeQL). |
| 13 | **Info** | The Supabase project URL and **publishable** key are hard-coded in two files. | This is by design and safe **only because** RLS/grants are correct (they appear to be); it means the migrations are the real security boundary. | Run `supabase/tests/rls_checks.sql` in CI against the live schema; run Supabase's security advisors after each migration. |
| 14 | **Info** | No automated pipeline was found for the app itself (the only workflows are inside vendored `third_party/`). | Tests are strong (≈ 100 files incl. `99-security`) but only run when someone remembers. | Add a GitHub Actions workflow for `npm test` and the Supabase SQL tests. |

**Things I checked and found sound:** secret-key refusal in the client; no `service_role` key anywhere in app code (my grep hit only the refusal checks); owner-bound policies on every user table; revoke-then-grant pattern; `search_path` pinned on every definer function; no message/text logging in functions; AI key not reachable from the browser; permission-gated sensors with explicit stop paths.

### 5.4 Security-relevant tests in the repository
`tests/99-security.test.mjs` (lock off by default; PIN never stored in clear; hash + wrong-PIN wait survives refresh; link guard; CSP blocks foreign script, no eval), `tests/21-cloud`, `22-cloud-sync`, `23-board`, `39-accounts-medius`, `40-medius-function`, `63-luna-chat`, `44-comfort` (stored-XSS repair), `02-schema` (migration/repair), `supabase/tests/*.ts` and `rls_checks.sql`. **I did not run them in this review.**

---

## 6. Open items the project itself flags **[docs]**
* AHA 60–100 BPM and ACSM "≈ 1,000 kcal a week" not yet verified against the primary pages.
* AMDR and fibre table values and protein g/kg need verification from the original IOM tables.
* Effort-band cut-offs (64 / 77 / 96 %) are attributed to ACSM but not yet checked against it.
* Camera-pulse method source, sleep-range "?" link, and several "worked panels" (Stair Sense, recovery, Training Hall, What-if, report) are still plain text.
* The Evidence Vault and the "?" panel each hold a hand-written copy of some formulas; they can drift.
* Calorie surplus/deficit rules and 35 mL/kg water are HealthWiz's own and have no external source.

---

## 7. One-paragraph summary
HealthWiz Kingdom is a local-first wellness tracker whose health numbers come from standard published equations (Mifflin–St Jeor, FAO/WHO PAL, Compendium METs, Keytel, Tanaka, Uth, NOAA/NASA models) or from the Group 14 stair study, with the project's own game rules kept separate and labelled. Its cybersecurity posture is strong where it matters most — row-level security with revoked default grants, JWT-checked Edge Functions that hold the AI key server-side, counts-only logging, clamped and k-anonymised social features, sensor data that stays in memory — and weakest on the device: plain-text `localStorage` for health data and session tokens, a CSP that still permits inline script, and in-memory rate limits on two AI endpoints. The fixes with the best value are the durable rate limit, escaping `'`, and moving toward a stricter CSP.
