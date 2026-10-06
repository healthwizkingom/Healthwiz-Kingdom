// HealthWiz Kingdom: Medius's AI counsel (the Wizard's Counsel). Called by js/v6-counsel.js with the player's session.
//
// The Gemini API key lives only here, as the Edge Function secret GEMINI_API_KEY. The app never sees it.
// Only signed-in players can call this: the platform checks the JWT (verify_jwt = true, supabase/config.toml), and this
// code checks it again (signature against the project's JWKS, expiry, role "authenticated") before anything else.
// Medius's persona and safety rules are set here, so the key cannot be used as a general chatbot.
// Messages go to Gemini and the reply comes back. Nothing is stored, and the log holds counts only, never text.
//
//   POST { name, messages: [{ role: 'user' | 'assistant', content }] }   Authorization: Bearer <player's access token>
//     200 { reply, help }            reply starts with Medius's hidden mood tag, e.g. "[mood:calm] …" (the app removes it)
//                                    help: true → the app shows the crisis help numbers (crisis words, blocked or empty reply)
//     400 { error: 'bad' } · 401 { error: 'signin' } · 429 { error: 'limit', scope: 'hour' | 'day', retry (s) }
//     502 { error: 'ai' } · 503 { error: 'busy' | 'nokey' | 'setup' }
//
// Deploy (needs supabase/migrations/20261007000200_medius_usage.sql): supabase functions deploy medius-chat
// Secret: supabase secrets set GEMINI_API_KEY=… (or Dashboard → Edge Functions → Secrets).

const MODEL = 'gemini-3.5-flash-lite';                            // the one place the model is named
const GENERATION = { temperature: 0.8, maxOutputTokens: 1024 };   // unchanged from the first Gemini version
const HOUR_LIMIT = 30, DAY_LIMIT = 100;                           // messages per player: per hour, per 24 hours
const GEMINI = 'https://generativelanguage.googleapis.com/v1beta/models/' + MODEL + ':generateContent';

