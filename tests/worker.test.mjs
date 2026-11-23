import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../docs/worker.js', import.meta.url), 'utf8');
const { default: worker } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const origin = 'http://localhost:8080';
const env = { BOT_TOKEN: 'test-token-not-a-credential', ALLOWED_ORIGINS: origin };
const session = '0123456789abcdef0123456789abcdef';
function request(path, options = {}) {
  return new Request(`https://worker.example${path}`, { ...options, headers: { Origin: origin, ...options.headers } });
}

test('rejects an untrusted origin before contacting Telegram', async () => {
  const response = await worker.fetch(request('/check?session=' + session, { headers: { Origin: 'https://evil.example' } }), env);
  assert.equal(response.status, 403);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), null);
});
test('fails closed if allowed origins were not configured', async () => {
  const response = await worker.fetch(request('/check?session=' + session), { BOT_TOKEN: env.BOT_TOKEN });
  assert.equal(response.status, 403);
});
test('preflight permits only the configured origin', async () => {
  const response = await worker.fetch(request('/check', { method: 'OPTIONS' }), env);
  assert.equal(response.status, 204);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), origin);
});
test('rejects a malformed session', async () => {
  const response = await worker.fetch(request('/check?session=x'), env);
  assert.equal(response.status, 400);
});
test('reports missing server configuration without exposing it', async () => {
  const response = await worker.fetch(request('/check?session=' + session), { ALLOWED_ORIGINS: origin });
  assert.equal(response.status, 503);
});
test('does not accept caller-supplied chat IDs and message text', async () => {
  const response = await worker.fetch(request('/send', { method: 'POST', body: JSON.stringify({ chat_id: 123, text: 'arbitrary content' }) }), env);
  assert.equal(response.status, 401);
});
test('malformed JSON is a client error', async () => {
  const response = await worker.fetch(request('/send', { method: 'POST', body: '{' }), env);
  assert.equal(response.status, 400);
});
test('connects only a matching private /start session, then authenticates fixed result messages', async () => {
  const originalFetch = globalThis.fetch;
  const sent = [];
  globalThis.fetch = async (url, options) => {
    if (String(url).endsWith('/getUpdates')) {
      return Response.json({ ok: true, result: [
        { update_id: 1, message: { text: '/start ' + session, chat: { id: 99, type: 'group' } } },
        { update_id: 2, message: { text: '/start other', chat: { id: 11, type: 'private' } } },
        { update_id: 3, message: { text: '/start ' + session, chat: { id: 42, type: 'private' } } },
      ] });
    }
    assert.ok(String(url).endsWith('/sendMessage'));
    sent.push(JSON.parse(options.body));
    return Response.json({ ok: true, result: { message_id: 1 } });
  };
  try {
    const response = await worker.fetch(request('/check?session=' + session), env);
    const data = await response.json();
    assert.equal(data.chat_id, 42);
    assert.equal(typeof data.receipt, 'string');
    const send = await worker.fetch(request('/send', { method: 'POST', body: JSON.stringify({ receipt: data.receipt, result: 'win', text: 'ignored' }) }), env);
    assert.equal(send.status, 200);
    assert.deepEqual(await send.json(), { ok: true });
    assert.deepEqual(sent, [{ chat_id: 42, text: 'You won Tic-Tac-Toe! Demo code: DEMO-WIN (no monetary value).' }]);
    const forged = await worker.fetch(request('/send', { method: 'POST', body: JSON.stringify({ receipt: data.receipt + 'x', result: 'win' }) }), env);
    assert.equal(forged.status, 401);
    for (const result of [['win'], { toString: 'win' }]) {
      const malformed = await worker.fetch(request('/send', { method: 'POST', body: JSON.stringify({ receipt: data.receipt, result }) }), env);
      assert.equal(malformed.status, 400);
    }
    const invalidResult = await worker.fetch(request('/send', { method: 'POST', body: JSON.stringify({ receipt: data.receipt, result: 'custom' }) }), env);
    assert.equal(invalidResult.status, 400);
  } finally { globalThis.fetch = originalFetch; }
});
test('an unmatched Telegram session stays pending', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ ok: true, result: [] });
  try {
    const response = await worker.fetch(request('/check?session=' + session), env);
    assert.deepEqual(await response.json(), { chat_id: null });
  } finally { globalThis.fetch = originalFetch; }
});
test('upstream failures are sanitized', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error(env.BOT_TOKEN); };
  try {
    const response = await worker.fetch(request('/check?session=' + session), env);
    assert.equal(response.status, 502);
    assert.deepEqual(await response.json(), { error: 'Telegram is temporarily unavailable' });
  } finally { globalThis.fetch = originalFetch; }
});
