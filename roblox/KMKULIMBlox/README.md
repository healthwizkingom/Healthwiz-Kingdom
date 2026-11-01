# KMKULIMBlox

Standalone Roblox Studio campus exploration experience for KMKULIM.

- Studio place file: `KMKULIMBlox_WorkingCopy.rbxl` (built from this folder, see below)
- Roblox experience: https://www.roblox.com/games/72202970868613
- Creator line: HEALTHWIZ KINGDOM
- The climb logging button is a demo and does not save climb records.

This folder keeps the Roblox project separate from the HealthWiz web app. It is not connected to app routes,
runtime assets, or deployment.

## What is in the game

The campus is **generated when the server starts** (about 15 000 parts + terrain), from the same data the web app uses:

| Thing | Source |
|---|---|
| Terrain (smooth, walkable hills; max slope about 30 degrees) | `data/elevation-zones.geojson` (heights halved and slopes stretched so you can walk them) |
| 44 buildings (exact footprints, open-corridor facades, hip roofs, roof monitor + tank on the big blue block, Surau dome) | `data/campus-osm.geojson` + `data/campus-looks.json` (drone video) |
| Roads with red/white kerbs, covered walkways, car parks, Padang + goals, tennis courts, Astaka, water towers, palms | `campus-osm.geojson`, `campus-props.json` |
| KM KULIM entrance sign (3D letters, red M, olive panel, cream plate, emblems, tiled steps, floodlights) and the "We love KMKulim" sign | reference photos in `assets/reference/` |
| 32 stair hearts. Every stair is real, climbable geometry built from the survey (risers, riser height, tread, switchbacks), with a lit nosing per step, handrails, a photo board and a heart you tap | `data/stair-survey.json`, `CampusData.luau` |
| Tap a heart: it opens into the stair photo, the steps light up one after another in the stair's colour, a student climbs, sparkles at the top | `StairMarkerService` + `World/StairAnimator` |
| Gazebos, shelters, benches, picnic sets: every one is a `Seat` (walk into it to sit, jump to stand) | `World/Furniture`, `World/Landmarks` |
| **Gereg** (bicycle) racks and **Kereta** (cars): walk up, press E (tap the prompt), W/S + A/D or thumbstick, jump to get off. Unused vehicles go home after 50 s | `World/Vehicles`, `VehicleController` |
| Auto-generated life: hedges and crotons along the blocks, flower beds, a fountain, bins, flagpoles with the Jalur Gemilang, 30 students strolling the walkways | `World/Decor`, `World/Students` |
| Plant life: rain trees, mango, frangipani, bamboo, banana, flowering bushes and ferns in clumps; lotus pond with bridge; fountain | `World/Vegetation`, `World/Props` |
| Campus life: parked motorbike sheds, bus stop, "Zon Sihat" outdoor gym (hold the prompt for coins), basketball court, KM KULIM Run jogging track round the Padang, zebra crossings and road signs, birds, butterflies, clouds | `World/Props`, `World/Sky` |
| Collectibles and leaderboard: Semangat coins along the walkways, health hearts at the top of every stair, Coins + Stairs-discovered on the leaderboard | `CoinService`, `CollectibleSpin` |
| Day/night cycle (14 min), street lights and sign floodlights at dusk | `LightingService` |

## Build the place file

```bash
python3 tools/roblox_gen_world_data.py          # repo root: regenerates src/.../World/Data/*.luau from data/
cd roblox/KMKULIMBlox
rojo build default.project.json -o KMKULIMBlox_WorkingCopy.rbxl     # Rojo 7.5+  (cargo install rojo)
```

Open the `.rbxl` in Studio and press Play. Terrain is sculpted by the server script at run time, so you will not see it in Edit mode.
`rojo serve` + the Rojo plugin lets you edit the Luau live.

### Logos on the KM KULIM sign
The MARA and Kolej MARA Kulim emblems need image assets. Upload `assets/mara-logo.png` and `assets/kolej-mara-kulim-crest.jpg`
(Creator Hub, or `python3 tools/roblox_upload_assets.py` with an Open Cloud key) and paste the ids into
`src/ServerScriptService/KMKULIMBlox/World/Assets.luau`. Until then the sign shows text emblems.

### Checking without Studio
`lune run tools/check` compiles every Luau file; `lune run tools/smoke --stub=TerrainBuilder WorldBuilder.server` builds the
whole world offline (Lune with Roblox datatypes) and counts the parts. Neither replaces a Studio playtest.
