# Data notes

What the prototype shows, where each piece comes from, and what is a placeholder. Nothing here is a campus measurement
unless it says "measured".

## 1. What the OpenStreetMap file contains

Your export `data/source/kmk-map.osm` (OSM API 0.6, generator openstreetmap-cgimap 2.1.0) covers
5.34810–5.35403 °N, 100.53634–100.54046 °E: 1,352 nodes, 134 ways, 4 relations.

**Drawn on the map** (139 features after conversion, `tools/osm_to_geojson.py`):

| Kind | Count | Notes |
|---|---|---|
| Campus outline | 1 | `amenity=college`, "Kolej MARA Kulim" (`grades=12`). All 28 placed staircases fall inside it. |
| Buildings | 45 | `building=college` 22, `yes` 10, `house` 6, `dormitory` 5, `mosque` 1, `hut` 1 (a bus shelter). Three dormitories are multipolygons with a courtyard. |
| Roofs / canopies | 19 | `building=roof`, `layer=1`: drawn as thin raised canopies. |
| Covered walkways | 21 | `highway=footway`, `covered=yes`, `surface=concrete` (one at `layer=-1`). These are the red dashed lines in your OSM screenshot. In fantasy mode they become the animated glowing paths. |
| Roads | 35 | 32 residential and service roads, 3 secondary ("Jalan Air Merah / Junjong"). |
| Sports areas | 4 | "Padang" (track and field), a second pitch, a tennis court, "Astaka" (`leisure=stadium`). |
| Squares | 3 | `place=square`, unnamed. |
| River | 3 | "Sungai Machang Bubok". |
| Water towers | 2 | `man_made=water_tower`. |
| Residential area | 1 | "Kampung Ayer Merah". |
| Points | 5 | Two bus stops, a gate, a shop and a neighbourhood name (kept in the data, not drawn). |

**Named places inside the campus:** Bangunan Akademik (5 outlines), Asrama Lelaki A, B and C, Asrama Perempuan E and F,
Surau, Astaka, Padang.

**Not in the OSM file:**
- **No staircases.** There is no `highway=steps`, so OSM gives no stair positions, step counts or directions.
- **No heights.** No `height`, `building:levels`, `ele` or `level` tags, so building heights in the 3D map are illustrative
  (dormitory 13 m, college 10 m, mosque 7 m, house 5 m, others 6 m, canopies 2.6–3 m, water towers 12 m). The raised-buildings
  button turns them off.
- **No contours or terrain.** The raised ground on the map is illustrative (section 3).

Licence: © OpenStreetMap contributors, ODbL 1.0. The map shows the attribution. The converted file keeps every OSM id.

## 2. Staircase details from your information

From the HealthWiz app's stair list (`STAIRS` in `js/hw-02-core.js`, the original v5.4.3 data, read once and never
changed), and the Group 14 F21 report (v4), Table 2, for ST14, ST19 and ST20.

- **32 records**, all with a name, an angle, an app category and a floor label.
- **28 with a stored coordinate**, shown as **Estimated location**: the app never recorded where they came from.
  ST06, ST31 and ST32 share one coordinate; ST09 and ST15 share another (one marker each, marked ×3 and ×2).
- **4 with no coordinate** (ST02, ST08, ST16, ST29): listed, never placed on the map.
- **Angles:** 29 are from the app data (method not recorded), labelled **Estimated angle**. ST14, ST19 and ST20 are the F21
  report's values, θ = arctan(rise ÷ run) from tape measurements, mean of 5 consecutive steps, labelled
  **Angle from measured steps**. They match the app values exactly (26.43°, 27.23°, 28.52°).
- **Measured step size** (F21 report Table 2): ST20 = Staircase A (Generator Stairs) rise 0.169 m, run 0.311 m;
  ST19 = C (Block Aisyah Stairs) 0.157 m, 0.305 m; ST14 = B (Block Kenanga Stairs) 0.149 m, 0.300 m.
- **Flagged "Needs checking"** (7): ST31, ST32, ST33 (stored angles 59.76°–65.52°, unusually steep for a staircase);
  ST08 and ST21 (same name); ST10 and ST27 (same route name, different angles).

