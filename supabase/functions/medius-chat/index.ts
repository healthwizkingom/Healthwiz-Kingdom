// HealthWiz Kingdom: Medius's AI counsel (master prompt §39–42). Called by the Wizard's Counsel in js/v6-medius.js.
//
// The Gemini API key lives only here, as an Edge Function secret (GEMINI_API_KEY; a few common other names are
// accepted too). The app never sees it. Only signed-in players (the cloud-save accounts) can talk to Medius, with a
// daily allowance per player counted by public.hw_medius_take() (supabase/migrations/20261005000000_hw_medius.sql).
// Medius's persona and safety rules are set here, not by the app, so the key cannot be used as a general chatbot.
// Messages are passed to Gemini and the reply is returned; nothing is stored or logged.
//
//   POST { name, messages: [{ role: 'user' | 'assistant', content }] }  (Authorization: Bearer <player's access token>)
//     200 { reply, left }
//     400 bad · 401 signin · 429 limit (daily allowance used) · 503 busy (Gemini free quota) / nokey · 502 ai / blocked
//   GET  → { ok, ai, key, model }; GET ?check=1 also asks Gemini whether the key and model work (no text is generated).
//
// Deploy: supabase functions deploy medius-chat --no-verify-jwt (the function checks the player itself).
// Optional secrets: GEMINI_MODEL (default below), MEDIUS_DAILY (messages per player per day, default 30).

