# Tic-Tac-Toe

A space-themed browser game drawn with the Canvas 2D API. Play **X** against a deliberately fallible computer opponent on a board presented as a rotating cube.

The game runs as a static site. Telegram is an optional integration for demo result messages; no account, API key, or backend is required to play locally.

## Run locally

Requires Python 3 for the static file server. There is no frontend build step.

```sh
git clone https://github.com/2thinkcritical/CrosNnuls.git
cd CrosNnuls
python3 -m http.server 8080 --bind 127.0.0.1 --directory docs
```

Open **http://127.0.0.1:8080**. Click an empty square to place X; the computer responds with O. Use **Play again** to reset the board. Music can be toggled with the sound button and may require a user gesture before the browser allows playback.

Winning displays `DEMO-WIN`, a demonstration code with **no monetary or redemption value**.

## What the project demonstrates

- Projecting a 3D cube onto a 2D canvas, including polygon-based pointer hit testing.
- Animating symbols, cube rotation, and win feedback without a rendering framework.
- Keeping turn state, terminal states, and delayed computer moves coordinated.
- Connecting a static frontend to a separately deployed Telegram adapter without exposing bot credentials.
- Testing the game state and HTTP boundary with Node's built-in test runner.

The computer uses a heuristic policy with intentional random mistakes. It is designed to be beatable and does not use minimax or machine learning.

## Structure

| Path | Responsibility |
| --- | --- |
| `docs/index.html` | Page structure, game canvas, and optional connection dialog |
| `docs/game.js` | Rendering, input handling, animations, and game state |
| `docs/config.js` | Public browser settings; empty values select standalone mode |
| `docs/styles.css` | Responsive layout and visual styling |
| `docs/worker.js` | Optional Telegram HTTP adapter |
| `wrangler.toml` | Worker entry point and local origin configuration |
| `tests/` | Game-state and Worker regression tests |
| `generate_sound.py` | Standard-library utility for generating the click sound |

## Verify

Requires **Node.js 22.12+**. Tests and syntax checks do not need npm dependencies, credentials, or live Telegram requests.

```sh
npm test
npm run check
```

To check the Worker bundle using the pinned development tool:

```sh
npm ci
npm run worker:check
```

CI runs the tests, JavaScript syntax checks, and Worker bundle validation on pushes and pull requests. External HTTP responses are replaced with fixtures in tests; a passing suite does not claim a live Telegram deployment was verified.

## Optional Telegram integration

Leave `docs/config.js` unchanged for standalone play. To connect your own bot, follow [the deployment guide](DEPLOY.md). Bot credentials are stored in Worker secrets or a local, ignored `.dev.vars` file, never in browser JavaScript.

```text
Browser ── /check?session=<random ID> ──► Worker ──► Telegram getUpdates
        ◄── short-lived signed receipt ──┘
Browser ── /send {receipt, result} ─────► Worker ──► fixed result message
```

The Worker accepts a private chat only after receiving the matching `/start` payload. Result messages require a signed receipt that expires after ten minutes. Callers cannot select arbitrary destination chats or supply message text.

## Scope and limitations

- This is a portfolio game and integration prototype. Results are determined in the browser and are not proof of a legitimate win. Demo codes are not a reward system.
- Telegram polling reads at most the earliest 100 unconfirmed updates and does not acknowledge them. Updates can be repeated, stale entries can prevent discovery of newer ones, and a webhook or another polling consumer conflicts with this adapter. Use a dedicated, low-traffic demo bot. A production integration needs a webhook, durable session storage, expiry, and rate limits.
- Signed receipts can be replayed until expiry. An unconfirmed `/start` update can issue fresh receipts until it leaves Telegram’s pending queue. Origin filtering limits browser access; CORS is not authentication or abuse prevention.
- The game board currently supports pointer input. Full keyboard and screen-reader gameplay, reduced-motion behavior, and high-DPI rendering remain future work.
- Background art and audio are included in `docs/`. Their provenance and redistribution terms have not been established in this repository. No repository-wide license is declared.

Credential exposure should be handled privately with the owner: revoke the affected token through BotFather and update the Worker secret. Removing a token from a current file does not remove it from Git history.
