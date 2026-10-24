/* v6: the staircases added after the original list, the fixed step counts and the photos (owner's request, 2026-10-24). Not part of
   the original. Loaded right after the original modules so STAIRS (js/hw-02-core.js) is complete for everything that reads it.
   * ST01 (Tangga dalam Blok E) and ST34-ST38 are appended; names and coordinates are from the owner's list and GPS readings, the angle
     is calculated: tan(angle) = riser / run, from the measured step (tools/import_survey_table.py has the same numbers).
   * steps: steps per flight of every stair, from the survey table (data/stair-survey.json). A climb needs no step range.
   * photo: assets/stairs/<id>.webp from the survey document; a few stairs share another's photo (listed, flagged "check" in the records). */
(()=>{
const NEW=[{"id": "ST34", "cat": "VIGOROUS", "name": "Tangga dusun durian ke kolam ikan (Laman Ibrahim)", "floor": "G level", "angle": 36.81, "lat": 5.352826, "lng": 100.538445},
{"id": "ST35", "cat": "MODERATE", "name": "Tangga depan Jab.Math/ sebelah Jab. Bahasa ke pintu belakang Jab Sains", "floor": "G level", "angle": 26.57, "lat": 5.35111, "lng": 100.537968},
{"id": "ST36", "cat": "VIGOROUS", "name": "Tangga ke tapak parking depan pejabat", "floor": "G level", "angle": 35.54, "lat": 5.3518611, "lng": 100.5380278},
{"id": "ST37", "cat": "MILD", "name": "Tangga laluan bumbung pejalan kaki (belakang FAZ) ke asrama kayu (Tun Teja)", "floor": "G level", "angle": 23.53, "lat": 5.3513889, "lng": 100.5395},
{"id": "ST38", "cat": "VIGOROUS", "name": "Tangga dalam Blok FAZ", "floor": "G level", "angle": 37.84, "lat": 5.3513333, "lng": 100.5396111},
{"id": "ST01", "cat": "VIGOROUS", "name": "Tangga dalam Blok E", "floor": "G level", "angle": 37.35, "lat": 5.352509, "lng": 100.538922}];
NEW.forEach(q=>{if(!STAIRS.some(s=>s.id===q.id))STAIRS.push(q)});
const STEPS={"ST02":[5],"ST03":[11,11,11,11,11],"ST04":[35],"ST05":[6],"ST06":[11,11],"ST07":[11,11],"ST08":[8],"ST09":[11,11],"ST10":[24],"ST11":[27],"ST12":[37],"ST13":[32],"ST14":[13],"ST15":[11,11],"ST16":[5],"ST17":[10,10],"ST18":[20],"ST19":[9],"ST20":[28],"ST21":[8],"ST22":[10,10],"ST23":[10],"ST24":[10,10],"ST25":[10,10],"ST26":[50],"ST27":[10],"ST28":[10,10],"ST29":[10,10],"ST30":[25],"ST31":[11],"ST32":[11],"ST33":[10,10],"ST34":[25],"ST35":[11,11],"ST36":[3],"ST37":[6],"ST38":[10,10],"ST01":[10,10]};
const SHARED={"ST16":"ST02","ST20":"ST18","ST21":"ST08","ST25":"ST24","ST27":"ST10","ST32":"ST31","ST33":"ST22","ST38":"ST01"};
STAIRS.forEach(q=>{if(STEPS[q.id])q.steps=STEPS[q.id].slice();q.photo='assets/stairs/'+(SHARED[q.id]||q.id)+'.webp'});
})();
