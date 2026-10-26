# Calculations and their "?" explanations

Master prompt, "Universal ? calculation explanation". This is the audit of every number HealthWiz works out, what its "?"
shows, and what is still open. Source records live in `js/v6-sources.js` (`HWSources`); the panel is `HWExplain`
(same file), opened through the existing `HWHelp` "?" (`js/v6-help.js`). Stage 2 built the foundation and converted the
calculations marked **worked**; the rest follow in later stages.

**Worked** = the panel shows meaning, inputs with their origin, the formula the code runs, the user's own numbers step by
step, verified clickable sources, HealthWiz's own choices kept apart from the sources, and limits.
**Text** = an older plain-text "?" explains it, without the worked example or linked sources.

| Calculation | Code | "?" | Sources (`HWSources` ids) | Notes / flags |
|---|---|---|---|---|
| BMI, adult category, healthy weight range | `js/v6-body.js` `bmiOut` | worked (`xbmi`) | cdcbmi, asianbmi | App shows adult categories from 18; CDC uses 20+ (said in the panel). |
| BMR, TDEE, daily energy goal | `js/hw-03-part.js` `calc`, `js/hw-05` `computeGoals` | worked (`xenergy`) | mifflin, cdcbmi, faopal, hall | **Changed 2026-10-18 (owner's request):** TDEE = BMR × PAL, with the FAO/WHO/UNU adult PAL categories (sedentary or light 1.40–1.69, active or moderately active 1.70–1.99, vigorous 2.00–2.40) at their middle values 1.55, 1.85, 2.2 (the middle is HealthWiz's choice). Saved activity factors are migrated in schema 10 (1.2, 1.375 → 1.55; 1.55, 1.725 → 1.85; 1.9 → 2.2), so goals rise for most people (e.g. old sedentary 1.2 → 1.55). Water extras follow the new levels: +300 mL at PAL 1.7+, +500 mL at 2.0+. Surplus / deficit rules are HealthWiz's own (no source). |
| Protein, carbohydrate, fat, fiber goals | `js/hw-06` `mref` | worked (`xmacro`) | iomdri, whodiet | IOM report confirmed; its table values (protein g/kg, AMDR, 14 g fiber per 1,000 kcal) still to be checked: the NIH tables blocked automated access. Deficit protein 1.1 g/kg is HealthWiz's choice. |
| Water goal | `js/hw-05` `computeGoals` | worked (`xwater`) | efsawater (comparison) | 35 mL/kg is HealthWiz's rule; no single verified source (said in the panel). |
| Stair workout energy (MET + Keytel) | `js/v6-stairs.js` `estimate` | worked (inside `stkcal`, `js/v6-calcx.js`) | compwalk, mifflin, keytel, nistcal | Stair METs checked against the 2024 Compendium. Keytel coefficients are from the full text (abstract does not list them). |
| Our project's VO₂ / kJ method | `js/v6-stairs.js` `projectVO2` | worked (inside `stkcal`) | f21, uth, mcardle, weir, nistcal | Matches the Group 14 report (Section 3.1): the pulse after climbing is assumed to be PRmax, so the result is an estimated VO₂max (said in the panel). **Added from the report (Section 4.4):** when the pulse after is below the pulse before, the result is shown as not valid instead of a number. 20.1 kJ/L is the report's interpolation of McArdle's values (book located; values cross-checked with Weir). Never saved or scored. |
| Group 14 study tables (pulse rate, f, T, ω, VO₂, energy, recovery) | `js/v6-f21.js` | — (data for the Lab) | f21 | Raw counts only are stored; tests/61-f21 recomputes Tables 7, 8, 9, 11 and they agree, apart from one rounding (P2 moderate VO₂ 22.95, printed 22.9). **Flag:** Section 4.4's "vigorous gave the highest energy for every participant" holds for 5 of 6 (P2: moderate 87.5 kJ > vigorous 85.1 kJ). |
| Peak heart rate as % of 220 − age | `js/v6-stairs.js` `peak` | worked (`xpeak`) | tanaka | The unsourced "10–20 BPM" margin was removed; Tanaka's 208 − 0.7 × age is shown beside it. |
| Running calories (MET × kg × h) | `js/v6-running.js` `met`, `kcalOf` | worked (`xrun`, `xrun-<id>`) | comprun, compwalk, compendium | **Fixed:** the table held 2011 values under a 2024 label; now the 2024 values with their codes (tests/37 updated with the new arithmetic). The unsourced "±20–30%" was removed. Runs saved with a stored kcal keep it. |
| Health Score weights and components | `js/v6-score.js` | text + sources (`scorewt`) | whofv, whodiet, iomdri, mifflin, whopa, acsm, aasm, aasmkids, cdcbmi, lovibond95, henry05 (cohen before the DASS-21, 2026-10-20) | Per-component worked examples: later stage. Not yet checked: AHA 60–100 BPM (page blocked), ACSM "≈ 1,000 kcal a week" (abstract says 500–1000 MET·min a week). The Group 14 figure is now checked: 6.3–37.5% (report Table 8; the earlier text said 6–37%). |
| Fruit & veg portions (80 g) | `js/v6-score.js` | text (`fvinfo`) | whofv | Source verified; worked example: later stage. |
| Stair Sense: h = n × r, W = mgh, P = W ÷ t | `js/v6-gravity.js` | text + sources (`gvhelp`) | nistg, nistcal | Worked example: later stage. |
| Step height from angle (rise = tread × tan θ) | `js/v6-stairs.js`, `js/v6-gravity.js` | text | f21 | The three measured stairways (rise, run, hypotenuse, θ) match the report's Table 2 and the angle bands its Section 4.1. |
| Training Hall calories, VO₂ ≈ MET × 3.5, kJ | `js/v6-exercise.js` | none | compcond (codes checked) | **Fixed:** the "±25%" band had no source and is no longer shown; saved `lo`/`hi` stay in old sessions. Worked panel: later stage. |
| Pulse as periodic motion: f, T, ω | `js/v6-stairs.js` | text (`pulseshm`) | — (definitions) | Physics definitions; no source needed. |
| Heart-rate recovery (after − 1 min after) | `js/v6-stairs.js` | text | — | Worked panel: later stage. |
| Camera pulse (PPG) BPM | `js/v6-ppg.js` | text (`ppg`) | — | Method source still to add. |
| Sleep duration and recommended range | `js/hw-02-core.js` | text (`sleeprange`) | aasm, aasmkids (verified, not yet linked there) | Link in a later stage. |
| Sleep Score | `js/hw-02-core.js` | text (`sleepscore`) | — | HealthWiz's own game formula: label as such. |
| Food calories and estimated macros | menu (`js/hw-01`), `js/hw-06` | text (`nutest`) | — | KOLEJ MARA KULIM Dewan Selera 2022 list (no online source); macros per dish type are estimates. Nutrition stage. |
| Add More Food: the Wizard's web estimate | `js/v6-addfood.js` `totals`; `supabase/functions/food-guess` `atwaterOff` | the card (every part, its source and arithmetic); Evidence Vault `foodguess` | fao77 (the energy check only) | Sum of the parts Gemini returns (each part's kcal and macros × the player's adjustment, 0 to 4 in half steps). Check per part: kcal ≈ 4 × protein + 4 × carbohydrate + 9 × fat, flagged when more than 25 kcal and 25 % off. An AI estimate from web sources, labelled; the part sources are what Gemini reports. |
| Add More Food: canteen dish and amount | `js/v6-addfood.js` `calc` | worked in the card | — (the menu is the app's own data) | kcal = the menu's kcal per portion × portions; protein, carbohydrate and fat are `estMac` estimates from the dish type, labelled. |
| Alchemist's Workshop energy comparisons | `js/v6-alchemy.js` | text (`alhelp`) | — | Simulation; worked panel later. |
| What-if simulator, weekly report, week-vs-week stats | `js/v6-whatif.js`, `js/v6-report.js`, `js/v6-charts.js` | text | — | Later stage. |
| Air quality / weather | `js/v6-live.js` | text (`aqsrc`) | — | Retrieved from Open-Meteo; DOE APIMS linked for the official index. |
| XP, levels, kingdom states, streaks | game modules | — | — | Game values, never health measurements. |

## Evidence Vault links from the "?"

Every "?" of a calculation that has an Evidence Vault entry ends with **View formula and evidence in the Evidence Vault**, a
link to `#vault=<calculation id>` (the `id` of an entry in `HWVault.CALCS`, `js/v6-vault.js`). Set the id with `ev:'<id>'` in the
`HWExplain.btn` spec, `{ev:'<id>'}` as the 4th argument of `HWHelp.btn`, or the 4th argument of `HWHelp.reg`; a list of ids gives
one link each (the Stairs "?" holds two calculations). `ev:'none'` (no longer used by any "?") shows "Evidence entry not yet available" instead of a link.
`tests/68-evidence-links.test.mjs` fails if an id is not a Vault calculation.

| Calculation "?" | Vault entry | | Calculation "?" | Vault entry |
|---|---|---|---|---|
| `xbmi` | `bmi` | | `stkcal` (energy) | `stairkcal` |
| `xenergy` | `energy` | | `stkcal` (VO₂, project method), `sp-<id>` | `project` |
| `xmacro` | `macro` | | `sk-<id>` | `stairkcal` |
| `xwater` | `water` | | `xpeak` | `peak` |
| `xrun`, `xrun-<id>` | `run` | | `scorewt` | `score` |
| `fvinfo` | `fv` | | `gvhelp` | `gravity` |
| `sleeprange` | `sleep` | | `nutest` | `nutrients` |
| `ppg` | `ppg` | | `strec` (1-minute drop) | `recovery` |

Vault entries with **no "?" to link from**: `train` (Training Hall shows kcal with no "?"), `foodguess` (explained on its own
card), `stairways`, `lab`. Calculations whose "?" is a game or simulation note (`sleepscore`, `bmigame`, `alhelp`, `whatif`, `statcmp`,
`aqsrc`, `plan-why`, `pulseshm`) have no Vault entry and no link.
**Sources added 2026-10-18** (each opened and read first, see its `c` in `js/v6-sources.js`): `allen` (camera pulse principle), `cole` (1-minute heart-rate recovery), `hall` and `faopal` (energy goal), `nsf` (adult sleep ranges), `myfcd` (Malaysian food database, comparison only). A US government table that confirmed the AMDR and fiber figures was dropped because it names USDA, which this app does not cite (`tests/67-addfood`); those values stay unverified.
**Corrected:** the sleep ranges 7–9 h (18–64) and 7–8 h (65+) were credited to AASM, whose adult statement says "7 or more hours" with no upper limit or older-adult range; they are the National Sleep Foundation's, now cited as such. The sleep "?" no longer says "AASM/CDC" (CDC was never checked).
**Flagged:** the calorie surplus/deficit rules and 35 mL/kg water are HealthWiz's own (no source found); the protein g/kg values and the ACSM "≈ 1,000 kcal a week" and AHA 60–100 BPM figures are still unverified (the pages could not be opened as text).
**Known duplication, not changed:** each `HWVault.CALCS` entry (`f`, `src`, `app`) is still written by hand next to the
formula in its "?" panel; the two can drift. Differences seen: `fv` cites `whofv` + `whodiet` in the Vault and none in its "?"; `energy` cites
`mifflin` in the Vault, `mifflin` + `cdcbmi` here.

**Added 2026-10-20: the Stress Quest's DASS-21 check-in** (`js/v6-dass.js`, Vault entry `dass`, sources `dassfaq`,
`lovibond95`, `henry05`, each opened first). Each scale (Depression, Anxiety, Stress) = the sum of its 7 answers (0–3)
× 2, from 0 to 42 (the DASS FAQ's rule for the 21-item form); storm level = 1 + round(9 × total ÷ 63), where the total is
the sum of all 21 answers (0–63). Worked example, checked in the browser: all 21 answers = 1 → each scale 7 × 2 = 14 of
42; total 21; level 1 + round(9 × 21 ÷ 63) = 1 + 3 = 4. **Not used:** the DASS severity bands (Normal to Extremely
severe), because the manual that sets them was not opened; the scores are shown without labels. The storm level and
the order of the creatures are game choices, not part of the DASS.

**Added 2026-10-26: The Ascent Monument** (`js/v6-monument.js`, route `monument`). Read-only, from the saved stair sessions
(`HWStairs.all()`), so edits and deletions show at once.
* Rise of one session: h = steps logged (e.v = steps per climb × climbs) × rise of one step of that staircase. The rise is
  the F21 report's measured step rise for ST14, ST19 and ST20 (`HWStairs.STUDY`: 0.149, 0.157, 0.169 m), otherwise the
  survey sheet's riser height (`data/stair-survey.json`, averaged over the flights weighted by their risers; a riser
  outside 12 to 21 cm is shown with CHECK). No known rise (a staircase not surveyed, an old entry with no staircase id
  whose name is not unique, or the survey file not readable because the app was opened from the device): the steps count,
  the height does not, and the page says how many sessions and steps that is. No rise is guessed.
