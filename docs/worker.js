/**
 * Cloudflare Worker для проксирования Telegram API
 * 
 * Деплой:
 * 1. Зайдите на https://workers.cloudflare.com
 * 2. Создайте новый Worker
 * 3. Вставьте этот код
 * 4. В Settings -> Variables добавьте:
 *    - BOT_TOKEN: ваш токен бота
 *    - ALLOWED_ORIGINS: https://yourusername.github.io (через запятую если несколько)
 * 5. Сохраните и задеплойте
 * 6. Скопируйте URL воркера в game.js -> CONFIG.WORKER_URL
 */

// Эти переменные задаются в настройках Cloudflare Worker
// BOT_TOKEN - токен вашего Telegram бота
// ALLOWED_ORIGINS - разрешённые домены (например: https://username.github.io)

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': checkOrigin(origin, env.ALLOWED_ORIGINS) ? origin : '',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Routes
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

function checkOrigin(origin, allowedOrigins) {
  if (!allowedOrigins) return true; // Если не настроено - разрешаем всё (для разработки)
  const allowed = allowedOrigins.split(',').map(s => s.trim());
  return allowed.includes(origin) || allowed.includes('*');
}

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
    const username = url.searchParams.get('username');

    if (!username) {
      return jsonResponse({ error: 'Missing username' }, 400, corsHeaders);
    }

    // Получаем последние обновления
    const response = await fetch(
      `https://api.telegram.org/bot${env.BOT_TOKEN}/getUpdates?timeout=1&allowed_updates=["message"]`
    );

    const data = await response.json();

    if (!data.ok) {
      return jsonResponse({ error: `Telegram Error: ${data.description}`, debug: data }, 200, corsHeaders);
    }

    // Ищем /start с нужным username
    for (const update of (data.result || []).reverse()) {
      const message = update.message || {};
      const text = message.text || '';

      if (text.startsWith('/start')) {
        const parts = text.split(' ');
        if (parts.length > 1 && parts[1].toLowerCase() === username.toLowerCase()) {
          // Строгая проверка: ник отправителя должен совпадать с введенным
          const senderUsername = message.from?.username;

          if (!senderUsername || senderUsername.toLowerCase() !== username.toLowerCase()) {
            // Подтверждаем обновление, чтобы не зацикливаться
            await fetch(
              `https://api.telegram.org/bot${env.BOT_TOKEN}/getUpdates?offset=${update.update_id + 1}`
            );

            return jsonResponse({
              error: 'username_mismatch',
              expected: username,
              actual: senderUsername
            }, 400, corsHeaders);
          }

          const chatId = message.chat?.id;

          if (chatId) {
            // Подтверждаем обновление
            await fetch(
              `https://api.telegram.org/bot${env.BOT_TOKEN}/getUpdates?offset=${update.update_id + 1}`
            );
            try {
              await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  chat_id: chatId,
                  text: `Готово! Вы успешно привязали аккаунт.\nПерейдите обратно в игру`,
                  parse_mode: 'HTML',
                }),
              });
            } catch (err) {
              console.error('Failed to send confirmation message:', err);
            }

            return jsonResponse({ chat_id: chatId }, 200, corsHeaders);
          }
        }
      }
    }

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

