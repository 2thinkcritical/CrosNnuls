import { expect, test } from '@playwright/test';

const status = page => page.getByRole('status');
const MARK = { X: 'крестик', O: 'нолик', empty: 'пусто' };
const square = (page, row, column, mark = 'empty') =>
  page.getByRole('button', { name: `Ряд ${row}, столбец ${column}: ${MARK[mark]}`, exact: true });

async function openGame(page) {
  // A low random draw makes the fallible opponent always choose the first empty square.
  await page.addInitScript(() => { Math.random = () => 0.05; });
  await page.goto('/');
}

async function winRound(page) {
  await square(page, 1, 1).click();
  await expect(square(page, 1, 2, 'O')).toBeVisible();
  await square(page, 2, 2).click();
  await expect(square(page, 1, 3, 'O')).toBeVisible();
  await square(page, 3, 3).click();
}

test.beforeEach(async ({ page }, testInfo) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text());
  });
  testInfo.errorsFromPage = errors;
});

// eslint-disable-next-line no-empty-pattern -- Playwright passes fixtures as the first argument.
test.afterEach(({}, testInfo) => {
  expect(testInfo.errorsFromPage).toEqual([]);
});

test('a complete pointer round respects turn order, occupied squares and a terminal win', async ({ page }) => {
  await openGame(page);
  await expect(status(page)).toHaveText('Ваш ход');
  await square(page, 1, 1).click();
  await square(page, 2, 3).click({ force: true }); // Attempt a second move during the computer turn.
  await expect(square(page, 1, 2, 'O')).toBeVisible();
  await expect(square(page, 2, 3)).toBeVisible();
  await square(page, 1, 1, 'X').click({ force: true });
  await expect(square(page, 1, 1, 'X')).toBeVisible();

  await square(page, 2, 2).click();
  await expect(square(page, 1, 3, 'O')).toBeVisible();
  await square(page, 3, 3).click();

  await expect(status(page)).toHaveText('Вы победили!');
  await expect(page.locator('#round-detail')).toContainText('DEMO-WIN');
  await square(page, 3, 1).click({ force: true });
  await expect(square(page, 3, 1)).toBeVisible();
  await expect(page.locator('#round-detail')).not.toContainText('sent');
});

test('quick reset cancels the pending computer move and any earlier rotation', async ({ page }) => {
  await page.clock.install();
  await openGame(page);
  await square(page, 1, 1).click();
  await expect(status(page)).toHaveText('Компьютер думает…');
  await page.getByRole('button', { name: 'Новая игра' }).click();
  await page.clock.runFor(100);
  await page.getByRole('button', { name: 'Новая игра' }).click();
  await page.clock.runFor(800);

  await expect(page.getByRole('button', { name: /столбец \d: пусто/ })).toHaveCount(9);
  await expect(status(page)).toHaveText('Ваш ход');
  await square(page, 2, 2).click();
  await page.clock.runFor(800);
  await expect(square(page, 2, 2, 'X')).toBeVisible();
  await expect(square(page, 1, 1, 'O')).toBeVisible();
});

test('keyboard enters the grid once, navigates the cells, and activates using Enter and Space', async ({ page }) => {
  await openGame(page);
  await page.keyboard.press('Tab');
  await expect(square(page, 1, 1)).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowDown');
  await expect(square(page, 2, 2)).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(square(page, 1, 1, 'O')).toBeVisible();
  await expect(square(page, 2, 2, 'X')).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Space');
  await expect(square(page, 3, 2, 'X')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Новая игра' })).toBeFocused();
});

test('short screens keep the complete board and controls in the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 740, height: 360 });
  await openGame(page);
  for (const selector of ['h1', '#game-canvas', '#status-text', '#game-btn', '#sound-btn']) {
    await expect(page.locator(selector)).toBeInViewport({ ratio: 1 });
  }
});

test.describe('narrow touch layouts', () => {
  test.use({
    viewport: { width: 320, height: 568 },
    deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  });

  test('high-DPI touch screens fit the board and map taps to the correct square', async ({ page }) => {
    await openGame(page);
    const canvas = page.locator('#game-canvas');
    await expect(canvas).toBeInViewport({ ratio: 1 });
    await expect(page.getByRole('button', { name: 'Новая игра' })).toBeInViewport({ ratio: 1 });
    const rect = await canvas.boundingBox();
    expect(Math.abs(await canvas.evaluate(element => element.width) - rect.width * 2)).toBeLessThanOrEqual(1);
    await page.touchscreen.tap(rect.x + rect.width * 0.391, rect.y + rect.height * 0.57);
    await expect(square(page, 2, 2, 'X')).toBeVisible();
    await expect(square(page, 1, 1, 'O')).toBeVisible();
  });

  test('a 320 × 400 screen keeps the board and controls in view', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 400 });
    await openGame(page);
    for (const selector of ['h1', '#game-canvas', '#status-text', '#game-btn', '#sound-btn', '#board-help']) {
      await expect(page.locator(selector)).toBeInViewport({ ratio: 1 });
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  });
});

test('reduced motion draws the move immediately and keeps the reset board still', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.clock.install();
  await openGame(page);
  const canvas = page.locator('#game-canvas');
  const pixels = () => canvas.evaluate(element => element.toDataURL());
  await square(page, 1, 1).click();
  const firstFrame = await pixels();
  await page.clock.runFor(250); // Between the player move and the computer response.
  expect(await pixels()).toBe(firstFrame);

  await page.getByRole('button', { name: 'Новая игра' }).click();
  const resetFrame = await pixels();
  await page.clock.runFor(250);
  expect(await pixels()).toBe(resetFrame);
  await square(page, 2, 2).click();
  await expect(square(page, 2, 2, 'X')).toBeVisible();
});

