const WINNING_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

export function getOutcome(board) {
  const line = WINNING_LINES.find(([a, b, c]) =>
    board[a] && board[a] === board[b] && board[a] === board[c],
  );
  if (line) return { result: board[line[0]], winningLine: [...line] };
  if (board.every(Boolean)) return { result: 'draw', winningLine: null };
  return null;
}

export function newRound() {
  return { board: Array(9).fill(''), turn: 'X', outcome: null };
}

export function placeMark(round, index, mark) {
  if (round.outcome || round.turn !== mark || !Number.isInteger(index) || round.board[index] !== '') {
    return round;
  }
  const board = [...round.board];
  board[index] = mark;
  const outcome = getOutcome(board);
  return { board, turn: outcome ? null : (mark === 'X' ? 'O' : 'X'), outcome };
}

export function chooseComputerMove(board, random = Math.random) {
  const available = board.flatMap((mark, index) => mark ? [] : [index]);
  if (!available.length) return null;

  const pick = squares => squares[Math.floor(random() * squares.length)];
  if (random() < 0.30) return pick(available);

  const candidate = [...board];
  // Preserve the original opponent's deliberate chances of missing a win or a block.
  for (const [mark, chanceOfMissing] of [['O', 0.40], ['X', 0.50]]) {
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
