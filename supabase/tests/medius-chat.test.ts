// Unit tests for supabase/functions/medius-chat (run: deno test --no-lock --allow-env supabase/tests/medius-chat.test.ts).
// Deno.serve and fetch are stubbed: no network. A real ES256 key pair signs the players' tokens, and the stubbed
// Supabase serves its public key as the JWKS, so the signature check runs for real.
import { assert, assertEquals, assertMatch, assertStringIncludes } from 'jsr:@std/assert@1';

const SB = 'https://proj.supabase.co';
Deno.env.set('SUPABASE_URL', SB);
Deno.env.set('SUPABASE_ANON_KEY', 'anon-key');
Deno.env.set('GEMINI_API_KEY', 'gem-key');

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
type Call = { url: string; init?: RequestInit };
const calls: Call[] = []; const logs: string[] = [];
let take: () => Response = () => Response.json({ ok: true, hour: 1, day: 1 });
let gemini: () => Response = () => Response.json({ candidates: [{ content: { parts: [{ text: '[mood:smile] Well met!' }] }, finishReason: 'STOP' }] });
globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const url = String(input instanceof Request ? input.url : input); calls.push({ url, init });
  if (url === SB + '/auth/v1/.well-known/jwks.json') return Response.json({ keys: [jwk] });
  if (url === SB + '/rest/v1/rpc/medius_take') return take();
  if (url.startsWith('https://generativelanguage.googleapis.com/')) return gemini();
  return new Response('not found', { status: 404 });
}) as typeof fetch;
console.log = (...a: unknown[]) => { logs.push(a.map(String).join(' ')); };   // the function's log, checked below
let handler: (r: Request) => Promise<Response> | Response = () => new Response();
(Deno as any).serve = (h: typeof handler) => { handler = h; return { finished: Promise.resolve(), shutdown() {} }; };
await import('../functions/medius-chat/index.ts');

const ask = async (body: unknown, auth?: string) => {
  const r = await handler(new Request('https://proj.supabase.co/functions/v1/medius-chat', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: 'Bearer ' + auth } : {}) }, body: JSON.stringify(body) }));
  return { status: r.status, json: await r.json().catch(() => null), cors: r.headers.get('access-control-allow-origin') };
};
const MSGS = { name: 'Aina', messages: [{ role: 'user', content: 'I feel stressed about exams' }, { role: 'assistant', content: 'Tell me more.' }, { role: 'user', content: 'Finals are next week' }] };

Deno.test('CORS preflight answers without a token', async () => {
  const r = await handler(new Request(SB + '/functions/v1/medius-chat', { method: 'OPTIONS' }));
  assertEquals(r.status, 204); assertEquals(r.headers.get('access-control-allow-origin'), '*');
  assertStringIncludes(r.headers.get('access-control-allow-headers') || '', 'authorization');
});

Deno.test('only signed-in players: no token, a bad signature, an expired or anon token → 401, nothing sent to Gemini', async () => {
  calls.length = 0;
  for (const t of [undefined, 'nope', await token({ sub: 'u', role: 'authenticated', iss: SB + '/auth/v1', exp: Date.now() / 1000 + 60 }, other.privateKey),
    await token({ sub: 'u', role: 'authenticated', iss: SB + '/auth/v1', exp: Date.now() / 1000 - 5 }), await token({ role: 'anon', iss: SB + '/auth/v1', exp: Date.now() / 1000 + 60 })]) {
    const r = await ask(MSGS, t);
    assertEquals([r.status, r.json.error], [401, 'signin']);
  }
  assert(!calls.some(c => c.url.includes('generativelanguage')), 'Gemini is never called');
});

