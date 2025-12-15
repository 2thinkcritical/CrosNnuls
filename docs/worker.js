/**
 * Cloudflare Worker для проксирования Telegram API
 *
 * Деплой:
 * 1. Зайдите на https://workers.cloudflare.com
 * 2. Создайте новый Worker
 * 3. Вставьте этот код
 * 4. В Settings -> Variables добавьте:
 *    - BOT_TOKEN: ваш токен бота
 * 5. Сохраните и задеплойте
 * 6. Скопируйте URL воркера в game.js -> CONFIG.WORKER_URL
 */

// BOT_TOKEN - токен вашего Telegram бота (123456789:AAAA....)

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Простые CORS-заголовки: разрешаем все Origin
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Маршруты
    if (url.pathname === '/send' && request.method === 'POST') {
      return handleSend(request, env, corsHeaders);
    }

    if (url.pathname === '/check' && request.method === 'GET') {
      return handleCheck(url, env, corsHeaders);
    }

    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  },
};

/**
 * POST /send
 * Body: { chat_id: number, text: string }
 * Отправляет сообщение в Telegram
 */
async function handleSend(request, env, corsHeaders) {
  try {
    const { chat_id, text } = await request.json();

    if (!chat_id || !text) {
      return jsonResponse({ error: 'Missing chat_id or text' }, 400, corsHeaders);
    }

    if (!env.BOT_TOKEN) {
      return jsonResponse({ error: 'Missing BOT_TOKEN in environment' }, 500, corsHeaders);
    }

    const response = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id,
        text,
        parse_mode: 'HTML',
      }),
    });

    const data = await response.json();
    return jsonResponse(data, response.ok ? 200 : 400, corsHeaders);
  } catch (e) {
    return jsonResponse({ error: e.message }, 500, corsHeaders);
  }
}

/**
 * GET /check?username=xxx
 * Проверяет, подписался ли пользователь на бота
 * Возвращает { chat_id: number | null }
 */
async function handleCheck(url, env, corsHeaders) {
  try {
    const usernameRaw = url.searchParams.get('username') || '';
    const username = usernameRaw.trim();

    if (!username) {
      return jsonResponse({ error: 'Missing username' }, 400, corsHeaders);
    }

    if (!env.BOT_TOKEN) {
      return jsonResponse({ error: 'Missing BOT_TOKEN in environment' }, 500, corsHeaders);
    }

    // Получаем последние обновления
    const response = await fetch(
      `https://api.telegram.org/bot${env.BOT_TOKEN}/getUpdates?timeout=1&allowed_updates=["message"]`
    );

    const data = await response.json();

    if (!data.ok) {
      return jsonResponse(
        {
          error: `Telegram Error: ${data.description}`,
          debug: data,
        },
        200,
        corsHeaders
      );
    }

    // Ищем /start с нужным username
    for (const update of (data.result || []).reverse()) {
      const message = update.message || {};
      const text = message.text || '';

      if (!text.startsWith('/start')) continue;

      const parts = text.split(' ');
      const payload = (parts[1] || '').trim().toLowerCase();
      const expected = username.toLowerCase();

      // Требуем совпадения payload (/start <username>)
      if (!payload || payload !== expected) continue;

      // Строгая проверка ника отправителя
      const senderUsername = (message.from?.username || '').trim().toLowerCase();
      if (!senderUsername || senderUsername !== expected) {
        // Подтверждаем обновление, чтобы не зацикливаться
        await fetch(
          `https://api.telegram.org/bot${env.BOT_TOKEN}/getUpdates?offset=${update.update_id + 1}`
        );

        return jsonResponse(
          {
            error: 'username_mismatch',
            expected: username,
            actual: message.from?.username || null,
          },
          400,
          corsHeaders
        );
      }

      const chatId = message.chat?.id;
      if (chatId) {
        // Подтверждаем обновление, чтобы не зацикливаться
        await fetch(
          `https://api.telegram.org/bot${env.BOT_TOKEN}/getUpdates?offset=${update.update_id + 1}`
        );

        return jsonResponse({ chat_id: chatId }, 200, corsHeaders);
      }
    }

    // Не нашли нужный /start
    return jsonResponse({ chat_id: null }, 200, corsHeaders);
  } catch (e) {
    return jsonResponse({ error: e.message, chat_id: null }, 500, corsHeaders);
  }
}

function jsonResponse(data, status, headers) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
}
