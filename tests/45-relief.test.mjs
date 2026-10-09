// Stress Quest activity collection (js/v6-relief.js): illustrated cards replace the "what would help you handle this?" options.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, closeBrowser, go, state } from './helpers.mjs';

after(closeBrowser);
const boot = async (o = {}) => { const r = await openApp(o); await r.page.waitForSelector('.wl'); return r; };
async function toEncounter(page, feel = 3) {
  await go(page, 'stress');
  await page.click('[data-a="sqs"]'); await page.click(`[data-a="sqf"][data-i="${feel}"]`); await page.click('[data-a="sqy"]'); await page.click('[data-a="sqe"]');
}
const IDS = ['shake', 'lantern', 'arrow', 'react', 'sound', 'ground', 'write', 'steps'];
const VIEWPORTS = [{ width: 390, height: 844 }, { width: 1280, height: 900 }];

for (const viewport of VIEWPORTS) {
  test(`the collection shows by itself, no method-choice step, scrolls and fits at ${viewport.width}px`, async () => {
    const { page, errors } = await boot({ viewport });
    await toEncounter(page);
    assert.equal(await page.locator('.qo').count(), 0, 'the five-option list is gone');
    assert.equal(await page.locator('[data-a="sqp"]').count(), 0);
    assert.equal(await page.locator('[data-a="rxo"]').count(), IDS.length, 'one card per activity');
    for (const id of IDS) assert.ok(await page.locator(`[data-a="rxo"][data-id="${id}"] .rxa svg`).count(), id + ' card has its illustration');
    const names = await page.locator('.rxc .rxt b').allTextContents();
    for (const n of ['Shake It Off', 'Empower Yourself', 'Arrow Focus', 'Reaction Focus', 'Calming Sounds']) assert.ok(names.includes(n), n);
    assert.ok((await page.locator('.rxc .rxt small').allTextContents()).every(t => t.length > 20), 'each card has a description');
    const box = await page.locator('.rxc').first().boundingBox();
    assert.ok(box.height >= 44 && box.width >= 150, 'cards are large tap targets');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'no sideways scroll');
    assert.equal(await page.locator('[data-a="sqfin"]').count(), 1, 'FINISH QUEST is still there');
    assert.deepEqual(errors, []);
  });
}

test('open a card, read it, go back; START and back work for every activity', async () => {
  const { page, errors } = await boot({ viewport: VIEWPORTS[0] });
  await toEncounter(page);
  for (const id of IDS) {
    await page.click(`[data-a="rxo"][data-id="${id}"]`);
    assert.ok(await page.locator('.rxdt').count() && await page.locator('.rxds').count(), id + ' shows its name and sentence');
    assert.ok(await page.isVisible('[data-a="rxs"]'), id + ' has a START button');
    assert.ok(await page.isVisible('[data-a="rxb"]'), id + ' has a way back');
    await page.click('[data-a="rxs"]');
    assert.ok(await page.isVisible('[data-a="rxb"], [data-a="rxdone"], [data-a="sqbs"]'), id + ' running');
    await page.click('[data-a="rxb"]');
    assert.equal(await page.locator('[data-a="rxo"]').count(), IDS.length, id + ': back returns to the collection');
  }
  assert.deepEqual(errors, []);
});

test('the weather and recorded mood stay put: finishing activities never move the stress rating', async () => {
  const { page, errors } = await boot({ viewport: VIEWPORTS[0] });
  await toEncounter(page, 4);
  const snap = () => page.evaluate(() => ({ r: S.sq.r, r0: S.sq.r0, scene: document.querySelector('#qsc')?.innerHTML.length }));
  const before = await snap();
  assert.equal(before.r, 9);
  // Arrow Focus: twelve rounds, then the original "How do you feel now?" step with the best answer
  await page.click('[data-a="rxo"][data-id="arrow"]'); await page.click('[data-a="rxs"]');
  for (let i = 0; i < 12; i++) { await page.waitForSelector('#rxar .mid'); await page.click('[data-a="rxdir"][data-d="1"]'); await page.waitForTimeout(620); }
  assert.match(await page.textContent('#rxar'), /of 12/);
  await page.click('[data-a="rxdone"]');
  await page.click('[data-a="sqt"][data-i="3"]');
  const after = await page.evaluate(() => ({ r: S.sq.r, r0: S.sq.r0, last: S.sq.last, tries: S.sq.tries }));
  assert.equal(after.r, before.r, 'rating unchanged by "Much calmer"');
  assert.equal(after.r0, before.r0);
  assert.deepEqual(after.tries, [{ t: 'arrow', fb: 3 }]);
  await page.click('[data-a="sqa"]');
  assert.equal(await page.locator('[data-a="rxo"]').count(), IDS.length, 'TRY ANOTHER returns to the collection');
  await page.click('[data-a="sqfin"]');
  const st = await state(page);
  const e = st.e.filter(x => x.c === 'stress').at(-1);
  assert.equal(e.v, 9, 'recorded mood is the one the user set');
  assert.equal(e.m.end, 9);
  assert.deepEqual(e.m.tech.map(t => t.t), ['arrow'], 'stress data keeps the activity used');
  assert.match(await page.textContent('.pg'), /Stress: 9\/10/);
  assert.deepEqual(errors, []);
});

