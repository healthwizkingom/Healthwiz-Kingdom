// HealthWiz Kingdom: food search for Add More Food, through USDA FoodData Central. Called by js/v6-addfood.js.
//
// The FoodData Central API key lives only here, as the Edge Function secret FDC_API_KEY (a free data.gov key:
// https://fdc.nal.usda.gov/api-key-signup). The app never sees it. Signed-in players only: the platform checks the JWT
// (verify_jwt = true, supabase/config.toml) and this code checks it again (signature, expiry, role "authenticated").
// FoodData Central data is public domain (CC0 1.0); HealthWiz credits it as the source. Nutrient values from the API are
// per 100 g (Foundation, SR Legacy, Survey/FNDDS: per 100 g edible portion; Branded: per 100 g or 100 ml, converted by
// USDA from the label). Nothing is stored; the log holds counts and outcomes only, never the search words.
//
//   POST { q }      → 200 { foods: [{ id, name, type, brand, unit, per100: { kcal, p, c, f } }] }   (up to 12)
//   POST { id }     → 200 { food: { id, name, type, brand, unit, per100, portions: [{ label, g }], serving: { g, unit, text } | null } }
//   400 { error: 'bad' } · 401 { error: 'signin' } · 429 { error: 'limit', retry (s) } · 502 { error: 'db' } · 503 { error: 'busy' | 'nokey' }
//
// Deploy: supabase functions deploy food-search · Secret: supabase secrets set FDC_API_KEY=…

const FDC = 'https://api.nal.usda.gov/fdc/v1';
const TYPES = ['Foundation', 'SR Legacy', 'Survey (FNDDS)', 'Branded'];
const PER_HOUR = 60;                                              // searches per player per hour (this instance)