async function configureTelegram(page, config) {
  await page.route('**/config.js', route => route.fulfill({
    contentType: 'application/javascript',
    body: `window.TICTACTOE_CONFIG = ${JSON.stringify(config)};`,
  }));
}

test('incomplete Telegram configuration leaves the standalone game playable', async ({ page }) => {
  await configureTelegram(page, { WORKER_URL: 'https://adapter.test' });
  await openGame(page);
  await expect(page.getByRole('dialog')).toBeHidden();
  await square(page, 1, 1).click();
  await expect(square(page, 1, 1, 'X')).toBeVisible();
});

test('Telegram connection uses a signed receipt and reports a failed delivery', async ({ page }) => {
  await configureTelegram(page, { WORKER_URL: 'https://adapter.test', BOT_USERNAME: 'demo_bot' });
  await page.addInitScript(() => { window.open = url => { window.openedBot = url; }; });
  let session;
  const resultRequests = [];
  await page.route('https://adapter.test/check?*', route => {
    session = new URL(route.request().url()).searchParams.get('session');
    return route.fulfill({ json: { chat_id: 42, receipt: 'signed-demo-receipt' } });
  });
  await page.route('https://adapter.test/send', route => {
    resultRequests.push(route.request().postDataJSON());
    return route.fulfill({ json: { ok: false } });
  });
  await openGame(page);
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Подключить Telegram' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  expect(session).toMatch(/^[a-f0-9]{32}$/);
  expect(await page.evaluate(() => window.openedBot)).toBe(`https://t.me/demo_bot?start=${session}`);
  await winRound(page);
  await expect(page.locator('#round-detail')).toContainText('не удалось отправить в Telegram');
  expect(resultRequests).toEqual([{ receipt: 'signed-demo-receipt', result: 'win' }]);
});

test('a late Telegram delivery cannot write a result into a fresh round', async ({ page }) => {
  await configureTelegram(page, { WORKER_URL: 'https://adapter.test', BOT_USERNAME: 'demo_bot' });
  await page.addInitScript(() => { window.open = () => {}; });
  await page.route('https://adapter.test/check?*', route =>
    route.fulfill({ json: { chat_id: 42, receipt: 'signed-demo-receipt' } }));
  let respond;
  await page.route('https://adapter.test/send', route => {
    respond = () => route.fulfill({ json: { ok: true } });
  });
  await openGame(page);
  await page.getByRole('button', { name: 'Подключить Telegram' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await winRound(page);
  await expect.poll(() => Boolean(respond)).toBe(true);

  await page.getByRole('button', { name: 'Новая игра' }).click();
  const response = page.waitForResponse('https://adapter.test/send');
  await respond();
  await (await response).finished();
  await expect(status(page)).toHaveText('Ваш ход');
  await expect(page.locator('#round-detail')).toBeEmpty();
});

test('the player can dismiss the optional dialog with Escape and play immediately', async ({ page }) => {
  await configureTelegram(page, { WORKER_URL: 'https://adapter.test', BOT_USERNAME: 'demo_bot' });
  await openGame(page);
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(square(page, 1, 1)).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(square(page, 1, 1, 'X')).toBeVisible();
});

test('sound is opt-in and can be muted again using the same control', async ({ page }) => {
  await openGame(page);
  const sound = page.getByRole('button', { name: 'Звук' });
  await expect(sound).toHaveAttribute('aria-pressed', 'false');
  await sound.click();
  await expect(sound).toHaveAttribute('aria-pressed', 'true');
  await sound.click();
  await expect(sound).toHaveAttribute('aria-pressed', 'false');
});

test('the live region identifies the computer move', async ({ page }) => {
  await openGame(page);
  await square(page, 1, 1).click();
  await expect(status(page)).toContainText('Компьютер: ряд 1, столбец 2');
  await expect(status(page)).toContainText('Ваш ход');
});

test('an expired Telegram receipt can reconnect without reloading', async ({ page }, testInfo) => {
  await configureTelegram(page, { WORKER_URL: 'https://adapter.test', BOT_USERNAME: 'demo_bot' });
  await page.addInitScript(() => { window.open = () => {}; });
  let checks = 0;
  const receipts = [];
  await page.route('https://adapter.test/check?*', route => {
    checks++;
    return route.fulfill({ json: { chat_id: 42, receipt: checks === 1 ? 'expired-receipt' : 'fresh-receipt' } });
  });
  await page.route('https://adapter.test/send', route => {
    receipts.push(route.request().postDataJSON().receipt);
    return route.fulfill({ status: receipts.length === 1 ? 401 : 200, json: receipts.length === 1 ? { error: 'expired' } : { ok: true } });
  });
  await openGame(page);
  await page.getByRole('button', { name: 'Подключить Telegram' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await winRound(page);
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.locator('#telegram-feedback')).toContainText('истекла');
  await page.getByRole('button', { name: 'Подключить Telegram' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await page.getByRole('button', { name: 'Новая игра' }).click();
  await winRound(page);
  await expect(page.locator('#round-detail')).toHaveText('Результат отправлен в Telegram.');
  expect(receipts).toEqual(['expired-receipt', 'fresh-receipt']);
  // Chromium reports the deliberately mocked 401 as a resource error.
  const expected401 = testInfo.errorsFromPage.filter(text => text.includes('401 (Unauthorized)'));
  expect(expected401.length).toBeLessThanOrEqual(1);
  testInfo.errorsFromPage.splice(0, testInfo.errorsFromPage.length,
    ...testInfo.errorsFromPage.filter(text => !text.includes('401 (Unauthorized)')));
});
