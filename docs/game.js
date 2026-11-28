import { createSound } from './audio.js';
import { element } from './dom.js';
import { BOARD_SIZE } from './geometry.js';
import { chooseComputerMove, newRound, placeMark } from './rules.js';
import { createScene } from './scene.js';
import { createSky } from './sky.js';
import { createTelegramConnection } from './telegram.js';

const COMPUTER_DELAY = 450;
const OUTCOME_LABEL = { X: 'Вы победили!', O: 'Победил компьютер', draw: 'Ничья' };
const MARK_LABEL = { X: 'крестик', O: 'нолик' };

/** @typedef {import('./rules.js').Mark} Mark */
/** @typedef {import('./rules.js').Round} Round */

const grid = element('#board', HTMLElement);
const status = element('#status-text', HTMLElement);
const detail = element('#round-detail', HTMLElement);
const reset = element('#game-btn', HTMLButtonElement);
const sound = createSound(element('#sound-btn', HTMLButtonElement));
/** @type {HTMLButtonElement[]} */
const squares = [];
let activeSquare = 0;
let round = newRound();
/** @type {ReturnType<typeof setTimeout> | undefined} */
let computerTimer;
const scene = createScene(element('#game-canvas', HTMLCanvasElement), grid, round);
createSky(element('#bg-canvas', HTMLCanvasElement));
const score = { X: element('#score-x', HTMLElement), O: element('#score-o', HTMLElement) };
const wins = { X: 0, O: 0 };

grid.style.setProperty('--board-size', `${BOARD_SIZE}px`);
for (let row = 0; row < 3; row++) {
  const rowElement = document.createElement('div');
  rowElement.className = 'board-row';
  rowElement.setAttribute('role', 'row');
  grid.append(rowElement);
  for (let column = 0; column < 3; column++) {
    const index = row * 3 + column;
    const cell = document.createElement('div');
    cell.setAttribute('role', 'gridcell');
    rowElement.append(cell);

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'square';
    button.tabIndex = index === 0 ? 0 : -1;
    button.addEventListener('focus', () => setActiveSquare(index));
    button.addEventListener('click', () => playerMove(index));
    cell.append(button);
    squares.push(button);
  }
}

const telegram = createTelegramConnection(
  window.TICTACTOE_CONFIG,
  element('#telegram-dialog', HTMLDialogElement),
  () => squares[activeSquare].focus(),
);

/** @param {number} index */
function setActiveSquare(index) {
  squares[activeSquare].tabIndex = -1;
  squares[index].tabIndex = 0;
  activeSquare = index;
}

grid.addEventListener('keydown', event => {
  const row = Math.floor(activeSquare / 3);
  const column = activeSquare % 3;
  let next = activeSquare;
  switch (event.key) {
    case 'ArrowUp': if (row > 0) next -= 3; break;
    case 'ArrowDown': if (row < 2) next += 3; break;
    case 'ArrowLeft': if (column > 0) next -= 1; break;
    case 'ArrowRight': if (column < 2) next += 1; break;
    default: return;
  }
  event.preventDefault();
  squares[next].focus();
});

/** @param {{ reset?: boolean, rotate?: boolean }} [options] */
function render(options) {
  for (const [index, square] of squares.entries()) {
    const row = Math.floor(index / 3) + 1;
    const column = index % 3 + 1;
    const mark = round.board[index];
    square.setAttribute('aria-label', `Ряд ${row}, столбец ${column}: ${mark ? MARK_LABEL[mark] : 'пусто'}`);
    square.setAttribute('aria-disabled', String(round.turn !== 'X' || Boolean(mark)));
  }

  const result = round.outcome?.result;
  status.dataset.result = result ?? '';
  status.textContent = result ? OUTCOME_LABEL[result]
    : round.turn === 'X' ? 'Ваш ход' : 'Компьютер думает…';
  scene.show(round, options);
}

/** @param {Round} finished a round with an outcome */
async function reportOutcome(finished) {
  if (!finished.outcome) return;
  const { result } = finished.outcome;
  if (result === 'draw') return;
  wins[result] += 1;
  score[result].textContent = String(wins[result]);
  if (result === 'X') detail.textContent = 'Демо-код: DEMO-WIN';
  if (!telegram?.connected) return;

  const delivered = await telegram.send(result === 'X' ? 'win' : 'loss');
  if (round !== finished) return;
  detail.textContent = delivered ? 'Результат отправлен в Telegram.'
    : result === 'X' ? 'Демо-код: DEMO-WIN · не удалось отправить в Telegram.' : 'Не удалось отправить в Telegram.';
}

/**
 * @param {number | null} index
 * @param {Mark} mark
 * @returns {boolean} whether the move was legal
 */
function move(index, mark) {
  if (index === null) return false;
  const next = placeMark(round, index, mark);
  if (round === next) return false;

  round = next;
  render();
  if (mark === 'O') {
    status.textContent = `Компьютер: ряд ${Math.floor(index / 3) + 1}, столбец ${index % 3 + 1}. ${status.textContent}`;
  }
  if (round.outcome) void reportOutcome(round);
  return true;
}

/** @param {number} index */
function playerMove(index) {
  if (!move(index, 'X')) return;
  void sound.click();
  if (round.outcome) return;

  const pendingRound = round;
  computerTimer = setTimeout(() => {
    if (round !== pendingRound) return;
    move(chooseComputerMove(round.board), 'O');
  }, COMPUTER_DELAY);
}

reset.addEventListener('click', () => {
  clearTimeout(computerTimer);
  round = newRound();
  detail.textContent = '';
  setActiveSquare(0);
  void sound.click();
  render({ reset: true, rotate: true });
});

render();
