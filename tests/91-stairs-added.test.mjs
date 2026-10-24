// The stairs added on 2026-10-24 (js/v6-stairs-data.js): ST01 and ST34-ST38, the fixed steps of every stair, the photos, and
// the survey values behind them (data/stair-survey.json, made by tools/import_survey_table.py). Pure data: no browser.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const core = read('js/hw-02-core.js');
const ctx = vm.createContext({});
vm.runInContext(core.slice(core.indexOf('const STAIRS=['), core.indexOf('];', core.indexOf('const STAIRS=[')) + 2), ctx);
vm.runInContext(read('js/v6-stairs-data.js'), ctx);
const STAIRS = JSON.parse(vm.runInContext('JSON.stringify(STAIRS)', ctx)); // a plain copy: arrays from the vm realm do not deepEqual
const by = id => STAIRS.find(s => s.id === id);
const survey = JSON.parse(read('data/stair-survey.json'));
const deg = (r, u) => Math.round(Math.atan(r / u) * 180 / Math.PI * 100) / 100;

test('38 stairs: the new ones carry the list names and the angle calculated from riser and run', () => {
  assert.equal(STAIRS.length, 38);
  assert.equal(new Set(STAIRS.map(s => s.id)).size, 38, 'IDs are unique');
  const want = {
    ST01: ['Tangga dalam Blok E', deg(12.9, 16.9), 'VIGOROUS'],
    ST34: ['Tangga dusun durian ke kolam ikan (Laman Ibrahim)', 36.81, 'VIGOROUS'],
    ST35: ['Tangga depan Jab.Math/ sebelah Jab. Bahasa ke pintu belakang Jab Sains', 26.57, 'MODERATE'],
    ST36: ['Tangga ke tapak parking depan pejabat', deg(50, 70), 'VIGOROUS'],
    ST37: ['Tangga laluan bumbung pejalan kaki (belakang FAZ) ke asrama kayu (Tun Teja)', deg(64 / 6, 147 / 6), 'MILD'],
    ST38: ['Tangga dalam Blok FAZ', deg(17.4, 22.4), 'VIGOROUS'],
  };
  for (const [id, [name, angle, cat]] of Object.entries(want)) {
    const s = by(id);
    assert.deepEqual([s.name, s.cat], [name, cat], id);
    assert.ok(Math.abs(s.angle - angle) <= 0.011, `${id}: ${s.angle} vs ${angle}`);
    assert.ok(s.lat > 5.348 && s.lat < 5.354 && s.lng > 100.536 && s.lng < 100.541, id + ' is on the campus');
  }
  // the DMS readings of the owner: 5°21'06.7"N 100°32'16.9"E (ST36), 5°21'05.0"N 100°32'22.2"E (ST37), 5°21'04.8"N 100°32'22.6"E (ST38)
  assert.deepEqual([by('ST36').lat, by('ST36').lng], [5.3518611, 100.5380278]);
  assert.deepEqual([by('ST37').lat, by('ST37').lng], [5.3513889, 100.5395]);
  assert.deepEqual([by('ST38').lat, by('ST38').lng], [5.3513333, 100.5396111]);
  assert.equal(by('ST27').name, 'Tangga Anjung Santap', 'ST27 is Anjung Santap only');
  for (const s of STAIRS) {
    const band = s.angle < 26 ? 'MILD' : s.angle <= 31.2 ? 'MODERATE' : 'VIGOROUS';
    assert.equal(s.cat, band, s.id + ' category matches its angle band');
  }
});

test('every stair has fixed steps per flight; the survey table agrees; ST03 is the only stair of more than 2 flights', () => {
  for (const s of STAIRS) {
    assert.ok(Array.isArray(s.steps) && s.steps.length >= 1 && s.steps.every(Number.isInteger), s.id);
    assert.deepEqual(survey.stairs[s.id].flights.map(f => f.risers), s.steps, s.id + ' steps match the survey');
  }
  assert.deepEqual(STAIRS.filter(s => s.steps.length > 2).map(s => s.id), ['ST03']);
  assert.deepEqual(by('ST03').steps, [11, 11, 11, 11, 11]);
  assert.deepEqual(by('ST35').steps, [11, 11]);
  assert.deepEqual([by('ST36').steps, by('ST37').steps, by('ST34').steps], [[3], [6], [25]]);
});

test('every stair has a photo that exists, small enough for a phone; shared photos are the known ones', () => {
  for (const s of STAIRS) {
    const f = path.join(root, s.photo);
    assert.ok(fs.existsSync(f), s.id + ' ' + s.photo);
    assert.ok(fs.statSync(f).size < 100 * 1024, s.id + ' photo under 100 KB');
  }
  const shared = Object.fromEntries(STAIRS.filter(s => s.photo !== `assets/stairs/${s.id}.webp`).map(s => [s.id, s.photo.match(/ST\d+/)[0]]));
  assert.deepEqual(shared, { ST16: 'ST02', ST20: 'ST18', ST21: 'ST08', ST25: 'ST24', ST27: 'ST10', ST32: 'ST31', ST33: 'ST22', ST38: 'ST01' });
});

test('survey: per-step riser and run of the new experiment, Melati and Kemboja calculated from the run and the list angle', () => {
  const f = id => survey.stairs[id].flights[0];
  assert.deepEqual([f('ST34').riser_cm, f('ST34').tread_cm], [22.45, 30]);
  assert.deepEqual([f('ST35').riser_cm, f('ST35').tread_cm], [15.15, 30.3]);
  assert.ok(Math.abs(f('ST36').riser_cm - 50 / 3) < 1e-3 && Math.abs(f('ST36').tread_cm - 70 / 3) < 1e-3);
  assert.ok(Math.abs(f('ST37').riser_cm - 64 / 6) < 1e-3 && Math.abs(f('ST37').tread_cm - 147 / 6) < 1e-3);
  assert.deepEqual([f('ST38').riser_cm, f('ST38').tread_cm], [17.4, 22.4]);
  for (const [id, a] of [['ST22', 29.44], ['ST33', 65.52]]) {
    assert.equal(f(id).tread_cm, 30);
    assert.ok(Math.abs(f(id).riser_cm - 30 * Math.tan(a * Math.PI / 180)) < 0.01, id);
    assert.match(f(id).notes, /calculated as run x tan/);
  }
  assert.ok(survey.warnings.some(w => w.stair === 'ST33' && w.field === 'Riser' && w.level === 'check'), 'the 66 cm riser is flagged');
  assert.equal(survey.stairs.ST01.flights.length, 2); assert.equal(survey.stairs.ST01.flights[0].turn, 'reverse');
  // ST02, ST16 and ST29 had no coordinate in the app: the table gives one
  for (const id of ['ST02', 'ST16', 'ST29']) assert.ok(survey.stairs[id].bottom, id);
});
