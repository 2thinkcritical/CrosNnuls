import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';

const source = await readFile(new URL('../docs/game.js', import.meta.url), 'utf8');
function game(config = {}) {
  const elements = new Map();
  const timers = [];
  let ready;
  const drawing = new Proxy({}, { get: () => () => {} });
  function element(id) {
    if (!elements.has(id)) elements.set(id, {
      textContent: '', style: {}, disabled: false,
      classList: { add() {}, remove() {} },
      addEventListener() {}, focus() {},
      width: 420, height: 380,
      getContext: () => drawing,
      getBoundingClientRect: () => ({ left: 0, top: 0 }),
    });
    return elements.get(id);
  }
  const context = vm.createContext({
    console: { log() {}, warn() {}, error() {} }, crypto: webcrypto, AbortSignal,
    window: { TICTACTOE_CONFIG: config, innerWidth: 1280, innerHeight: 800, addEventListener() {}, open() {} },
    document: { getElementById: element, addEventListener: (_, callback) => { ready = callback; }, body: { addEventListener() {} } },
    Image: class {}, Audio: class { paused = true; play() { return Promise.resolve(); } },
    setTimeout: (callback, delay) => { timers.push({ callback, delay }); },
    fetch: async () => { throw new Error('unexpected network request'); },
  });
  vm.runInContext(source, context);
  ready();
  return { context, element, run: code => vm.runInContext(code, context), timers };
}

test('the default page starts a playable demo without Telegram', () => {
  const app = game();
  for (const timer of app.timers.filter(timer => timer.delay === 300)) timer.callback();
  assert.equal(app.run('state.gameBlocked'), false);
  assert.equal(app.element('game-btn').textContent, 'Play again');
});
test('incomplete Telegram configuration still starts the demo', () => {
  const app = game({ WORKER_URL: 'https://example.invalid' });
  assert.equal(app.run('state.gameBlocked'), false);
});
test('configured Telegram mode waits for a connection', () => {
  const app = game({ WORKER_URL: 'https://example.invalid', BOT_USERNAME: 'example_bot' });
  assert.equal(app.run('state.gameBlocked'), true);
});
test('a demo win never claims a Telegram message was delivered', async () => {
  const app = game();
  await app.run('handleWin()');
  assert.equal(app.element('game-btn').textContent, 'Demo code: DEMO-WIN · Play again');
});
test('a failed Telegram send is visible to the player', async () => {
  const app = game({ WORKER_URL: 'https://example.invalid', BOT_USERNAME: 'example_bot' });
  app.run("state.telegramReceipt = 'test'; state.telegramChatId = 42;");
  await app.run('handleWin()');
  assert.match(app.element('game-btn').textContent, /could not send/);
});
test('detects a win, a draw, and an unfinished board', () => {
  const app = game();
  assert.equal(app.run("checkWinner(['X','X','X','','O','','O','',''])"), 'X');
  assert.equal(app.run("checkWinner(['X','O','X','X','O','O','O','X','X'])"), 'draw');
  assert.equal(app.run("checkWinner(['X','','','','O','','','',''])"), null);
});
test('computer moves use an empty square without mutating the input', () => {
  const app = game();
  app.run("globalThis.board = ['X','O','','','','','','','']");
  for (let i = 0; i < 50; i++) {
    assert.ok([2, 3, 4, 5, 6, 7, 8].includes(app.run('bestMoveForO(board)')));
    assert.equal(app.run('board.join()'), 'X,O,,,,,,,');
  }
});

test('reset cancels the previous symbol animation and delayed computer move', () => {
  const app = game();
  app.run("const point = projectPoint(-100, 100, 150, getCubeTransform()); onClick({clientX: point[0], clientY: point[1]});");
  assert.equal(app.run("state.board[0]"), 'X');
  const pending = [...app.timers];
  assert.ok(pending.some(timer => timer.delay === 450));
  app.run('reset(false)');
  for (const timer of pending) timer.callback();
  assert.equal(app.run('state.board.every(cell => cell === "")'), true);
  assert.equal(app.run('state.computerThinking'), false);
});

test('a previous round cannot report a win after reset', () => {
  const app = game();
  app.run("state.board = ['X','X','X','O','O','','','','']; afterMove();");
  const pending = [...app.timers];
  app.run('reset(false)');
  for (const timer of pending) timer.callback();
  assert.equal(app.element('status-text').textContent, 'Your turn');
  assert.equal(app.element('game-btn').textContent, 'Play again');
});