const KEY = (Deno.env.get('GEMINI_API_KEY') || '').trim();
const SB = (Deno.env.get('SUPABASE_URL') || '').replace(/\/+$/, '');
const PUB = (() => { try { return JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') || '{}').default; } catch { return ''; } })() || Deno.env.get('SUPABASE_ANON_KEY') || '';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const log = (o: Record<string, unknown>) => console.log(JSON.stringify({ medius: 1, ...o }));   // counts and outcomes only

// Medius's persona: the Wizard's Counsel system prompt (CSP() in js/hw-05-v5-4-module.js) with the first Gemini
// version's line on staying on topic, plus the mood tag his reactions in the study follow (js/v6-counsel.js).
const persona = (name: string) => "You are Wizard King Medius, a warm, kind listening companion inside HealthWiz Kingdom, a student wellness app. The user's name is " + name + "; they are most likely a college or university student (assignments, exams, deadlines, money, family, friendships, relationships, loneliness, homesickness, burnout). Begin in a light, gentle old-fashioned wizard voice (thee, thou, hath) with a touch of whimsy. As soon as the user shares sadness, stress, anxiety, grief, loneliness or any real struggle, drop the old-fashioned speech completely and talk plainly, warmly and naturally, like a caring counsellor, while still being Medius. Use their name now and then, never every message. Listen first: reflect what they feel, validate it, ask one gentle open question at a time, and only then offer one or two small, practical coping ideas (a short breathing exercise, rest, food and water, breaking a task into the next tiny step, talking to a friend, lecturer, family member or the campus counselling unit). Keep replies short: 2 to 5 sentences, no lists unless asked. Never diagnose, never label conditions, never give medication or medical advice, never claim to be a licensed therapist or human. If they mention suicide, self-harm, abuse, or being in danger, step out of the wizard character, respond with real care and seriousness, encourage them to contact emergency services (999 in Malaysia), Befrienders KL (03-7627 2929, 24 hours) or Talian Kasih (15999) right now, and to tell someone they trust; stay with them in the conversation. Stay on wellbeing and the player's day: if asked for unrelated work (homework answers, code, essays), kindly steer back. Reply in the language the user writes in.";
export const MOOD_RULE = 'Start every reply with one hidden mood tag for how Medius looks while he says it, exactly one of: [mood:calm] [mood:smile] [mood:concerned] [mood:thinking] [mood:encourage] [mood:gesture] [mood:chuckle]. Nothing comes before the tag; the app hides it. calm: steady listening. smile: warm and glad. concerned: worried for them. thinking: pondering. encourage: cheering them on. gesture: offering an idea. chuckle: light fun. When the user is sad, struggling or mentions danger, abuse, self-harm or suicide, use only [mood:concerned] or [mood:calm], never a smile or a chuckle.';

// The same crisis words the app watches for (CRISIS in js/hw-05-v5-4-module.js): the reply then always carries the help numbers.
const CRISIS = /suicid|kill(ing)? myself|end (my|it all)|my life to end|self[- ]?harm|hurt(ing)? myself|cut(ting)? myself|want to die|wanna die|don'?t want to (live|be alive|exist)|better off dead|no reason to live|bunuh diri|nak mati|abuse[ds]? me|not safe at home/i;
const FALLBACK = '[mood:concerned] I could not find the right words for that just now, and I am sorry. What you are feeling matters. If things feel heavy, please reach out to a real person right away: Emergency 999 (Malaysia), Befrienders KL 03-7627 2929 (24 hours), Talian Kasih 15999, your campus counselling unit, or someone you trust.';

async function timed(url: string, init: RequestInit, ms: number) {
  const c = new AbortController(), t = setTimeout(() => c.abort(), ms);
  try { return await fetch(url, { ...init, signal: c.signal }); } finally { clearTimeout(t); }
}

/* ---------- the player's JWT ---------- */
const b64 = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), c => c.charCodeAt(0));
let jwks: { at: number, keys: any[] } | null = null;
async function keyFor(kid: string) {
  if (!jwks || Date.now() - jwks.at > 600e3 || !jwks.keys.some(k => k.kid === kid)) {
    const r = await timed(SB + '/auth/v1/.well-known/jwks.json', {}, 5000).catch(() => null);
    const j = r && r.ok ? await r.json().catch(() => null) : null;
    if (j && Array.isArray(j.keys)) jwks = { at: Date.now(), keys: j.keys };
  }
  return jwks && jwks.keys.find(k => k.kid === kid) || null;
}
/** The verified claims of a signed-in player's access token, or null. */
async function player(token: string): Promise<{ sub: string } | null> {
  const p = token.split('.');
  if (p.length !== 3 || !SB) return null;
  let h: any, c: any;
  try { h = JSON.parse(new TextDecoder().decode(b64(p[0]))); c = JSON.parse(new TextDecoder().decode(b64(p[1]))); } catch { return null; }
  if (!c || c.role !== 'authenticated' || typeof c.sub !== 'string' || !(c.exp * 1000 > Date.now())) return null;
  if (c.iss && c.iss !== SB + '/auth/v1') return null;
  if (h.alg === 'ES256' || h.alg === 'RS256') {
    const jwk = await keyFor(h.kid);
    if (!jwk) return null;
    const alg = h.alg === 'ES256' ? { name: 'ECDSA', namedCurve: 'P-256', hash: 'SHA-256' } : { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' };
    try {
      const k = await crypto.subtle.importKey('jwk', jwk, alg, false, ['verify']);
      const ok = await crypto.subtle.verify(alg, k, b64(p[2]), new TextEncoder().encode(p[0] + '.' + p[1]));
      return ok ? { sub: c.sub } : null;
    } catch { return null; }
  }
  // legacy HS256 project: ask Auth (the secret is not available here)
  const r = await timed(SB + '/auth/v1/user', { headers: { apikey: PUB, Authorization: 'Bearer ' + token } }, 6000).catch(() => null);
  const u = r && r.ok ? await r.json().catch(() => null) : null;
  return u && u.id === c.sub ? { sub: c.sub } : null;
}

/* ---------- message limits (counts only, supabase/migrations/20261007000200_medius_usage.sql) ---------- */
async function take(token: string): Promise<any> {
  const r = await timed(SB + '/rest/v1/rpc/medius_take', { method: 'POST', headers: { apikey: PUB, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_hour_max: HOUR_LIMIT, p_day_max: DAY_LIMIT }) }, 6000).catch(() => null);
  if (!r) return null;
  if (r.status === 401 || r.status === 403) return { auth: 1 };
  if (!r.ok) return null;
  return await r.json().catch(() => null);
}

/* ---------- the request ---------- */
type Msg = { role: 'user' | 'assistant'; content: string };
function clean(b: any): { name: string; messages: Msg[] } | null {
  if (!b || typeof b !== 'object' || !Array.isArray(b.messages)) return null;
  const name = String(b.name || '').replace(/[^\p{L}\p{N} ._'-]/gu, '').trim().slice(0, 20) || 'traveller';
  let total = 0;
  const messages: Msg[] = b.messages.slice(-30).map((m: any) => ({ role: m && m.role === 'assistant' ? 'assistant' : 'user', content: String((m && m.content) || '').slice(0, 1500) }))
    .filter((m: Msg) => m.content.trim()).reverse().filter((m: Msg) => (total += m.content.length) <= 12000).reverse();
  while (messages.length && messages[0].role !== 'user') messages.shift();
  if (!messages.length || messages[messages.length - 1].role !== 'user') return null;
  return { name, messages };
}

async function gemini(name: string, messages: Msg[]) {
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: persona(name) + ' ' + MOOD_RULE }] },
    contents: messages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
    generationConfig: GENERATION,
  });
  const r = await timed(GEMINI, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': KEY }, body }, 25000).catch(() => null);
  if (!r) return { error: 'ai' };
  if (r.status === 429) return { error: 'busy' };                                   // Gemini's free quota, for now
  if (r.status === 400 || r.status === 401 || r.status === 403) { const t = await r.text().catch(() => ''); return { error: /API key|API_KEY|PERMISSION/i.test(t) ? 'nokey' : 'ai' }; }
  if (!r.ok) return { error: 'ai' };
  const d = await r.json().catch(() => null);
  const c = d && d.candidates && d.candidates[0];
  const text = c && c.content && Array.isArray(c.content.parts) ? c.content.parts.filter((p: any) => typeof p.text === 'string' && !p.thought).map((p: any) => p.text).join('').trim() : '';
  const blocked = !!(d && d.promptFeedback && d.promptFeedback.blockReason) || /SAFETY|BLOCKLIST|PROHIBITED|SPII/.test((c && c.finishReason) || '');
  if (blocked || !text) return { reply: FALLBACK, blocked: true };
  return { reply: text.slice(0, 4000) };
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return json(405, { error: 'method' });
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const me = await player(token);
  if (!me) return json(401, { error: 'signin' });
  if (!KEY) { log({ out: 'nokey' }); return json(503, { error: 'nokey' }); }
  if (Number(req.headers.get('content-length') || 0) > 64000) return json(400, { error: 'bad' });
  const b = clean(await req.json().catch(() => null));
  if (!b) return json(400, { error: 'bad' });
  const n = await take(token);
  if (n && n.auth) return json(401, { error: 'signin' });
  if (!n) { log({ out: 'setup' }); return json(503, { error: 'setup' }); }   // the limits SQL has not been run
  if (!n.ok) { log({ out: 'limit', scope: n.scope, hour: n.hour, day: n.day }); return json(429, { error: 'limit', scope: n.scope, retry: n.retry }); }
  const crisis = CRISIS.test(b.messages[b.messages.length - 1].content);
  const g: any = await gemini(b.name, b.messages);
  log({ out: g.reply ? (g.blocked ? 'fallback' : 'ok') : g.error, hour: n.hour, day: n.day });
  if (g.reply) return json(200, { reply: g.reply, help: crisis || !!g.blocked });
  return json(g.error === 'busy' || g.error === 'nokey' ? 503 : 502, { error: g.error });
});
