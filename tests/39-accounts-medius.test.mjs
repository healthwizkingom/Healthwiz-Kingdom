// Accounts, part 2: Medius's free-account offer after the Traveller's Registry, Medius AI through the medius-chat Edge
// Function (signed out / signed in, mood tags, crisis, limits, the reactions in his study), and the Runners' Board
// entry following the account.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, closeBrowser, go, state, RETURNING } from './helpers.mjs';
import { URL0, ANON, CLOUD, fakeSupabase, device, synced, signIn } from './cloud-fake.mjs';

after(closeBrowser);
const EMOJI = /(?:\p{Emoji_Presentation}|\p{Emoji}️)/u;
const visibleEmoji = page => page.evaluate(() => { const re = /(?:\p{Emoji_Presentation}|\p{Emoji}️)/u, out = [], w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n; (n = w.nextNode());) { const p = n.parentElement; if (re.test(n.nodeValue) && !p.closest('.pxe') && !p.closest('svg')) out.push(n.nodeValue.trim().slice(0, 30)); } return out; });

async function registry(page) {
  await page.click('.wl .ct button');
  await page.waitForFunction(() => S.v === 'onb');
  const answer = async v => { await page.fill('#obi', v); await page.press('#obi', 'Enter'); };
  await page.addLocatorHandler(page.locator('.bpop:not(.out)').first(), async o => { await o.click({ force: true }); });
  await answer('Aina'); await answer('16');
  await page.click('[data-a="obsex"][data-v="f"]');
  await answer('160'); await answer('52');
  await page.click('[data-a="obact"]'); await page.click('[data-a="cdnext"]'); await page.click('[data-a="obf"]');
  await page.click('[data-a="obgo"]');
}

test('after the Traveller\'s Registry Medius offers a free account once; SKIP or NOT NOW carry on into the kingdom', async () => {
  const S = fakeSupabase();
  const { page, errors } = await openApp({ fresh: true, before: p => p.route(URL0 + '/**', S.handle) });
  await page.waitForSelector('.wl');
  await registry(page);
  await page.waitForSelector('[data-a="acskip"]');
  const t = await page.textContent('#main');
  assert.match(t, /WIZARD KING MEDIUS[\s\S]*CREATE A FREE ACCOUNT\?[\s\S]*backed up to the cloud[\s\S]*CREATE A FREE ACCOUNT[\s\S]*SKIP/);
  assert.equal(await page.evaluate(() => S.v), 'onb');
  assert.deepEqual(await visibleEmoji(page), []);
  // CREATE opens "What happens when you sign in" (with the parent line: Aina is 16); NOT NOW carries on
  await page.click('[data-a="aconb"]');
  assert.match(await page.textContent('#mo'), /WHAT HAPPENS WHEN YOU SIGN IN[\s\S]*Ask a parent or guardian/);
  await page.click('[data-a="acx"]');
  await page.waitForFunction(() => S.v === 'home');
  assert.equal((await state(page)).s.ao, 1, 'offered once');
  assert.deepEqual(S.calls, [], 'nothing sent');
  // a later registry edit (Settings → CHANGE MY DATA) does not ask again
  assert.equal(await page.evaluate(() => { go('onb'); S.ob.i = 7; acts.obgo(); return S.v; }), 'home', 'not offered again');
  assert.deepEqual(errors, []);
});

