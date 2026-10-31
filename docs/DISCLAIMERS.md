# Disclaimers behind the "?" (owner request, 18 October 2026)

Goal: less text on every screen. Every disclaimer, "not a medical device / not a diagnosis / not medical advice" note and
estimate caveat sits behind a "?" button (`HWHelp`, `js/v6-help.js`), with the wording unchanged. Each page keeps one short
visible pointer so a user always sees that the app is not medical. Tests: `tests/69-disclaimers.test.mjs`.

## Page footer (all pages)

Before: `<p class="dis">` with the page's whole `DIS` text and the tagline (`js/hw-04-part.js`, `render()`).
After: "Wellness tracker, not a medical device" and a "?" (accessible name "About: Wellness tracker, not a medical device",
44 x 44 px, tap, Enter, Space and Escape, focus returns to the button). The panel holds the page's full `DIS` text and "Turn Your
Health Into an Adventure." The `DIS` entries themselves (`hw-02-core.js`, `hw-03-part.js`, `hw-04-part.js`, `v6-alchemy.js`,
`v6-body.js`, `v6-exercise.js`, `v6-lab.js`, `v6-observatory.js`, `v6-provisions.js`, `v6-running.js`, `v6-score.js`,
`v6-stairs.js`, `v6-time.js`) are untouched.

Visible footer words per page, counted from the running app (before = `DIS` text plus tagline):

| Page | Footer words before | Footer words after |
|---|---:|---:|
| food | 65 | 6 |
| water | 65 | 6 |
| sleep | 30 | 6 |
| pulse | 68 | 6 |
| stair | 68 | 6 |
| stress | 41 | 6 |
| bmi | 20 | 6 |
| calc | 23 | 6 |
| stats | 22 | 6 |
| guide | 22 | 6 |
| set | 17 | 6 |
| health | 27 | 6 |
| home | 41 | 6 |
| quests | 24 | 6 |
| kingdom | 16 | 6 |
| badges | 21 | 6 |
| alchemy | 37 | 6 |
| run | 43 | 6 |
| score | 29 | 6 |
| body | 37 | 6 |
| exercise | 88 | 6 |
| lab | 38 | 6 |
| time | 26 | 6 |
| campus | 25 | 6 |

Total over 24 pages: 893 -> 144


## Inline notes moved into a card's "?"

| Page and card | Wording (unchanged) | Was | Now in |
|---|---|---|---|
| Body, BMI result | "BMI is an adult screening number worked out from what you typed. It is not a diagnosis and does not describe every aspect of health." | `v6-body.js:39` paragraph | the BMI "?" (`xbmi`), first limit |
| Body, daily energy goal | "These are estimates (Mifflin-St Jeor), not medical prescriptions." | `v6-body.js:99` paragraph | the energy goal "?" (`energyWhy`), first limit |
| Health Hall, personal quest plan | "General estimates for healthy people, not medical prescriptions. A doctor or dietitian can personalise them." | `hw-05-v5-4-module.js:33` small | new "?" `plannote` in the card heading |
| Health Hall, Safety Scroll | "Heart rate, BMI, sleep and stress tools are for tracking and learning only. They do not diagnose anything. If something worries you or you feel unwell, talk to a parent, teacher or healthcare professional." | `hw-04-part.js:38` paragraph | "?" `safetyscroll` in the card heading (the card is now just its heading and the "?") |
| Health Score, recommendations (fallback list) | "General wellness guidance, not medical advice." | `v6-score.js:166` small | "?" `recnote` in the heading |
| Health Score, SDG card | "HealthWiz is a wellness tracker, not a medical device." | `v6-score.js:188` small | "?" `sdgnote`; the SDG 3 sentence stays |
| Health Score, what-if | "A habit summary, not a medical diagnosis or a validated clinical risk score." | `v6-whatif.js:110` small | the existing what-if "?" already says it ("The Health Score is a habit summary, not a medical diagnosis or a validated clinical risk score."), so the visible sentence was removed and not duplicated |
| Health Score, Health Orb | "General wellness guidance based only on your logged entries. It does not promise any health result and is not medical advice. Concerning symptoms belong with a healthcare professional." | `v6-orb.js:163` small | "?" `orbnote` beside REPLAY ORB READING |
| Laboratory intro | "They are not diagnoses and not medical advice." | `v6-lab.js:119` | "?" `labnote` at the end of the intro |
| Stress meter | "A game visual, not a medical measurement." | `hw-03-part.js:6` small | "?" `stormnote` |
| Older Pulse page, heart-rate picture | "Not a medical ECG." | `hw-02-core.js:210` | "?" `ecgnote` in the card heading |
| Stair plan card | "Not a medical prescription." | `v6-plan.js:94` | "?" `plnote` (the "Optional." stays) |
| Home, Guide: tomorrow's quest tag | "GENERAL WELLNESS IDEAS · NOT MEDICAL ADVICE" | `hw-04-part.js:29` tag | "?" `tqnote` (full tag text in the panel) |
| Guide: observations tag | "OBSERVATIONS FROM YOUR OWN LOGS · NOT MEDICAL ADVICE" | `v6-insights.js:75` tag | "?" `obsnote` |
| Quests: game quests tag | "🎮 GAME QUESTS · NOT MEDICAL ADVICE" | `v6-quests.js:71` tag | "?" `gqnote` |
| Quest board (conditions) | "HealthWiz does not diagnose conditions. Ask a doctor before changing your activity." | `v6-conditions.js` quest card, "your quests" card, registry question | "?" `condnote`, `condnote2`, `condnote3` |
| Stairs, heart-rate recovery | "A guide only. It varies with fitness, caffeine, sleep and how hard you climbed." | `v6-stairs.js:227` small | the existing recovery "?" (`strec`); the sentence "If you feel dizzy, have chest pain or feel unwell, stop and see a health professional." stays visible as a safety instruction |

