// Unit tests for supabase/functions/food-guess (run: deno test --no-lock --allow-env supabase/tests/food-guess.test.ts).
// Deno.serve and fetch are stubbed: no network. A real ES256 key pair signs the players' tokens.
import { assert, assertEquals } from 'jsr:@std/assert@1';

const SB = 'https://proj.supabase.co';
Deno.env.set('SUPABASE_URL', SB);
Deno.env.set('SUPABASE_ANON_KEY', 'anon-key');
Deno.env.set('GEMINI_API_KEY', 'gem-test-key');

const b64u = (b: Uint8Array | string) => btoa(typeof b === 'string' ? b : String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const jwk = { ...(await crypto.subtle.exportKey('jwk', kp.publicKey)), kid: 'k1', alg: 'ES256', use: 'sig' };
async function token(claims: Record<string, unknown>) {
  const h = b64u(JSON.stringify({ alg: 'ES256', typ: 'JWT', kid: 'k1' })), p = b64u(JSON.stringify(claims));
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, kp.privateKey, new TextEncoder().encode(h + '.' + p)));
  return h + '.' + p + '.' + b64u(sig);
}
const good = (sub = 'user-1') => token({ sub, role: 'authenticated', iss: SB + '/auth/v1', exp: Math.floor(Date.now() / 1000) + 3600 });

let reply: unknown = { kind: 'food', name: 'Nasi lemak', portion: 'one big plate', note: 'MyFCD values for coconut rice; extra chicken added, no sambal.', confidence: 'medium',
  items: [{ label: 'Coconut rice', grams: 250, kcal: 450, protein: 8, carbs: 70, fat: 15, source: 'MyFCD', basis: 'per 100 g: 180 kcal, x 250 g' },
    { label: 'Fried chicken (extra)', grams: 120, kcal: 330, protein: 25, carbs: 8, fat: 22, source: 'KFC Malaysia nutrition guide', basis: 'label: 330 kcal per piece' }] };
let status = 200, firstStatus = 0, grounding: unknown = { groundingChunks: [{ web: { uri: 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/abc', title: 'myfcd.moh.gov.my' } },
  { web: { uri: 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/abc', title: 'dup' } }, { web: { uri: 'javascript:alert(1)', title: 'bad' } }],
  searchEntryPoint: { renderedContent: '<div class="chips">nasi lemak calories</div>' } };
const calls: { url: string; init?: RequestInit }[] = [], logs: string[] = [];
globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const url = String(input instanceof Request ? input.url : input); calls.push({ url, init });
  if (url === SB + '/auth/v1/.well-known/jwks.json') return Response.json({ keys: [jwk] });
  if (url.startsWith('https://generativelanguage.googleapis.com/')) {
    if (firstStatus) { const st = firstStatus; firstStatus = 0; return new Response(JSON.stringify({ error: { status: 'INVALID_ARGUMENT', message: 'tool not supported' } }), { status: st }); }
    if (status !== 200) return new Response(JSON.stringify({ error: { status: 'X', message: 'nope' } }), { status });
    return Response.json({ candidates: [{ content: { parts: [{ text: typeof reply === 'string' ? reply : JSON.stringify(reply) }] }, groundingMetadata: grounding }] });
  }
  return new Response('not found', { status: 404 });
}) as typeof fetch;
console.log = (...a: unknown[]) => { logs.push(a.map(String).join(' ')); };
let handler: (r: Request) => Promise<Response> | Response = () => new Response();
(Deno as any).serve = (h: typeof handler) => { handler = h; return { finished: Promise.resolve(), shutdown() {} }; };
const mod = await import('../functions/food-guess/index.ts');
const ask = async (body: unknown, auth?: string) => {
  const r = await handler(new Request(SB + '/functions/v1/food-guess', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: 'Bearer ' + auth } : {}) }, body: JSON.stringify(body) }));
  return { status: r.status, json: await r.json().catch(() => null) };
};

Deno.test('signed-in only: no token → 401 and Gemini is never called', async () => {
  calls.length = 0;
  const r = await ask({ food: 'nasi kerabu' });
  assertEquals([r.status, r.json.error], [401, 'signin']);
  assert(!calls.some(c => c.url.includes('generativelanguage')));
});

