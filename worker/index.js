/**
 * Optional Telegram adapter for the static game.
 *
 * Secrets (Worker secrets, never the frontend):
 * - BOT_TOKEN: Telegram Bot API token.
 * - RECEIPT_SECRET: HMAC key for session receipts, independent of the bot token.
 */
/**
 * @typedef {{ BOT_TOKEN?: string, RECEIPT_SECRET?: string, ALLOWED_ORIGINS?: string }} Env
 * @typedef {{ chat_id: number, session: string, expires: number }} Identity
 * @typedef {keyof typeof MESSAGES} GameResult
 */

const SESSION_PATTERN = /^[a-f0-9]{32}$/;
const RECEIPT_TTL_SECONDS = 600;
const MESSAGES = Object.freeze({
  win: 'You won Tic-Tac-Toe! Demo code: DEMO-WIN (no monetary value).',
  loss: 'The computer won Tic-Tac-Toe. Try another round!',
});

export default {
  /**
   * @param {Request} request
   * @param {Env} env
   * @returns {Promise<Response>}
   */
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean);
    if (!origin || !allowed.includes(origin)) {
      return json({ error: 'Origin is not allowed' }, 403);
    }
    const headers = {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      Vary: 'Origin',
    };
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    const url = new URL(request.url);
    const check = url.pathname === '/check' && request.method === 'GET';
    const send = url.pathname === '/send' && request.method === 'POST';
    if (!check && !send) return json({ error: 'Not found' }, 404, headers);
    const { BOT_TOKEN: botToken, RECEIPT_SECRET: receiptSecret } = env;
    if (!botToken || !receiptSecret) {
      return json({ error: 'Telegram integration is not configured' }, 503, headers);
    }

    try {
      if (check) {
        const session = url.searchParams.get('session') || '';
        if (!SESSION_PATTERN.test(session)) return json({ error: 'Invalid session' }, 400, headers);
        const data = await telegram(botToken, 'getUpdates', { timeout: 0, allowed_updates: ['message'], limit: 100 });
        for (const update of [...(data.result || [])].reverse()) {
          const message = update.message;
          if (message?.chat?.type !== 'private' || !Number.isSafeInteger(message.chat.id)) continue;
          if (message.text !== `/start ${session}`) continue;
          const receipt = await signReceipt(receiptSecret, {
            chat_id: message.chat.id,
            session,
            expires: Math.floor(Date.now() / 1000) + RECEIPT_TTL_SECONDS,
          });
          return json({ chat_id: message.chat.id, receipt }, 200, headers);
        }
        return json({ chat_id: null }, 200, headers);
      }

      /** @type {{ receipt?: unknown, result?: unknown } | null} */
      let body;
      try { body = await request.json(); }
      catch { return json({ error: 'Invalid JSON' }, 400, headers); }
      if (!body || typeof body !== 'object') return json({ error: 'Invalid request' }, 400, headers);
      const identity = await verifyReceipt(receiptSecret, body.receipt);
      if (!identity) return json({ error: 'A valid Telegram session is required' }, 401, headers);
      if (!isGameResult(body.result)) return json({ error: 'Invalid game result' }, 400, headers);
      await telegram(botToken, 'sendMessage', { chat_id: identity.chat_id, text: MESSAGES[body.result] });
      return json({ ok: true }, 200, headers);
    } catch {
      // Do not return upstream exceptions: request URLs contain the bot credential.
      return json({ error: 'Telegram is temporarily unavailable' }, 502, headers);
    }
  },
};

/**
 * @param {unknown} value
 * @returns {value is GameResult}
 */
function isGameResult(value) {
  return typeof value === 'string' && Object.hasOwn(MESSAGES, value);
}

/**
 * @param {string} botToken
 * @param {string} method Telegram Bot API method
 * @param {object} body
 * @returns {Promise<{ result?: any[] }>}
 */
async function telegram(botToken, method, body) {
  const response = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  });
  /** @type {{ ok?: boolean, result?: any[] }} */
  const data = await response.json();
  if (!response.ok || !data.ok) throw new Error('Telegram request failed');
  return data;
}

/** @param {string} secret */
async function receiptKey(secret) {
  return crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

/**
 * @param {string} secret
 * @param {Identity} identity
 */
async function signReceipt(secret, identity) {
  const payload = btoa(JSON.stringify(identity));
  const signature = await crypto.subtle.sign('HMAC', await receiptKey(secret), new TextEncoder().encode(payload));
  return `${payload}.${Array.from(new Uint8Array(signature), byte => byte.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * @param {string} secret
 * @param {unknown} receipt
 * @returns {Promise<Identity | null>}
 */
async function verifyReceipt(secret, receipt) {
  if (typeof receipt !== 'string' || receipt.length > 1024) return null;
  const [payload, signature, extra] = receipt.split('.');
  if (extra !== undefined || !payload || !signature || !/^[a-f0-9]{64}$/.test(signature)) return null;
  const bytes = Uint8Array.from(signature.match(/../g) ?? [], value => Number.parseInt(value, 16));
  if (!await crypto.subtle.verify('HMAC', await receiptKey(secret), bytes, new TextEncoder().encode(payload))) return null;
  try {
    const identity = JSON.parse(atob(payload));
    if (!Number.isSafeInteger(identity.chat_id) || !SESSION_PATTERN.test(identity.session) ||
        !Number.isSafeInteger(identity.expires) || identity.expires <= Math.floor(Date.now() / 1000)) return null;
    return identity;
  } catch { return null; }
}

/**
 * @param {unknown} data
 * @param {number} status
 * @param {Record<string, string>} [headers]
 */
function json(data, status, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
  });
}
