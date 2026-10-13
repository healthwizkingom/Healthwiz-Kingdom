// Unit tests for supabase/functions/food-search (run: deno test --no-lock --allow-env supabase/tests/food-search.test.ts).
// Deno.serve and fetch are stubbed: no network. A real ES256 key pair signs the players' tokens.
import { assert, assertEquals } from 'jsr:@std/assert@1';

const SB = 'https://proj.supabase.co';
Deno.env.set('SUPABASE_URL', SB);
Deno.env.set('SUPABASE_ANON_KEY', 'anon-key');
Deno.env.set('FDC_API_KEY', 'fdc-test-key');

const b64u = (b: Uint8Array | string) => btoa(typeof b === 'string' ? b : String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const jwk = { ...(await crypto.subtle.exportKey('jwk', kp.publicKey)), kid: 'k1', alg: 'ES256', use: 'sig' };
async function token(claims: Record<string, unknown>) {
  const h = b64u(JSON.stringify({ alg: 'ES256', typ: 'JWT', kid: 'k1' })), p = b64u(JSON.stringify(claims));
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, kp.privateKey, new TextEncoder().encode(h + '.' + p)));
  return h + '.' + p + '.' + b64u(sig);
}
const good = (sub = 'user-1') => token({ sub, role: 'authenticated', iss: SB + '/auth/v1', exp: Math.floor(Date.now() / 1000) + 3600 });

// FoodData Central as the API answers it (search: nutrientNumber/value; details: nutrient.number/amount, foodPortions)
const SEARCH = { foods: [
  { fdcId: 2512381, description: 'Rice, white, cooked, no added fat', dataType: 'Survey (FNDDS)', foodNutrients: [
    { nutrientNumber: '208', unitName: 'KCAL', value: 130 }, { nutrientNumber: '268', unitName: 'kJ', value: 544 }, { nutrientNumber: '203', unitName: 'G', value: 2.69 },
    { nutrientNumber: '205', unitName: 'G', value: 28.2 }, { nutrientNumber: '204', unitName: 'G', value: 0.28 }] },
  { fdcId: 999, description: 'No energy listed', dataType: 'Branded', foodNutrients: [{ nutrientNumber: '203', unitName: 'G', value: 1 }] },
  { fdcId: 2000001, description: 'MILO chocolate malt drink', dataType: 'Branded', brandOwner: 'Nestle', servingSizeUnit: 'MLT', foodNutrients: [
    { nutrientNumber: '208', unitName: 'KCAL', value: 79 }, { nutrientNumber: '203', unitName: 'G', value: 2.4 }] }] };
const FOOD = { fdcId: 2512381, description: 'Rice, white, cooked, no added fat', dataType: 'Survey (FNDDS)',
  foodNutrients: [{ nutrient: { number: '208', unitName: 'kcal' }, amount: 130 }, { nutrient: { number: '203', unitName: 'g' }, amount: 2.69 },
    { nutrient: { number: '205', unitName: 'g' }, amount: 28.2 }, { nutrient: { number: '204', unitName: 'g' }, amount: 0.28 }],
  foodPortions: [{ gramWeight: 158, amount: 1, portionDescription: '1 cup', measureUnit: { name: 'undetermined' } },
    { gramWeight: 0, portionDescription: 'broken' }, { gramWeight: 100, portionDescription: 'Quantity not specified', amount: 1, modifier: 'serving', measureUnit: { name: 'undetermined' } }] };
