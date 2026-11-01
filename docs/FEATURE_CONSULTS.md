# Feature consults: the 13-feature catalog

Status: DRAFT for review. Nothing in this file is built yet. Each feature gets a consult: what already exists, what is missing, the plan, the sources, the tests, and the decision needed from the owner. No code changes until the owner approves a feature.

Rules used for every consult (from `AGENTS.md` and `docs/DISCLAIMERS.md`):
- HealthWiz is a wellness tracker, not a medical device. No diagnosis, no claim that a number measures a physiological state the phone cannot measure.
- Every number is labelled measured, calculated, or estimated, with its method.
- Nothing is invented. A missing input makes the result "unavailable", not a guessed value.
- Citations come only from `js/v6-sources.js` (or the Vault). A claim with no source in that list is marked **SOURCE NEEDED** and is not cited from memory.

## Summary

| # | Feature | Phase | Status | Action |
|---|---|---|---|---|
| 1 | Astral Trance (sleep engine) | 1 | Built | Skip |
| 2 | Climb Now (EPOC & substrate crossover) | 2 | Partial | Consult: missing parts are not measurable from pulse and cadence |
| 3 | Inspect Ascent (torque & power) | 2 | Mostly built | Consult: only knee load missing |
| 4 | Recover Now (HR recovery & vagal tone) | 2 | Partial | Consult: guided 2-minute timer |
| 5 | Hydrate & Cool (thermodynamics) | 2 | Partial | Consult: sweat-loss model |
| 6 | Nightly Alchemical Sync | 2 | Not built | Consult: needs sources and micronutrient data |
| 7 | Spire of Trials (GPS stair trials) | 2 | Partial | Consult: timed trials and boards |
| 8 | Daily Allostatic Readiness | 3 | Partial | Consult: needs weights and a source |
| 9 | Vascular Tone / Arterial Compliance | 3 | Not built | Consult: the catalog's target cannot be measured from pulse |
| 10 | Bone Remodeling | 3 | Not built | Consult: needs ground-force and K2 data |
| 11 | Neuro-Vagal Reset (0.1 Hz pacer) | 3 | Not built | Consult: paced breathing, claims need sources |
| 12 | GLUT4 Glycemic Blunting | 3 | Not built | Consult: needs carbohydrate and glucose sources |
| 13 | Cardiovascular Drift & Thermal Strain | 3 | Not built | Consult: a drift index, not plasma volume |

Features 1 is skipped. Features 2 to 13 are consulted below (12 consults). Several catalog claims cannot be built as written; each consult says so and proposes an honest version.

---

## 1. Astral Trance (sleep engine): BUILT, SKIPPED

Exists in `js/v6-trance.js` ("Sleep Now"): Abyssal Slumber, Astral Drift, Stillness (N2 equivalent), the Astral Weave REM estimate, Time to Cross the Veil, the 6-hour Severed Conduit cap, the 90-minute minimum, the 13-hour cap, and the baseline-relative type. Vault entries exist in `js/v6-vault.js` (Xie 2013 covers glymphatic clearance, the AQP4 mechanism is not separately cited).

Open item (not a build): the catalog says "Arcane Stillness" and "Abyssal Slumber" are N2 and N3 stages. The app says these are phone-motion estimates, not sleep stages, which is correct and must stay.

---

## 2. Climb Now (EPOC & substrate crossover): PARTIAL

**Exists:** VO₂ from the pulse ratio (`js/v6-stairs.js`, `15.3 × pulse after ÷ pulse before`, source `uth`), energy in kJ per litre of O₂ (`js/v6-alchemy.js`, Metabolic Forge), and step counting with cadence (`js/v6-gravity.js`).

**Missing and not measurable from what the app has:**
- **Ventilatory thresholds** (VT1 and VT2) need breathing gas or ventilation data. Pulse and cadence cannot identify them.
- **Carbohydrate to fat crossover** needs the respiratory exchange ratio (RER) from gas analysis. Not available.
- **EPOC** (excess post-exercise oxygen consumption) needs measured oxygen uptake after exercise. Heart-rate recovery is not a measure of EPOC.

**Proposed honest version (if the owner wants it):** a labelled *heart-rate intensity band* (percent of estimated maximum heart rate, source `tanaka` for the maximum and `acsm` for the bands), shown as "estimated effort", with no claim about fuel source. Substrate text would be removed.

