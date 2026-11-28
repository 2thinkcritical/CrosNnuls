import { expect, test } from '@playwright/test';

const status = page => page.getByRole('status');
const square = (page, row, column, mark = 'empty') =>
  page.getByRole('button', { name: `Row ${row}, column ${column}: ${mark}`, exact: true });

async function openGame(page) {
  // A low random draw makes the fallible opponent always choose the first empty square.
  await page.addInitScript(() => { Math.random = () => 0.05; });
  await page.goto('/');
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
  await expect(status(page)).toHaveText('Your turn');
  await square(page, 1, 1).click();
  await square(page, 2, 3).click({ force: true }); // Attempt a second move during the computer turn.
  await expect(square(page, 1, 2, 'O')).toBeVisible();
  await expect(square(page, 2, 3)).toBeVisible();
  await square(page, 1, 1, 'X').click({ force: true });
  await expect(square(page, 1, 1, 'X')).toBeVisible();

  await square(page, 2, 2).click();
  await expect(square(page, 1, 3, 'O')).toBeVisible();
  await square(page, 3, 3).click();

  await expect(status(page)).toHaveText('You win!');
  await expect(page.locator('#score-x')).toHaveText('1');
  await expect(page.locator('#score-o')).toHaveText('0');
  await square(page, 3, 1).click({ force: true });
  await expect(square(page, 3, 1)).toBeVisible();
});

test('quick reset cancels the pending computer move and any earlier rotation', async ({ page }) => {
  await page.clock.install();
  await openGame(page);
  await square(page, 1, 1).click();
  await expect(status(page)).toHaveText('Computer is thinking…');
  await page.getByRole('button', { name: 'New game' }).click();
  await page.clock.runFor(100);
  await page.getByRole('button', { name: 'New game' }).click();
  await page.clock.runFor(800);

  await expect(page.getByRole('button', { name: /column \d: empty/ })).toHaveCount(9);
  await expect(status(page)).toHaveText('Your turn');
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
  await expect(page.getByRole('button', { name: 'New game' })).toBeFocused();
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
    await expect(page.getByRole('button', { name: 'New game' })).toBeInViewport({ ratio: 1 });
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

  await page.getByRole('button', { name: 'New game' }).click();
  const resetFrame = await pixels();
  await page.clock.runFor(250);
  expect(await pixels()).toBe(resetFrame);
  await square(page, 2, 2).click();
  await expect(square(page, 2, 2, 'X')).toBeVisible();
});

test('sound is opt-in and can be muted again using the same control', async ({ page }) => {
  await openGame(page);
  const sound = page.getByRole('button', { name: 'Sound' });
  await expect(sound).toHaveAttribute('aria-pressed', 'false');
  await sound.click();
  await expect(sound).toHaveAttribute('aria-pressed', 'true');
  await sound.click();
  await expect(sound).toHaveAttribute('aria-pressed', 'false');
});

test('the live region identifies the computer move', async ({ page }) => {
  await openGame(page);
  await square(page, 1, 1).click();
  await expect(status(page)).toContainText('Computer played row 1, column 2');
  await expect(status(page)).toContainText('Your turn');
});
