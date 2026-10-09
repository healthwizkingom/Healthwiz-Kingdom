// Usability pass (js/v6-hall.js, js/v6-stairs.js counters, js/v6-body.js): the Health Hall tap flow, step-range chips,
// Body & Energy. More items are added below by later commits.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, closeBrowser, go, state, RETURNING, entry, APP_URL } from './helpers.mjs';
import { URL0, CLOUD, tok, fakeSupabase, device, signIn, synced, water } from './cloud-fake.mjs';

after(closeBrowser);
const M = { viewport: { width: 390, height: 844 }, context: { hasTouch: true, isMobile: true } };
const noScroll = page => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);

test('every tracker page shows the same 3-line header; tiles show today and the one input; Next step names the first gap', async () => {
  const { page, ctx, errors } = await openApp(M);
  for (const v of ['food', 'water', 'sleep', 'stair', 'body']) {
    await go(page, v);
    assert.equal(await page.locator('#hwh3').count(), 1, v + ' header');
    assert.deepEqual(await page.$$eval('#hwh3 .hwhr b', b => b.map(x => x.textContent)), ['WHAT THIS IS', 'WHAT TO ENTER', 'WHY IT MATTERS'], v);
    assert.ok(await noScroll(page), v + ' no horizontal scroll');
  }
  await go(page, 'health');
  assert.match(await page.textContent('#hwnext'), /Water:.*250 mL/, 'nothing logged: water first');
  assert.match(await page.textContent('#hub [data-v="food"]'), /Water 0 \/ 2,000 mL[\s\S]*Tap to pick a food or add 250 mL/);
  assert.match(await page.textContent('#hub [data-v="body"]'), /Tap to enter height \+ weight/);
  await go(page, 'water'); await page.tap('[data-a="wa"][data-v="250"]'); await page.waitForTimeout(300);
  await go(page, 'health');
  assert.match(await page.textContent('#hwnext'), /Food:/, 'water done, food is next');
  assert.deepEqual(errors, []); await ctx.close();
});

test('an example line sits under an empty input, links to it and hides once there is a value', async () => {
  const { page, ctx, errors } = await openApp(M);
  await go(page, 'water');
  assert.equal(await page.getAttribute('#wc', 'placeholder'), null, 'old placeholder removed');
  assert.match(await page.textContent('#hwe-wc'), /Example: 330/);
  assert.equal(await page.getAttribute('#wc', 'aria-describedby'), 'hwe-wc');
  await page.fill('#wc', '300'); assert.equal(await page.isHidden('#hwe-wc'), true);
  await page.fill('#wc', ''); assert.equal(await page.isVisible('#hwe-wc'), true);
  assert.deepEqual(errors, []); await ctx.close();
});

test('stairs: two taps fill a climb with a range midpoint and a count; 44px chips; total reads steps × climbs; saved shape unchanged', async () => {
  const { page, ctx, errors } = await openApp(M);
  await go(page, 'stair');
  await page.tap('#stman .sqlist .chip >> nth=0');
  assert.equal(await page.isHidden('#ss'), true, 'number box waits behind the chips');
  await page.tap('#stman [data-a="strng"][data-r="1"]');      // 6–10 → 8
  await page.tap('#stman [data-a="stcl"][data-n="3"]');
  assert.equal(await page.inputValue('#ss'), '8');
  assert.equal(await page.inputValue('#sc'), '3');
  assert.match(await page.textContent('#tot'), /8 steps × 3 climbs = 24 steps/);
  const small = await page.$$eval('#stcnt-c .chip', b => b.filter(x => x.offsetHeight < 44 || x.offsetWidth < 44).length);
  assert.equal(small, 0, 'every chip is at least 44 px');
  await page.fill('#ss', '9'); assert.match(await page.textContent('#tot'), /9 steps × 3 climbs = 27 steps/, 'the default can be changed');
  await page.tap('#stman [data-a="savestair"]'); await page.waitForTimeout(300);
  const e = (await state(page)).e.filter(x => x.c === 'stair')[0];
  assert.equal(e.v, 27); assert.equal(e.m.steps, 9); assert.equal(e.m.climbs, 3);
  await page.tap('#stman [data-a="strng"][data-r="c"]'); await page.fill('#ss', '1001'); await page.tap('#stman [data-a="stcl"][data-n="2"]');
  await page.tap('#stman [data-a="savestair"]'); await page.waitForTimeout(200);
  assert.equal((await state(page)).e.filter(x => x.c === 'stair').length, 1, 'steps above 1000 are still refused');
  assert.ok(await noScroll(page));
  assert.deepEqual(errors, []); await ctx.close();
});

