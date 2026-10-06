// Step 23 (§78–80, §36, §59–60, §88, §91): the Hall of Heroes leaderboard — opt-in, game progress only, privacy controls.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { closeBrowser, go, RETURNING, entry } from './helpers.mjs';
import { fakeSupabase, device, synced, signIn, water } from './cloud-fake.mjs';

after(closeBrowser);
const card = page => page.textContent('#v6lb');
const ready = (page, re) => page.waitForFunction(r => new RegExp(r).test((document.getElementById('v6lb') || {}).textContent || ''), re.source, { timeout: 15000 });
async function join(page, name) {
  await go(page, 'quests');
  await ready(page, /JOIN THE HALL OF HEROES/);
  if (name != null) await page.fill('#lbname', name);
  await page.click('[data-a="lbjoin"]');
}

test('signed out: the card explains and points to Settings; nothing is sent and Settings has no privacy card', async () => {
  const S = fakeSupabase();
  const { page, errors } = await device(S, { cloud: null });
  await go(page, 'quests');
  assert.match(await card(page), /HALL OF HEROES[\s\S]*never shows health data[\s\S]*OPEN CLOUD SAVE SETTINGS[\s\S]*GAME PROGRESS ONLY/);
  await go(page, 'set');
  assert.equal(await page.$('#v6lbs'), null);
  assert.deepEqual(S.calls, []);
  assert.deepEqual(errors, []);
});

test('join with a hero name: only game progress is sent, XP and badges come from the cloud save', async () => {
  const S = fakeSupabase();
  const seed = { ...RETURNING, xp: 420, b: { 'First Sip': '2026-09-01' }, e: [entry('water', 500, 0), entry('bmi', 22, 1, { w: 70, h: 170 }), entry('food', 900, 0)],
    p: { ...RETURNING.p, name: 'Real Person Name' } };
  const { page, errors } = await device(S, { seed });
  await signIn(page, S); await synced(page);
  await go(page, 'quests');
  await ready(page, /JOIN THE HALL OF HEROES/);
  const txt = await card(page);
  assert.match(txt, /Joining is optional[\s\S]*Never[\s\S]*BMI, weight, calories/);
  const suggested = await page.inputValue('#lbname');
  assert.match(suggested, /^[A-Z][a-z]+ [A-Z][a-z]+ \d\d$/, 'a fantasy name is suggested');
  assert.ok(!suggested.includes('Real'), 'never the profile name');
  await page.fill('#lbname', 'x'); await page.click('[data-a="lbjoin"]');
  assert.match(await card(page), /3 to 20 characters/);
  await page.fill('#lbname', 'me@mail.com'); await page.click('[data-a="lbjoin"]');
  assert.match(await card(page), /letters, numbers, spaces/);
  assert.equal(S.sent.length, 0, 'nothing sent before a valid join');
  await page.fill('#lbname', '  Brave   Otter ');
  await page.click('[data-a="lbjoin"]');
  await ready(page, /\(YOU\)/);
  const uid = Object.values(S.users)[0].id, row = S.board[uid];
  assert.equal(row.name, 'Brave Otter');
  assert.equal(row.badges, Object.keys(S.rows[uid].data.b).length, 'badges counted from the cloud save');
  assert.equal(row.xp, S.rows[uid].data.xp, 'XP is read from the synced cloud save');
  const sent = S.sent[0];
  assert.deepEqual(Object.keys(sent).sort(), ['p_hidden', 'p_name', 'p_stats']);
  assert.deepEqual(Object.keys(sent.p_stats).sort(), ['explore', 'kingdom', 'quests', 'streak', 'week_xp', 'wk']);
  assert.ok(Object.values(sent.p_stats).every(v => typeof v === 'number' || /^\d{4}-\d{2}-\d{2}$/.test(v)));
  assert.doesNotMatch(JSON.stringify(S.sent), /bmi|kcal|weight|"w"|pulse|sleep|Real Person|hero@example/i, 'no health data, profile name or e-mail');
  assert.ok(sent.p_stats.week_xp > 0 && sent.p_stats.streak >= 1 && sent.p_stats.kingdom > 0);
  const t = await card(page);
  assert.match(t, /THIS WEEK[\s\S]*ALL-TIME XP[\s\S]*QUESTS[\s\S]*BADGES[\s\S]*KINGDOM[\s\S]*EXPLORER[\s\S]*GENTLE STREAK/);
  assert.match(t, /🥇Brave Otter \(YOU\)[\s\S]*XP this week[\s\S]*Your place: 🥇/);
  assert.equal(await page.getAttribute('[data-a="lbtab"][data-v="week"]', 'aria-pressed'), 'true', 'this week is the default board');
  assert.deepEqual(await page.evaluate(() => window.__ev.filter(x => !/^cloud|^data/.test(x))), []);
  assert.equal(await page.evaluate(() => /lbname|Brave Otter/.test(localStorage.getItem('healthwiz'))), false, 'board state is not in the save');
  assert.deepEqual(errors, []);
});