const KEY = (Deno.env.get('FDC_API_KEY') || '').trim();
const SB = (Deno.env.get('SUPABASE_URL') || '').replace(/\/+$/, '');
const PUB = (() => { try { return JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') || '{}').default; } catch { return ''; } })() || Deno.env.get('SUPABASE_ANON_KEY') || '';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const log = (o: Record<string, unknown>) => console.log(JSON.stringify({ food: 1, ...o }));   // counts and outcomes only

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

/* ---------- a simple per-player limit (per function instance) ---------- */
const uses = new Map<string, number[]>();
function allow(sub: string) {
  const now = Date.now(), L = (uses.get(sub) || []).filter(t => now - t < 3600e3);
  if (L.length >= PER_HOUR) return Math.ceil((L[0] + 3600e3 - now) / 1000);
  L.push(now); uses.set(sub, L); return 0;
}

/* ---------- FoodData Central → what the app needs ---------- */
const r1 = (v: number) => Math.round(v * 10) / 10;
// legacy nutrient numbers: 208 energy (kcal), 957 / 958 energy (Atwater, kcal) when 208 is missing, 203 protein, 204 fat, 205 carbohydrate
export function per100(list: any[]) {
  const by: Record<string, number> = {};
  for (const n of Array.isArray(list) ? list : []) {
    const num = String(n.nutrientNumber || n.number || (n.nutrient && n.nutrient.number) || '');
    const unit = String(n.unitName || (n.nutrient && n.nutrient.unitName) || '').toUpperCase();
    const v = Number(n.value ?? n.amount);
    if (!num || !isFinite(v)) continue;
    if ((num === '208' || num === '957' || num === '958') && unit && unit !== 'KCAL') continue;   // 268 is kJ
    if (by[num] == null) by[num] = v;
  }
  const kcal = by['208'] ?? by['958'] ?? by['957'];
  if (kcal == null) return null;
  return { kcal: r1(kcal), p: by['203'] != null ? r1(by['203']) : null, c: by['205'] != null ? r1(by['205']) : null, f: by['204'] != null ? r1(by['204']) : null };
}
const unitOf = (f: any) => /^(ml|mlt)$/i.test(String(f.servingSizeUnit || '')) ? 'ml' : 'g';
const typeOf = (t: string) => (TYPES.find(x => x.toLowerCase() === String(t || '').toLowerCase()) || String(t || ''));
export function portions(f: any) {
  const out: { label: string, g: number }[] = [];
  for (const p of Array.isArray(f.foodPortions) ? f.foodPortions : []) {
    const g = Number(p.gramWeight);
    if (!(g > 0)) continue;
    const mu = p.measureUnit && p.measureUnit.name && !/undetermined/i.test(p.measureUnit.name) ? p.measureUnit.name : '';
    const label = String(p.portionDescription && !/quantity not specified/i.test(p.portionDescription) ? p.portionDescription
      : [p.amount, mu, p.modifier].filter(x => x != null && x !== '').join(' ')).trim();
    if (label && !out.some(o => o.label === label)) out.push({ label: label.slice(0, 80), g: r1(g) });
  }
  return out.slice(0, 8);
}
export function serving(f: any) {
  const g = Number(f.servingSize);
  return g > 0 ? { g: r1(g), unit: unitOf(f), text: String(f.householdServingFullText || '').slice(0, 60) } : null;
}

async function fdc(path: string, init?: RequestInit) {
  const sep = path.includes('?') ? '&' : '?';
  const r = await timed(FDC + path + sep + 'api_key=' + encodeURIComponent(KEY), init || {}, 12000).catch(() => null);
  if (!r) return { error: 'db' };
  if (r.status === 429) return { error: 'busy' };
  if (r.status === 401 || r.status === 403) return { error: 'nokey' };
  if (!r.ok) return { error: 'db', status: r.status };
  const d = await r.json().catch(() => null);
  return d ? { d } : { error: 'db' };
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return json(405, { error: 'method' });
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const me = await player(token);
  if (!me) return json(401, { error: 'signin' });
  if (!KEY) { log({ out: 'nokey' }); return json(503, { error: 'nokey' }); }
  if (Number(req.headers.get('content-length') || 0) > 2000) return json(400, { error: 'bad' });
  const b: any = await req.json().catch(() => null);
  const q = b && typeof b.q === 'string' ? b.q.replace(/[^\p{L}\p{N} ,.'&()-]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 60) : '';
  const id = b && Number.isInteger(b.id) && b.id > 0 ? b.id : 0;
  if (!q && !id) return json(400, { error: 'bad' });
  const wait = allow(me.sub);
  if (wait) { log({ out: 'limit' }); return json(429, { error: 'limit', retry: wait }); }
  if (q) {
    const r: any = await fdc('/foods/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: q, dataType: TYPES, pageSize: 25 }) });
    if (r.error) { log({ out: r.error, status: r.status }); return json(r.error === 'busy' || r.error === 'nokey' ? 503 : 502, { error: r.error }); }
    const foods = (Array.isArray(r.d.foods) ? r.d.foods : []).map((f: any) => ({ id: f.fdcId, name: String(f.description || '').slice(0, 120), type: typeOf(f.dataType),
      brand: f.brandOwner || f.brandName ? String(f.brandOwner || f.brandName).slice(0, 60) : '', unit: f.dataType === 'Branded' ? unitOf(f) : 'g', per100: per100(f.foodNutrients) }))
      .filter((f: any) => Number.isInteger(f.id) && f.name && f.per100).slice(0, 12);
    log({ out: 'ok', kind: 'search', n: foods.length });
    return json(200, { foods });
  }
  const r: any = await fdc('/food/' + id);
  if (r.error) { log({ out: r.error, status: r.status }); return json(r.error === 'busy' || r.error === 'nokey' ? 503 : 502, { error: r.error }); }
  const f = r.d, p = per100(f.foodNutrients);
  if (!p) { log({ out: 'nonutrients' }); return json(502, { error: 'db' }); }
  const type = typeOf(f.dataType);
  log({ out: 'ok', kind: 'food' });
  return json(200, { food: { id: f.fdcId, name: String(f.description || '').slice(0, 120), type, brand: f.brandOwner ? String(f.brandOwner).slice(0, 60) : '',
    unit: type === 'Branded' ? unitOf(f) : 'g', per100: p, portions: portions(f), serving: type === 'Branded' ? serving(f) : null } });
});
