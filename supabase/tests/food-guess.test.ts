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
    { label: 'Coconut rice', g: 250, kcal: 450, p: 8, c: 70, f: 15, na: null, k: null, mg: null, trp: null, caf: null, nsrc: '', nm: '', src: 'MyFCD', basis: 'per 100 g: 180 kcal, x 250 g', chk: false },
    { label: 'Fried chicken (extra)', g: 120, kcal: 330, p: 25, c: 8, f: 22, na: null, k: null, mg: null, trp: null, caf: null, nsrc: '', nm: '', src: 'KFC Malaysia nutrition guide', basis: 'label: 330 kcal per piece', chk: false }]);
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
  assertEquals(r.json.result.items, [{ label: 'Roti canai', g: 3000, kcal: 600, p: 12, c: 80, f: 25, na: null, k: null, mg: null, trp: null, caf: null, nsrc: '', nm: '', src: '', basis: '', chk: false }]);
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

Deno.test('a model without search grounding (400) is asked again without it, and the result says it was not searched', async () => {
  firstStatus = 400; calls.length = 0;
  const r = await ask({ food: 'teh tarik' }, await good());
  assertEquals(r.status, 200);
  assertEquals(r.json.result.searched, false);
  const g = calls.filter(x => x.url.includes('generativelanguage'));
  assertEquals(g.length, 2);
  assertEquals(JSON.parse(g[1].init!.body as string).tools, undefined);
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

Deno.test('Luke searches the five nutrients himself and cites the best result: he is told never to ask, to use the closest food, and to say null rather than guess', async () => {
  calls.length = 0; logs.length = 0;
  reply = { kind: 'food', name: 'Teh O and rice', portion: '1 glass, 1 plate', note: 'Tea from a national table; rice from the brand-free table.', confidence: 'medium', items: [
    { label: 'Black tea with sugar', grams: 200, kcal: 40, protein: 0, carbs: 10, fat: 0, sodium_mg: 4, potassium_mg: 60, magnesium_mg: 4, tryptophan_mg: null, caffeine_mg: 38, nutrient_source: 'MyFCD, tea brewed (myfcd.moh.gov.my)', nutrient_match: 'SIMILAR', source: 'MyFCD', basis: 'per 100 g x 200 g' },
    { label: 'Plain rice', grams: 150, kcal: 195, protein: 4, carbs: 42, fat: 0.4, sodium_mg: 2, potassium_mg: 50, magnesium_mg: 18, tryptophan_mg: 46, caffeine_mg: 0, nutrient_source: 'MyFCD', nutrient_match: 'exact', source: 'MyFCD', basis: 'per 100 g x 150 g' },
    { label: 'Mystery sauce', grams: 30, kcal: 40, protein: 1, carbs: 8, fat: 0.5, sodium_mg: 900, potassium_mg: 40, magnesium_mg: 6, tryptophan_mg: 12, caffeine_mg: 5, nutrient_source: 'estimate', nutrient_match: 'exact', source: 'estimate', basis: 'my estimate' },
    { label: 'Odd values', grams: 100, kcal: 100, protein: 5, carbs: 12, fat: 3, sodium_mg: -5, potassium_mg: '70', magnesium_mg: 99999, tryptophan_mg: 99999, caffeine_mg: 'x', nutrient_source: 'A national table', nutrient_match: 'roughly', source: 'A national table', basis: 'x' }] };
  const r = await ask({ food: 'teh o and nasi putih' }, await good());
  assertEquals(r.status, 200);
  const sys = JSON.parse(calls.find(c => c.url.includes('generativelanguage'))!.init!.body as string).systemInstruction.parts[0].text as string;
  for (const w of ['sodium_mg, potassium_mg, magnesium_mg, tryptophan_mg and caffeine_mg', 'The player cannot know these numbers, so never ask for them: search for them yourself', 'Use the best result you can find',
    'the closest similar food', '"nutrient_source"', '"nutrient_match"', 'do not fill it with a guess, and do not write 0 unless a source says the amount is 0', 'Give caffeine_mg only for a part that has a caffeine source']) assert(sys.includes(w), 'the instructions say: ' + w);
  assert(!/usda|fooddata/i.test(sys), 'USDA is not named in the instructions');
  const it = r.json.result.items;
  // best result and match kept with the numbers (match is normalised; a caffeine of 0 is not a finding)
  assertEquals([it[0].na, it[0].k, it[0].mg, it[0].trp, it[0].caf, it[0].nsrc, it[0].nm], [4, 60, 4, null, 38, 'MyFCD, tea brewed (myfcd.moh.gov.my)', 'similar']);
  assertEquals([it[1].mg, it[1].trp, it[1].caf, it[1].nm], [18, 46, null, 'exact']);
  // a number with no citation is dropped, never shown
  assertEquals([it[2].na, it[2].k, it[2].mg, it[2].trp, it[2].caf, it[2].nsrc, it[2].nm], [null, null, null, null, null, '', '']);
  // bad values: negative or text-that-is-not-a-number is missing, numbers are clamped, an unknown match label is blank
  assertEquals([it[3].na, it[3].k, it[3].mg, it[3].trp, it[3].caf, it[3].nm], [null, 70, 2000, 5000, null, '']);
  assert(!JSON.stringify(r.json).includes('gem-test-key'));
});
