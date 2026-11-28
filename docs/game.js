import { createSound } from './audio.js';
import { element } from './dom.js';
import { BOARD_SIZE } from './geometry.js';
import { chooseComputerMove, newRound, placeMark } from './rules.js';
import { createScene } from './scene.js';
import { createSky } from './sky.js';

/** @typedef {import('./rules.js').Mark} Mark */

const COMPUTER_DELAY = 450;
const OUTCOME_LABEL = { X: 'You win!', O: 'The computer wins', draw: "It's a draw" };

const grid = element('#board', HTMLElement);
const status = element('#status-text', HTMLElement);
const reset = element('#game-btn', HTMLButtonElement);
const sound = createSound(element('#sound-btn', HTMLButtonElement));
const score = { X: element('#score-x', HTMLElement), O: element('#score-o', HTMLElement) };
const wins = { X: 0, O: 0 };
/** @type {HTMLButtonElement[]} */
const squares = [];
let activeSquare = 0;
let round = newRound();
/** @type {ReturnType<typeof setTimeout> | undefined} */
let computerTimer;
const scene = createScene(element('#game-canvas', HTMLCanvasElement), grid, round);
createSky(element('#bg-canvas', HTMLCanvasElement));

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
    const mark = round.board[index];
    square.setAttribute('aria-label', `Row ${Math.floor(index / 3) + 1}, column ${index % 3 + 1}: ${mark || 'empty'}`);
    square.setAttribute('aria-disabled', String(round.turn !== 'X' || Boolean(mark)));
  }
  const result = round.outcome?.result;
  status.dataset.result = result ?? '';
  status.textContent = result ? OUTCOME_LABEL[result]
    : round.turn === 'X' ? 'Your turn' : 'Computer is thinking…';
  scene.show(round, options);
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
    status.textContent = `Computer played row ${Math.floor(index / 3) + 1}, column ${index % 3 + 1}. ${status.textContent}`;
  }
  const result = round.outcome?.result;
  if (result === 'X' || result === 'O') {
    wins[result] += 1;
    score[result].textContent = String(wins[result]);
  }
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
  setActiveSquare(0);
  void sound.click();
  render({ reset: true, rotate: true });
});

render();
