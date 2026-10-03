// Shared by tests/21-cloud and 22-cloud-sync: a small fake Supabase (auth + the hw_saves table, with the same rev rules as
// supabase/migrations) answering through Playwright routes, so several "devices" can share one account.
import assert from 'node:assert/strict';
import { openApp, go, state } from './helpers.mjs';

export const URL0 = 'https://hwtest.supabase.co';
export const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
export const tok = o => b64({ alg: 'HS256', typ: 'JWT' }) + '.' + b64(o) + '.sig';
export const ANON = tok({ role: 'anon', iss: 'supabase' });
export const CLOUD = JSON.stringify({ url: URL0, key: ANON });

export function fakeSupabase() {
  const S = { users: {}, rows: {}, board: {}, noBoard: false, sent: [], down: false, confirm: false, calls: [], race: 0, n: 0 };
  const session = u => ({ access_token: tok({ sub: u.id, email: u.email, role: 'authenticated' }), refresh_token: 'r-' + u.id, expires_in: 3600, user: { id: u.id, email: u.email } });
  S.handle = async route => {
    const req = route.request(), u = new URL(req.url()), m = req.method();
    S.calls.push(m + ' ' + u.pathname);
    if (S.down) return route.abort('internetdisconnected');
    const send = (status, body) => route.fulfill({ status, contentType: 'application/json', body: body === undefined ? '' : JSON.stringify(body) });
    if (req.headers().apikey !== ANON) return send(401, { message: 'bad apikey' });
    const body = req.postData() ? JSON.parse(req.postData()) : null;
    if (u.pathname === '/auth/v1/signup') {
      if (S.users[body.email]) return send(422, { msg: 'User already registered' });
      const usr = S.users[body.email] = { id: 'u' + (++S.n) + '-0000', email: body.email, pw: body.password };
      return send(200, S.confirm ? { id: usr.id, email: usr.email } : session(usr));
    }
    if (u.pathname === '/auth/v1/token') {
      if (u.searchParams.get('grant_type') === 'password') { const usr = S.users[body.email]; return usr && usr.pw === body.password ? send(200, session(usr)) : send(400, { error_description: 'Invalid login credentials' }); }
      const usr = Object.values(S.users).find(x => 'r-' + x.id === body.refresh_token); return usr ? send(200, session(usr)) : send(400, { error_description: 'Invalid Refresh Token' });
    }
    if (u.pathname === '/auth/v1/logout') return send(204);
    const auth = (req.headers().authorization || '').replace('Bearer ', ''), sub = auth.split('.').length === 3 ? JSON.parse(Buffer.from(auth.split('.')[1], 'base64url')).sub : null;
    if (!sub || !Object.values(S.users).some(x => x.id === sub)) return send(401, { message: 'JWT invalid' });
    if (u.pathname === '/functions/v1/medius-chat') { // supabase/functions/medius-chat: S.ai = 'ok' | 'busy' | 'nokey' | 'blocked' | 'setup'
      S.ai = S.ai || 'ok'; S.aiUsed = S.aiUsed || {}; S.aiSent = S.aiSent || []; S.aiSent.push({ sub, body });
      if (S.ai === 'setup') return send(503, { error: 'setup' });
      const n = S.aiUsed[sub] = (S.aiUsed[sub] || 0) + 1, daily = S.aiDaily || 30;
      if (n > daily) return send(429, { error: 'limit', left: 0 });
      if (S.ai !== 'ok') return send(S.ai === 'blocked' ? 502 : 503, { error: S.ai });
      const last = body.messages[body.messages.length - 1].content;
      return send(200, { reply: 'Medius hears thee, ' + body.name + ': ' + last, left: daily - n });
    }
    if (u.pathname === '/rest/v1/rpc/hw_delete_account') { for (const k in S.users) if (S.users[k].id === sub) delete S.users[k]; delete S.rows[sub]; delete S.board[sub]; return send(204); }
    if (u.pathname.startsWith('/rest/v1/rpc/hw_board_') || u.pathname === '/rest/v1/hw_board') return board(S, u, m, sub, body, send);
    if (u.pathname !== '/rest/v1/hw_saves') return send(404, { code: 'PGRST205', message: 'Could not find the table' });
    const who = (u.searchParams.get('user_id') || '').replace('eq.', '');
    if (m === 'POST') { if (body.user_id !== sub) return send(403, { message: 'RLS' }); if (S.rows[sub]) return send(409, { code: '23505', message: 'duplicate key' }); S.rows[sub] = { rev: 1, sv: body.sv, data: body.data, device: body.device, updated_at: new Date().toISOString() }; return send(201, [S.rows[sub]]); }
    if (who !== sub) return send(200, []); // RLS: other rows are invisible
    const row = S.rows[sub];
    if (m === 'GET') return send(200, row ? [row] : []);
    if (m === 'PATCH') {
      if (S.race > 0 && row) { S.race--; row.rev++; } // another device wrote in between
      const rev = +(u.searchParams.get('rev') || '').replace('eq.', '');
      if (!row || row.rev !== rev) return send(200, []);
      Object.assign(row, { sv: body.sv, data: body.data, device: body.device, rev: row.rev + 1, updated_at: new Date().toISOString() });
      return send(200, [row]);
    }
    if (m === 'DELETE') { delete S.rows[sub]; return send(204); }
    return send(405, {});
  };
  return S;
}

