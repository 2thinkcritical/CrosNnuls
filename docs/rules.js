/** @typedef {'X' | 'O'} Mark */
/** @typedef {Mark | ''} Cell */
/** @typedef {{ result: Mark | 'draw', winningLine: number[] | null }} Outcome */
/** @typedef {{ board: Cell[], turn: Mark | null, outcome: Outcome | null }} Round */

const WINNING_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

/**
 * @param {readonly Cell[]} board
 * @returns {Outcome | null}
 */
export function getOutcome(board) {
  const line = WINNING_LINES.find(([a, b, c]) =>
    board[a] && board[a] === board[b] && board[a] === board[c],
  );
  if (line) return { result: /** @type {Mark} */ (board[line[0]]), winningLine: [...line] };
  if (board.every(Boolean)) return { result: 'draw', winningLine: null };
  return null;
}

/** @returns {Round} */
export function newRound() {
  return { board: Array(9).fill(''), turn: 'X', outcome: null };
}

/**
 * Returns the next round, or the same object when the move is not legal.
 * @param {Round} round
 * @param {number} index
 * @param {Mark} mark
 * @returns {Round}
 */
export function placeMark(round, index, mark) {
  if (round.outcome || round.turn !== mark || !Number.isInteger(index) || round.board[index] !== '') {
    return round;
  }
  const board = [...round.board];
  board[index] = mark;
  const outcome = getOutcome(board);
  return { board, turn: outcome ? null : (mark === 'X' ? 'O' : 'X'), outcome };
}

/**
 * A beatable opponent: it plays randomly 30% of the time, and otherwise wins or
 * blocks when it can, deliberately missing some of those chances.
 * @param {readonly Cell[]} board
 * @param {() => number} [random]
 * @returns {number | null}
 */
export function chooseComputerMove(board, random = Math.random) {
  const available = board.flatMap((mark, index) => mark ? [] : [index]);
  if (!available.length) return null;

  /** @param {number[]} squares */
  const pick = squares => squares[Math.floor(random() * squares.length)];
  if (random() < 0.30) return pick(available);

  const candidate = [...board];
  /** @type {[Mark, number][]} */
  const chances = [['O', 0.40], ['X', 0.50]];
  for (const [mark, chanceOfMissing] of chances) {
    for (const index of available) {
      candidate[index] = mark;
      const completesLine = getOutcome(candidate)?.result === mark;
      candidate[index] = '';
      if (completesLine) {
        if (available.length > 1 && random() < chanceOfMissing) {
          return pick(available.filter(other => other !== index));
        }
        return index;
      }
    }
  }
  return pick(available);
}