test('two players: ranks, tabs, hidden names, the privacy card, leaving, and the joined state on a new sign-in', async () => {
  const S = fakeSupabase();
  const a = await device(S, { seed: { ...RETURNING, xp: 100, e: [entry('water', 500, 0)] } });
  await signIn(a.page, S, 'a@example.com'); await synced(a.page);
  await join(a.page, 'Swift Heron');
  await ready(a.page, /\(YOU\)/);
  const b = await device(S, { seed: { ...RETURNING, xp: 900, b: { x: 1, y: 2, z: 3 }, e: [entry('water', 500, 0)] } });
  await signIn(b.page, S, 'b@example.com'); await synced(b.page);
  await join(b.page, 'Bold Comet');
  await ready(b.page, /\(YOU\)/);
  await a.page.click('[data-a="lbref"]');
  await ready(a.page, /Bold Comet/);
  await a.page.click('[data-a="lbtab"][data-v="xp"]');
  await ready(a.page, /🥇Bold Comet[\s\S]*🥈Swift Heron \(YOU\)/);
  await a.page.click('[data-a="lbtab"][data-v="badges"]');
  await ready(a.page, new RegExp('🥇Bold Comet[\\s\\S]*' + S.board[Object.keys(S.board).find(k => S.board[k].name === 'Bold Comet')].badges + 'badges'));
  // B hides their name from Settings: A keeps seeing the rank, without the name
  await go(b.page, 'set');
  assert.match(await b.page.textContent('#v6lbs'), /LEADERBOARD PRIVACY[\s\S]*as Bold Comet[\s\S]*HIDE MY NAME[\s\S]*LEAVE THE BOARD/);
  const order = await b.page.evaluate(() => { const h = document.querySelector('#main').innerHTML; return [h.indexOf('id="v6acct"'), h.indexOf('id="v6lbs"'), h.indexOf('id="v6pwa"')]; });
  assert.ok(order[0] < order[1] && order[1] < order[2], 'privacy card sits under ACCOUNT');
  await b.page.click('#v6lbs [data-a="lbhide"]');
  await b.page.waitForFunction(() => /as Hidden adventurer[\s\S]*SHOW MY NAME/.test(document.getElementById('v6lbs').textContent));
  await a.page.click('[data-a="lbref"]');
  await ready(a.page, /🕶️ Hidden adventurer/);
  assert.doesNotMatch(await card(a.page), /Bold Comet/);
  // leaving takes two taps and removes the server entry
  const bid = Object.values(S.users).find(u => u.email === 'b@example.com').id;
  await b.page.click('#v6lbs [data-a="lbleave"]');
  assert.ok(S.board[bid], 'one tap does nothing');
  await b.page.click('#v6lbs [data-a="lbleave"]');
  await b.page.waitForFunction(() => HWBoard.status().on === false);
  assert.equal(S.board[bid], undefined);
  assert.match(await b.page.textContent('#v6lbs'), /not on the leaderboard/);
  await a.page.click('[data-a="lbref"]');
  await a.page.waitForFunction(() => !/🕶️ Hidden adventurer/.test(document.getElementById('v6lb').textContent));
  // A on a new device: the account is already on the board
  const c = await device(S, { seed: { ...RETURNING } });
  await signIn(c.page, S, 'a@example.com'); await synced(c.page);
  await go(c.page, 'quests');
  await ready(c.page, /Swift Heron \(YOU\)/);
  // signing out forgets the board on this device and leaves the server entry
  await go(c.page, 'set'); await c.page.click('[data-a="acout"]');
  assert.equal(await c.page.$('#v6lbs'), null);
  assert.equal(await c.page.evaluate(() => localStorage.getItem('healthwiz_board')), null);
  assert.ok(Object.keys(S.board).length === 1);
  assert.deepEqual([...a.errors, ...b.errors, ...c.errors], []);
});

test('board events, refresh after sync, missing setup and offline say what happened', async () => {
  const S = fakeSupabase();
  const { page, ctx, errors } = await device(S, { seed: { ...RETURNING, xp: 50 } });
  await page.evaluate(() => { window.__b = []; HWEvents.on('*', e => { if (/^board:/.test(e.type)) window.__b.push(e.type); }); });
  await signIn(page, S); await synced(page);
  await join(page, 'Calm Maple');
  await ready(page, /\(YOU\)/);
  const uid = Object.values(S.users)[0].id;
  // a new log, then REFRESH: the entry is published again before the board is read
  await water(page, 250);
  await page.click('[data-a="lbref"]');
  await page.waitForFunction(() => /XP this week/.test(document.getElementById('v6lb').textContent));
  assert.ok(S.board[uid].week_xp > 0);
  assert.deepEqual(await page.evaluate(() => window.__b), ['board:joined']);
  // offline
  await ctx.setOffline(true);
  await go(page, 'quests');
  assert.match(await card(page), /Offline\. The board updates when you are back online/);
  await ctx.setOffline(false);
  // the project has no leaderboard functions
  S.noBoard = true;
  await page.click('[data-a="lbtab"][data-v="streak"]');
  await ready(page, /not set up in the cloud project yet[\s\S]*Nothing on this device was changed/);
  assert.deepEqual(errors.filter(e => !/404/.test(e)), []);
});

test('360 px: tabs and rows fit without horizontal scrolling', async () => {
  const S = fakeSupabase();
  const { page, errors } = await device(S, { seed: { ...RETURNING, xp: 80, e: [entry('water', 500, 0)] }, viewport: { width: 360, height: 800 } });
  await signIn(page, S); await synced(page);
  await join(page, 'Merry Fox Of The Long Road'.slice(0, 20));
  await ready(page, /\(YOU\)/);
  const w = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth, document.getElementById('v6lb').getBoundingClientRect().right]);
  assert.ok(w[0] <= w[1] && w[2] <= w[1], 'no overflow: ' + w);
  const small = await page.evaluate(() => [...document.querySelectorAll('#v6lb button')].filter(b => b.offsetParent && b.getBoundingClientRect().height < 32).length);
  assert.equal(small, 0, 'buttons stay touch-friendly');
  assert.deepEqual(errors, []);
});
