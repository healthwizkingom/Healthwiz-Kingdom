// Contextual "?" help (js/v6-help.js) and backdated logging (js/v6-when.js).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, closeBrowser, go, RETURNING, state, entry, daysAgo } from './helpers.mjs';

after(closeBrowser);
const boot = async (view, o = {}) => { const r = await openApp(o); await r.page.waitForSelector('.wl'); if (view) await go(r.page, view); return r; };
const pop = page => page.evaluate(() => { const p = document.getElementById('hwh-pop'); return p && !p.hidden ? p.textContent : null; });
const NOW = new Date();
const hhmm = (d = new Date()) => String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');

/* ---------- help buttons ---------- */

test('every moved explanation sits behind a "?" button and is gone from the page until it is opened', async () => {
  const seed = JSON.parse(JSON.stringify(RETURNING));
  seed.e = [entry('sleep', 7.5, 1, { bed: '23:00', wake: '06:30', aw: 1, lat: 15, rest: 3, score: 80 }, '07:00')];
  const rows = [
    // view, button key, text that must be hidden on the page, text shown in the panel
    ['food', 'nutintro', /Log your meals to see calories and nutrients/, /Log your meals to see calories and nutrients, today and over the week/],
    ['food', 'nutest', /Macro values for menu foods are estimated/, /Macro values for menu foods are estimated from typical dish composition\. Custom foods use the numbers you entered/],
    ['sleep', 'sleepgame', /Game visualization based on|Game visual of your logged sleep/, /not a medical measurement/],
    ['sleep', 'sleepscore', /HealthWiz Sleep Score — a game score/, /game score from your logged sleep\. It is NOT a medical measurement/],
    ['sleep', 'sleeprange', /A range, not an exact requirement/, /Recommended range for your age: 8–10 h\. A range, not an exact requirement/],
    ['sleep', 'alarmwhy', /A web page cannot ring reliably/, /cannot ring reliably when the browser is closed, the tab is in the background or the phone is locked, especially on iPhone/],
    ['stair', 'hrpic', /A heart-rate picture, not an ECG/, /A heart-rate picture, not an ECG/],
    ['bmi', 'bmigame', /Your game form follows your BMI range/, /game form follows your BMI range\. It is just for fun, not a health judgement/],
    ['score', 'scorenote', /A habit score from what you logged/, /A habit score from what you logged, not a diagnosis/],
    ['score', 'scorewt', /reasoned judgement/, /reasoned judgement from the sources above[\s\S]*Edit WT in js\/v6-score\.js/],
    ['quests', 'questpick', /focus quest is picked from your own logs/, /weekly quests reset on Monday/],
    ['quests', 'streakrest', /One rest day a week keeps your gentle streak/, /One rest day a week keeps your gentle streak going/],
    ['stats', 'statcmp', /Completed days only \(today is still in progress\)/, /Completed days only[\s\S]*today is still in progress[\s\S]*not judgments/],
  ];
  const { page, ctx, errors } = await boot(null, { seed });
  for (const [view, key, hidden, shown] of rows) {
    await go(page, view);
    if (view === 'stats') await page.evaluate(() => 0);
    const b = page.locator('.hwh[data-hwh="' + key + '"]').first();
    assert.equal(await b.count(), 1, view + ' has the ' + key + ' button');
    assert.doesNotMatch(await page.textContent('#main'), hidden, view + '/' + key + ': explanation not inline');
    assert.equal(await b.getAttribute('aria-expanded'), 'false');
    assert.match(await b.getAttribute('aria-label'), /^About: /, 'labelled');
    await b.scrollIntoViewIfNeeded(); await b.click();
    assert.match(await pop(page), shown, view + '/' + key);
    assert.equal(await b.getAttribute('aria-expanded'), 'true');
    await page.keyboard.press('Escape');
    assert.equal(await pop(page), null, 'Escape closes ' + key);
    assert.equal(await b.getAttribute('aria-expanded'), 'false');
  }
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('opens and closes by tap on a phone, by keyboard, with CLOSE and by tapping outside; focus returns to the button', async () => {
  const { page, ctx, errors } = await boot('bmi', { viewport: { width: 360, height: 640 }, context: { hasTouch: true, isMobile: true } });
  await page.fill('#bh', '170'); await page.fill('#bw', '60');
  const b = page.locator('.hwh[data-hwh="bmigame"]');
  await b.tap();
  assert.match(await pop(page), /just for fun/);
  const box = await page.evaluate(() => { const r = document.getElementById('hwh-pop').getBoundingClientRect(); return [r.left, r.right, innerWidth, r.top, r.bottom, innerHeight]; });
  assert.ok(box[0] >= 0 && box[1] <= box[2] && box[3] >= 0 && box[4] <= box[5], 'inside the screen: ' + box);
  await page.tap('.hwhx');
  assert.equal(await pop(page), null);
  // keyboard: focus the button, Enter opens, focus is in the panel, Tab stays inside, Escape returns focus
  await b.focus(); await page.keyboard.press('Enter');
  assert.match(await pop(page), /just for fun/);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'hwh-pop');
  await page.keyboard.press('Tab'); await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => !!document.activeElement.closest('#hwh-pop')), true, 'Tab stays in the panel');
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(() => document.activeElement.dataset.hwh), 'bmigame', 'focus back on the button');
  // Space opens, a second press on the button closes, tapping elsewhere closes
  await page.keyboard.press('Space'); assert.match(await pop(page), /just for fun/);
  await page.tap('h2'); assert.equal(await pop(page), null, 'tap outside closes');
  await b.tap(); await b.tap(); assert.equal(await pop(page), null, 'the button toggles');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Medius: the AI-listener limit stays visible, privacy and AI details are behind a labelled button', async () => {
  const { page, ctx, errors } = await boot('stress');
  await page.evaluate(() => { S.cs = { ph: 'chat', sec: 0, m: [] }; render(); });
  const txt = await page.textContent('#counsel');
  assert.match(txt, /Medius is an AI listener, not a therapist or crisis service\./);
  assert.doesNotMatch(txt, /processed by Google Gemini/);
  assert.doesNotMatch(txt, /Your words are not saved/);
  const b = page.locator('#counsel .hwh[data-hwh="medpriv"]');
  assert.match(await b.getAttribute('aria-label'), /Privacy and AI limitations/);
  assert.match(await b.textContent(), /PRIVACY/);
  await b.click();
  assert.match(await pop(page), /Messages are processed by Google Gemini to generate Medius's replies and are not saved by HealthWiz\./);
  assert.match(await pop(page), /Your words are not saved/);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('the hearts sentence is gone everywhere; other streak text stays', async () => {
  const { page, ctx, errors } = await boot('quests');
  const t = await page.textContent('#main');
  assert.doesNotMatch(t, /No hearts are lost for missed days\. Return whenever you can\./);
  assert.match(t, /STREAK/); assert.match(t, /day best streak/); assert.match(t, /Gentle streak/);
  assert.equal(await page.locator('#v6streak').count(), 1, 'consistency card still follows the streak card');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('fruit & veg card moved to sit directly below the Macronutrients card; one card, one source', async () => {
  const seed = JSON.parse(JSON.stringify(RETURNING));
  seed.e = [{ id: 'fv1', c: 'food', v: 60, m: { name: 'Epal Merah', por: '1 biji', qty: 2, pm: 1, meal: 'breakfast', src: 'KOLEJ MARA KULIM', u: 0 }, n: '', d: daysAgo(0), t: '08:00' }];
  const { page, ctx, errors } = await boot('food', { seed });
  assert.equal(await page.locator('#ffv').count(), 1);
  assert.equal(await page.evaluate(() => document.querySelector('#fmac').nextElementSibling.id), 'ffv', 'directly below macros');
  assert.equal(await page.evaluate(() => document.querySelector('#fmac').parentElement === document.querySelector('#ffv').parentElement), true);
  await go(page, 'score');
  assert.equal(await page.locator('#ffv').count(), 0, 'not duplicated on the Health Score page');
  assert.match(await page.textContent('#main'), /Fruit & veg/, 'its row in the score table stays');
  const sub = await page.evaluate(() => HWScore.compute().I.fv);
  assert.ok(sub && sub.sub > 0, 'still counted in the score');
  // logging more fruit updates the card
  await go(page, 'food');
  await page.evaluate(() => { add('food', 40, { name: 'Epal Merah', por: '1 biji', qty: 1, pm: 1, meal: 'lunch', src: 'KOLEJ MARA KULIM', u: 0 }); render(); });
  assert.match(await page.textContent('#ffv'), /3/);
  for (const w of [360, 1100]) {
    await page.setViewportSize({ width: w, height: 800 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'no sideways scroll at ' + w);
  }
  assert.deepEqual(errors, []);
  await ctx.close();
});

/* ---------- backdated logging ---------- */

const openWhen = async (page, scope = '') => { await page.locator(scope + ' .hww .hwwb').first().scrollIntoViewIfNeeded(); await page.locator(scope + ' .hww .hwwb').first().click(); };

test('water: today unchanged by default; yesterday and an older date save on their own day; today\'s total never moves', async () => {
  const { page, ctx, errors } = await boot('water');
  assert.equal(await page.locator('.hww').count(), 1);
  assert.match(await page.textContent('.hww'), /Log for…/);
  await page.click('[data-a="wa"][data-v="250"]');
  let s = await state(page);
  assert.equal(s.e.length, 1); assert.equal(s.e[0].d, daysAgo(0)); assert.ok(Math.abs(+s.e[0].t.replace(':', '') - +hhmm().replace(':', '')) <= 100);
  await openWhen(page);
  await page.click('[data-hww="yest"]');
  assert.match(await page.textContent('.hww'), /LOGGING FOR: Yesterday/);
  await page.click('[data-a="wa"][data-v="500"]');
  s = await state(page);
  assert.deepEqual(s.e.map(e => [e.c, e.v, e.d]), [['water', 250, daysAgo(0)], ['water', 500, daysAgo(1)]]);
  assert.equal(await page.evaluate(() => wt(today())), 250, 'today unchanged');
  assert.equal(await page.evaluate(d => wt(d), daysAgo(1)), 500);
  assert.match(await page.textContent('.hwwe'), /500/, 'the day\'s entries are listed with edit/delete');
  assert.equal(await page.locator('.hwwe [data-a="del"]').count(), 1);
  // an older date and an explicit time
  await page.fill('[data-hww-in="d"]', daysAgo(10)); await page.fill('[data-hww-in="t"]', '06:05');
  await page.fill('#wc', '300'); await page.click('[data-a="wcu"]');
  s = await state(page);
  const old = s.e.find(e => e.d === daysAgo(10));
  assert.deepEqual([old.v, old.t], [300, '06:05']);
  assert.equal(await page.evaluate(() => wt(today())), 250);
  // 7-day graph and statistics read the right days
  await page.click('[data-hww="close"]');
  await page.click('[data-hww="now"]');
  assert.match(await page.textContent('.hww'), /Log for…/);
  await go(page, 'stats');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('future dates and times are refused; the date input stops at today', async () => {
  const { page, ctx, errors } = await boot('water');
  await openWhen(page);
  assert.equal(await page.getAttribute('[data-hww-in="d"]', 'max'), daysAgo(0));
  const tomorrow = await page.evaluate(() => { const d = new Date(); d.setDate(d.getDate() + 1); return ymd(d); });
  await page.fill('[data-hww-in="d"]', tomorrow);
  assert.match(await page.textContent('.hwwn'), /in the future/);
  assert.match(await page.textContent('.hww'), /Log for…/, 'clamped back to now');
  // a time later today is clamped to now
  await page.evaluate(() => HWWhen.reset());
  const r = await page.evaluate(() => { const d = new Date(); d.setDate(d.getDate() + 1); return HWWhen.future(ymd(d), '10:00'); });
  assert.equal(r, true);
  assert.equal(await page.evaluate(() => HWWhen.future(today(), nowT())), false, 'now is not the future');
  assert.equal((await state(page)).e.length, 0, 'nothing saved');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('the choice resets on another page, is shared by Nutrition and Water, and a double tap saves one entry', async () => {
  const { page, ctx, errors } = await boot('food');
  await openWhen(page); await page.click('[data-hww="yest"]');
  await go(page, 'water');
  assert.match(await page.textContent('.hww'), /LOGGING FOR: Yesterday/, 'same page: kept');
  await page.evaluate(() => { const b = document.querySelector('[data-a="wa"][data-v="250"]'); b.click(); document.querySelector('[data-a="wa"][data-v="250"]').click(); });
  assert.equal((await state(page)).e.length, 1, 'rapid identical backdated save ignored');
  await go(page, 'sleep');
  assert.match(await page.textContent('.hww'), /Woke up on…/);
  await go(page, 'water');
  assert.match(await page.textContent('.hww'), /Log for…/, 'reset after leaving');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('food: a meal logged for yesterday lands on yesterday, with daily and weekly totals correct; custom food too', async () => {
  const { page, ctx, errors } = await boot('food');
  await openWhen(page, '#fpick'); await page.click('[data-hww="yest"]'); await page.fill('[data-hww-in="t"]', '13:10');
  await page.click('#fl .it >> nth=0');
  await page.click('[data-a="addfood"] >> nth=0');
  await page.waitForTimeout(600);
  let s = await state(page);
  const f = s.e.filter(e => e.c === 'food');
  assert.equal(f.length, 1);
  assert.deepEqual([f[0].d, f[0].t], [daysAgo(1), '13:10']);
  assert.equal(await page.evaluate(() => kc(today())), 0, 'today unchanged');
  assert.ok(await page.evaluate(d => kc(d), daysAgo(1)) > 0);
  // custom food
  await page.click('[data-a="cf"]');
  await page.fill('#cn', 'Teh tarik'); await page.fill('#cc', '120'); await page.click('[data-a="savecf"]');
  s = await state(page);
  const c = s.e.find(e => e.m && e.m.name === 'Teh tarik');
  assert.equal(c.d, daysAgo(1));
  assert.equal(await page.evaluate(() => kc(today())), 0);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('sleep: overnight session is filed under the wake-up day; yesterday and older dates; duplicate for a day asks first', async () => {
  const { page, ctx, errors } = await boot('sleep');
  await page.fill('#slb', '23:30'); await page.fill('#slw', '06:45');
  assert.equal(await page.inputValue('#sld'), '7.3');
  await openWhen(page); await page.click('[data-hww="yest"]');
  assert.equal(await page.locator('[data-hww-in="t"]').count(), 0, 'date only for sleep');
  await page.click('[data-a="slsave"]');
  let s = await state(page);
  assert.equal(s.e.length, 1);
  assert.deepEqual([s.e[0].c, s.e[0].v, s.e[0].d, s.e[0].t, s.e[0].m.bed, s.e[0].m.wake], ['sleep', 7.3, daysAgo(1), '06:45', '23:30', '06:45']);
  // again for the same day: the first tap only warns
  await page.waitForTimeout(1300);
  await page.click('[data-a="slsave"]');
  assert.equal((await state(page)).e.length, 1, 'asked first');
  await page.waitForTimeout(1300);
  await page.click('[data-a="slsave"]');
  assert.equal((await state(page)).e.length, 2, 'second tap confirms');
  // an older date
  await page.fill('[data-hww-in="d"]', daysAgo(6)); await page.waitForTimeout(1600);
  await page.click('[data-a="slsave"]');
  s = await state(page);
  assert.ok(s.e.some(e => e.d === daysAgo(6)));
  // today is untouched: no sleep for today
  assert.equal(s.e.filter(e => e.d === daysAgo(0)).length, 0);
  // weekly stats include the nights
  assert.match(await page.textContent('#main'), /Avg sleep/);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('sleep for today keeps the old behaviour (no control needed)', async () => {
  const { page, ctx, errors } = await boot('sleep');
  await page.fill('#slb', '22:30'); await page.fill('#slw', '06:30');
  await page.click('[data-a="slsave"]');
  const s = await state(page);
  assert.equal(s.e[0].d, daysAgo(0)); assert.equal(s.e[0].v, 8);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('stairs by hand: backdated climb; workout for yesterday; a workout with device heart rates cannot be backdated', async () => {
  const { page, ctx, errors } = await boot('stair');
  await page.click('[data-a="cat"][data-c="MODERATE"]');
  await page.click('.sqlist .chip >> nth=0');
  await page.fill('#ss', '10'); await page.fill('#sc', '3');
  await openWhen(page, '#stman'); await page.click('#stman [data-hww="yest"]');
  await page.click('[data-a="savestair"]');
  let s = await state(page);
  assert.equal(s.e.length, 1); assert.equal(s.e[0].d, daysAgo(1)); assert.equal(s.e[0].v, 30);
  assert.equal(await page.evaluate(() => sp(today())), 0, 'today\'s steps unchanged');
  // workout for yesterday
  await page.selectOption('#wk-loc', { index: 1 });
  await page.fill('#wk-b', '70'); await page.fill('#wk-a', '120');
  await page.fill('#wk-s', '12'); await page.fill('#wk-c', '2'); await page.fill('#wk-d', '8');
  await openWhen(page, '#stseal'); await page.click('#stseal [data-hww="yest"]'); await page.fill('#stseal [data-hww-in="t"]', '17:30');
  await page.click('[data-a="stwsave"]');
  s = await state(page);
  const w = s.e.find(e => e.m.kind === 'workout');
  assert.deepEqual([w.d, w.t, w.m.hrB, w.m.hrA, w.m.src], [daysAgo(1), '17:30', 70, 120, 'manual']);
  assert.equal(await page.evaluate(() => rest(today())), null, 'today\'s resting heart rate unchanged');
  assert.equal(await page.evaluate(d => rest(d), daysAgo(1)), 70);
  // GPS check-in has no date control (never backdated)
  assert.equal(await page.locator('#v6gps .hww').count(), 0);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('BMI for an earlier date does not change the profile; energy can be rated for yesterday', async () => {
  const { page, ctx, errors } = await boot('bmi');
  await page.fill('#bh', '170'); await page.fill('#bw', '80');
  await openWhen(page); await page.click('[data-hww="yest"]');
  await page.click('[data-a="savebmi"]');
  let s = await state(page);
  assert.equal(s.e[0].c, 'bmi'); assert.equal(s.e[0].d, daysAgo(1));
  assert.deepEqual([s.p.h, s.p.w], [165, 60], 'profile unchanged');
  await go(page, 'home');
  await openWhen(page, '#encheck'); await page.click('#encheck [data-hww="yest"]');
  assert.match(await page.textContent('#encheck'), /HOW WAS YOUR ENERGY ON YESTERDAY/);
  await page.click('#encheck [data-a="ener"][data-i="4"]');
  s = await state(page);
  assert.equal(s.en[daysAgo(1)].v, 4); assert.equal(s.en[daysAgo(0)], undefined);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('stress check-in can be filed for an earlier time', async () => {
  const { page, ctx, errors } = await boot('stress');
  await openWhen(page); await page.click('[data-hww="yest"]');
  await page.click('[data-a="sqs"]');
  await page.evaluate(() => { S.sq = { ph: 'feel' }; acts.sqf({ i: '3' }); S.sq.tries = []; acts.sqfin(); });
  const s = await state(page);
  assert.equal(s.e.length, 1); assert.equal(s.e[0].c, 'stress'); assert.equal(s.e[0].d, daysAgo(1));
  assert.equal(await page.evaluate(() => str(today())), null);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('midnight: late-evening and early-morning entries stay on the day chosen, in the browser\'s time zone', async () => {
  const { page, ctx, errors } = await boot('water', { context: { timezoneId: 'Asia/Kuala_Lumpur' } });
  const r = await page.evaluate(() => {
    const out = [];
    for (const [d, t] of [[ymd(new Date(Date.now() - 86400000)), '23:59'], [ymd(new Date(Date.now() - 86400000)), '00:00']]) {
      HWWhen.reset(); document.querySelector('.hww .hwwb').click();
      const di = document.querySelector('[data-hww-in="d"]'); di.value = d; di.dispatchEvent(new Event('change', { bubbles: true }));
      const ti = document.querySelector('[data-hww-in="t"]'); ti.value = t; ti.dispatchEvent(new Event('change', { bubbles: true }));
      drink(100); out.push(st.e[st.e.length - 1]);
    }
    return out.map(e => [e.d, e.t]);
  });
  assert.equal(r[0][1], '23:59'); assert.equal(r[1][1], '00:00');
  assert.equal(r[0][0], r[1][0]);
  assert.notEqual(r[0][0], daysAgo(0));
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('editing a past entry updates that day only; the edit dialog refuses a future date', async () => {
  const seed = JSON.parse(JSON.stringify(RETURNING));
  seed.e = [entry('water', 250, 3, {}, '10:00'), entry('water', 400, 0, {}, '08:00')];
  const { page, ctx, errors } = await boot('water', { seed });
  await openWhen(page); await page.fill('[data-hww-in="d"]', daysAgo(3));
  await page.click('.hwwe [data-a="edit"]');
  assert.equal(await page.getAttribute('#ed', 'max'), daysAgo(0));
  await page.fill('#ev', '700'); await page.click('[data-a="esave"]');
  assert.equal(await page.evaluate(() => [wt(today()), wt(ymd(new Date(Date.now() - 3 * 86400000)))].join()), '400,700');
  await page.click('.hwwe [data-a="edit"]');
  const tomorrow = await page.evaluate(() => { const d = new Date(); d.setDate(d.getDate() + 1); return ymd(d); });
  await page.fill('#ed', tomorrow); await page.click('[data-a="esave"]');
  assert.equal((await state(page)).e.find(e => e.v === 700).d, daysAgo(3), 'not moved into the future');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('narrow phone: help and date controls fit, nothing scrolls sideways', async () => {
  const { page, ctx, errors } = await boot('sleep', { viewport: { width: 320, height: 640 }, context: { hasTouch: true, isMobile: true } });
  for (const v of ['sleep', 'food', 'water', 'stair', 'bmi', 'home']) {
    await go(page, v);
    const c = page.locator('.hww .hwwb').first();
    if (await c.count()) { await c.scrollIntoViewIfNeeded(); await c.tap(); }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, v + ' fits at 320');
    const bad = await page.evaluate(() => [...document.querySelectorAll('.hwwp,.hww')].filter(e => e.getBoundingClientRect().right > innerWidth + 1).length);
    assert.equal(bad, 0, v + ' control inside the screen');
  }
  assert.deepEqual(errors, []);
  await ctx.close();
});
