// The campus map's sky (owner's request, 2026-10-20: "make the weather (rain / foggy), the time (day until night) sky and
// the haze affect the map"). A picture, not a forecast: the live reading the app already has (js/v6-live.js: Open-Meteo
// weather for Kulim, and the modelled haze, CAMS) and the time of day from the device's clock turn into
//   * the sky above the horizon and the light on the ground (MapLibre's sky and light), the 3D scene's sun, sky light,
//     exposure and street lights (observatory/models3d.js);
//   * a tint over the map at dusk and at night, a fog veil (fog, mist or haze) and falling rain: three layers of plain CSS
//     over the map canvas (under the staircase markers), so the map itself never redraws for them;
//   * the time of day from the sun's height at the campus, worked out from the clock (the NOAA low-precision formulas):
//     day above 6°, dawn or dusk between −6° and 6° (civil twilight), night below −6°.
// Nothing here changes a marker, a height or a number. Reduced motion: the rain is drawn still.
const R = Math.PI / 180;

/** The sun's height above the horizon and its compass bearing (degrees, from north, clockwise) at lng/lat for a Date. */
export function sun(date, lat, lng) {
  const n = date.getTime() / 864e5 + 2440587.5 - 2451545.0; // days since J2000
  const L = (280.46 + 0.9856474 * n) % 360, g = ((357.528 + 0.9856003 * n) % 360) * R;
  const lam = (L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * R, eps = (23.439 - 4e-7 * n) * R;
  const dec = Math.asin(Math.sin(eps) * Math.sin(lam)), ra = Math.atan2(Math.cos(eps) * Math.sin(lam), Math.cos(lam));
  const gmst = (280.46061837 + 360.98564736629 * n) % 360, ha = (gmst + lng) * R - ra;
  const alt = Math.asin(Math.sin(lat * R) * Math.sin(dec) + Math.cos(lat * R) * Math.cos(dec) * Math.cos(ha));
  const az = Math.atan2(-Math.sin(ha), Math.tan(dec) * Math.cos(lat * R) - Math.sin(lat * R) * Math.cos(ha));
  return { alt: alt / R, az: ((az / R) % 360 + 360) % 360 };
}

// WMO weather codes (Open-Meteo) → how hard it rains (0–1) and how foggy it is (0–1)
const RAIN = { 51: .3, 53: .35, 55: .45, 56: .35, 57: .45, 61: .5, 63: .7, 65: .9, 66: .5, 67: .8, 80: .55, 81: .75, 82: .95, 95: 1, 96: 1, 99: 1 };
const FOG = { 45: .8, 48: .85 };
export const PREVIEWS = ['live', 'day', 'dusk', 'night', 'rain', 'fog', 'haze'];

/** What the sky shows. in: {now: Date, lat, lng, wx: Open-Meteo `current` or null, hazeLevel: 0–5 (js/v6-live.js),
    preview: one of PREVIEWS ('live' uses the reading and the clock)} → state. */
export function skyState({ now = new Date(), lat, lng, wx = null, hazeLevel = 0, preview = 'live' } = {}) {
  const s = sun(now, lat, lng);
  let tod = s.alt > 6 ? 'day' : s.alt > -6 ? (now.getUTCHours() + 8) % 24 < 12 ? 'dawn' : 'dusk' : 'night'; // Malaysia time for morning or evening
  let rain = 0, fog = 0, haze = 0, cloud = 0, src = 'clock';
  if (preview === 'live') {
    if (wx) { const c = +wx.weather_code; rain = RAIN[c] || (+wx.precipitation > 0 ? .3 : 0); fog = FOG[c] || 0; cloud = Math.max(0, Math.min(1, (+wx.cloud_cover || 0) / 100)); src = 'live'; }
    haze = [0, 0, 0, .35, .6, .85][Math.max(0, Math.min(5, hazeLevel | 0))];
  } else {
    if (['day', 'dusk', 'night'].includes(preview)) tod = preview;
    if (preview === 'rain') { rain = .75; cloud = .9; }
    if (preview === 'fog') { fog = .85; cloud = .7; }
    if (preview === 'haze') haze = .6;
    if (['rain', 'fog', 'haze'].includes(preview)) tod = 'day';
    src = 'preview';
  }
  return { tod, alt: s.alt, az: s.az, rain, fog, haze, cloud, src, preview };
}

const mix = (a, b, t) => '#' + [1, 3, 5].map(i => Math.round(parseInt(a.substr(i, 2), 16) * (1 - t) + parseInt(b.substr(i, 2), 16) * t).toString(16).padStart(2, '0')).join('');

/** The look for a state and a map look ('realistic' | 'fantasy'): MapLibre sky and light, the CSS layers and the 3D lights. */
export function skyLook(st, mode) {
  const fan = mode === 'fantasy', dim = Math.max(st.rain * .55, st.fog * .45, st.cloud * .3);
  const T = {
    realistic: { day: ['#cfe2f3', '#eef1ec'], dawn: ['#9fb3d8', '#f6c7a0'], dusk: ['#5a6aa6', '#f39a6b'], night: ['#0d1630', '#24305a'] },
    fantasy: { day: ['#3550a8', '#8f7fd8'], dawn: ['#2a2f78', '#d68aa8'], dusk: ['#211d5c', '#c4688a'], night: ['#0b1430', '#3b3482'] },
  }[fan ? 'fantasy' : 'realistic'][st.tod];
  const grey = fan ? '#5b5f86' : '#a9adb3', haze = '#c9b98f';
  let skyC = mix(T[0], grey, dim), horC = mix(T[1], grey, dim);
  if (st.haze) { skyC = mix(skyC, haze, st.haze * .6); horC = mix(horC, haze, st.haze * .8); }
  const veil = Math.max(st.fog, st.haze * .8); // how thick the fog or haze is
  const fogC = st.haze > st.fog ? (fan ? '#4e4a63' : '#d6ccb0') : (fan ? '#3a3f62' : '#dfe3e6');
  const sky = { 'sky-color': skyC, 'horizon-color': horC, 'fog-color': veil ? fogC : (fan ? '#0d1736' : '#e6e9e2'),
    'sky-horizon-blend': .6, 'horizon-fog-blend': veil ? .95 : fan ? .55 : .7, 'fog-ground-blend': veil ? .35 : fan ? .72 : .85, 'atmosphere-blend': fan ? .7 : .4 };
  // the ground light: low and warm at dawn and dusk, dim and blue at night, flat under rain or fog
  const polar = st.tod === 'day' ? Math.max(20, 90 - Math.max(st.alt, 10)) : st.tod === 'night' ? 40 : 75;
  const lightC = { day: fan ? '#c9d4ff' : '#ffffff', dawn: '#ffd2a6', dusk: '#ffb487', night: fan ? '#9fb0ff' : '#8ea0d8' }[st.tod];
  const lightI = ({ day: fan ? .5 : .38, dawn: .3, dusk: .28, night: fan ? .45 : .2 }[st.tod]) * (1 - dim * .5);
  const light = { anchor: 'map', position: [1.4, st.tod === 'day' || st.tod === 'dawn' || st.tod === 'dusk' ? st.az : 215, polar], color: lightC, intensity: lightI };
  // the CSS layers: a tint (dusk, night, storm), the fog veil, the rain
  // (a plain see-through colour: Fantasy's moonlit ground gets a light lift by day; Realistic darkens toward night)
  const tint = fan ? { day: .16, dawn: .12, dusk: .14, night: 0 }[st.tod] : { day: 0, dawn: .12, dusk: .2, night: .46 }[st.tod];
  const tintC = st.tod === 'night' ? '#0e1636' : st.tod === 'day' ? (fan ? '#a9c0ff' : '#4a5260') : st.tod === 'dawn' ? '#ffb09a' : '#d9784a';
  const lamps = st.tod === 'night' || st.tod === 'dusk' || st.rain >= .7 || st.fog >= .7 || fan ? 1 : st.tod === 'dawn' ? .5 : 0;
  // the 3D scene (realistic is the day scene, fantasy the moonlit one): how bright its key light and sky light are
  const key = fan ? { day: 1.15, dawn: .95, dusk: .9, night: 1 }[st.tod] : { day: 1, dawn: .55, dusk: .45, night: .16 }[st.tod];
  return { sky, light, tint: Math.min(.6, tint + (st.rain ? st.rain * .14 : 0)), tintC: st.rain && st.tod === 'day' && !fan ? '#3f4a58' : tintC,
    veil, veilC: fogC, rain: st.rain, lamps, key: key * (1 - dim * .45), hemi: (fan ? 1 : st.tod === 'night' ? .35 : st.tod === 'day' ? 1 : .7) * (1 - dim * .25),
    warm: st.tod === 'dawn' || st.tod === 'dusk' };
}

/** Words for the caption under the map. */
export function skyWords(st) {
  const tod = { day: 'day', dawn: 'dawn', dusk: 'dusk', night: 'night' }[st.tod];
  const w = [st.rain >= .9 ? 'heavy rain' : st.rain >= .5 ? 'rain' : st.rain > 0 ? 'light rain' : '', st.fog ? 'fog' : '', st.haze ? 'haze' : ''].filter(Boolean);
  return tod + (w.length ? ', ' + w.join(', ') : st.cloud >= .7 ? ', cloudy' : '');
}