| ID | Name (app data) | App category | Floor label | Estimated location | θ (°) | Step rise / run (F21) | Notes |
|---|---|---|---|---|---|---|---|
| ST02 | Tangga Selangkah Menara Gading | Mild | G level | — (none recorded) | 14.25 | — | No coordinates recorded: listed, not placed on the map. |
| ST03 | Tangga ke Dewan Mawar / Makmal Fizik (depan office) | Mild | G level | 5.3515422, 100.5380308 | 19.60 | — |  |
| ST04 | Tangga dari cafe ke court tennis | Mild | G level | 5.3504943, 100.5389913 | 20.94 | — |  |
| ST05 | Tangga parking KJ ke laluan study putra (belakang Jab. Matematik) | Mild | G level | 5.3512084, 100.5377726 | 21.80 | — |  |
| ST06 | Tangga depan Pejabat HEP ke Makmal Kimia (tingkat 1) | Mild | Tingkat 1 | 5.3515635, 100.5383731 | 23.96 | — | Shares one stored coordinate with ST31, ST32. |
| ST07 | Tangga sebelah depan Bilik Raflesia (sebelah Seroja) ke Lab Biology | Mild | G level | 5.3512758, 100.5383744 | 24.45 | — |  |
| ST08 | Tangga Makmal Inovasi ke bilik 406, 407 | Mild | G level | — (none recorded) | 24.51 | — | No coordinates recorded: listed, not placed on the map. Same name as ST21 in the app data: may be the same staircase. |
| ST09 | Tangga dari Dataran Ilmu ke Jab. Sains / Makmal Biology | Mild | G level | 5.3512708, 100.538078 | 24.72 | — | Shares one stored coordinate with ST15. |
| ST10 | Tangga dari parking Anjung Santap ke koperasi (melalui tempat pungutan parcel) | Mild | G level | 5.3511202, 100.539051 | 24.86 | — | Same route name as ST27 in the app data, with a different angle. |
| ST11 | Tangga dari court tennis ke Blok C | Mild | G level | 5.3496995, 100.5390775 | 25.71 | — |  |
| ST12 | Tangga dari Blok C ke Blok A/B | Mild | G level | 5.349364, 100.5390849 | 25.85 | — |  |
| ST13 | Tangga belakang Dewan Ixora ke Dewan Kesidang | Moderate | G level | 5.3502767, 100.5379339 | 26.00 | — |  |
| ST14 | Tangga belakang Bilik 409 naik ke Dewan Kenanga | Moderate | G level | 5.3524047, 100.5383392 | 26.43 | 0.149 m / 0.3 m (Staircase B) | Staircase B (Block Kenanga Stairs) in the Group 14 F21 report: step rise and run measured with a tape (mean of 5 consecutive steps). The report ranks it Mild among its three stairs. |
| ST15 | Tangga aras 1 naik ke bilik tutorial (sebelah Lab Biology) | Moderate | Tingkat 2 | 5.3512708, 100.538078 | 26.57 | — | Shares one stored coordinate with ST09. |
| ST16 | Tangga merah ke wakaf / gazebo sebelah Selangkah ke Menara Gading | Moderate | G level | — (none recorded) | 26.60 | — | No coordinates recorded: listed, not placed on the map. |
| ST17 | Tangga dari DS naik ke koperasi | Moderate | G level | 5.3510194, 100.5386617 | 26.60 | — |  |
| ST18 | Tangga ke Makmal Inovasi dari tapak parking depan pejabat | Moderate | G level | 5.3520312, 100.5380334 | 27.00 | — |  |
| ST19 | Tangga dari Blok Aisyah / parking Blok E ke Dewan Kenanga | Moderate | G level | 5.3525206, 100.5386027 | 27.23 | 0.157 m / 0.305 m (Staircase C) | Staircase C (Block Aisyah Stairs) in the Group 14 F21 report: step rise and run measured with a tape (mean of 5 consecutive steps). The report ranks it Moderate among its three stairs. |
| ST20 | Tangga sebelah rumah penjana elektrik ke Dewan Kenanga | Moderate | G level | 5.3519878, 100.5383771 | 28.52 | 0.169 m / 0.311 m (Staircase A) | Staircase A (Generator Stairs) in the Group 14 F21 report: step rise and run measured with a tape (mean of 5 consecutive steps). The report ranks it Vigorous among its three stairs. |
| ST21 | Tangga Makmal Inovasi ke bilik 406, 407 | Moderate | G level | 5.3521864, 100.5381059 | 28.86 | — | Same name as ST08 in the app data: may be the same staircase. |
| ST22 | Tangga cafe ke Dewan Melati (dewan exam) (tangga tengah) | Moderate | G level | 5.350466, 100.5387657 | 29.44 | — |  |
| ST23 | Tangga Anjung Santap | Moderate | G level | 5.3517635, 100.5391633 | 31.20 | — |  |
| ST24 | Tangga dalam Blok A | Vigorous | G level | 5.3490042, 100.5388927 | 31.21 | — |  |
| ST25 | Tangga dalam Blok B | Vigorous | G level | 5.3490162, 100.5391398 | 31.30 | — |  |
| ST26 | Tangga dari rumah pengarah naik ke Blok E | Vigorous | G level | 5.3520232, 100.5388347 | 31.52 | — |  |
| ST27 | Tangga dari parking Anjung Santap ke koperasi (melalui tempat pungutan parcel) | Vigorous | G level | 5.3509924, 100.5388522 | 31.55 | — | Same route name as ST10 in the app data, with a different angle. |
| ST28 | Tangga naik ke Smart Classroom | Vigorous | G level | 5.3507487, 100.5379365 | 34.02 | — |  |
| ST29 | Tangga naik ke Dewan Semarak | Vigorous | G level | — (none recorded) | 37.20 | — | No coordinates recorded: listed, not placed on the map. |
| ST30 | Tangga dari parking Anjung Santap ke Blok FAZ (sebelah belakang) | Vigorous | G level | 5.3511299, 100.5395432 | 37.84 | — |  |
| ST31 | Tangga aras 1 naik ke bilik tutorial (sebelah Lab Fizik) — lower half | Vigorous | Tingkat 2 | 5.3515635, 100.5383731 | 59.76 | — | Shares one stored coordinate with ST06, ST32. Stored angle is unusually steep for a staircase: flagged for re-measurement. |
| ST32 | Tangga aras 1 naik ke bilik tutorial (sebelah Lab Fizik) — upper half | Vigorous | Tingkat 2 | 5.3515635, 100.5383731 | 60.13 | — | Shares one stored coordinate with ST06, ST31. Stored angle is unusually steep for a staircase: flagged for re-measurement. |
| ST33 | Tangga cafe ke Dewan Kemboja (dewan exam) (tangga hujung) | Vigorous | G level | 5.3504813, 100.5389749 | 65.52 | — | Stored angle is unusually steep for a staircase: flagged for re-measurement. |