test('Body & Energy: one page; bmi and calc routes open it at their section; unconfirmed profile starts empty; typing never changes the saved profile', async () => {
  const { page, ctx, errors } = await openApp(M);
  await go(page, 'bmi');
  assert.equal(await page.evaluate(() => S.v), 'body');
  assert.deepEqual(await page.$$eval('.sthd', h => h.map(x => x.id)), ['be-bmi', 'be-energy', 'be-macro']);
  await go(page, 'calc');
  assert.ok(await page.evaluate(() => document.getElementById('be-energy').getBoundingClientRect().top < 200), 'calc scrolls to the energy section');
  assert.equal(await page.locator('#hub').count(), 0);
  await go(page, 'health');
  assert.deepEqual(await page.$$eval('#hub [data-v]', b => b.map(x => x.dataset.v).filter(v => v === 'body' || v === 'bmi' || v === 'calc')), ['body'], 'one tile');
  await go(page, 'body');
  await page.fill('#bh', '180'); await page.fill('#bw', '90');
  assert.match(await page.textContent('#bout'), /27\.8/);
  const p0 = await page.evaluate(() => JSON.stringify(st.p));
  assert.equal(p0.includes('"h":180'), false, 'typing does not change the profile');
  assert.match(await page.textContent('#eout'), /BMR[\s\S]*TDEE[\s\S]*Not saved yet/);
  assert.match(await page.textContent('#bout'), /not a diagnosis/);
  assert.ok(await noScroll(page));
  const fresh = await openApp({ ...M, seed: { ...RETURNING, s: { ...RETURNING.s, onb: 0 } } });
  await go(fresh.page, 'body');
  assert.equal(await fresh.page.inputValue('#bh'), '', 'no guessed height');
  assert.match(await fresh.page.textContent('#eout'), /does not guess/);
  assert.deepEqual(errors.concat(fresh.errors), []); await ctx.close(); await fresh.ctx.close();
});