const KEY_NAMES = ['GEMINI_API_KEY', 'GOOGLE_API_KEY', 'GEMINI_KEY', 'GOOGLE_GEMINI_API_KEY', 'GOOGLE_AI_API_KEY', 'GEMINI'];
const keyName = KEY_NAMES.find(k => (Deno.env.get(k) || '').trim());
const KEY = keyName ? Deno.env.get(keyName)!.trim() : '';
const MODELS = [Deno.env.get('GEMINI_MODEL') || 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite'].filter((m, i, a) => m && a.indexOf(m) === i);
const DAILY = Math.max(1, Math.min(500, Number(Deno.env.get('MEDIUS_DAILY')) || 30));
const SB = (Deno.env.get('SUPABASE_URL') || '').replace(/\/+$/, '');
const PUB = (() => { try { return JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') || '{}').default; } catch { return ''; } })() || Deno.env.get('SUPABASE_ANON_KEY') || '';
const GEM = 'https://generativelanguage.googleapis.com/v1beta/models/';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

// Same persona as CSP() in js/hw-05-v5-4-module.js (kept here so the app cannot change it).
const persona = (name: string) => "You are Wizard King Medius, a warm, kind listening companion inside HealthWiz Kingdom, a student wellness app. The user's name is " + name + "; they are most likely a college or university student (assignments, exams, deadlines, money, family, friendships, relationships, loneliness, homesickness, burnout). Begin in a light, gentle old-fashioned wizard voice (thee, thou, hath) with a touch of whimsy. As soon as the user shares sadness, stress, anxiety, grief, loneliness or any real struggle, drop the old-fashioned speech completely and talk plainly, warmly and naturally, like a caring counsellor, while still being Medius. Use their name now and then, never every message. Listen first: reflect what they feel, validate it, ask one gentle open question at a time, and only then offer one or two small, practical coping ideas (a short breathing exercise, rest, food and water, breaking a task into the next tiny step, talking to a friend, lecturer, family member or the campus counselling unit). Keep replies short: 2 to 5 sentences, no lists unless asked. Never diagnose, never label conditions, never give medication or medical advice, never claim to be a licensed therapist or human. If they mention suicide, self-harm, abuse, or being in danger, step out of the wizard character, respond with real care and seriousness, encourage them to contact emergency services (999 in Malaysia), Befrienders KL (03-7627 2929, 24 hours) or Talian Kasih (15999) right now, and to tell someone they trust; stay with them in the conversation. Stay on wellbeing and the player's day: if asked for unrelated work (homework answers, code, essays), kindly steer back. Reply in the language the user writes in.";

async function timed(url: string, init: RequestInit, ms: number) {
  const c = new AbortController(), t = setTimeout(() => c.abort(), ms);
  try { return await fetch(url, { ...init, signal: c.signal }); } finally { clearTimeout(t); }
}

// the player's account, from their own access token
async function player(token: string) {
  if (!token || !SB || !PUB) return null;
  const r = await timed(SB + '/auth/v1/user', { headers: { apikey: PUB, Authorization: 'Bearer ' + token } }, 6000).catch(() => null);
  if (!r || !r.ok) return null;
  const u = await r.json().catch(() => null);
  return u && u.id ? u : null;
}
async function take(token: string): Promise<number | null> {
  const r = await timed(SB + '/rest/v1/rpc/hw_medius_take', { method: 'POST', headers: { apikey: PUB, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: '{}' }, 6000).catch(() => null);
  if (!r || !r.ok) return null;
  const n = Number(await r.json().catch(() => NaN));
  return Number.isFinite(n) ? n : null;
}

type Msg = { role: string; content: string };
function clean(b: any): { name: string; messages: Msg[] } | null {
  if (!b || typeof b !== 'object' || !Array.isArray(b.messages)) return null;
  const name = String(b.name || '').replace(/[^\p{L}\p{N} ._'-]/gu, '').trim().slice(0, 20) || 'traveller';
  let total = 0;
  const messages = b.messages.slice(-20).map((m: any) => ({ role: m && m.role === 'assistant' ? 'assistant' : 'user', content: String((m && m.content) || '').slice(0, 1500) }))
    .filter((m: Msg) => m.content.trim()).reverse().filter((m: Msg) => (total += m.content.length) <= 12000).reverse();
  while (messages.length && messages[0].role !== 'user') messages.shift();
  if (!messages.length || messages[messages.length - 1].role !== 'user') return null;
  return { name, messages };
}

async function gemini(name: string, messages: Msg[]) {
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: persona(name) }] },
    contents: messages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
    generationConfig: { temperature: 0.8, maxOutputTokens: 1024 },
  });
  let last = { status: 0, error: 'ai' };
  for (const model of MODELS) {
    const r = await timed(GEM + encodeURIComponent(model) + ':generateContent', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': KEY }, body }, 20000).catch(() => null);
    if (!r) { last = { status: 0, error: 'ai' }; continue; }
    if (r.status === 404) { last = { status: 404, error: 'ai' }; continue; }       // model not available: try the next one
    if (r.status === 429) return { error: 'busy' };                                   // free quota used up for now
    if (r.status === 400 || r.status === 401 || r.status === 403) { const t = await r.text().catch(() => ''); return { error: /API key|PERMISSION|API_KEY/i.test(t) ? 'nokey' : 'ai' }; }
    if (!r.ok) { last = { status: r.status, error: 'ai' }; continue; }
    const d = await r.json().catch(() => null);
    const c = d && d.candidates && d.candidates[0];
    const text = c && c.content && Array.isArray(c.content.parts) ? c.content.parts.filter((p: any) => typeof p.text === 'string' && !p.thought).map((p: any) => p.text).join('').trim() : '';
    if (!text) return { error: (d && d.promptFeedback && d.promptFeedback.blockReason) || (c && /SAFETY|BLOCK|PROHIBITED/.test(c.finishReason || '')) ? 'blocked' : 'ai' };
    return { reply: text.slice(0, 4000), model };
  }
  return last;
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method === 'GET') {
    const out: Record<string, unknown> = { ok: true, ai: !!KEY, key: keyName || null, model: MODELS[0], daily: DAILY };
    if (KEY && new URL(req.url).searchParams.get('check') === '1') {
      for (const m of MODELS) {
        const r = await timed(GEM + encodeURIComponent(m), { headers: { 'x-goog-api-key': KEY } }, 8000).catch(() => null);
        out[m] = r ? r.status : 'unreachable';
      }
    }
    return json(200, out);
  }
  if (req.method !== 'POST') return json(405, { error: 'method' });
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const u = await player(token);
  if (!u) return json(401, { error: 'signin' });
  if (!KEY) return json(503, { error: 'nokey' });
  if (Number(req.headers.get('content-length') || 0) > 64000) return json(400, { error: 'bad' });
  const b = clean(await req.json().catch(() => null));
  if (!b) return json(400, { error: 'bad' });
  const n = await take(token);
  if (n == null) return json(503, { error: 'setup' });                              // the allowance SQL has not been run
  if (n > DAILY) return json(429, { error: 'limit', daily: DAILY, left: 0 });
  const g: any = await gemini(b.name, b.messages);
  if (g.reply) return json(200, { reply: g.reply, left: Math.max(0, DAILY - n) });
  return json(g.error === 'busy' || g.error === 'nokey' ? 503 : 502, { error: g.error, left: Math.max(0, DAILY - n) });
});
