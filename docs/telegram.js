const CHECK_INTERVAL = 2_000;
const MAX_CHECKS = 31;
const REQUEST_TIMEOUT = 10_000;

function waitForNextCheck(signal) {
  return new Promise(resolve => {
    function finish() {
      clearTimeout(timer);
      signal.removeEventListener('abort', finish);
      resolve();
    }
    const timer = setTimeout(finish, CHECK_INTERVAL);
    signal.addEventListener('abort', finish, { once: true });
    if (signal.aborted) finish();
  });
}

export function createTelegramConnection(config, dialog, onClose) {
  const worker = config?.WORKER_URL?.trim().replace(/\/+$/, '');
  const bot = config?.BOT_USERNAME?.trim();
  let receipt = null;
  if (!worker || !bot) return null;

  const connectButton = dialog.querySelector('#telegram-connect');
  const demoButton = dialog.querySelector('#telegram-demo');
  const feedback = dialog.querySelector('#telegram-feedback');
  let connection;

  function finish() {
    connection?.abort();
    onClose();
  }

  dialog.addEventListener('close', finish);
  demoButton.addEventListener('click', () => dialog.close());
  connectButton.addEventListener('click', async () => {
    connection = new AbortController();
    const { signal } = connection;
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    const session = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');

    connectButton.disabled = true;
    feedback.textContent = 'Press Start in Telegram, then return here.';
    window.open(`https://t.me/${encodeURIComponent(bot)}?start=${session}`, '_blank', 'noopener,noreferrer');
    demoButton.focus();

    for (let attempt = 0; attempt < MAX_CHECKS && !signal.aborted; attempt++) {
      try {
        const response = await fetch(`${worker}/check?session=${session}`, {
          signal: AbortSignal.any([signal, AbortSignal.timeout(REQUEST_TIMEOUT)]),
        });
        const data = await response.json();
        if (signal.aborted || !dialog.open) return;
        if (!response.ok || data.error) {
          feedback.textContent = 'Telegram is unavailable. Try again or continue in demo mode.';
          connectButton.disabled = false;
          return;
        }
        if (data.chat_id && data.receipt) {
          receipt = data.receipt;
          dialog.close();
          return;
        }
      } catch {
        if (signal.aborted || !dialog.open) return;
      }
      if (attempt + 1 < MAX_CHECKS) await waitForNextCheck(signal);
    }
    if (signal.aborted || !dialog.open) return;
    feedback.textContent = 'Connection timed out. Try again or continue in demo mode.';
    connectButton.disabled = false;
  });

  dialog.showModal();
  return {
    get connected() { return receipt !== null; },
    async send(result) {
      if (!receipt) return false;
      try {
        const response = await fetch(`${worker}/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ receipt, result }),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT),
        });
        const data = await response.json();
        return response.ok && data.ok === true;
      } catch {
        return false;
      }
    },
  };
}