Deno.test('the same request as before: one model, the persona + mood rule, user/model roles, the generation settings, the key as a header', async () => {
  calls.length = 0; logs.length = 0;
  const r = await ask(MSGS, await good());
  assertEquals(r.status, 200); assertEquals(r.json, { reply: '[mood:smile] Well met!', help: false }); assertEquals(r.cors, '*');
  const g = calls.find(c => c.url.includes('generativelanguage'))!;
  assertMatch(g.url, /\/v1beta\/models\/gemini-3\.5-flash-lite:generateContent$/);
  assertEquals((g.init!.headers as Record<string, string>)['x-goog-api-key'], 'gem-key');
  const b = JSON.parse(String(g.init!.body));
  assertStringIncludes(b.systemInstruction.parts[0].text, "You are Wizard King Medius, a warm, kind listening companion inside HealthWiz Kingdom, a student wellness app. The user's name is Aina;");
  assertStringIncludes(b.systemInstruction.parts[0].text, '[mood:calm] [mood:smile] [mood:concerned] [mood:thinking] [mood:encourage] [mood:gesture] [mood:chuckle]');
  assertEquals(b.contents.map((c: any) => c.role), ['user', 'model', 'user']);
  assertEquals(b.contents[2].parts[0].text, 'Finals are next week');
  assertEquals(b.generationConfig, { temperature: 0.8, maxOutputTokens: 1024 });
  // the rate limit is asked with the player's own session, with the limits
  const t = calls.find(c => c.url.endsWith('/rpc/medius_take'))!;
  assertEquals(JSON.parse(String(t.init!.body)), { p_hour_max: 30, p_day_max: 100 });
  assertMatch((t.init!.headers as Record<string, string>).Authorization, /^Bearer ey/);
  // the log holds counts only, never words
  assert(logs.length >= 1); for (const l of logs) assert(!/exam|Finals|Aina|Well met/i.test(l), 'no message text in logs: ' + l);
});

Deno.test('limits: 429 with the window and seconds to wait; Gemini not called', async () => {
  calls.length = 0; take = () => Response.json({ ok: false, scope: 'hour', hour: 30, day: 42, retry: 1200 });
  const r = await ask(MSGS, await good());
  assertEquals([r.status, r.json], [429, { error: 'limit', scope: 'hour', retry: 1200 }]);
  assert(!calls.some(c => c.url.includes('generativelanguage')));
  take = () => Response.json({ ok: true, hour: 2, day: 2 });
});

Deno.test('blocked or empty replies: a gentle fallback that always carries the crisis numbers', async () => {
  for (const g of [() => Response.json({ promptFeedback: { blockReason: 'SAFETY' } }),
    () => Response.json({ candidates: [{ finishReason: 'SAFETY', content: { parts: [] } }] }),
    () => Response.json({ candidates: [{ content: { parts: [{ text: '  ' }] } }] })]) {
    gemini = g;
    const r = await ask(MSGS, await good());
    assertEquals(r.status, 200); assertEquals(r.json.help, true);
    assertMatch(r.json.reply, /^\[mood:concerned\][\s\S]*999[\s\S]*03-7627 2929[\s\S]*15999/);
  }
  gemini = () => Response.json({ candidates: [{ content: { parts: [{ text: '[mood:concerned] I am here with thee.' }] } }] });
});

Deno.test('crisis words in the message → help: true; Gemini busy / no key / bad requests are named', async () => {
  const r = await ask({ name: 'A', messages: [{ role: 'user', content: 'i want to die' }] }, await good());
  assertEquals([r.status, r.json.help], [200, true]);
  gemini = () => new Response('{}', { status: 429 });
  assertEquals((await ask(MSGS, await good())).json, { error: 'busy' });
  gemini = () => new Response('API key not valid', { status: 400 });
  assertEquals((await ask(MSGS, await good())).json, { error: 'nokey' });
  assertEquals((await ask({ name: 'A', messages: [] }, await good())).status, 400);
  assertEquals((await ask({ name: 'A', messages: [{ role: 'assistant', content: 'hi' }] }, await good())).status, 400, 'the last message must be the player\'s');
  take = () => new Response('{"code":"PGRST202"}', { status: 404 });
  assertEquals((await ask(MSGS, await good())).json, { error: 'setup' }, 'the limits SQL is missing');
});