## Kept visible (safety instructions, labels, live warnings)

* Stress page crisis and emergency numbers; the "I feel dizzy" and "Chest pain" stop buttons and post-stop message in the
  Training Hall (`v6-exercise.js:227`); the "check with your doctor first" gate and the stairs note (`v6-conditions.js`, which
  still ends with its disclaimer sentence); the stair planner's doctor-first warning; the "outside the usual resting range, see a
  doctor" line (`v6-stairs.js:200`, `v6-score.js:130`, `hw-03-part.js:66`) and the unusual-value card (`hw-03-part.js:71`),
  which show only when the user's own data triggers them; the stairs "Safety" paragraph (already behind the Stair Sense "?").
* Labels, not disclaimers: every "measured / calculated / estimated / simulated / missing" label and every "GAME PROGRESS, NOT A
  HEALTH MEASUREMENT" tag. The title screen's own line "Wellness tracker, not a medical device." (`hw-02-core.js:85`) stays: that
  screen has no footer.
* The printed and shared report (`v6-report.js`) keeps its "not a medical document" footer and privacy warning, because paper has
  no "?".

## Already behind a button, left as they were

* The "Will my watch work?" sheet (`v6-hr.js:109`) and the camera pulse sheet (`v6-ppg.js:215`) open on demand and are help
  sheets themselves; the pulse "?" (`v6-ppg.js:152`) already holds the same sentence.
* The Health Orb's per-card notes (`v6-orb.js`) sit inside a collapsed "More detail" disclosure.
* The Health Hall tile explanations (`v6-hall.js:39,43`) are the tile "?" panels.

## Not done

Other short estimate caveats that are not "not medical" sentences (for example "estimate" tags on single numbers) were left in
place: they are the labels the brief says to keep next to a value. A line-by-line check of every `<small class="mut">` for
more caveats was not done.

## Sleep Now (added 2026-10-31)

`js/v6-trance.js` shows "game estimate from phone movement, not a medical measurement" on the Morning Readout and its "?" panel.
The four states are movement estimates with HealthWiz's own uncalibrated thresholds, not sleep stages. The four Evidence Vault
sources behind the names (Xie 2013, Fernandez and Lüthi 2020, Czeisler and Gooley 2007, Peever and Fuller 2017) were read through
PubMed; their limits are stated in each record. No audio is recorded, only a loudness number. No "delta percentage" or "glymphatic
efficiency" is shown, because a phone cannot measure them.

The Astral Weave (a REM estimate) is a model of when REM usually happens in a night, kept only where the phone was still. It is not detected REM and is labelled so on the Depths card, in the "?" panel and in the Evidence Vault. Spell Mastery is a game value, not a memory measurement.

The Astral Weave's Vault entry cites Peever and Fuller 2017, Brooks and Peever 2012, Jones 2005 and Buzsaki 2002, each checked against its PubMed record on 2026-10-31. Each mechanism line says what the abstract shows and, separately, which standard detail (the sublaterodorsal nucleus pathway, the PPT/LDT nuclei, theta's 4 to 8 Hz range and medial-septal pacemaker, theta in REM) the abstract read does not state. The Buzsaki abstract does not mention REM, so the link from theta to REM memory consolidation is shown as a possible function.

Full-text check (2026-10-31): the open-access Brooks and Peever 2012 text (PMC6621291) was read. It supports the SLD glutamate neurons acting through GABA/glycine interneurons, and says the relay is unclear; it does not contain the sentence "driven by descending input from the pontine SLD" that was supplied in a note. Jones 2005, Peever and Fuller 2017 and Buzsaki 2002 are not open access and were not read in full; their excerpts supplied in notes could not be checked, so the PPT/LDT, theta 4 to 8 Hz and medial-septum details stay marked as standard detail not stated in the abstract read.

Second full-text check (2026-10-31): the owner supplied the NIH author manuscript of Scammell, Arrigoni and Lipton 2017 (Neuron 93(4), PMID 28231463). It was read, and it supports the SLD to ventromedial-medulla/spinal GABA-glycine pathway, the PPT and LDT cholinergic nuclei (with "may help drive"), and theta arising from the dorsal hippocampus in rodent REM, with only a modest amount of theta in the human REM EEG and medial-septal cholinergic neurons helping drive it. It also says how the SLD produces atonia is still debated. A second uploaded file (an oncology paper on NKp46 in leukaemia) is unrelated and was not used. Jones 2005, Buzsaki 2002 and Peever and Fuller 2017 are still abstract-only.