const calls: { url: string; init?: RequestInit }[] = [], logs: string[] = [];
let fdcStatus = 200;
globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const url = String(input instanceof Request ? input.url : input); calls.push({ url, init });
  if (url === SB + '/auth/v1/.well-known/jwks.json') return Response.json({ keys: [jwk] });
  if (url.startsWith('https://api.nal.usda.gov/fdc/v1/')) {
    if (fdcStatus !== 200) return new Response('{}', { status: fdcStatus });
    return Response.json(url.includes('/foods/search') ? SEARCH : FOOD);
  }
  return new Response('not found', { status: 404 });
}) as typeof fetch;
console.log = (...a: unknown[]) => { logs.push(a.map(String).join(' ')); };
let handler: (r: Request) => Promise<Response> | Response = () => new Response();
(Deno as any).serve = (h: typeof handler) => { handler = h; return { finished: Promise.resolve(), shutdown() {} }; };
const mod = await import('../functions/food-search/index.ts');
const ask = async (body: unknown, auth?: string) => {
  const r = await handler(new Request(SB + '/functions/v1/food-search', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: 'Bearer ' + auth } : {}) }, body: JSON.stringify(body) }));
  return { status: r.status, json: await r.json().catch(() => null) };
};

Deno.test('signed-in only: no token → 401 and FoodData Central is never called', async () => {
  calls.length = 0;
  const r = await ask({ q: 'rice' });
  assertEquals([r.status, r.json.error], [401, 'signin']);
  assert(!calls.some(c => c.url.includes('nal.usda.gov')));
});

Deno.test('search: the key stays on the server; per-100 g kcal and macros; foods without energy are dropped; kJ is not read as kcal', async () => {
  calls.length = 0;
  const r = await ask({ q: 'nasi <putih>' }, await good());
  assertEquals(r.status, 200);
  assertEquals(r.json.foods.length, 2);
  assertEquals(r.json.foods[0], { id: 2512381, name: 'Rice, white, cooked, no added fat', type: 'Survey (FNDDS)', brand: '', unit: 'g', per100: { kcal: 130, p: 2.7, c: 28.2, f: 0.3 } });
  assertEquals([r.json.foods[1].brand, r.json.foods[1].unit, r.json.foods[1].per100], ['Nestle', 'ml', { kcal: 79, p: 2.4, c: null, f: null }]);
  const c = calls.find(x => x.url.includes('/foods/search'))!;
  assert(c.url.includes('api_key=fdc-test-key'));
  assertEquals(JSON.parse(c.init!.body as string).query, 'nasi putih', 'the query is cleaned');
  assert(!JSON.stringify(r.json).includes('fdc-test-key'));
  assert(!logs.join('\n').includes('nasi'), 'search words are never logged');
});

Deno.test('details: household portions with their gram weights (unnamed and zero-weight ones skipped)', async () => {
  const r = await ask({ id: 2512381 }, await good());
  assertEquals(r.status, 200);
  assertEquals(r.json.food.portions, [{ label: '1 cup', g: 158 }, { label: '1 serving', g: 100 }]);
  assertEquals(r.json.food.serving, null);
  assertEquals(r.json.food.per100.kcal, 130);
});

Deno.test('helpers: a branded label serving; Atwater energy when 208 is missing', () => {
  assertEquals(mod.serving({ servingSize: 250, servingSizeUnit: 'MLT', householdServingFullText: '1 cup' }), { g: 250, unit: 'ml', text: '1 cup' });
  assertEquals(mod.per100([{ nutrient: { number: '958', unitName: 'kcal' }, amount: 52 }])!.kcal, 52);
  assertEquals(mod.per100([{ nutrientNumber: '208', unitName: 'kJ', value: 500 }]), null);
});

Deno.test('a bad body is 400; FoodData Central busy is 503 busy; a refused key is 503 nokey', async () => {
  assertEquals((await ask({}, await good())).status, 400);
  assertEquals((await ask({ id: -1 }, await good())).status, 400);
  fdcStatus = 429; const b = await ask({ q: 'rice' }, await good('user-2'));
  fdcStatus = 403; const k = await ask({ q: 'rice' }, await good('user-2'));
  fdcStatus = 200;
  assertEquals([b.status, b.json.error, k.status, k.json.error], [503, 'busy', 503, 'nokey']);
});

Deno.test('a per-player hourly limit (60), then 429 with the wait', async () => {
  let last = { status: 0, json: null as any };
  for (let i = 0; i < 61; i++) last = await ask({ q: 'egg' }, await good('heavy-user'));
  assertEquals([last.status, last.json.error], [429, 'limit']);
  assert(last.json.retry > 0);
});