**Files:** `js/v6-calcx.js` (formula text), `js/v6-stairs.js` (the saved session), `js/v6-vault.js` (entry).
**Tests:** worked example at a known age and resting pulse; band boundaries; "unavailable" when no maximum can be estimated.
**Risks:** users will read "fat burning" into any band. The text must say the band is effort, not fuel.
**Decision needed:** (a) build the effort-band version, or (b) drop the item.

---

## 3. Inspect Ascent (torque & power): MOSTLY BUILT

**Exists:** work W = m × g × h, average power P = W ÷ t, and step height from the three measured stairways or a typed value (`js/v6-gravity.js`, `physics()`, source `nistg` for g). Incline θ is already used to derive step height from a staircase's angle (`verifiedRise`).

**Decisions already recorded:** incline is not added to the power formula. W depends on the rise h, not on θ, so adding θ would change nothing.

**Missing:** knee-extensor joint load. This needs body-segment lengths, joint angles, and a force model. None of that is in the app or in `js/v6-sources.js`.

**Plan:** no build for knee load. If the owner wants it, first add a source for a segment model, then consult again.
**Decision needed:** confirm that knee load is dropped, or name a source for a segment model.

---

## 4. Recover Now (HR recovery & vagal tone): PARTIAL

**Exists:** the 1-minute drop (`hrR1`) typed in the workout form, a 7-day average (`st-recavg`), the help card `strec`, and the Oracle's use of the drop (`js/v6-arcana.js`). Source `cole` supports heart-rate recovery as a risk marker, which the app must not claim.

**Missing:** a guided 2-minute window that prompts for the pulse at stop and at 60 seconds, and saves the difference.

**Plan**
- Add a Recover Now button and countdown to the workout card in `js/v6-stairs.js`.
- Save the 60-second drop to the existing `hrR1` field. No new storage key, no migration.
- Add a Vault entry using only `cole` and the existing help text.
- Pure drop function with worked examples (after 142, at 60 s 118, drop 24 BPM).
- Browser test: the prompt appears at 60 s; skipping saves nothing.

**Vagal tone:** the catalog says this measures vagal tone. A 1-minute drop does not measure vagal tone. The label must be "heart-rate drop", not "vagal tone".

**Decision needed:** approve the timer, and approve the relabel from "vagal tone" to "heart-rate drop".

---

## 5. Hydrate & Cool (thermodynamics): PARTIAL

**Exists:** ambient weather (opt-in Open-Meteo in `js/v6-arcana.js`), water logs (`st.e`, category `water`), and the water target (`st.s`).

**Missing:** a sweat-loss estimate and the balance against intake.

**Plan (estimate, labelled)**
1. Metabolic heat = energy expenditure × (1 − efficiency). Efficiency is an **assumption** (shown, editable), not a measurement.
2. Sweat evaporated = heat ÷ latent heat of vaporization of water. The latent heat value needs a source (**SOURCE NEEDED**; not in `js/v6-sources.js`).
3. Only part of the sweat evaporates; the rest drips. This share is also an assumption and must be shown.
4. Balance = estimated loss − logged water. Shown as "estimated deficit", never as dehydration.

**Osmolarity and electrolytes:** not built. There is no sodium or electrolyte logging, and no source in the list for a sodium balance model.

**Files:** new pure module or an addition to `js/v6-arcana.js`. If a new script is added, `sw.js` precache and the 64 KB file limit apply.
**Tests:** worked example with stated assumptions; "unavailable" with no weather or no energy value.
**Decision needed:** (a) build the estimate with the three labelled assumptions and a source for latent heat, or (b) drop it.

---

## 6. Nightly Alchemical Sync (chrono-nutrition & sleep): NOT BUILT

**Exists:** meal times (`st.e`, food category), sleep latency and N3-equivalent duration (`js/v6-trance.js`), and the caffeine entries in `js/hw-02-core.js`.

**Missing**
- **Caffeine half-life:** **SOURCE NEEDED**. The app has no caffeine source.
- **Magnesium and tryptophan intake:** the menu data has kcal only (`js/hw-01-menu-data.js`). Micronutrient data may exist in the MyFCD source (`myfcd`) but only if the file includes those nutrients. Must be checked before building.
- **Evidence strength:** one or two nights of paired data cannot show an effect. The output must be a descriptive table, not a score.

