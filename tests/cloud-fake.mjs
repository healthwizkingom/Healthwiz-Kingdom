// Shared by the account / cloud / leaderboard / Medius AI tests: a small fake Supabase answering through Playwright routes,
// with the same rules as supabase/migrations and supabase/functions/medius-chat, so several "devices" can share one account.
//   Auth: /otp (sends a "mail" with a code), /verify (type email), /token (refresh_token, pkce), /authorize (Google), /settings,
//   /logout. Data: user_data (own row only, updated_at moves forward on every write; a PATCH with an old updated_at
//   changes nothing), hw_delete_account, the Hall of Heroes RPCs. Medius: /functions/v1/medius-chat (signed-in only).
import { openApp, go } from './helpers.mjs';

export const URL0 = 'https://hwtest.supabase.co';
export const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
export const tok = o => b64({ alg: 'ES256', typ: 'JWT', kid: 'k1' }) + '.' + b64(o) + '.sig';
export const ANON = tok({ role: 'anon', iss: 'supabase' });
export const CLOUD = JSON.stringify({ url: URL0, key: ANON });

let clock = Date.parse('2026-10-05T10:00:00Z');
const stamp = () => new Date(clock += 1000).toISOString().replace('Z', '+00:00'); // like PostgREST: strictly increasing

export function fakeSupabase() {
  const S = { users: {}, rows: {}, board: {}, noBoard: false, sent: [], down: false, calls: [], race: 0, n: 0, mail: [], google: true, codes: {},
    ai: [], aiReply: null, aiStatus: 200, aiBody: null, ask: [] };
  const session = u => ({ access_token: tok({ sub: u.id, email: u.email, role: 'authenticated', exp: 9e9 }), refresh_token: 'r-' + u.id, expires_in: 3600, user: { id: u.id, email: u.email } });
  const user = email => S.users[email] || (S.users[email] = { id: 'u' + (++S.n) + '-0000', email });
  S.handle = async route => {
    const req = route.request(), u = new URL(req.url()), m = req.method();
    S.calls.push(m + ' ' + u.pathname);
    if (S.down) return route.abort('internetdisconnected');
    const send = (status, body) => route.fulfill({ status, contentType: 'application/json', body: body === undefined ? '' : JSON.stringify(body) });
    if (u.pathname.startsWith('/functions/v1/') && m === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' } });
    if (req.headers().apikey !== ANON) return send(401, { message: 'bad apikey' });
    const body = req.postData() ? JSON.parse(req.postData()) : null;
    if (u.pathname === '/auth/v1/settings') return send(200, { external: { email: true, google: S.google } });
    if (u.pathname === '/auth/v1/otp') {
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(body.email || '')) return send(400, { msg: 'invalid email' });
      const code = String(100000 + S.mail.length * 7919 % 899999);
      S.codes[body.email] = code; S.mail.push({ email: body.email, code, redirect: u.searchParams.get('redirect_to'), create: body.create_user });
      return send(200, {});
    }
    if (u.pathname === '/auth/v1/verify') {
      if (body.type !== 'email' || !S.codes[body.email] || S.codes[body.email] !== body.token) return send(403, { msg: 'Token has expired or is invalid' });
      delete S.codes[body.email]; return send(200, session(user(body.email)));
    }
    if (u.pathname === '/auth/v1/token') {
      const g = u.searchParams.get('grant_type');
      if (g === 'pkce') { const p = S.pkce; return p && p.code === body.auth_code && p.verifier === body.code_verifier ? send(200, session(user(p.email))) : send(400, { error_description: 'invalid flow state' }); }
      const usr = Object.values(S.users).find(x => 'r-' + x.id === body.refresh_token); return usr ? send(200, session(usr)) : send(400, { error_description: 'Invalid Refresh Token' });
    }
    if (u.pathname === '/auth/v1/logout') { S.logout = u.searchParams.get('scope'); return send(204); }
    const auth = (req.headers().authorization || '').replace('Bearer ', ''), claims = auth.split('.').length === 3 ? JSON.parse(Buffer.from(auth.split('.')[1], 'base64url')) : null, sub = claims && claims.sub;
    if (!sub || !Object.values(S.users).some(x => x.id === sub)) return send(401, { message: 'JWT invalid' });
    if (u.pathname === '/functions/v1/medius-chat') return medius(S, body, send);
    if (u.pathname === '/rest/v1/rpc/hw_delete_account') { for (const k in S.users) if (S.users[k].id === sub) delete S.users[k]; delete S.rows[sub]; delete S.board[sub]; return send(204); }
    if (u.pathname.startsWith('/rest/v1/rpc/hw_board_') || u.pathname === '/rest/v1/hw_board') return board(S, u, m, sub, body, send);
    if (/^\/rest\/v1\/rpc\/(run_me|claim_run_scores|run_join_me|submit_run_score_me|leave_run_board_me|run_board)$/.test(u.pathname)) return runs(S, u.pathname.split('/').pop(), sub, body, send);
    if (u.pathname !== '/rest/v1/user_data') return send(404, { code: 'PGRST205', message: 'Could not find the table' });
    const who = (u.searchParams.get('user_id') || '').replace('eq.', '');
    if (m === 'POST') { if (body.user_id !== sub) return send(403, { message: 'RLS' }); if (S.rows[sub]) return send(409, { code: '23505', message: 'duplicate key' }); S.rows[sub] = { data: body.data, updated_at: stamp() }; S.writes = (S.writes || 0) + 1; return send(201, [S.rows[sub]]); }
    if (who !== sub) return send(200, []); // RLS: other rows are invisible
    const row = S.rows[sub];
    if (m === 'GET') return send(200, row ? [row] : []);
    if (m === 'PATCH') {
      if (S.race > 0 && row) { S.race--; row.updated_at = stamp(); } // another device wrote in between
      const ts = (u.searchParams.get('updated_at') || '').replace('eq.', '');
      if (!row || row.updated_at !== ts) return send(200, []);
      Object.assign(row, { data: body.data, updated_at: stamp() }); S.writes = (S.writes || 0) + 1;
      return send(200, [row]);
    }
    if (m === 'DELETE') { delete S.rows[sub]; return send(204); }
    return send(405, {});
  };
  return S;
}

