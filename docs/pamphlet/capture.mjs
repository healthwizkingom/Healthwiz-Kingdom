// Captures phone-size screens of the running app for the pamphlet, with 30 days of SAMPLE entries from the repo's own test helper.
// Usage (from this folder):  node capture.mjs [route ...]      -> shots/<route>.png
import { openApp, yearOfLogs, closeBrowser, go, dismissAware } from '../../tests/helpers.mjs';
const routes = process.argv.slice(2).length ? process.argv.slice(2) : ['home','health','kingdom','water','food','sleep','stress','score','body','exercise','run','stats','quests','badges','lab','time','monument','alchemy','set','campus'];
const seed = yearOfLogs(30);
for (const r of routes) {
  const { page, ctx } = await openApp({ seed, url: r === 'campus' ? process.env.APP_URL : undefined, viewport: { width: 390, height: 844 }, context: { deviceScaleFactor: 2, isMobile: true, hasTouch: true } });
  try {
    await go(page, r); if (r === 'campus') await dismissAware(page);
    await page.waitForTimeout(r === 'campus' ? 4000 : 1800);
    for (let k = 0; k < 8; k++) { // dismiss badge / reward pop-ups the sample data triggers
      const hit = await page.evaluate(() => { const el = [...document.querySelectorAll('body *')].find(e => e.children.length === 0 && /tap to continue/i.test(e.textContent) && e.offsetParent !== null); if (!el) return false; let n = el; while (n && getComputedStyle(n).position !== 'fixed') n = n.parentElement; (n || el).click(); return true; });
      if (!hit) break; await page.waitForTimeout(600);
    }
    await page.evaluate(() => { // remove the top "weekly quest complete" banner box the sample data triggers
      let n = document.elementFromPoint(195, 72); const keep = [];
      while (n && n !== document.body) { const r = n.getBoundingClientRect(); if (/steady stream|quest complete/i.test(n.textContent) || (r.height > 40 && r.height < 120 && r.top < 90 && r.width > 300)) keep.push(n); n = n.parentElement; }
      const t = keep.filter(e => e.getBoundingClientRect().height < 130).pop(); if (t && /steady stream|quest complete|^\s*$/i.test(t.textContent.trim() || ' ')) t.style.visibility = 'hidden'; });
    await page.waitForTimeout(900);
    await page.screenshot({ path: `shots/${r}.png` }); console.log('ok', r, await page.evaluate(() => S.v));
  } catch (e) { console.log('FAIL', r, e.message.slice(0, 120)); }
  await ctx.close();
}
await closeBrowser();