test('Shake It Off and Reaction Focus run and end in the feel-now step; Calming Sounds plays and stops', async () => {
  const { page, errors } = await boot({ viewport: VIEWPORTS[1] });
  await page.evaluate(() => { st.s.sound = true; });
  await toEncounter(page);
  await page.click('[data-a="rxo"][data-id="shake"]'); await page.click('[data-a="rxs"]');
  assert.match(await page.textContent('#rxcue'), /hands/i);
  await page.waitForFunction(() => document.querySelector('#rxsh') && /^rxsh s0$/.test(document.querySelector('#rxsh').className));
  await page.click('[data-a="rxdone"]');
  assert.ok(await page.isVisible('[data-a="sqt"][data-i="0"]'), 'feel-now step');
  await page.click('[data-a="sqt"][data-i="1"]'); await page.click('[data-a="sqa"]');

  await page.click('[data-a="rxo"][data-id="react"]'); await page.click('[data-a="rxs"]');
  await page.click('#rxorb');   // too early: it simply waits again
  assert.match(await page.textContent('#rxcue'), /early/i);
  for (let i = 0; i < 5; i++) { await page.waitForSelector('#rxorb.on', { timeout: 9000 }); await page.click('#rxorb'); await page.waitForTimeout(1100); }
  assert.match(await page.textContent('#rxcue'), /Average \d+ ms/);
  await page.click('[data-a="rxdone"]'); await page.click('[data-a="sqt"][data-i="2"]'); await page.click('[data-a="sqa"]');

  for (const sc of ['forest', 'kingdom', 'rain', 'night']) {
    await page.click('[data-a="rxo"][data-id="sound"]');
    await page.click(`[data-a="rxsc"][data-s="${sc}"]`); await page.click('[data-a="rxs"]');
    await page.waitForTimeout(700);
    assert.equal(await page.evaluate(() => HWRelief.sounds.on), true, sc + ' playing');
    await page.click('[data-a="rxdone"]');
    assert.equal(await page.evaluate(() => HWRelief.sounds.on), false, sc + ' stopped');
    await page.click('[data-a="sqt"][data-i="3"]'); await page.click('[data-a="sqa"]');
  }
  // leaving the page stops sound and does not strand the quest on an activity screen
  await page.click('[data-a="rxo"][data-id="sound"]'); await page.click('[data-a="rxs"]'); await page.waitForTimeout(300);
  await go(page, 'home');
  assert.equal(await page.evaluate(() => HWRelief.sounds.on), false);
  await go(page, 'stress');
  assert.equal(await page.locator('[data-a="rxo"]').count(), IDS.length);
  assert.deepEqual(errors, []);
});

test('Empower Yourself keeps the original breathing exercise (lantern), and a way back to the collection', async () => {
  const { page, errors } = await boot({ viewport: VIEWPORTS[0] });
  await toEncounter(page);
  await page.click('[data-a="rxo"][data-id="lantern"]'); await page.click('[data-a="rxs"]');
  assert.equal(await page.locator('.rxlg .orb').count(), 1, 'the breathing orb is the lantern glow');
  assert.match(await page.textContent('#bl'), /INHALE|EXHALE/);
  assert.ok(await page.isVisible('[data-a="rxb"]'));
  await page.click('[data-a="rxb"]');
  assert.equal(await page.locator('[data-a="rxo"]').count(), IDS.length);
  // the original grounding tool still works from its card
  await page.click('[data-a="rxo"][data-id="ground"]'); await page.click('[data-a="rxs"]');
  assert.equal(await page.locator('.gorb').count(), 5);
  assert.deepEqual(errors, []);
});
