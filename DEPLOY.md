# Deployment

The frontend and Telegram Worker are independent. Deploying the static game alone does not require a Cloudflare account or Telegram bot.

## Static game on GitHub Pages

1. In repository **Settings → Pages**, choose **Deploy from a branch**.
2. Select the branch containing the reviewed changes and the `/docs` directory.
3. Save and use the URL reported by GitHub Pages.

For this repository, the expected project URL is `https://2thinkcritical.github.io/CrosNnuls/`. Use the actual URL reported by GitHub; Pages must first be enabled and the selected branch must contain the changes.

Keep `WORKER_URL` and `BOT_USERNAME` empty in `docs/config.js` to publish a standalone game. No npm build is required for GitHub Pages.

## Optional Worker: local development

Use Node.js 22.12+, Python 3, and a **new, unexposed** token for a dedicated demo bot. Do not reuse a token that has appeared in source control.

```sh
npm ci
cp .dev.vars.example .dev.vars
```

Edit `.dev.vars` locally and set `BOT_TOKEN`. This file is ignored by Git. Start the Worker:

```sh
npm run worker:dev
```

In another terminal, start the frontend:

```sh
python3 -m http.server 8080 --bind 127.0.0.1 --directory docs
```

For local integration testing, set the public settings in `docs/config.js`:

```js
window.TICTACTOE_CONFIG = Object.freeze({
  WORKER_URL: 'http://127.0.0.1:8081',
  BOT_USERNAME: 'your_demo_bot',
});
```

Open `http://127.0.0.1:8080`. Connect Telegram, press **Start** in the bot, then return to the browser. You can always choose **Play without Telegram** instead. Restore blank settings before publishing a standalone demo.

The old Python adapter and `restart.sh` have been retired. Wrangler runs the same Worker code locally and remotely; explicit foreground commands also avoid terminating unrelated processes on occupied ports.

## Optional Worker: deployment

1. In `wrangler.toml`, choose your Worker name and set `ALLOWED_ORIGINS` to the frontend origin. For GitHub Pages this is `https://2thinkcritical.github.io` — **no repository path and no trailing slash**. Multiple exact origins are separated by commas. Do not use `*`.
2. Authenticate your own Cloudflare account and set the bot token as a secret:

   ```sh
   npx wrangler login
   npx wrangler secret put BOT_TOKEN
   ```

   Enter the token only at the secret prompt. Never put it in `wrangler.toml`, `docs/config.js`, a commit, or a shell command saved in history.
3. Validate and deploy:

   ```sh
   npm test
   npm run worker:check
   npx wrangler deploy
   ```

4. Set `WORKER_URL` in `docs/config.js` to the HTTPS URL reported by Wrangler, with no trailing slash. Set `BOT_USERNAME` to your bot's username, without `@`.
5. Publish the frontend changes through your normal review workflow.

No Cloudflare or Telegram configuration is changed by running the tests or dry-run bundle check.

## HTTP contract

All requests require an `Origin` present in `ALLOWED_ORIGINS`; the server rejects missing or unlisted origins. CORS is not an authentication mechanism.

| Request | Input | Success |
| --- | --- | --- |
| `OPTIONS` | Allowed origin | `204` with CORS headers |
| `GET /check?session=…` | Exactly 32 lowercase hexadecimal characters | `{ "chat_id": null }` while pending, or `{ "chat_id": 123, "receipt": "…" }` after a matching private `/start` |
| `POST /send` | JSON `{ "receipt": "…", "result": "win" }` or result `"loss"` | `{ "ok": true }` after Telegram accepts the fixed message |

Errors: `400` invalid input, `401` missing/invalid/expired receipt, `403` unlisted origin, `404` unknown route, `503` missing bot configuration, `502` upstream failure. The adapter does not return bot credentials or raw Telegram exceptions to the browser.

Receipts are signed with HMAC-SHA-256 using the bot secret and expire after ten minutes. Rotating the bot token invalidates existing receipts. After a receipt expires, the connection dialog reopens. Choose Connect Telegram to receive a fresh receipt, or continue without Telegram. No page reload is needed.

## Troubleshooting

- **CORS rejection:** check the exact scheme, host, and port in `ALLOWED_ORIGINS`.
- **Connection remains pending:** use a private chat, press Start through the current session link, and ensure no webhook or other polling consumer is using the demo bot. The adapter only inspects 100 pending updates and intentionally does not advance the global update offset.
- **Message not delivered:** check whether the bot is blocked, the token was rotated, or the receipt expired. The game does not report successful delivery until the Worker confirms it.
- **Port already in use:** choose a different port and update the matching origin/URL. Do not kill unrelated processes.

See [README limitations](README.md#scope-and-limitations) before exposing the optional integration publicly.