**Plan:** for each evening, list caffeine timing and an estimated amount left at bedtime (using a source half-life), the last meal time, and the sleep latency and N2/N3-equivalent figures from the Trance. Show the table with the words "descriptive, not evidence of cause". No "nutritional synergy score".

**Decision needed:** (a) build the descriptive table once caffeine and micronutrient sources are added, or (b) drop the synergy score entirely.

---

## 7. Spire of Trials (GPS stair trials): PARTIAL

**Exists:** GPS check-in on campus staircases (`js/v6-gps.js`, `js/v6-gravity.js`), the Hall of Heroes leaderboard (`js/v6-board.js`, `js/v6-duel.js`), and the Dueling Arena race against your own earlier climb.

**Missing:** timed trials with a start and finish line per staircase, vertical speed per trial, and sector boards that compare users.

**Plan**
- A trial is defined by the two GPS check-ins on one staircase. Time = finish − start. Vertical speed = h ÷ time, with h from the existing step-height rule.
- Accuracy: GPS on stairs is weak. The trial must show the GPS accuracy and refuse a time if accuracy is worse than a set limit.
- Boards: a decision between local-only (device storage) and cloud (the existing `hw_leaderboard` table in `supabase/migrations/`). Cloud brings privacy and moderation work.

**Tests:** trial time from two timestamps; refusal when accuracy is poor; board ordering.
**Decision needed:** local-only or cloud boards, and the GPS accuracy limit (proposed: refuse above 25 m).

---

## 8. Daily Allostatic Readiness: PARTIAL

**Exists:** the Oracle readiness (sleep, DASS-21 total, 1-minute drop) in `js/v6-arcana.js`, DASS-21 (`js/v6-dass.js`, sources `henry05`, `lovibond95`), and prior-day work (`js/v6-gravity.js`).

**Missing:** resting heart rate (RHR) trend, N3 share from the Trance, and a merged daily tier.