export async function device(S, { seed, cloud = CLOUD, viewport } = {}) {
  const r = await openApp({ seed, viewport, before: async page => {
    await page.route(URL0 + '/**', S.handle);
    if (cloud) await page.addInitScript(c => { if (!sessionStorage.getItem('cl')) { localStorage.setItem('healthwiz_cloud', c); sessionStorage.setItem('cl', '1'); } }, cloud);
  } });
  await r.page.waitForSelector('.wl');
  await r.page.evaluate(() => { window.__ev = []; HWEvents.on('*', e => { if (/^cloud:|^data:imported/.test(e.type)) window.__ev.push(e.type + (e.mode ? ':' + e.mode : '') + (e.how ? ':' + e.how : '')); }); });
  return r;
}
export const st = page => page.evaluate(() => HWCloud.status());
export const synced = page => page.waitForFunction(() => { const s = HWCloud.status(); return s.phase === 'ok' && !s.pending; }, null, { timeout: 15000 });
export async function signUp(page, email = 'hero@example.com', pw = 'kingdom123', create = true) {
  await go(page, 'set');
  await page.fill('#clem', email); await page.fill('#clpw', pw);
  await page.click(create ? '[data-a="clup"]' : '[data-a="clin"]');
}
export const water = (page, ml = 250) => page.evaluate(v => { add('water', v, {}, ''); render(); }, ml);

// The leaderboard, with the rules of supabase/migrations/20261004000000_hw_leaderboard.sql: XP and badges come from the
// caller's cloud save, other counts are clamped, hidden names are masked for others, no user ids are returned.
const BOARDS = ['xp', 'week', 'quests', 'badges', 'kingdom', 'explore', 'streak'];
function board(S, u, m, sub, body, send) {
  if (S.noBoard) return send(404, { code: 'PGRST202', message: 'Could not find the function' });
  const NUM = /^[0-9]{1,12}(\.[0-9]+)?$/, n = (o, k) => NUM.test(String(o?.[k] ?? '')) ? Math.floor(+o[k]) : 0;
  if (u.pathname === '/rest/v1/rpc/hw_board_publish') {
    S.sent.push(body);
    const name = String(body.p_name || '').replace(/\s+/g, ' ').trim();
    if (name.length < 3 || name.length > 20 || !/^[\p{L}\p{N}][\p{L}\p{N} ._'-]*$/u.test(name)) return send(400, { code: '22023', message: 'hero name: 3-20 letters, numbers, spaces' });
    const save = S.rows[sub]; if (!save) return send(400, { code: '22023', message: 'sync your cloud save first' });
    const st = body.p_stats || {}, xp = n(save.data, 'xp'), wk = /^\d{4}-\d{2}-\d{2}$/.test(st.wk || '') ? st.wk : null;
    S.board[sub] = { name, hidden: !!body.p_hidden, xp, week_xp: wk ? Math.min(n(st, 'week_xp'), xp, 100000) : 0, wk, quests: Math.min(n(st, 'quests'), 100000),
      badges: Object.keys(save.data.b || {}).length, kingdom: Math.min(n(st, 'kingdom'), 100), explore: Math.min(n(st, 'explore'), 10000), streak: Math.min(n(st, 'streak'), 3660) };
    return send(204);
  }
  if (u.pathname === '/rest/v1/rpc/hw_board_top') {
    if (!BOARDS.includes(body.p_board)) return send(400, { code: '22023', message: 'unknown board' });
    const t = body.p_board, lim = Math.max(1, Math.min(body.p_limit || 20, 50));
    const v = Object.entries(S.board).filter(([, b]) => t !== 'week' || (body.p_week && b.wk === body.p_week))
      .map(([id, b]) => ({ id, b, score: t === 'week' ? b.week_xp : b[t] })).filter(x => x.score > 0 || x.id === sub)
      .sort((a, b) => b.score - a.score || a.b.name.localeCompare(b.b.name));
    const out = []; v.forEach((x, i) => { const rank = v.findIndex(y => y.score === x.score) + 1; if (i < lim || x.id === sub) out.push({ rank, name: x.b.hidden && x.id !== sub ? null : x.b.name, value: x.score, xp: x.b.xp, me: x.id === sub }); });
    return send(200, out);
  }
  const who = (u.searchParams.get('user_id') || '').replace('eq.', '');
  if (who !== sub) return send(200, []);
  if (m === 'GET') { const b = S.board[sub]; return send(200, b ? [{ name: b.name, hidden: b.hidden }] : []); }
  if (m === 'DELETE') { delete S.board[sub]; return send(204); }
  return send(405, {});
}