Deno.test('a search: Google Search grounding is on, the key stays on the server, the parts and the sources come back, the words are never logged', async () => {
  calls.length = 0; logs.length = 0;
  const r = await ask({ food: 'nasi lemak <big plate>, extra ayam goreng, no sambal' }, await good());
  assertEquals(r.status, 200);
  assertEquals(r.json.result.items, [
    { label: 'Coconut rice', g: 250, kcal: 450, p: 8, c: 70, f: 15, src: 'MyFCD', basis: 'per 100 g: 180 kcal, x 250 g', chk: false },
    { label: 'Fried chicken (extra)', g: 120, kcal: 330, p: 25, c: 8, f: 22, src: 'KFC Malaysia nutrition guide', basis: 'label: 330 kcal per piece', chk: false }]);
  assertEquals([r.json.result.name, r.json.result.portion, r.json.result.confidence, r.json.result.searched], ['Nasi lemak', 'one big plate', 'medium', true]);
  assertEquals(r.json.result.sources, [{ title: 'myfcd.moh.gov.my', url: 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/abc' }], 'deduplicated, https only');
  assertEquals(r.json.result.suggest, '<div class="chips">nasi lemak calories</div>');
  const c = calls.find(x => x.url.includes('generativelanguage'))!;
  assertEquals((c.init!.headers as Record<string, string>)['x-goog-api-key'], 'gem-test-key');
  const sent = JSON.parse(c.init!.body as string);
  assertEquals(sent.tools, [{ google_search: {} }]);
  assert(sent.contents[0].parts[0].text.includes('The player ate: nasi lemak big plate , extra ayam goreng, no sambal'), 'angle brackets are cleaned');
  const sys = sent.systemInstruction.parts[0].text;
  assert(sys.includes('Apply every change the player typed') && sys.includes('Never invent a source'));
  assert(!/usda/i.test(sys), 'USDA is not named in the instructions');
  assert(!JSON.stringify(r.json).includes('gem-test-key'));
  assert(!logs.join('\n').includes('lemak') && !logs.join('\n').includes('sambal'), 'the player\'s words are never logged');
});

Deno.test('the answer is checked: JSON inside a fence is found; bad parts are dropped; weights are clamped; "estimate" is no source', async () => {
  reply = 'Here you go:\n```json\n' + JSON.stringify({ kind: 'food', name: 'Roti canai', portion: '2 pieces', note: '', confidence: 'sure!', items: [
    { label: 'Roti canai', grams: 99999, kcal: 600, protein: 12, carbs: 80, fat: 25, source: 'estimate', basis: '' }, { label: 'Dal', grams: 50, kcal: -5 }, { label: '', grams: 10, kcal: 10 }] }) + '\n```';
  const r = await ask({ food: 'roti canai 2' }, await good());
  assertEquals(r.status, 200);
  assertEquals(r.json.result.items, [{ label: 'Roti canai', g: 3000, kcal: 600, p: 12, c: 80, f: 25, src: '', basis: '', chk: false }]);
  assertEquals(r.json.result.confidence, 'low', 'an unsourced answer never reads as sure');
  assertEquals(mod.parse('no json here'), null);
});

Deno.test('the calories are checked against the macros: 4 x protein + 4 x carbohydrate + 9 x fat', async () => {
  // 8 g protein + 70 g carbohydrate + 15 g fat = 32 + 280 + 135 = 447 kcal: 450 is fine, 900 is flagged
  assertEquals([mod.atwaterOff(450, 8, 70, 15), mod.atwaterOff(900, 8, 70, 15), mod.atwaterOff(60, 8, 70, 15)], [false, true, true]);
  assertEquals([mod.atwaterOff(120, 5, 20, 2), mod.atwaterOff(null, 1, 1, 1), mod.atwaterOff(100, null, 1, 1)], [false, false, false], 'a small gap, or a missing macro, is not flagged');
  reply = { kind: 'food', name: 'X', portion: 'p', confidence: 'high', items: [{ label: 'Rice', grams: 200, kcal: 900, protein: 8, carbs: 70, fat: 15, source: 'MyFCD', basis: 'x' }] };
  const r = await ask({ food: 'rice' }, await good());
  assertEquals([r.json.result.items[0].chk, r.json.result.confidence], [true, 'low']);
});

Deno.test('with the search on but no web page found, the answer is not "sure"', async () => {
  reply = { kind: 'food', name: 'X', portion: 'p', confidence: 'high', items: [{ label: 'Rice', grams: 200, kcal: 447, protein: 8, carbs: 70, fat: 15, source: 'MyFCD', basis: 'x' }] };
  const saved = grounding; grounding = {};
  const r = await ask({ food: 'rice' }, await good());
  grounding = saved;
  assertEquals([r.json.result.sources, r.json.result.confidence], [[], 'low']);
});

Deno.test('a model or key that cannot use the search tool (400, or 429 for its quota) is asked again without it, the result says it was not searched, and the reason is logged', async () => {
  firstStatus = 429; logs.length = 0; calls.length = 0;
  const r = await ask({ food: 'teh tarik' }, await good());
  assertEquals(r.status, 200);
  assertEquals(r.json.result.searched, false);
  const g = calls.filter(x => x.url.includes('generativelanguage'));
  assertEquals(g.length, 2);
  assertEquals(JSON.parse(g[1].init!.body as string).tools, undefined);
  assert(logs.join('\n').includes('"first":"429 INVALID_ARGUMENT tool not supported"'), 'the reason is logged: ' + logs.join('|'));
  assert(!logs.join('\n').includes('teh tarik'), 'the words are never logged');
  // both calls refused for quota: busy, with both reasons logged
  status = 429; firstStatus = 429; logs.length = 0;
  const b = await ask({ food: 'teh tarik' }, await good('user-9'));
  status = 200;
  assertEquals([b.status, b.json.error], [503, 'busy']);
  assert(logs.join('\n').includes('"status":429') && logs.join('\n').includes('"first":"429'));
});

Deno.test('not a food → unknown; a bad body is 400; Gemini busy 503 busy; another Gemini error 502', async () => {
  reply = { kind: 'unknown' };
  assertEquals((await ask({ food: 'my homework' }, await good())).json, { unknown: true });
  assertEquals((await ask({}, await good())).status, 400);
  status = 429; const b = await ask({ food: 'teh tarik' }, await good('user-2'));
  status = 500; const k = await ask({ food: 'x' }, await good('user-2'));
  status = 200;
  assertEquals([b.status, b.json.error, k.status, k.json.error], [503, 'busy', 502, 'ai']);
});

Deno.test('a per-player hourly limit (40), then 429 with the wait', async () => {
  reply = { kind: 'unknown' };
  let last = { status: 0, json: null as any };
  for (let i = 0; i < 41; i++) last = await ask({ food: 'egg' }, await good('heavy-user'));
  assertEquals([last.status, last.json.error], [429, 'limit']);
  assert(last.json.retry > 0);
});