**Problems to settle first**
- "Allostatic load" is a concept, not a measurement. The score must be named as a readiness index, not allostatic load.
- The N3 share is a phone-motion estimate, not a measured N3 share. It must carry that label.
- The weights (the Oracle's 0.4 / 0.3 / 0.3) have no source. They are HealthWiz's choices and must be shown as such.

**Plan:** reuse the Oracle's formula, add RHR (typed or device), and output a labelled "pacing suggestion" (light, moderate, full), never a diagnosis or a medical advice line.

**Tests:** tier boundaries; "unavailable" when any input is missing and the rule says so.
**Decision needed:** confirm the name "readiness index", and confirm that N3 is shown as an estimate.

---

## 9. Vascular Tone / Arterial Compliance: NOT BUILT (target not measurable)

**Catalog claim:** rate-pressure product and vascular elasticity from pulse, incline, and cadence.

**Problem:** the rate-pressure product is heart rate × systolic blood pressure. Blood pressure is not logged, and no source in the list links pulse alone to arterial elasticity. Compliance needs pressure and flow measurements.

**Honest alternative:** a "heart-rate response index" (peak climbing pulse relative to resting pulse, per workout), labelled as heart-rate response, not vascular health. Source `uth` supports the pulse ratio as a fitness-style estimate; no source supports it as elasticity.

**Decision needed:** (a) build the heart-rate response index with the relabel, (b) add blood-pressure logging first (a larger change: new input, new form, new warnings), or (c) drop the item.

---

## 10. Bone Remodeling & Osteogenic Matrix: NOT BUILT (inputs missing)

**Catalog claim:** vertical ground reaction force from stairs, paired with calcium, vitamin D, and K2 intake.

**Missing**
- **Ground reaction force:** needs a source and a force model. The phone cannot measure it. The app could estimate a multiple of body weight, but that needs a **SOURCE NEEDED**.
- **Calcium, vitamin D, K2:** the menu data has kcal only. MyFCD (`myfcd`) and the DRI source (`iomdri`) may list calcium and vitamin D but K2 is unlikely to be in either. Check before building.
- **Bone density:** cannot be inferred from logs. Any output must say that bone density is measured by DXA scan, not by this app.

**Decision needed:** (a) drop the item, (b) build a stair-activity log plus calcium and vitamin D intake only, with no K2 and no "remodeling" claim, after the owner names sources.

---

## 11. Neuro-Vagal Reset (0.1 Hz pacer): NOT BUILT

**Catalog claim:** a 0.1 Hz resonance-breathing pacer that drives vagus nerve stimulation.

**Plan (feasible)**
- An on-screen paced breathing guide (about 6 breaths per minute, which is 0.1 Hz) with a calm visual, shown when the user taps it after a stressful DASS result.
- Pulse before and after, typed or from the camera pulse estimate (`js/v6-ppg.js`, source `allen`), shown as the user's own numbers.

**Claims to remove:** "drives vagus nerve stimulation" has no source in the list. The text must say "a paced breathing exercise some people find calming" and nothing about the nerve.

**Safety:** stop if dizzy, same as the Stairs safety text.
**Tests:** pacer timing (exact 10 s cycle); no pulse data is invented when none is given.
**Decision needed:** approve the paced-breathing guide with the relabel, or drop the item.

---

## 12. GLUT4 Post-Meal Glycemic Blunting: NOT BUILT (sources missing)

**Catalog claim:** post-meal climbs time muscle contraction for insulin-independent glucose uptake.

**Missing**
- **Glucose and insulin:** no glucose data is logged, and no source for the mechanism is in the list. **SOURCE NEEDED.**
- **Carbohydrate per meal:** the menu data has kcal, not carbohydrate grams. Check `myfcd`.
- **The claim:** "blunts glycemic response" is a physiological outcome. Without glucose data the app cannot show it.

**Plan (honest):** a timer that suggests a short walk or climb after a meal, and records the post-meal stair time. No glucose claim, no GLUT4 mention, unless a source is named and approved.

**Decision needed:** approve the post-meal timer with no glucose claim, or drop the item.

---

## 13. Cardiovascular Drift & Thermal Strain: NOT BUILT (plasma volume not measurable)

**Catalog claim:** plasma volume deficit and dehydration shock risk.

**Problem:** plasma volume needs blood sampling. The app cannot estimate it, and "shock risk" is a medical claim.

**Feasible version:** a cardiac drift index. Pick a constant-cadence climb (from `js/v6-gravity.js` cadence), split it into the first and second half, and report the percentage rise in heart rate with the ambient temperature from the weather source. Labelled as a drift index, not plasma volume, not risk.

**Files:** `js/v6-gravity.js` (cadence segments), `js/v6-arcana.js` (weather), `js/v6-stairs.js` (pulse).
**Tests:** worked example with two halves; "unavailable" when cadence is not constant or no pulse is logged.
**Decision needed:** approve the drift index with the relabel, or drop the item.

---

## Source gaps to fill before any feature that needs them

| Needed for | Gap | Action |
|---|---|---|
| 5, 6 | Latent heat of water, caffeine half-life | Owner names a verified source; add to `js/v6-sources.js` |
| 6, 10, 12 | Micronutrients (magnesium, tryptophan, calcium, vitamin D, K2, carbohydrate) | Check MyFCD and DRI entries; add rows if missing |
| 10 | Ground reaction force model | Owner names a source, or drop |
| 12 | Glucose and insulin mechanism | Owner names a source, or drop |
| 9 | Pulse and arterial elasticity | None exists; drop or add blood pressure logging |

No source is cited in this file that is not already in `js/v6-sources.js`, except those marked SOURCE NEEDED.

## Decisions requested from the owner

For each of features 2 to 13, reply with one of: **build as proposed**, **build with the relabel**, **drop**, or **needs a source first**. The table below is the default if no reply.

| # | Default if no reply |
|---|---|
| 2 Climb Now | Drop substrate and EPOC; build effort band only if approved |
| 3 Inspect Ascent | Drop knee load |
| 4 Recover Now | Build the timer, relabel as heart-rate drop |
| 5 Hydrate & Cool | Hold until a latent heat source is named |
| 6 Nightly Sync | Hold until sources are named |
| 7 Spire of Trials | Local-only boards, refuse above 25 m GPS accuracy |
| 8 Allostatic | Build as readiness index, N3 labelled as estimate |
| 9 Vascular | Build heart-rate response index with relabel |
| 10 Bone | Drop |
| 11 Neuro-Vagal | Build paced breathing guide with relabel |
| 12 GLUT4 | Build post-meal timer with no glucose claim |
| 13 Drift | Build drift index with relabel |

Only feature 4 is ready to build without a source. The others wait for the decision above.

## Owner-supplied citations: verification (checked against public records, not yet added to js/v6-sources.js)

| Citation as supplied | Result | What is safe to add |
|---|---|---|
| Sylow, Kleinert, Richter, Jensen. Exercise-stimulated glucose uptake, Nat Rev Endocrinol 13(3):133-148, doi 10.1038/nrendo.2016.162 | **Verified.** Online Oct 2016, issue dated 2017. | Yes, if feature 12 ever needs a mechanism source. It supports contraction-stimulated glucose uptake in muscle; it does not support any claim about this app's users. |
| Stacoff et al. Ground reaction forces on stairs, Gait Posture 21(1):24-38, doi 10.1016/j.gaitpost.2003.11.003 | **Real, but the title was wrong:** it is "...effects of stair inclination and **age**", not "speed". The abstract gives no peak ascent force; the only figure is "average vertical load increased up to 1.6 BW" on the steep stair. | Not the supplied `key_value: 1.45`. Feature 10 is dropped, so nothing needs it. |
| Blanchard & Sawers 1983. The absolute bioavailability of caffeine in man, Eur J Clin Pharmacol 24(1):93-98 | **Real, but the supplied DOI is wrong** (the record is 10.1007/BF00613933). The mean half-life of 5.0 h was **not confirmed**: the abstract could not be read (publisher login wall), and a search snippet suggested individual half-lives of 2.7 to 9.9 h. | Nothing yet. Feature 6 stays on hold until the abstract text is supplied or another source gives the half-life. |
| Wenger 1996, "Biophysics and Heat Balance...", Cooper Publishing, doi 10.1016/B978-012386525-0.00003-4 | **Could not be verified.** The publisher, year and DOI pattern do not match any record found. The value 2.426 kJ/g appears in a 2018 heat-physiology chapter (Belval & Jay) but its own reference could not be confirmed, and latent heat falls with temperature (about 2.50 kJ/g at 0 C, 2.41 kJ/g at 40 C). | Nothing yet. Feature 5 stays on hold until a source for the latent heat of water at skin temperature is confirmed. |

Also not used: the supplied MyFCD tag names, the tryptophan intake range, and the formula blocks (their images did not arrive). Entries added to `js/v6-sources.js` must use its existing fields (`t`, `by`, `in`, `d`, ...), not the supplied object layout.

### Second round (owner-supplied "verified" texts), checked against PubMed

| Supplied | Result | Effect |
|---|---|---|
| Wenger 1972, "Heat of evaporation of sweat", J Appl Physiol 32(4):568-569, doi ...32.4.568, "2.426 x 10^6 J/kg at 30 C" | **Real paper, wrong details.** PubMed (PMID 5026491): "Heat of evaporation of sweat: thermodynamic considerations", J Appl Physiol 1972;32(4):456-9, doi 10.1152/jappl.1972.32.4.456. PubMed shows **no abstract**, so the 2.426 value and the 30 C condition cannot be confirmed from the record. (A different paper, Snellen, Mitchell and Wyndham 1970, J Appl Physiol 29:40-44, has a similar title.) | Not added. Feature 5 stays on hold until someone reads the paper's text and confirms the value. |
| Blanchard & Sawers 1983, doi 10.1007/BF00613933, "averaged 4.98 h (range 3.03 to 7.15 h)" | **Citation and DOI correct, quotation not found.** PubMed (PMID 6832208): the abstract gives no mean half-life; its only half-life sentence is "The caffeine plasma half-lives varied from 2.7 to 9.9 h, indicating substantial inter-subject variability in its elimination." | Not added. A single 5.0 h figure is not supported by this paper's abstract. Feature 6 stays on hold; if used, it must show the 2.7 to 9.9 h spread, not one number. |

### Menu micronutrient estimates (Features 5 and 6, data side), 2026-11-01

- **Sources recorded in `js/v6-sources.js`:** `nistwater` (checked: the enthalpy of vaporization was computed from NIST's saturation table, 2429.8 kJ/kg at 30 °C, 2422.7 at 33 °C), `blanchard83` (checked against its PubMed abstract: individual caffeine half-lives 2.7 to 9.9 h) and `iom2001` (**partly checked**: the book is real, but the sentence "about 4 to 5 hours (range 2 to 9)" was supplied by the owner and could not be read here; the record says so). A caffeine half-life must be shown as a spread, not one number.
- **Menu estimates:** `data/menu_micronutrient_dataset.json` / `.csv` (all 152 menu rows) and `js/v6-menu-nutrients.js`. 23 rows map to one published food-composition record; the rest are unavailable. The tables used are the USDA SR Legacy release; MyFCD could not be read. **The project rule (tests/67) keeps USDA out of the app's source and Vault lists, so the provenance is kept in the data files, `tools/build_menu_nutrients.py` and this note.** If these values are ever shown to users, the owner must decide how to cite the tables (that needs `tests/67` to change).
- Not built: Luke's live search does not return tryptophan or caffeine (its function asks only for sodium, potassium and magnesium).

## Features 5 and 6: final plans, decisions and corrections (2026-11-01)

### Four factual corrections to the earlier notes and the owner's brief
1. **Caffeine half-life spread.** "3.0 to 7.0 h" came from the quotation "averaged 4.98 h (range 3.03 to 7.15 h)", which is NOT in the Blanchard & Sawers abstract. The only half-life line verified (PubMed 6832208) is **2.7 to 9.9 h**, individual values in 10 men. The IOM "4 to 5 h typical, 2 to 9 h range" was supplied by the owner and has not been read in the book. Feature 6 uses 2.7 to 9.9 h as the checked spread and shows the IOM figure only as a marked, unverified context line.
2. **Four assumptions, not three.** Feature 5 assumes η = 0.20, α = 0.80, **all heat leaves as sweat** (convection, radiation and breath ignored), and 1 g of sweat = 1 mL.
3. **Skin temperature.** NIST gives Lv = 2426 kJ/kg at about 31.6 °C. No source is held for a "typical skin temperature", so the wording is "the value at about 31.6 °C".
4. **Caffeine entries.** The earlier note "the caffeine entries in `js/hw-02-core.js`" was wrong: the app has no caffeine log. The only caffeine in the app is the `caf` value Luke saves with a food entry (`js/v6-addfood.js`).

### Decisions (owner, 2026-11-01)
- **Menu-table caffeine: Option A.** Feature 6 reads ONLY `caf` values saved from Luke lookups. A static menu item with no Luke lookup says "caffeine unknown". `tests/67` is unchanged. The menu dataset's USDA provenance stays in the data files, the build tool and these docs.
- **Feature 5 energy input:** the project's existing kJ estimate (`js/v6-stairs.js` `projectVO2`, exposed as `HWStairs.projectNow`). No second energy calculation, and no dependence on stair height.
- **Minerals graph:** stays sodium, potassium and magnesium only. Tryptophan and caffeine are not minerals; Feature 6 presents them.
- **Order:** Feature 5 first, then Feature 6.

### Feature 5: Hydrate & Cool (built: `js/v6-hydrate.js`, `tests/98-hydrate.test.mjs`)
heat Q = energy × (1 − 0.20); sweat S = Q ÷ (0.80 × 2426 kJ/kg). Worked: 100 kJ → 80 kJ → 0.0412 kg ≈ 41 mL. Labelled "estimated fluid deficit", with the four assumptions on the card and a worked "?" panel. No alert, no "drink now", no dehydration or heat-illness wording. Needs a confirmed profile, a resting pulse, an after pulse and a workout time; otherwise it says what to add. Memory only, no schema step. NIST water is the only source (`nistwater`); η and α are HealthWiz's own round figures and say so.

### Feature 6: Nightly Alchemical Sync (plan; not built yet)
Standalone `js/v6-nightsync.js` (the Trance file is 56 KB). For each evening item with a saved `caf`: residual = mg × 0.5^(hours ÷ half-life) at 2.7 h and 9.9 h, shown as a range (Teh O 40 mg at 16:00, bed 23:00, 7 h: about 7 to 25 mg). Items with no caffeine value are never counted as zero: the card says "caffeine unknown for N logged items" and labels the range "at least". No partial totals. Last meal time, sleep latency and N2/N3-equivalent figures come from the Trance, as logged. "Descriptive, not evidence of cause." No synergy score. Memory only.

### Luke's lookup (already built, commit 17fe1a9)
`food-guess` returns `caffeine_mg` and `tryptophan_mg` per part with `nutrient_source` and `nutrient_match`; a number without a citation is dropped; caffeine 0 counts as missing; null or failure shows "Luke found no source" and saves nulls. The entry keeps `trp`, `caf`, `mnsrc`, `mnm`. No USDA wording in any user-facing file (`tests/67`). The function needs the owner to deploy it.
