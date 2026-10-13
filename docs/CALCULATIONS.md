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
| BMR, TDEE, daily energy goal | `js/hw-03-part.js` `calc`, `js/hw-05` `computeGoals` | worked (`xenergy`) | mifflin, cdcbmi | Activity factors 1.2–1.9 and the surplus / deficit rules have no verified source yet (said in the panel). |
| Protein, carbohydrate, fat, fiber goals | `js/hw-06` `mref` | worked (`xmacro`) | iomdri, whodiet | IOM report confirmed; its table values (protein g/kg, AMDR, 14 g fiber per 1,000 kcal) still to be checked: the NIH tables blocked automated access. Deficit protein 1.1 g/kg is HealthWiz's choice. |
| Water goal | `js/hw-05` `computeGoals` | worked (`xwater`) | efsawater (comparison) | 35 mL/kg is HealthWiz's rule; no single verified source (said in the panel). |
| Stair workout energy (MET + Keytel) | `js/v6-stairs.js` `estimate` | worked (inside `stkcal`, `js/v6-calcx.js`) | compwalk, mifflin, keytel, nistcal | Stair METs checked against the 2024 Compendium. Keytel coefficients are from the full text (abstract does not list them). |
| Our project's VO₂ / kJ method | `js/v6-stairs.js` `projectVO2` | worked (inside `stkcal`) | f21, uth, mcardle, weir, nistcal | Matches the Group 14 report (Section 3.1): the pulse after climbing is assumed to be PRmax, so the result is an estimated VO₂max (said in the panel). **Added from the report (Section 4.4):** when the pulse after is below the pulse before, the result is shown as not valid instead of a number. 20.1 kJ/L is the report's interpolation of McArdle's values (book located; values cross-checked with Weir). Never saved or scored. |
| Group 14 study tables (pulse rate, f, T, ω, VO₂, energy, recovery) | `js/v6-f21.js` | — (data for the Lab) | f21 | Raw counts only are stored; tests/61-f21 recomputes Tables 7, 8, 9, 11 and they agree, apart from one rounding (P2 moderate VO₂ 22.95, printed 22.9). **Flag:** Section 4.4's "vigorous gave the highest energy for every participant" holds for 5 of 6 (P2: moderate 87.5 kJ > vigorous 85.1 kJ). |
| Peak heart rate as % of 220 − age | `js/v6-stairs.js` `peak` | worked (`xpeak`) | tanaka | The unsourced "10–20 BPM" margin was removed; Tanaka's 208 − 0.7 × age is shown beside it. |
| Running calories (MET × kg × h) | `js/v6-running.js` `met`, `kcalOf` | worked (`xrun`, `xrun-<id>`) | comprun, compwalk, compendium | **Fixed:** the table held 2011 values under a 2024 label; now the 2024 values with their codes (tests/37 updated with the new arithmetic). The unsourced "±20–30%" was removed. Runs saved with a stored kcal keep it. |
| Health Score weights and components | `js/v6-score.js` | text + sources (`scorewt`) | whofv, whodiet, iomdri, mifflin, whopa, acsm, aasm, aasmkids, cdcbmi, cohen | Per-component worked examples: later stage. Not yet checked: AHA 60–100 BPM (page blocked), ACSM "≈ 1,000 kcal a week" (abstract says 500–1000 MET·min a week). The Group 14 figure is now checked: 6.3–37.5% (report Table 8; the earlier text said 6–37%). |
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
| Add More Food: the Wizard's guess | `js/v6-addfood.js` `partVal`, `totals` | worked in the card (every part with its source); Evidence Vault `foodguess` | fndds, sr28, fdc | Sum of parts. USDA part: value per 100 g × grams ÷ 100, grams = household measure (from `js/v6-foodparts.js`) × how many. Canteen part: menu kcal × portions, macros estMac (labelled). AI part (signed in, Gemini via food-guess): labelled AI estimate, not from a database. Nearest-match parts are named on the card. Estimate, not measurement. |
| Add More Food: nutrients for a portion | `js/v6-addfood.js` `calc` | worked in the card (method line + source line); Evidence Vault `foodportion` | fdc, fndds, gbfpd | value per 100 g × grams ÷ 100 (FNDDS / SR convention, read in the FNDDS 2021–2023 documentation); gram weights of household measures and label servings from FoodData Central, approximate. A nutrient the database lacks is shown as missing; once logged, the day's macro total counts it as 0 (the existing `emac` rule for custom foods): flag. Canteen dishes: kcal from the menu, macros HealthWiz's estimate (labelled). |
| Alchemist's Workshop energy comparisons | `js/v6-alchemy.js` | text (`alhelp`) | — | Simulation; worked panel later. |
| What-if simulator, weekly report, week-vs-week stats | `js/v6-whatif.js`, `js/v6-report.js`, `js/v6-charts.js` | text | — | Later stage. |
| Air quality / weather | `js/v6-live.js` | text (`aqsrc`) | — | Retrieved from Open-Meteo; DOE APIMS linked for the official index. |
| XP, levels, kingdom states, streaks | game modules | — | — | Game values, never health measurements. |

## Rules for adding a "?"

1. Read the code that computes the number; the formula in the panel must be the one that runs.
2. Use the actual inputs in `steps`, with units, and say where each input came from (`o`).
3. Cite only records from `HWSources`, and only the ones the shown steps use. Add a record only after opening the source
   and seeing that it supports the claim; write what was checked in `c`. No Wikipedia.
4. Put HealthWiz's own choices in `app`, never in a source's `s`.
5. Never add an error margin, confidence or range that no source or measurement supports.
6. Add or update a test in `tests/60-explain.test.mjs` with the arithmetic checked by hand in a comment.
