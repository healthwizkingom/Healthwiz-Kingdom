// Survey values from the Word stair data sheet (data/stair-survey.json, made by tools/import_stair_sheet.py) laid over
// the app's own records (data/staircases.json, unverified). Nothing is guessed: a value the sheet does not have stays as
// the app had it, with the app's labels. Each value taken from the survey says so, and each value worked out from survey
// numbers (step count, total rise, angle) is labelled "calculated".
// The app's stored location, angle and orientation are kept in s.app so the details can show both.

const deg = r => r * 180 / Math.PI;

/** Apply the survey to the records in place. Returns how many records it changed. */
export function applySurvey(stairs, survey) {
  if (!survey || !survey.stairs) return 0;
  let n = 0;
  for (const s of stairs) {
    const v = survey.stairs[s.id];
    if (!v) continue;
    n++;
    s.app = { latitude: s.latitude, longitude: s.longitude, locationStatus: s.locationStatus, estimatedAngle: s.estimatedAngle,
      angleStatus: s.angleStatus, orientationDeg: s.orientationDeg };
    const rec = v.survey || {}, by = [rec.by, rec.date, rec.tool].filter(Boolean).join(', ');
    s.survey = { ...v, label: 'Survey sheet' + (by ? ' (' + by + ')' : ''), recordComplete: !!(v.complete && v.complete.record) };
    // position: the measured bottom of the stair replaces the app's estimate
    if (v.bottom) {
      s.latitude = v.bottom.lat; s.longitude = v.bottom.lng;
      s.locationStatus = 'measured'; s.locationSource = s.survey.label + ', phone GPS at the bottom step'
        + (v.bottom.accuracy_m != null ? ', ±' + v.bottom.accuracy_m + ' m' : ', accuracy not recorded');
      s.locationAccuracy_m = v.bottom.accuracy_m;
    }
    const F = v.flights || [];
    // orientation: the measured heading of the first flight
    if (F[0] && F[0].heading_deg != null) { s.orientationDeg = F[0].heading_deg; s.orientationSource = s.survey.label + ', heading of flight 1 (measured)'; s.orientationStatus = 'measured'; }
    const all = k => F.length && F.every(f => f[k] != null);
    // step count: counted on site
    if (all('risers') && v.complete && v.complete.flights) s.stepCount = F.reduce((t, f) => t + f.risers, 0), s.stepCountSource = s.survey.label + ' (counted)';
    // vertical rise: measured if every flight has a measured total rise, else calculated from risers x riser height
    if (all('totalRise_cm') && v.complete && v.complete.flights) { s.verticalRise_m = +(F.reduce((t, f) => t + f.totalRise_cm, 0) / 100).toFixed(2); s.verticalRiseStatus = 'measured'; }
    else if (all('risers') && all('riser_cm') && v.complete && v.complete.flights) { s.verticalRise_m = +(F.reduce((t, f) => t + f.risers * f.riser_cm, 0) / 100).toFixed(2); s.verticalRiseStatus = 'calculated (risers × riser height)'; }
    // angle: θ = arctan(riser / tread) per flight, the F21 method; the stair's angle is the mean over its steps
    const fa = F.filter(f => f.riser_cm && f.tread_cm);
    if (fa.length) {
      fa.forEach(f => { f.angle_deg = +deg(Math.atan(f.riser_cm / f.tread_cm)).toFixed(2); });
      const w = fa.reduce((t, f) => t + (f.risers || 1), 0);
      s.surveyAngle = +(fa.reduce((t, f) => t + f.angle_deg * (f.risers || 1), 0) / w).toFixed(2);
    }
    s.flightsSurveyed = F;
    s.geometryStatus = v.complete && v.complete.flights ? 'surveyed' : s.geometryStatus;
    s.measurementStatus = v.complete && v.complete.flights && v.complete.position ? 'surveyed' : 'partially measured';
  }
  return n;
}

/** The 3D plan for a fully surveyed staircase: one entry per flight, in metres, or null when anything is missing. */
export function surveyPlan(s) {
  const v = s.survey;
  if (!v || !v.complete || !v.complete.flights) return null;
  return v.flights.map((f, i, A) => ({
    n: f.risers, riser: f.riser_cm / 100, tread: f.tread_cm / 100, width: f.width_cm / 100,
    turn: i < A.length - 1 ? f.turn : null,
    landingLength: f.landing && f.landing.length_cm ? f.landing.length_cm / 100 : null,
    landingWidth: f.landing && f.landing.width_cm ? f.landing.width_cm / 100 : null,
  }));
}