* Total vertical ascent H = h₁ + … + hₙ. Repeated climbs are added vertically; descents are not subtracted.
  Worked example (tests/92-monument): ST20 28 × 6 = 168 steps × 0.169 m = 28.392 m; ST14 13 × 2 = 26 × 0.149 m = 3.874 m;
  H = 32.266 m from the device. Over http the survey adds ST04 35 × 4 = 140 × 0.155 m = 21.7 m → 53.966 m.
* Landmark ratio R = H ÷ landmark height (32.266 ÷ 451.9 = 7.1 % of a Petronas tower; 32.266 ÷ 6 = 5.4 two-storey houses).
  Bars are linear from 0 to the landmark; the to-scale picture uses one linear scale and one baseline; the ladder is
  logarithmic and says so. "Climbs to go" = remaining height ÷ (steps per climb × rise) of the staircase climbed most;
  "weeks at your pace" = remaining height ÷ (ascent of the last 28 days ÷ 4).
* Estimated mechanical work against gravity W = m g H with g = 9.81 m/s² and the user's confirmed weight only
  (`HWStairs.profile()`); 60 kg × 9.81 × 192.355 m = 113.2 kJ. "Lifting a 1,000 kg car" = W ÷ (1,000 kg × g) = m H ÷ 1,000.
  Labelled as idealised work, never calories.