// Runners' Board for accounts (supabase/migrations/20261007000100_run_scores_accounts.sql): membership and claims only
function runs(S, fn, sub, body, send) {
  S.rb = S.rb || { members: {}, calls: [] }; S.rb.calls.push({ fn, sub, body });
  const M = S.rb.members;
  if (fn === 'run_me') return send(200, [{ joined: !!M[sub], nickname: M[sub] || null }]);
  if (fn === 'claim_run_scores') { if (!M[sub] && body.p_nickname) M[sub] = body.p_nickname; return send(200, [{ joined: !!M[sub], nickname: M[sub] || null }]); }
  if (fn === 'run_join_me') { M[sub] = body.p_nickname; return send(204); }
  if (fn === 'leave_run_board_me') { delete M[sub]; return send(200, 0); }
  if (fn === 'run_board') return send(200, []);
  return send(204);
}

// medius-chat: the same contract as supabase/functions/medius-chat (the reply carries the mood tag)
function medius(S, body, send) {
  S.ask.push(body);
  if (S.aiStatus !== 200) return send(S.aiStatus, S.aiBody || { error: 'ai' });
  const last = body.messages[body.messages.length - 1].content;
  const reply = typeof S.aiReply === 'function' ? S.aiReply(last, body) : S.aiReply || '[mood:smile] Well met, ' + body.name + '!';
  return send(200, { reply, help: /suicid|kill myself|self[- ]?harm/i.test(last) });
}

export async function device(S, { seed, cloud = CLOUD, viewport, context } = {}) {
  const r = await openApp({ seed, viewport, context, before: async page => {
    await page.route(URL0 + '/**', S.handle);
    if (cloud) await page.addInitScript(c => { if (!sessionStorage.getItem('cl')) { localStorage.setItem('healthwiz_cloud', c); sessionStorage.setItem('cl', '1'); } }, cloud);
  } });
  await r.page.waitForSelector('.wl');
  await r.page.evaluate(() => { window.__ev = []; HWEvents.on('*', e => { if (/^cloud:|^data:imported/.test(e.type)) window.__ev.push(e.type + (e.mode ? ':' + e.mode : '') + (e.how ? ':' + e.how : '')); }); });
  return r;
}
export const st = page => page.evaluate(() => HWCloud.status());
export const synced = page => page.waitForFunction(() => { const s = HWCloud.status(); return s.phase === 'ok' && !s.pending; }, null, { timeout: 20000 });
/** Signs in through the real screens: Settings → ACCOUNT → SIGN IN → CONTINUE → email → the code from the "mail". */
export async function signIn(page, S, email = 'hero@example.com') {
  await go(page, 'set');
  await page.click('[data-a="acin"]');
  await page.click('[data-a="acgo"]');
  await page.fill('#acem', email);
  await page.click('[data-a="acmail"]');
  await page.waitForSelector('#accode');
  const code = S.mail.filter(x => x.email === email).pop().code;
  await page.fill('#accode', code);
  await page.click('[data-a="accode"]');
  await page.waitForFunction(() => HWCloud.status().signed);
}
export const water = (page, ml = 250) => page.evaluate(v => { add('water', v, {}, ''); render(); }, ml);

// The leaderboard, with the rules of supabase/migrations/20261004000000_hw_leaderboard.sql (XP and badges from the caller's
// cloud save, user_data since 20261007000000_user_data.sql); other counts are clamped, hidden names are masked for others.
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