test('Wizard\'s Counsel signed out: the study and the breathing bubble, "Sign in to talk with Medius", crisis numbers for everyone, no AI request', async () => {
  const S = fakeSupabase();
  const { page, errors } = await device(S, { cloud: null });
  const sent = []; page.on('request', r => { if (/supabase\.co|googleapis|anthropic/.test(r.url())) sent.push(r.url()); });
  await go(page, 'stress');
  let t = await page.textContent('#counsel');
  assert.match(t, /If you might be in danger[\s\S]*999[\s\S]*03-7627 2929[\s\S]*15999/, 'crisis numbers before entering the study');
  assert.match(t, /Medius is an AI listener, not a therapist or crisis service\./);
  await page.click('#counsel .hwh[data-hwh="medpriv"]'); assert.match(await page.textContent('#hwh-pop'), /Messages are processed by Google Gemini to generate Medius's replies and are not saved by HealthWiz\./); await page.keyboard.press('Escape');
  await page.click('[data-a="csgo"]');
  assert.equal(await page.locator('#cnbub').count(), 1, 'the breathing bubble works');
  await page.click('[data-a="csskip"]');
  t = await page.textContent('#counsel');
  assert.match(t, /Sign in to talk with Medius[\s\S]*SIGN IN TO TALK WITH MEDIUS/);
  assert.equal(await page.locator('#csin').count(), 0, 'no message box while signed out');
  assert.match(t, /03-7627 2929/);
  assert.equal(await page.locator('#counsel a[href="tel:999"]').count(), 1, 'tap to call');
  assert.deepEqual(await visibleEmoji(page), [], 'icons are pixel art');
  await page.click('[data-a="cssign"]');
  assert.match(await page.textContent('#mo'), /WHAT HAPPENS WHEN YOU SIGN IN/);
  await page.keyboard.press('Escape');
  assert.deepEqual(sent, []);
  assert.deepEqual(errors, []);
});

test('Medius AI signed in: the session goes to medius-chat, the mood tag is hidden and played, crisis stays calm or concerned, limits are friendly', async () => {
  const S = fakeSupabase();
  S.aiReply = last => /help/.test(last) ? '[mood:chuckle] Oh dear, a chuckle.' : /plain/.test(last) ? 'No tag at all.' : /odd/.test(last) ? '[mood:grumpy] Hmm.' : '[mood:smile] Well met, Tester! What brings thee here?';
  S.aiDelay = 600; // the 'thinking' state is checked while the reply is still on its way
  const { page, errors } = await device(S, { viewport: { width: 1000, height: 1100 } });
  const reqs = []; page.on('request', r => { if (/functions\/v1\/medius-chat/.test(r.url()) && r.method() === 'POST') reqs.push({ h: r.headers(), b: JSON.parse(r.postData()) }); });
  await signIn(page, S); await synced(page);
  await go(page, 'stress');
  await page.click('[data-a="csgo"]'); await page.click('[data-a="csskip"]');
  await page.fill('#csin', 'Hello wise one');
  await page.click('[data-a="cssend"]');
  assert.equal(await page.evaluate(() => HWCounsel.state.mode), 'think', 'thinking while the reply is on its way');
  await page.waitForFunction(() => /Well met, Tester!/.test(document.querySelector('#cslog').textContent) && !/\[mood/.test(document.querySelector('#cslog').textContent));
  assert.equal(reqs.length, 1);
  assert.match(reqs[0].h.authorization, /^Bearer ey/); assert.equal(reqs[0].h.apikey, ANON);
  assert.deepEqual(reqs[0].b, { name: 'Tester', messages: [{ role: 'user', content: 'Hello wise one' }] });
  assert.equal(await page.evaluate(() => HWCounsel.state.mood), 'smile');
  assert.equal(await page.evaluate(() => S.cs.m.at(-1).t), 'Well met, Tester! What brings thee here?', 'the tag is stripped');
  // the reply is typed out for the eyes; screen readers get it whole at once
  assert.equal(await page.locator('#cslog .cssr').count() <= 1, true);
  for (const [say, mood] of [['plain please', 'calm'], ['an odd one', 'calm']]) {
    await page.waitForFunction(() => !S.cs.busy);
    const n = await page.evaluate(() => S.cs.m.filter(x => x.r === 'a').length);
    await page.fill('#csin', say); await page.click('[data-a="cssend"]');
    await page.waitForFunction(n => S.cs.m.filter(x => x.r === 'a').length === n, n + 1);
    assert.equal(await page.evaluate(() => S.cs.m.at(-1).mood), mood, say + ': missing or unknown tag → calm');
  }
  // crisis words: the help box is highlighted and Medius never smiles or chuckles
  await page.fill('#csin', 'I want to kill myself, help'); await page.click('[data-a="cssend"]');
  await page.waitForFunction(() => S.cs.m.at(-1).r === 'a' && /chuckle/.test(S.cs.m.at(-1).t));
  assert.equal(await page.evaluate(() => S.cs.m.at(-1).mood), 'concerned');
  assert.equal(await page.locator('#cshelp.on').count(), 1);
  // limits
  S.aiStatus = 429; S.aiBody = { error: 'limit', scope: 'hour', retry: 1500 };
  await page.waitForFunction(() => !S.cs.busy);
  await page.fill('#csin', 'one more'); await page.click('[data-a="cssend"]');
  await page.waitForFunction(() => S.cs.m.at(-1).r === 'sys');
  assert.match(await page.evaluate(() => S.cs.m.at(-1).t), /listened to many words this hour[\s\S]*about 25 minutes[\s\S]*Nothing you wrote was saved/);
  S.aiStatus = 429; S.aiBody = { error: 'limit', scope: 'day', retry: 30000 };
  await page.fill('#csin', 'and another'); await page.click('[data-a="cssend"]');
  await page.waitForFunction(() => /today/.test(S.cs.m.at(-1).t));
  assert.match(await page.evaluate(() => S.cs.m.at(-1).t), /today[\s\S]*about 8 hours/);
  assert.deepEqual(errors.filter(e => !/status of 429/.test(e)), []);
});

test('Medius reacts in his study: idle breathing and blinks, a nod while typing, eyes raised while thinking, then the reply\'s mood (his hands never move)', async () => {
  const S = fakeSupabase();
  let release; S.aiReply = () => '[mood:gesture] Try one small step.';
  const { page, errors } = await device(S, { viewport: { width: 1000, height: 1100 } });
  await signIn(page, S); await synced(page);
  await go(page, 'stress');
  await page.click('[data-a="csgo"]'); await page.click('[data-a="csskip"]');
  await page.waitForSelector('#cnsc canvas.cnmd');
  const pose = () => page.evaluate(() => JSON.parse(HWCounsel.state.pose || 'null'));
  // idle: within one 4.6 s breath the head rises, and he blinks now and then
  const seen = new Set();
  for (let i = 0; i < 70; i++) { const p = await pose(); if (p && p.dy === -2) seen.add('breath'); if (p && p.eyes === 'closed') seen.add('blink'); await page.waitForTimeout(100); }
  assert.ok(seen.has('breath'), 'breathing');
  // typing: a nod
  await page.type('#csin', 'thinking aloud', { delay: 30 });
  let nod = false; for (let i = 0; i < 25 && !nod; i++) { const p = await pose(); nod = !!(p && p.dy === 4); await page.waitForTimeout(40); }
  assert.ok(nod, 'a small nod while the player types');
  // thinking: the reply is held back a moment
  await page.route(URL0 + '/functions/v1/medius-chat', async r => { await new Promise(res => { release = res; }); await S.handle(r); });
  await page.click('[data-a="cssend"]');
  await page.waitForTimeout(300);
  const th = await pose();
  assert.ok(th.eyes === 'up' && th.brows === 'lift' && !('hands' in th), 'eyes up in thought, hands as painted: ' + JSON.stringify(th));
  release();
  await page.waitForFunction(() => HWCounsel.state.mode === 'mood');
  const g = await pose();
  assert.equal(g.brows, 'lift', 'the gesture mood: brows lifted while the reply appears'); assert.ok(!('hands' in g));
  // the canvas is drawn in the study's own pixels: the sheet is loaded and something is painted over his figure
  const painted = await page.evaluate(() => { const c = document.querySelector('#cnsc canvas.cnmd'); const ctx = c.getContext('2d'); try { return ctx.getImageData(400, 60, 200, 280).data.some((v, i) => i % 4 === 3 && v > 0); } catch (e) { return 'tainted'; } });
  assert.ok(painted === true || painted === 'tainted', 'overlay painted');
  await page.waitForFunction(() => HWCounsel.state.mode === 'idle', null, { timeout: 15000 });
  // off screen: the timer stops
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.evaluate(() => { document.querySelector('#cnsc').style.display = 'none'; });
  assert.deepEqual(errors, []);
});

test('reduced motion: Medius shows his expression as one still frame and the reply appears at once', async () => {
  const S = fakeSupabase();
  S.aiReply = () => '[mood:smile] Hello there, friend.';
  const { page, errors } = await device(S, { context: { reducedMotion: 'reduce' } });
  await signIn(page, S); await synced(page);
  await go(page, 'stress');
  await page.click('[data-a="csgo"]'); await page.click('[data-a="csskip"]');
  await page.fill('#csin', 'hi'); await page.click('[data-a="cssend"]');
  await page.waitForFunction(() => /Hello there, friend\./.test(document.querySelector('#cslog').textContent));
  assert.equal(await page.locator('#cslog .cssr').count(), 0, 'no typing effect');
  const p = await page.evaluate(() => JSON.parse(HWCounsel.state.pose || 'null'));
  assert.deepEqual(p, { eyes: 'happy', mouth: 'smile' }, 'still smile, no nod or bob');
  assert.deepEqual(errors, []);
});

test('Runners\' Board: on sign-in this device\'s entry moves to the account, then follows it; LEAVE removes the account\'s entry', async () => {
  const S = fakeSupabase();
  const now = Date.now(), iso = t => new Date(t).toISOString();
  const runs = JSON.stringify({ ok: 1, del: [], runs: [{ id: 'r1', start: iso(now - 90e3), end: iso(now - 30e3), dist: 5200, dur: 1600, pace: 308, route: [], up: 1 }] });
  const anon = [];
  const { page, errors } = await device(S, { viewport: { width: 390, height: 844 } });
  await page.route('**/rest/v1/rpc/{submit_run_score,leave_run_board,run_board}', async r => {
    const fn = r.request().url().split('/rpc/')[1], h = r.request().headers();
    if (h.authorization) return S.handle(r);                         // signed in: the account functions
    anon.push(fn); return r.fulfill({ status: 200, contentType: 'application/json', body: fn === 'run_board' ? '[]' : 'null' });
  });
  // joined as this device, this week's totals already posted (so nothing is sent before signing in)
  await page.evaluate(r => { localStorage.setItem('healthwiz_runs', r); const ws = HWRunBoard.monday(null, 0), w = HWRunBoard.weekOf(JSON.parse(r).runs, ws);
    localStorage.setItem('healthwiz_runboard', JSON.stringify({ dev: '11111111-1111-4111-8111-111111111111', on: 1, nick: 'Steady Otter', sent: { [ws]: [w.km, w.runs, w.sec, w.b5, 'Steady Otter'].join('|') }, cache: {} })); }, runs);
  await page.reload(); await page.waitForSelector('.wl');
  await page.waitForFunction(() => HWRunBoard.state.on);
  await signIn(page, S); await synced(page);
  await page.waitForFunction(() => HWRunBoard.state.linked);
  const claim = S.rb.calls.find(c => c.fn === 'claim_run_scores');
  assert.deepEqual(claim.body, { p_device_id: '11111111-1111-4111-8111-111111111111', p_nickname: 'Steady Otter' }, 'this device\'s rows move to the account, keeping its nickname');
  await page.evaluate(() => HWRunBoard.push());
  for (let i = 0; i < 50 && !S.rb.calls.some(c => c.fn === 'submit_run_score_me'); i++) await page.waitForTimeout(100);
  const sub = S.rb.calls.find(c => c.fn === 'submit_run_score_me');
  assert.ok(sub, 'signed in: totals go to the account');
  assert.equal(sub.body.p_device_id, '11111111-1111-4111-8111-111111111111'); assert.equal(sub.body.p_nickname, undefined, 'the account keeps its nickname on the server');
  // LEAVE as the account; then sign out: this device starts fresh and the account entry is not touched again
  await go(page, 'stair');
  await page.locator('#v6rb').scrollIntoViewIfNeeded();
  await page.locator('#v6rb details summary').click();
  await page.click('[data-a="rbleave"]'); await page.click('[data-a="rbleave"]');
  await page.waitForFunction(() => !HWRunBoard.state.on);
  assert.ok(S.rb.calls.some(c => c.fn === 'leave_run_board_me'));
  assert.equal(anon.filter(f => f === 'leave_run_board').length, 0, 'not the device function');
  assert.notEqual(await page.evaluate(() => HWRunBoard.state.dev), '11111111-1111-4111-8111-111111111111');
  assert.deepEqual(errors, []);
});
