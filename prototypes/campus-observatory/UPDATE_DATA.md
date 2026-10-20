# Updating the staircase data from the Word sheet

The blank sheet is `data/source/HealthWiz_Campus_Stair_Data_Sheet.docx`. Fill it in as you measure, a few stairs at a
time. Whatever you have filled so far can be loaded at any point; blank cells simply stay "not surveyed".

## The three steps

1. **Fill in the sheet.** Write numbers only, without units (the unit is in each column title). Leave a cell blank if you
   did not measure it; do not copy the grey app values into the white cells.
2. **Import it.** From this folder run:

   ```sh
   python3 tools/import_stair_sheet.py path/to/your-filled-sheet.docx
   ```

   Python 3.8 or later; nothing to install. It writes two files:
   * `data/stair-survey.json`: the survey values the map uses (do not edit it by hand, re-run the tool instead);
   * `data/stair-survey-report.md`: what was imported, what is still missing, and anything to check.
3. **Read the report, fix the sheet, run it again.** Then refresh the map page.

No computer at hand? Send the filled sheet to Claude and ask it to run the import and commit the result.

## What the report checks

| Level | Meaning | Example |
|---|---|---|
| **error** | the value could not be used and was left out | "about 15" in a number column; latitude and longitude swapped; a position outside the campus |
| **check** | kept, but looks doubtful: re-measure or confirm | risers × riser height is more than 5 % away from the measured total rise; a riser of 24 cm; step size more than 1 cm from the F21 report |
| **note** | information only | "14,9" read as 14.9; no GPS accuracy written |

## What changes in the app when a stair has survey data

| Filled in the sheet | What the map shows | Label |
|---|---|---|
| Bottom latitude and longitude | the marker moves to the measured point; the old app coordinate is still listed in the details | **Measured location (survey)**, with the phone's ± accuracy |
| Risers, riser height, tread for a flight | the angle of that flight, θ = arctan(riser ÷ tread), and the stair's mean angle | **Angle from surveyed steps** (calculated) |
| Every flight complete: risers, riser height, tread, width, and the turn after each flight but the last | the 3D preview is built from these flights instead of the illustrative model; the shape buttons disappear | **Built from survey measurements** · finishes illustrative |
| Heading of climb (flight 1) | the 3D model and the compass turn to it | **Measured orientation** |
| Measured total rise of every flight | the stair's vertical rise | measured (otherwise "calculated: risers × riser height") |
| Landing length and width | the landings in the 3D model; without them a landing is drawn as wide and deep as the flight | |
| Building, indoor/outdoor, levels | shown in the details | Survey sheet (by, date, tool) |
| By, Date, Tool missing | values are still used | **Survey record incomplete** |

A stair becomes **Surveyed** when it has a measured position and complete flights. The app's own values (estimated
angle, coordinate, category) are never overwritten in `data/staircases.json`; the survey is laid over them when the page
loads, so an empty `data/stair-survey.json` (as committed: `"stairs": {}`) brings back exactly the old view.

## Parts 3 and 4

Buildings (Part 3) and your setup answers (Part 4) are read and stored in `data/stair-survey.json` for the integration
into HealthWiz; the map does not draw building heights from them yet.
