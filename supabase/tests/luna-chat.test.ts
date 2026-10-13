// Unit tests for supabase/functions/luna-chat (run: deno test --no-lock --allow-env supabase/tests/luna-chat.test.ts).
// Deno.serve and fetch are stubbed: no network. A real ES256 key pair signs the players' tokens, and the stubbed
// Supabase serves its public key as the JWKS, so the signature check runs for real.
import { assert, assertEquals, assertStringIncludes } from 'jsr:@std/assert@1';

const SB = 'https://proj.supabase.co';
Deno.env.set('SUPABASE_URL', SB);
Deno.env.set('SUPABASE_ANON_KEY', 'anon-key');
Deno.env.set('XAI_API_KEY', 'xai-test-key');

const b64u = (b: Uint8Array | string) => btoa(typeof b === 'string' ? b : String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const jwk = { ...(await crypto.subtle.exportKey('jwk', kp.publicKey)), kid: 'k1', alg: 'ES256', use: 'sig' };
const other = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
async function token(claims: Record<string, unknown>, key = kp.privateKey) {
  const h = b64u(JSON.stringify({ alg: 'ES256', typ: 'JWT', kid: 'k1' })), p = b64u(JSON.stringify(claims));
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(h + '.' + p)));
  return h + '.' + p + '.' + b64u(sig);
}
const good = () => token({ sub: 'user-1', role: 'authenticated', iss: SB + '/auth/v1', exp: Math.floor(Date.now() / 1000) + 3600 });

// stubs
const calls: { url: string; init?: RequestInit }[] = [];
let take: () => Response = () => Response.json({ ok: true, hour: 1, day: 1 });
let xai: () => Response = () => Response.json({ output: [{ type: 'message', content: [{ type: 'output_text', text: 'Well met, traveller! Drink some water.' }] }] });
globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const url = String(input instanceof Request ? input.url : input); calls.push({ url, init });
  if (url === SB + '/auth/v1/.well-known/jwks.json') return Response.json({ keys: [jwk] });
  if (url === SB + '/rest/v1/rpc/medius_take') return take();
  if (url === 'https://api.x.ai/v1/responses') return xai();
  return new Response('not found', { status: 404 });
}) as typeof fetch;
const logs: string[] = [];
console.log = (...a: unknown[]) => { logs.push(a.map(String).join(' ')); };
let handler: (r: Request) => Promise<Response> | Response = () => new Response();
(Deno as any).serve = (h: typeof handler) => { handler = h; return { finished: Promise.resolve(), shutdown() {} }; };
await import('../functions/luna-chat/index.ts');

const ask = async (body: unknown, auth?: string) => {
  const r = await handler(new Request(SB + '/functions/v1/luna-chat', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: 'Bearer ' + auth } : {}) }, body: JSON.stringify(body) }));
  return { status: r.status, json: await r.json().catch(() => null), cors: r.headers.get('access-control-allow-origin') };
};
const MSGS = { name: 'Aina', messages: [{ role: 'user', content: 'I feel stressed about exams' }, { role: 'assistant', content: 'Tell me more.' }, { role: 'user', content: 'Finals are next week' }] };

Deno.test('CORS preflight answers without a token', async () => {
  const r = await handler(new Request(SB + '/functions/v1/luna-chat', { method: 'OPTIONS' }));
  assertEquals(r.status, 204); assertEquals(r.headers.get('access-control-allow-origin'), '*');
});

Deno.test('only signed-in players: no token, bad signature, expired or anon → 401, xAI never called', async () => {
  calls.length = 0;
  for (const t of [undefined, 'nope', await token({ sub: 'u', role: 'authenticated', iss: SB + '/auth/v1', exp: Date.now() / 1000 + 60 }, other.privateKey),
    await token({ sub: 'u', role: 'authenticated', iss: SB + '/auth/v1', exp: Date.now() / 1000 - 5 }), await token({ role: 'anon', iss: SB + '/auth/v1', exp: Date.now() / 1000 + 60 })]) {
    const r = await ask(MSGS, t);
    assertEquals([r.status, r.json.error], [401, 'signin']);
  }
  assert(!calls.some(c => c.url.includes('x.ai')), 'xAI is never called');
});

Deno.test('a signed-in player gets Luna\'s reply; the xAI call uses the key, the model and the persona', async () => {
  calls.length = 0;
  const r = await ask(MSGS, await good());
  assertEquals(r.status, 200);
  assertEquals(r.json, { reply: 'Well met, traveller! Drink some water.', help: false });
  assertEquals(r.cors, '*');
  const x = calls.find(c => c.url === 'https://api.x.ai/v1/responses')!;
  assertEquals((x.init!.headers as Record<string, string>).Authorization, 'Bearer xai-test-key');
  const sent = JSON.parse(x.init!.body as string);
  assertEquals(sent.model, 'grok-4.7');
  assertStringIncludes(sent.instructions, 'Luna');
  assertStringIncludes(sent.instructions, 'not a doctor');
  assertEquals(sent.input.length, 3);
  assertEquals(sent.input[2], { role: 'user', content: 'Finals are next week' });
});

Deno.test('the per-player limit is checked before xAI is called; a limit answers 429 with the retry time', async () => {
  calls.length = 0;
  take = () => Response.json({ ok: false, scope: 'hour', hour: 30, day: 30, retry: 1200 });
  const r = await ask(MSGS, await good());
  take = () => Response.json({ ok: true, hour: 1, day: 1 });
  assertEquals([r.status, r.json.error, r.json.scope, r.json.retry], [429, 'limit', 'hour', 1200]);
  assert(!calls.some(c => c.url.includes('x.ai')));
});

Deno.test('a crisis word always carries the help numbers', async () => {
  const r = await ask({ name: 'Aina', messages: [{ role: 'user', content: 'I want to die' }] }, await good());
  assertEquals(r.json.help, true);
});

Deno.test('an empty reply from xAI becomes the safe fallback with help numbers', async () => {
  xai = () => Response.json({ output: [] });
  const r = await ask(MSGS, await good());
  xai = () => Response.json({ output: [{ type: 'message', content: [{ type: 'output_text', text: 'Well met!' }] }] });
  assertEquals(r.status, 200);
  assertStringIncludes(r.json.reply, '999');
  assertEquals(r.json.help, true);
});

Deno.test('a missing or rejected key gives 503 nokey, never a leak of the key', async () => {
  xai = () => new Response('{"error":"bad key xai-test-key"}', { status: 401 });
  const r = await ask(MSGS, await good());
  xai = () => Response.json({ output: [{ type: 'message', content: [{ type: 'output_text', text: 'Well met!' }] }] });
  assertEquals([r.status, r.json.error], [503, 'nokey']);
  assert(!JSON.stringify(r.json).includes('xai-test-key'));
  assert(!logs.join('\n').includes('xai-test-key'), 'the key is never logged');
});

Deno.test('a bad body is 400, and the log holds counts only, never the messages', async () => {
  const r = await ask({ messages: [] }, await good());
  assertEquals(r.status, 400);
  await ask(MSGS, await good());
  const joined = logs.join('\n');
  assertStringIncludes(joined, '"luna":1');
  assert(!joined.includes('Finals are next week'), 'message text is never logged');
});
