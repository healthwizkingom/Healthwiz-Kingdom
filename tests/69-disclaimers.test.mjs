// Disclaimers live behind the "?" button (js/v6-help.js). Each page keeps one short visible pointer, "Wellness tracker, not a
// medical device", and its full DIS text and tagline are in that "?" panel. Inline notes moved off the cards into their own "?".
// Safety instructions (crisis numbers, stop buttons, doctor-first gates, live warnings) stay visible: see docs/DISCLAIMERS.md.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, closeBrowser, go, RETURNING, yearOfLogs, entry } from './helpers.mjs';

after(closeBrowser);
const boot = async (o = {}) => { const r = await openApp(o); await r.page.waitForSelector('.wl'); return r; };
const pop = page => page.evaluate(() => { const p = document.getElementById('hwh-pop'); return p && !p.hidden ? p.textContent : null; });
const SHORT = 'Wellness tracker, not a medical device';

test('every page footer is one short line with a "?" whose panel holds that page\'s full DIS text and the tagline', async () => {
  const { page, ctx, errors } = await boot();
  const views = await page.evaluate(() => Object.keys(pages));
  let checked = 0;
  for (const v of views) {
    await go(page, v);
    if (!(await page.locator('#main p.dis').count())) continue; // title and registry screens have no footer
    checked++;
    const want = await page.evaluate(v => { const d = document.createElement('div'); d.innerHTML = DIS[v] || DIS.home; return d.textContent; }, v);
    assert.equal((await page.textContent('#main p.dis')).replace(/\s+/g, ' ').trim(), SHORT + '?', v + ': one short visible line');
    assert.ok(want.length > SHORT.length, v + ': has DIS text');
    const b = page.locator('#main p.dis .hwh');
    assert.equal(await b.count(), 1, v + ': one "?" in the footer');
    assert.equal(await b.getAttribute('aria-label'), 'About: ' + SHORT, v + ': accessible name');
    const box = await b.boundingBox();
    assert.ok(box.width >= 43.5 && box.height >= 43.5, v + ': 44 px target, got ' + box.width + 'x' + box.height);
    await b.scrollIntoViewIfNeeded(); await b.click();
    const t = await pop(page);
    assert.ok(t.includes(want), v + ': panel holds the DIS text');
    assert.ok(t.includes('Turn Your Health Into an Adventure.'), v + ': panel holds the tagline');
    await page.keyboard.press('Escape');
    assert.equal(await pop(page), null, v + ': Escape closes');
    assert.equal(await page.evaluate(() => document.activeElement.classList.contains('hwh')), true, v + ': focus returns to the "?"');
  }
  assert.ok(checked >= 20, 'checked ' + checked + ' pages');
  assert.deepEqual(errors.filter(e => !/leaflet/.test(e)), []); await ctx.close(); // the map page loads Leaflet from a CDN, which the tests block
});

test('the footer "?" opens with Enter and Space as well as a tap', async () => {
  const { page, ctx, errors } = await boot();
  await go(page, 'water');
  await page.locator('#main p.dis .hwh').focus();
  await page.keyboard.press('Enter');
  assert.match(await pop(page), /wellness tracker, not a medical device/i);
  await page.keyboard.press('Escape');
  await page.locator('#main p.dis .hwh').focus();
  await page.keyboard.press('Space');
  assert.match(await pop(page), /wellness tracker, not a medical device/i);
  await page.keyboard.press('Escape');
  assert.deepEqual(errors, []); await ctx.close();
});

test('inline disclaimers are off the cards and the same words are in the card\'s "?" panel', async () => {
  const seed = yearOfLogs(20);
  seed.e.push(entry('bmi', 22.1, 0, { h: 165, w: 60 }, '08:00'));
  const rows = [
    ['health', 'safetyscroll', /do not diagnose anything/, /Heart rate, BMI, sleep and stress tools are for tracking and learning only\. They do not diagnose anything\./],
    ['score', 'orbnote', /Concerning symptoms belong with a healthcare professional/, /not medical advice\. Concerning symptoms belong with a healthcare professional\./, async page => { await page.click('[data-a="orbshow"]'); await page.waitForSelector('#v6o'); }],
    ['score', 'sdgnote', /not a medical device/, /HealthWiz is a wellness tracker, not a medical device\./],
    ['lab', 'labnote', /not medical advice/, /They are not diagnoses and not medical advice\./],
    ['guide', 'tqnote', /NOT MEDICAL ADVICE/, /GENERAL WELLNESS IDEAS · NOT MEDICAL ADVICE/],
    ['quests', 'gqnote', /NOT MEDICAL ADVICE/, /GAME QUESTS · NOT MEDICAL ADVICE/],
    ['guide', 'obsnote', /NOT MEDICAL ADVICE/, /OBSERVATIONS FROM YOUR OWN LOGS · NOT MEDICAL ADVICE/],
  ];
  const { page, ctx, errors } = await boot({ seed });
  for (const [view, key, hidden, shown, pre] of rows) {
    await go(page, view);
    if (pre) await pre(page);
    const b = page.locator('.hwh[data-hwh="' + key + '"]').first();
    if (!(await b.count())) { assert.ok(false, view + ' has no ' + key + ' button'); }
    assert.doesNotMatch(await page.evaluate(() => [...document.querySelectorAll('#main > .pg > *:not(p.dis)')].map(e => e.textContent).join(' ').replace(/\s+/g, ' ')), hidden, view + '/' + key + ': sentence is not inline');
    assert.match(await b.getAttribute('aria-label'), /^About: /, key + ' labelled');
    await b.scrollIntoViewIfNeeded(); await b.click();
    assert.match(await pop(page), shown, view + '/' + key + ': same words in the panel');
    await page.keyboard.press('Escape');
    assert.equal(await pop(page), null);
  }
  assert.deepEqual(errors, []); await ctx.close();
});

test('the Stress page keeps its crisis and emergency numbers one tap away (NEED HELP NOW), shown at once when crisis words are written', async () => {
  const { page, ctx, errors } = await boot({ seed: RETURNING });
  await go(page, 'stress');
  assert.equal(await page.locator('#counsel [data-a="cshelp"]').count(), 1, 'the NEED HELP NOW button is on the Stress page');
  assert.doesNotMatch(await page.textContent('#main'), /Befrienders/, 'the numbers are hidden until asked for (the owner\'s request)');
  await page.click('#counsel [data-a="cshelp"]');
  assert.match(await page.textContent('#main'), /999|Befrienders/, 'crisis numbers appear when asked for');
  assert.deepEqual(errors, []); await ctx.close();
});