const dAgo = n => { const x = new Date(); x.setDate(x.getDate() - n); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
const ent = (c, v, n, t, m = {}) => ({ id: c + n + t + v, c, v, m, n: '', d: dAgo(n), t });

test('Settings log: grouped by day (newest first) with totals; one tap on Yesterday shows that day; date picker for older days; category filter applies; edit/delete kept', async () => {
  const seed = { ...RETURNING, e: [ent('water', 250, 0, '08:00'), ent('water', 500, 0, '12:00'), ent('food', 500, 0, '09:00', { name: 'Roti', qty: 1, meal: 'breakfast' }),
    ent('water', 300, 1, '10:15'), ent('food', 700, 1, '13:00', { name: 'Nasi', qty: 1, meal: 'lunch' }), ent('water', 200, 40, '09:00'), ent('pulse', 80, 0, '07:00', { st: 'Resting' })] };
  const { page, ctx, errors } = await openApp({ ...M, seed });
  await page.addLocatorHandler(page.locator('.bpop:not(.out)').first(), async o => { await o.click({ force: true }); });
  await go(page, 'set');
  assert.deepEqual(await page.$$eval('.lgd', d => d.map(x => x.dataset.d)), [dAgo(0), dAgo(1), dAgo(40)], 'newest day first; old pulse entries not listed');
  assert.match(await page.textContent('.lgd >> nth=0 >> summary'), /3 entries · 500 kcal · 750 mL/);
  assert.equal(await page.locator('.lgd[open]').count(), 1, 'only today is open');
  await page.tap('.lgc >> text=Yesterday');                                    // tap 1
  assert.equal(await page.locator('.lgd').count(), 1);
  const water = page.locator('.lgd .er', { hasText: 'Water' });
  assert.equal(await water.count(), 1); assert.match(await water.textContent(), /10:15/, 'time shown');
  assert.equal(await water.locator('[data-a="edit"],[data-a="del"]').count(), 2, 'edit and delete kept');
  await page.selectOption('select[data-ch="fc"]', 'food');                       // the filter applies to the chosen day
  assert.equal(await page.locator('.lgd .er').count(), 1);
  await page.selectOption('select[data-ch="fc"]', 'all');
  await page.fill('input[data-ch="lgpick"]', dAgo(40));                         // an older day with no chip
  assert.deepEqual(await page.$$eval('.lgd', d => d.map(x => x.dataset.d)), [dAgo(40)]);
  await page.tap('.lgc >> text=All days');
  assert.equal(await page.locator('.lgd').count(), 3);
  assert.ok(await noScroll(page));
  assert.deepEqual(errors, []); await ctx.close();
});

test('quest start: the registry asks about conditions after activity; a knee problem sorts the quests, puts stairs behind a doctor note; clearing goes back', async () => {
  const { page, ctx, errors } = await openApp({ ...M, fresh: true });
  await page.waitForSelector('.wl'); await page.tap('[data-a="go"][data-v="home"]'); await page.waitForSelector('#obt');
  const fill = async v => { await page.fill('#obi', String(v)); await page.tap('[data-a="obn"]'); };
  await fill('Aina'); await fill(19); await page.tap('[data-a="obsex"][data-v="f"]'); await fill(160); await fill(55);
  await page.tap('[data-a="obact"][data-v="1.375"]');
  assert.equal(await page.evaluate(() => S.ob.i), 6.5, 'the conditions question comes after activity');
  assert.match(await page.textContent('#cdcard'), /Anything that affects your activity\?/);
  assert.match(await page.textContent('#cdcard'), /does not diagnose conditions\. Ask a doctor before changing your activity\./);
  assert.equal(await page.locator('#cdcard [data-a="cdn"]').count(), 1, 'none of these');
  await page.tap('[data-a="cdt"][data-i="joint"]');
  await page.tap('[data-a="cda"]'); await page.fill('#cdin', 'x'.repeat(60)); await page.tap('[data-a="cdadd"]');
  assert.equal(await page.evaluate(() => S.ob.cc.cu[0].length), 40, 'free text is capped at 40 characters');
  await page.tap('[data-a="cdnext"]');
  assert.equal(await page.evaluate(() => S.ob.i), 6, 'then the read-back');
  assert.match(await page.textContent('.obw'), /Activity[\s\S]*Joint or knee problems/);
  await page.tap('[data-a="obb"]'); assert.equal(await page.evaluate(() => S.ob.i), 6.5, 'BACK from the read-back returns to the question');
  await page.tap('[data-a="cdnext"]'); await page.tap('[data-a="obf"]'); await page.waitForTimeout(300);
  assert.deepEqual(await page.evaluate(() => st.p.conds), ['joint', 'x'.repeat(40)]);
  await page.evaluate(() => { acts.obgo(); }); await page.waitForTimeout(300);
  await page.evaluate(() => go('quests'));
  assert.match(await page.textContent('#advq2 .cqs'), /Sorted for you: low-impact first, because you chose joint or knee problems\./);
  assert.deepEqual(await page.$$eval('#advq2 .aq .an b', b => b.map(x => x.textContent.slice(0, 8))).then(a => a.slice(0, 1)), ['Activity'], 'low-impact activity first');
  assert.match(await page.textContent('#advq2 .cqd summary'), /check with your doctor first/i);
  assert.match(await page.textContent('#advq2'), /HealthWiz does not diagnose conditions\. Ask a doctor before changing your activity\./);
  assert.match(await page.textContent('#v6q2'), /./); assert.doesNotMatch(await page.textContent('#v6q2'), /Mountain paths/, 'no stair weekly quest');
  await page.tap('#advq2 [data-a="condmove"]'); await page.waitForTimeout(200);
  assert.equal(await page.evaluate(() => QD(today())[2].p), 1, 'the easy move completes the Activity quest');
  await page.tap('#advq2 [data-a="condedit"]'); await page.tap('[data-a="cdn"]'); await page.tap('[data-a="cdnext"]'); await page.waitForTimeout(200);
  assert.deepEqual(await page.evaluate(() => st.p.conds), [], 'cleared');
  assert.equal(await page.locator('#advq2 .cqs').count(), 0); assert.equal(await page.evaluate(() => S.v), 'quests', 'back where we were');
  assert.match(await page.textContent('#advq2'), /Finish one stair session/);
  assert.ok(await noScroll(page));
  assert.deepEqual(errors, []); await ctx.close();
});

// ---- item 6: the tutorial after signing in ----
const cloudBefore = S => async p => { await p.route(URL0 + '/**', S.handle); await p.addInitScript(c => { if (!sessionStorage.getItem('cl')) { localStorage.setItem('healthwiz_cloud', c); sessionStorage.setItem('cl', '1'); } }, CLOUD); };
const openLink = async (page, url) => { await page.goto('about:blank'); await page.goto(url); }; // a link opened in a new tab is a full page load
const linkFor = (S, email) => { S.users[email] = { id: 'u9-0000', email }; return APP_URL + '#access_token=' + tok({ sub: 'u9-0000', email, role: 'authenticated', exp: 9e9 }) + '&refresh_token=r-u9-0000&expires_in=3600&token_type=bearer&type=magiclink'; };

test('email link: a new user who finished the registry lands on Home with the tutorial running; after SKIP a returning sign-in does not show it again', async () => {
  const S = fakeSupabase();
  const { page, ctx, errors } = await openApp({ ...M, fresh: true, before: cloudBefore(S) });
  await page.waitForSelector('.wl'); await page.tap('[data-a="go"][data-v="home"]'); await page.waitForSelector('#obt');
  const fill = async v => { await page.fill('#obi', String(v)); await page.tap('[data-a="obn"]'); };
  await fill('Aina'); await fill(19); await page.tap('[data-a="obsex"][data-v="f"]'); await fill(160); await fill(55);
  await page.tap('[data-a="obact"]'); await page.tap('[data-a="cdnext"]'); await page.tap('[data-a="obf"]'); await page.tap('[data-a="obgo"]');
  assert.equal(await page.evaluate(() => S.ob.i), 8, 'Medius offers an account'); assert.equal(await page.locator('#tut').count(), 0);
  // the emailed link reloads the page: the registry is over, the tutorial never started
  await openLink(page, linkFor(S, 'aina@example.com'));
  await page.waitForSelector('#tut', { timeout: 8000 });
  assert.equal(await page.evaluate(() => S.v), 'home', 'on the Home screen');
  assert.equal(await page.evaluate(() => HWCloud.status().signed), true);
  assert.equal(await page.locator('#tut').count(), 1, 'one tutorial, not two');
  await page.tap('#tut .tsk');
  assert.equal(await page.evaluate(() => localStorage.getItem('hwtut')), '1');
  await openLink(page, linkFor(S, 'aina@example.com')); await page.waitForTimeout(2500);   // signing in again on the same device
  assert.equal(await page.locator('#tut').count(), 0, 'a returning user is not shown the tutorial again');
  assert.deepEqual(errors.filter(e => !/sessionStorage/.test(e)), [], 'only the init scripts of the blank tab complain'); await ctx.close();
});

test('first sign-in KEEP / MERGE dialog: the tutorial waits for it and starts after the choice; nothing starts for a user still in the registry', async () => {
  const S = fakeSupabase();
  const a = await device(S, { viewport: M.viewport }); await signIn(a.page, S); await water(a.page, 250); await synced(a.page); await a.ctx.close();
  const seed = { ...RETURNING, e: [entry('water', 500, 0)] };
  const b = await device(S, { seed, viewport: M.viewport });
  await b.page.evaluate(() => localStorage.removeItem('hwtut'));                 // this device never showed the tutorial
  await signIn(b.page, S);
  await b.page.waitForSelector('[data-a="acmerge"]');
  await b.page.waitForTimeout(1800);
  assert.equal(await b.page.locator('#tut').count(), 0, 'not on top of the dialog');
  await b.page.click('[data-a="acmerge"]');
  await b.page.waitForSelector('#tut', { timeout: 8000 });
  assert.equal(await b.page.evaluate(() => S.v), 'home');
  assert.deepEqual(a.errors.concat(b.errors), []); await b.ctx.close();
  // a brand-new user in the middle of the registry is left alone
  const S2 = fakeSupabase(), c = await openApp({ ...M, fresh: true, before: cloudBefore(S2) });
  await c.page.waitForSelector('.wl'); await c.page.tap('[data-a="go"][data-v="home"]'); await c.page.waitForSelector('#obt');
  await c.page.evaluate(() => HWEvents.emit('cloud:signed-in', { via: 'email' })); await c.page.waitForTimeout(1500);
  assert.equal(await c.page.locator('#tut').count(), 0); assert.equal(await c.page.evaluate(() => S.v), 'onb');
  await c.ctx.close();
});
