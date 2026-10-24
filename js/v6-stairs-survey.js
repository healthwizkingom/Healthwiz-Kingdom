/* v6: the campus stair survey's changes to the stair list (2026-10-24). Not part of the original. js/hw-02-core.js stays as the
   original v5.4.3 data (it is at the 64 KB file limit), so the changes are applied here, once, before any v6 module reads STAIRS:
   * ST01 is back as a different, surveyed stair ("Tangga dalam Blok E"; the retired placeholder of the same ID was "Tangga
     Selangkah Menara Gading" 7.26°). ST34 to ST38 are new.
   * ST02, ST08, ST16, ST29 gained a coordinate recorded on site; ST33's coordinate moved.
   * ST23 and ST27 take the names of the owner's stair list (ST23 the parcel route, ST27 "Tangga Anjung Santap").
   Angles stay the list's own; the surveyed angles come from data/stair-survey.json. Mirrored in src/data/stairsData.ts. */
(function(){
const XY={"ST02": [5.35145, 100.53777], "ST08": [5.352306, 100.538528], "ST16": [5.35145, 100.53777], "ST29": [5.35077, 100.53819], "ST33": [5.350972, 100.538639]};
STAIRS.forEach(q=>{const c=XY[q.id];if(c){q.lat=c[0];q.lng=c[1]}});
STAIRS.find(q=>q.id==='ST23').name="Tangga dari parking Anjung Santap ke koperasi (melalui tempat pungutan parcel)";
STAIRS.find(q=>q.id==='ST27').name="Tangga Anjung Santap";
STAIRS.unshift({"id": "ST01", "cat": "VIGOROUS", "name": "Tangga dalam Blok E", "floor": "G level", "angle": 37.35, "lat": 5.352509, "lng": 100.538922});
STAIRS.push(
{"id": "ST34", "cat": "VIGOROUS", "name": "Tangga dusun durian ke kolam ikan (Laman Ibrahim)", "floor": "G level", "angle": 36.81, "lat": 5.352826, "lng": 100.538445},
{"id": "ST35", "cat": "MODERATE", "name": "Tangga depan Jab. Math / sebelah Jab. Bahasa ke pintu belakang Jab Sains", "floor": "G level", "angle": 26.57, "lat": 5.35111, "lng": 100.537968},
{"id": "ST36", "cat": "VIGOROUS", "name": "Tangga ke tapak parking depan pejabat", "floor": "G level", "angle": 35.55, "lat": 5.351861, "lng": 100.538028},
{"id": "ST37", "cat": "MODERATE", "name": "Tangga laluan bumbung pejalan kaki (belakang FAZ) ke asrama kayu (Tun Teja)", "floor": "G level", "angle": 29.74, "lat": 5.351389, "lng": 100.5395},
{"id": "ST38", "cat": "VIGOROUS", "name": "Tangga dalam Blok FAZ", "floor": "G level", "angle": 37.84, "lat": 5.351111, "lng": 100.539611});
})();
