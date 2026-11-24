import { createSound } from './audio.js';
import { BOARD_SIZE } from './geometry.js';
import { chooseComputerMove, newRound, placeMark } from './rules.js';
import { createScene, drawStarfield } from './scene.js';
import { createTelegramConnection } from './telegram.js';

const COMPUTER_DELAY = 450;
const OUTCOME_LABEL = { X: 'You win!', O: 'Computer wins', draw: 'Draw!' };

const grid = document.querySelector('#board');
const status = document.querySelector('#status-text');
const detail = document.querySelector('#round-detail');
const reset = document.querySelector('#game-btn');
const sound = createSound(document.querySelector('#sound-btn'));
const squares = [];
let activeSquare = 0;
let round = newRound();
let computerTimer;
const scene = createScene(document.querySelector('#game-canvas'), grid, round);
drawStarfield(document.querySelector('#bg-canvas'));

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
  document.querySelector('#telegram-dialog'),
  () => squares[activeSquare].focus(),
);

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

function render(options) {
  for (const [index, square] of squares.entries()) {
    const row = Math.floor(index / 3) + 1;
    const column = index % 3 + 1;
    const mark = round.board[index];
    square.setAttribute('aria-label', `Row ${row}, column ${column}: ${mark || 'empty'}`);
    square.setAttribute('aria-disabled', String(round.turn !== 'X' || Boolean(mark)));
  }

  const result = round.outcome?.result;
  status.dataset.result = result ?? '';
  status.textContent = result ? OUTCOME_LABEL[result]
    : round.turn === 'X' ? 'Your turn' : 'Computer is thinking…';
  scene.show(round, options);
}

async function reportOutcome(finished) {
  const { result } = finished.outcome;
  if (result === 'draw') return;
  if (result === 'X') detail.textContent = 'Demo code: DEMO-WIN';
  if (!telegram?.connected) return;

  const delivered = await telegram.send(result === 'X' ? 'win' : 'loss');
  if (round !== finished) return;
  detail.textContent = delivered ? 'Result sent to Telegram.'
    : result === 'X' ? 'Demo code: DEMO-WIN · Telegram delivery failed.' : 'Telegram delivery failed.';
}

function move(index, mark) {
  const next = placeMark(round, index, mark);
  if (round === next) return false;

  round = next;
  render();
  if (round.outcome) void reportOutcome(round);
  return true;
}

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
