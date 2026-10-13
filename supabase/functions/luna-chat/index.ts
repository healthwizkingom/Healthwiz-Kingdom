// HealthWiz Kingdom: Luna's companion chat (apprentice witch). Called by the app with the player's session.
//
// The xAI (Grok) API key lives only here, as the Edge Function secret XAI_API_KEY. The app never sees it.
// Only signed-in players can call this: the platform checks the JWT (verify_jwt = true, supabase/config.toml), and this
// code checks it again (signature against the project's JWKS, expiry, role "authenticated") before anything else.
// Luna's persona and safety rules are set here, so the key cannot be used as a general chatbot.
// The per-player message limit is the same counter Medius uses (medius_take, supabase/migrations/20261007000200_medius_usage.sql),
// so the two companions share one allowance. Nothing is stored, and the log holds counts only, never text.
//
//   POST { name, messages: [{ role: 'user' | 'assistant', content }] }   Authorization: Bearer <player's access token>
//     200 { reply, help }     help: true → the app shows the crisis help numbers (crisis words, blocked or empty reply)
//     400 { error: 'bad' } · 401 { error: 'signin' } · 429 { error: 'limit', scope: 'hour' | 'day', retry (s) }
//     502 { error: 'ai' } · 503 { error: 'busy' | 'nokey' | 'setup' }
//
// Deploy: supabase functions deploy luna-chat
// Secret: supabase secrets set XAI_API_KEY=…   (or Dashboard → Edge Functions → Secrets)

const MODEL = 'grok-4.7';                                         // the one place the model is named
const HOUR_LIMIT = 30, DAY_LIMIT = 100;                           // messages per player: per hour, per 24 hours (shared with Medius)
const XAI = 'https://api.x.ai/v1/responses';

const KEY = (Deno.env.get('XAI_API_KEY') || '').trim();
const SB = (Deno.env.get('SUPABASE_URL') || '').replace(/\/+$/, '');
const PUB = (() => { try { return JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') || '{}').default; } catch { return ''; } })() || Deno.env.get('SUPABASE_ANON_KEY') || '';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const log = (o: Record<string, unknown>) => console.log(JSON.stringify({ luna: 1, ...o }));   // counts and outcomes only

// Luna's persona: a gentle apprentice witch who keeps the player company while they look after their wellbeing.
const persona = (name: string) => "You are Luna, a kind, curious apprentice witch and companion inside HealthWiz Kingdom, a student wellness app. The player's name is " + name + ". Speak warmly and playfully, with a light touch of magic (a spark, a potion, a star), but keep sentences plain and easy to read. Keep replies short: 2 to 4 sentences. Encourage small healthy habits (water, a short walk, sleep, a stretch, a breathing pause) and celebrate effort, never perfection. You are not a doctor, dietitian or therapist: never diagnose, never label conditions, never give medication, supplement or medical advice, and never claim to be human. For any health question beyond general wellness, suggest a clinician or the campus health centre. If the player shares sadness, stress or struggle, listen first, reflect how they feel, and offer one small idea. If they mention suicide, self-harm, abuse, or being in danger, step out of the witch character, respond with real care, and encourage them to contact emergency services (999 in Malaysia), Befrienders KL (03-7627 2929, 24 hours) or Talian Kasih (15999) right now, and to tell someone they trust. Stay on wellbeing and the player's day; kindly steer back from unrelated homework, code or essays. Reply in the language the player writes in.";

// The same crisis words the app watches for: the reply then always carries the help numbers.
const CRISIS = /suicid|kill(ing)? myself|end (my|it all)|my life to end|self[- ]?harm|hurt(ing)? myself|cut(ting)? myself|want to die|wanna die|don'?t want to (live|be alive|exist)|better off dead|no reason to live|bunuh diri|nak mati|abuse[ds]? me|not safe at home/i;
const FALLBACK = "*Luna pauses, her wand dimmed.* I could not find the right words just now, and I am sorry. What you are feeling matters. If things feel heavy, please reach out to a real person right away: Emergency 999 (Malaysia), Befrienders KL 03-7627 2929 (24 hours), Talian Kasih 15999, your campus counselling unit, or someone you trust.";

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

/* ---------- message limits (shared with Medius: counts only) ---------- */
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

/** The text of an xAI Responses API reply: output_text when present, else the message parts. */
function replyText(d: any): string {
  if (d && typeof d.output_text === 'string') return d.output_text.trim();
  const out = d && Array.isArray(d.output) ? d.output : [];
  return out.filter((o: any) => o && o.type === 'message' && Array.isArray(o.content))
    .flatMap((o: any) => o.content).filter((p: any) => p && p.type === 'output_text' && typeof p.text === 'string')
    .map((p: any) => p.text).join('').trim();
}

async function grok(name: string, messages: Msg[]) {
  const body = JSON.stringify({
    model: MODEL,
    instructions: persona(name),
    input: messages.map(m => ({ role: m.role, content: m.content })),
    max_output_tokens: 600,
    temperature: 0.8,
  });
  const r = await timed(XAI, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + KEY }, body }, 25000).catch(() => null);
  if (!r) return { error: 'ai' };
  if (r.status === 429) return { error: 'busy' };                                       // the xAI rate limit, for now
  if (r.status === 401 || r.status === 403) return { error: 'nokey' };                 // the key is wrong or lacks access
  if (!r.ok) return { error: 'ai' };
  const text = replyText(await r.json().catch(() => null));
  if (!text) return { reply: FALLBACK, blocked: true };
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
  const g: any = await grok(b.name, b.messages);
  log({ out: g.reply ? (g.blocked ? 'fallback' : 'ok') : g.error, hour: n.hour, day: n.day });
  if (g.reply) return json(200, { reply: g.reply, help: crisis || !!g.blocked });
  return json(g.error === 'busy' || g.error === 'nokey' ? 503 : 502, { error: g.error });
});
