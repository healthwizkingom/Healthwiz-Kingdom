# Map avatars: sources and licences

The Campus Health Observatory's map avatar (observatory/avatar.js) is one of these, chosen by the player.

| File | Character | Source and licence | Changes made for HealthWiz |
|---|---|---|---|
| `tom.glb` | Tom | The model "Tom" supplied by the project owner for the Campus Observatory prototype. | Reduced to 14,000 triangles, one baked 1024 px texture, a new skeleton and new idle and walk clips (`prototypes/campus-observatory/tools/blender_tom.py`). |
| `schoolboy.glb` | Anime school boy | "Rigged Anime School Boy (Animation included)" by suzuart, https://sketchfab.com/3d-models/rigged-anime-school-boy-animation-included-288cb16deac54a3c95697a4e2290b499, licensed under CC BY 4.0 (http://creativecommons.org/licenses/by/4.0/). | Reduced from 55,452 to 14,000 triangles, colour baked onto one 1024 px texture, the source's skeleton and animation replaced by a simple skeleton placed at its joints with new idle and walk clips, arms lowered slightly (`tools/blender_avatar.py`). |
| `schoolgirl.glb` | Anime school girl | "Stylized Anime Japanese High School Girl 2" (https://skfb.ly/pMoto) by suzuart, licensed under Creative Commons Attribution (http://creativecommons.org/licenses/by/4.0/). | Converted from USDZ; reduced from 530,982 to 14,000 triangles, colour baked onto one 1024 px texture, a new skeleton and new idle and walk clips, arms lowered from the A-pose (`tools/blender_avatar.py`). |

The original source files are not in the repository (Tom 16 MB, the boy 21.8 MB, the girl 13 MB). To rebuild an avatar,
keep the source and run `blender -b --factory-startup -P tools/blender_avatar.py -- <source> assets/models/avatars/<name>.glb --name <name>`.
The app shows the credit for the chosen avatar in the avatar chooser and in the map legend.