* Summit air: NASA Glenn Research Center's Earth atmosphere model (troposphere, to 11 km): T = 15.04 − 0.00649 h °C,
  p = 101.29 × [(T + 273.1) ÷ 288.08]^5.256 kPa, shown as the drop in °C and p as a percentage of p at h = 0.
* The tower: stones = floor(H ÷ 0.25 m), one stair stone for every 0.25 m of verified ascent (32.266 m → 129 stones;
  9,000 m → 36,000). The stair never ends; its colour bands start at the stones for 451.9, 828, 4,095.2 and 8,848.86 m
  (1,807, 3,312, 16,380, 35,395) and a gold stone with a banner marks each real landmark passed. A symbol, not a measurement.
* Floors: H ÷ 3 m, HealthWiz's own round storey height (also used for the two illustrative buildings, 6 m and 30 m).
* Reference heights (checked 2026-10-26, each with its link and what was read, in `LANDMARKS`): Statue of Liberty 92.99 m
  (NPS), Eiffel Tower 330 m (official site), Menara KL 420.4 m, Petronas Twin Tower 451.9 m, Merdeka 118 678.9 m and
  Burj Khalifa 828 m (CTBUH Skyscraper Center, architectural height), Penang Hill 833 m (penanghill.gov.my), Mount
  Kinabalu 4,095.2 m (Sabah Parks), Mount Everest 8,848.86 m (2020 Nepal and China survey, news report), ISS ≈ 400 km
  (NASA). These are reference data shown in each landmark's own "Why this number?" panel, not `HWSources` records.

## Rules for adding a "?"

1. Read the code that computes the number; the formula in the panel must be the one that runs.
2. Use the actual inputs in `steps`, with units, and say where each input came from (`o`).
3. Cite only records from `HWSources`, and only the ones the shown steps use. Add a record only after opening the source
   and seeing that it supports the claim; write what was checked in `c`. No Wikipedia.
4. Put HealthWiz's own choices in `app`, never in a source's `s`.
5. Never add an error margin, confidence or range that no source or measurement supports.
6. Add or update a test in `tests/60-explain.test.mjs` with the arithmetic checked by hand in a comment.