## 3. Illustrative terrain (from your annotated screenshot)

`data/elevation-zones.geojson` holds two outlines traced from the two areas you circled on the phone screenshot of this map.
The screenshot was matched to the map by fitting its projection to ten staircase markers visible in it (residuals 0.2–1.3 m).

| Zone | Your annotation | Illustrative height | Staircases inside the outline |
|---|---|---|---|
| Middle Elevation (upper cluster) | north circle | 12 m above the base | ST14, ST18, ST19, ST20, ST21, ST23, ST26 |
| Highest Elevation (southern region) | south circle | 24 m above the base | ST11, ST12, ST24, ST25 |

The rest of the campus is the base level. Each zone rises gently (a smooth curve over 55 m and 80 m outside its outline)
to a flat top; there are no cliffs. Faint contour lines every 3 m show the rise. **The heights only show the order you
gave (base < middle < highest); they are not measured elevations** and must be replaced with surveyed values.

## 4. Computed, not measured

- **Nearest OSM place** in the details panel: the distance from the stored coordinate to the nearest named OSM building
  or field outline, worked out in the browser. It inherits the location's uncertainty.
- **Marker grouping:** records with an identical stored coordinate share a marker; markers that overlap on screen merge
  into a numbered cluster until you zoom in.
- **Map terrain** in the details panel: which illustrative zone the stored coordinate falls in.

## 5. Placeholders and limitations

- **Every staircase location is an estimate.** None has been checked on site; the map's dashed outlines say so.
- **No orientation, step count, flights, landings, floors or vertical rise** exist for any staircase. The details panel says
  "Not yet surveyed" or "Measurements unavailable" for each.
- **The 3D staircase model is illustrative.** Shape, steps per flight (9), width (1.4 m), landing depth (1.4 m), railing height
  (0.9 m) and the demonstration step (0.16 m rise, 0.30 m run) come from `data/demo-geometry.json`. For ST14, ST19 and ST20
  only, the step rise and run are the measured F21 values. The stored angle never sizes the model, and no height, step
  count or floor count is inferred from it. With no surveyed orientation, the model faces an arbitrary direction and has no
  north arrow.
- **Building heights in the map are illustrative** (see section 1), and so is the terrain (section 3).
- **The app category** (Mild / Moderate / Vigorous) colours the markers. It is the app's own label, not a measurement.
- **Floor labels** ("G level", "Tingkat 1", "Tingkat 2") are copied from the app; what they mean on site is not documented.
- **Fantasy buildings** are modelled in Blender (`tools/blender_buildings.py` → `assets/models/campus-fantasy.glb`). Their
  walls stand on the real OSM outlines; the plinths, storey bands, gold eaves, sloped hipped roofs, chimneys, corner
  turrets with spires, the Surau's gold dome and the water towers' pointed roofs are a fantasy treatment of those
  outlines. Heights and roof shapes are not real. Realistic mode shows plain blocks.
- **3D staircase models** are modelled in Blender (`tools/blender_stairs.py` → `assets/models/stairs/`). They use the same
  demonstration shapes and sizes as before; only the step rise and run of ST14, ST19 and ST20 are measured (F21). The
  materials, runes, crystals, rails and pedestals are styling, not the real staircases' finishes.
- **Your position (Tom)** comes from the device's Geolocation API only after you ask for it, with the device's own
  accuracy estimate shown as a circle. It is a device estimate, not a survey, and it is never stored or sent. The demo walk
  is simulated along an OpenStreetMap road and labelled "simulated position, not yours". Tom's size and walking speed on
  the map are a game look, not measurements.
- **Lighting and shadows** (map and preview) are a rendering effect. The light direction is chosen for a clear picture;
  it is not the real sun position, and the shadows do not show real shade on campus.
- **Fantasy decorations** (trees, lanterns, glowing walkways and zone edges, particles, crystals, the floating dais in the
  3D preview) are drawn over the same data and never move a marker or change a number. Trees are placed by a fixed
  pattern on open ground away from buildings, paths and staircases; they do not show real trees.
- **No health statistics** are shown: nothing here can yet be calculated from real staircase data.
- **Not built yet:** the survey workflow, accounts, the admin interface, a database, photos. The JSON already has empty fields
  for them.
