# Canvas Tic-Tac-Toe

[![CI](https://github.com/2thinkcritical/CrosNnuls/actions/workflows/ci.yml/badge.svg)](https://github.com/2thinkcritical/CrosNnuls/actions/workflows/ci.yml) [![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)

**[Play the live demo](https://2thinkcritical.github.io/CrosNnuls/)**

Play X against a beatable computer on a rotating cube drawn with the Canvas 2D API. The static game runs without an account, backend, or build step.

![A round of Canvas Tic-Tac-Toe in progress, with pink X and cyan O on the cube's front face](docs/preview.png)

## Play locally

Requires Python 3 for the static file server.

```sh
git clone https://github.com/2thinkcritical/CrosNnuls.git
cd CrosNnuls
python3 -m http.server 8080 --bind 127.0.0.1 --directory docs
```

Open [the local game](http://127.0.0.1:8080). Click or tap an empty square, or Tab to the board and use the arrow keys to move between cells. Enter and Space place your X. **Play again** starts a new round. The **Sound** toggle enables a short synthesized click. The game follows your system's reduced-motion setting.

A win shows `DEMO-WIN`, a demonstration code with no redemption value. The opponent checks for wins and blocks but sometimes deliberately chooses another move.

## How it works

| Path | Responsibility |
| --- | --- |
| `docs/game.js` | Board controls, status announcements, turn scheduling, and resets |
| `docs/rules.js` | Pure round transitions, winning lines, and the computer opponent |
| `docs/geometry.js` | 3D rotation, 2D projection, and the matching transform for the HTML grid |
| `docs/scene.js` | High-DPI Canvas rendering, animation, and the procedural starfield |
| `docs/audio.js` | Opt-in Web Audio tone synthesis |
| `docs/telegram.js` | Optional connection dialog, session polling, and result delivery |
| `docs/config.js` | Public Telegram settings, blank by default |
| `docs/dom.js` | Typed lookup of required elements |
| `worker/index.js` | Optional Cloudflare Worker for the Telegram Bot API (not published with the site) |

The front face is drawn in Canvas. An HTML grid of buttons follows the same projection, so pointer and keyboard input use the same nine targets. The stars and sound are generated in the browser from code in this repository.

## Verify

Requires Node.js 22.12+ and Python 3. The browser suite launches an isolated headless Chromium against the local static site.

```sh
npm ci
npx playwright install --only-shell chromium
npm run lint
npm run typecheck
npm test
npm run worker:check
npm run test:browser
```

The code is plain ES modules with no build step. It is type-checked in strict mode by TypeScript through JSDoc annotations (`checkJs`), and linted with ESLint. The Node suite checks round rules, projection alignment, and the Worker HTTP contract. The Playwright suite checks a legal round, rapid resets, keyboard navigation, touch, high-DPI rendering, short viewports, reduced motion, and the optional Telegram flow with network fixtures. CI runs both suites and validates the Worker bundle on pushes and pull requests. The test run uses no bot token and sends no Telegram messages.

## Optional Telegram integration

Follow [the deployment guide](DEPLOY.md) to connect a bot. Keep the public settings in `docs/config.js` blank for standalone play. Store `BOT_TOKEN` and the receipt-signing `RECEIPT_SECRET` in Worker secrets or an ignored local `.dev.vars` file.

```text
Browser ── /check?session=<random ID> ──► Worker ──► Telegram getUpdates
        ◄── short-lived signed receipt ──┘
Browser ── /send {receipt, result} ─────► Worker ──► fixed result message
```

The Worker matches the `/start` payload in a private chat and issues a signed receipt that expires after ten minutes. The receipt determines the destination chat, and the Worker selects the message from fixed result text.

## Scope and limitations

- Results come from the browser, so the integration is suitable for demo notifications. A game result does not establish that someone won fairly.
- The demo Worker checks at most the earliest 100 pending Telegram updates and leaves them unconfirmed. Older entries can prevent discovery of new ones. Use a dedicated, low-traffic bot without another polling consumer or webhook.
- Signed receipts can be replayed until they expire, and a pending `/start` can issue another receipt. A production integration would need durable sessions, replay protection, rate limiting, and a webhook.
- Automated browser coverage uses Chromium, including mobile emulation.
