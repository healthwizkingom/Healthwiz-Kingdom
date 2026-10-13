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

let reply: unknown = { kind: 'ask', question: 'How much rice was on the plate?', options: ['Half a plate', 'One plate', 'A big plate'], multi: false };
let status = 200;
const calls: { url: string; init?: RequestInit }[] = [], logs: string[] = [];
globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const url = String(input instanceof Request ? input.url : input); calls.push({ url, init });
  if (url === SB + '/auth/v1/.well-known/jwks.json') return Response.json({ keys: [jwk] });
  if (url.startsWith('https://generativelanguage.googleapis.com/')) {
    if (status !== 200) return new Response(JSON.stringify({ error: { status: 'X', message: 'nope' } }), { status });
    return Response.json({ candidates: [{ content: { parts: [{ text: typeof reply === 'string' ? reply : JSON.stringify(reply) }] } }] });
  }
  return new Response('not found', { status: 404 });
}) as typeof fetch;
console.log = (...a: unknown[]) => { logs.push(a.map(String).join(' ')); };
let handler: (r: Request) => Promise<Response> | Response = () => new Response();
(Deno as any).serve = (h: typeof handler) => { handler = h; return { finished: Promise.resolve(), shutdown() {} }; };
const mod = await import('../functions/food-guess/index.ts');
const REF = [['rice', 'Rice, white, cooked, no added fat'], ['eggfried', 'Egg, whole, fried with oil']];
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

Deno.test('a question: the key stays on the server, the food and answers are sent, the words are never logged', async () => {
  calls.length = 0; logs.length = 0;
  const r = await ask({ food: 'nasi <kerabu>', answers: [{ q: 'Which toppings?', a: 'fried fish, salted egg' }], ref: REF }, await good());
  assertEquals(r.status, 200);
  assertEquals(r.json, { ask: { q: 'How much rice was on the plate?', options: ['Half a plate', 'One plate', 'A big plate'], multi: false } });
  const c = calls.find(x => x.url.includes('generativelanguage'))!;
  assertEquals((c.init!.headers as Record<string, string>)['x-goog-api-key'], 'gem-test-key');
  const sent = JSON.parse(c.init!.body as string);
  assert(sent.contents[0].parts[0].text.includes('The player ate: nasi kerabu'), 'angle brackets are cleaned');
  assert(sent.contents[0].parts[0].text.includes('Answer: fried fish, salted egg'));
  assert(sent.systemInstruction.parts[0].text.includes('rice = Rice, white, cooked, no added fat'));
  assertEquals(sent.generationConfig.responseMimeType, 'application/json');
  assert(!JSON.stringify(r.json).includes('gem-test-key'));
  assert(!logs.join('\n').includes('kerabu') && !logs.join('\n').includes('salted'), 'the player\'s words are never logged');
});

Deno.test('a guess: parts are checked (unknown reference keys dropped, numbers clamped, empty parts removed)', async () => {
  reply = '```json\n' + JSON.stringify({ kind: 'guess', name: 'Nasi kerabu', note: 'A canteen-size plate.', items: [
    { label: 'Blue rice', part: 'rice', grams: 200, kcal: 260, protein: 5, carbs: 57, fat: 0.6 },
    { label: 'Solok lada', part: 'madeup', grams: 60, kcal: 130, protein: 6, carbs: 5, fat: 9 },
    { label: 'Huge', part: '', grams: 99999, kcal: -5, protein: 1, carbs: 1, fat: 1 },
    { label: '', part: '', grams: 10, kcal: 10 }] }) + '\n```';
  const r = await ask({ food: 'nasi kerabu', ref: REF }, await good());
  assertEquals(r.status, 200);
  assertEquals(r.json.guess.items, [
    { label: 'Blue rice', part: 'rice', g: 200, kcal: 260, p: 5, c: 57, f: 0.6 },
    { label: 'Solok lada', part: '', g: 60, kcal: 130, p: 6, c: 5, f: 9 }]);
  assertEquals(r.json.guess.note, 'A canteen-size plate.');
});

Deno.test('after enough answers a question is not accepted: he must guess', async () => {
  reply = { kind: 'ask', question: 'One more?', options: ['a', 'b'] };
  const answers = Array.from({ length: 7 }, (_, i) => ({ q: 'q' + i, a: 'a' }));
  const r = await ask({ food: 'roti canai', answers }, await good());
  assertEquals([r.status, r.json.error], [502, 'ai']);
  const sent = JSON.parse(calls.at(-1)!.init!.body as string);
  assert(sent.contents[0].parts[0].text.includes('Answer now with kind "guess"'));
});

Deno.test('not a food → unknown; a bad body is 400; Gemini busy 503 busy; another Gemini error 502', async () => {
  reply = { kind: 'unknown' };
  assertEquals((await ask({ food: 'my homework' }, await good())).json, { unknown: true });
  assertEquals((await ask({}, await good())).status, 400);
  status = 429; const b = await ask({ food: 'teh tarik' }, await good('user-2'));
  status = 403; reply = ''; const k = await handler(new Request(SB + '/functions/v1/food-guess', { method: 'POST', headers: { Authorization: 'Bearer ' + await good('user-2') }, body: JSON.stringify({ food: 'x' }) }));
  status = 200;
  assertEquals([b.status, (b.json as any).error, k.status], [503, 'busy', 502]);
  assertEquals(mod.shape({ kind: 'ask', question: 'Q?', options: ['only one'] }, new Set(), false), null, 'a question needs two options');
});

Deno.test('a per-player hourly limit (120), then 429 with the wait', async () => {
  reply = { kind: 'unknown' };
  let last = { status: 0, json: null as any };
  for (let i = 0; i < 121; i++) last = await ask({ food: 'egg' }, await good('heavy-user'));
  assertEquals([last.status, last.json.error], [429, 'limit']);
  assert(last.json.retry > 0);
});
